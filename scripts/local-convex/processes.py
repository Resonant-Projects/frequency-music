"""Bound local commands and signal retained Linux process identities."""
import os
from pathlib import Path
import signal
import subprocess
import time


def _open_pidfd(pid):
    try:
        return os.pidfd_open(pid, 0)
    except ProcessLookupError:
        return None
    except AttributeError as exc:
        raise RuntimeError("Local verification requires Linux pidfd support") from exc


def _remember_pids(pids, identities):
    for pid in pids:
        if pid not in identities:
            pidfd = _open_pidfd(pid)
            if pidfd is not None and isinstance(pids, dict):
                try:
                    unchanged = _stat_fields(pid)[19] == pids[pid]
                except (OSError, ValueError, IndexError):
                    unchanged = False
                if not unchanged:
                    os.close(pidfd)
                    pidfd = None
            identities[pid] = pidfd


def _stat_fields(pid):
    return (Path('/proc') / str(pid) / 'stat').read_text().rsplit(')', 1)[1].split()


def _descendant_pids(root_pid):
    parents = {root_pid}
    descendants = set()
    processes = []
    starts = {}
    # Session membership also finds children reparented between polling scans.
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            fields = _stat_fields(entry.name)
            starts[int(entry.name)] = fields[19]
            pid, ppid, session = int(entry.name), int(fields[1]), int(fields[3])
            processes.append((pid, ppid))
            if session == root_pid and pid != root_pid:
                descendants.add(pid)
        except (OSError, ValueError, IndexError):
            continue
    parents |= descendants
    while parents:
        children = {pid for pid, ppid in processes if ppid in parents} - descendants
        descendants.update(children)
        parents = children
    return {pid: starts[pid] for pid in descendants}


def _signal_pids(pids, sig, identities):
    for pid in pids:
        pidfd = identities.get(pid)
        if pidfd is not None:
            try:
                signal.pidfd_send_signal(pidfd, sig, None, 0)
            except ProcessLookupError:
                pass


def _close_pidfds(identities):
    descriptors = list(identities.values())
    identities.clear()
    for pidfd in descriptors:
        if pidfd is not None:
            os.close(pidfd)


def _stop_process_group(process, known_descendants=None, identities=None):
    supplied = identities is not None
    identities = identities if supplied else {}
    descendants = set(known_descendants or ())
    acquisition_error = None
    try:
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                if not supplied:
                    _remember_pids({process.pid}, identities)
                observed = _descendant_pids(process.pid)
                descendants.update(observed)
                _remember_pids(observed, identities)
            except (OSError, RuntimeError) as exc:
                # Still stop every retained identity and the unreaped root.
                acquisition_error = exc
            if identities.get(process.pid) is None:
                process.send_signal(sig)
            else:
                _signal_pids({process.pid}, sig, identities)
            _signal_pids(descendants, sig, identities)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass
        if acquisition_error is not None:
            raise RuntimeError("Unable to retain process identities during cleanup") from acquisition_error
    finally:
        _close_pidfds(identities)


def _wait_for_process(process, args, timeout, descendants, identities):
    deadline = time.monotonic() + timeout
    while True:
        observed = _descendant_pids(process.pid)
        descendants.update(observed)
        _remember_pids(observed, identities)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired(args, timeout)
        try:
            return process.wait(timeout=min(0.25, remaining)), descendants
        except subprocess.TimeoutExpired:
            continue


def _run_bounded(args, *, timeout, **kwargs):
    # Fail before launching a command if the host cannot provide safe cleanup.
    probe = _open_pidfd(os.getpid())
    if probe is None or not hasattr(signal, 'pidfd_send_signal'):
        if probe is not None:
            os.close(probe)
        raise RuntimeError("Local verification requires Linux pidfd support")
    os.close(probe)
    process = subprocess.Popen(args, start_new_session=True, **kwargs)
    descendants = set()
    identities = {}
    try:
        _remember_pids({process.pid}, identities)
        returncode, descendants = _wait_for_process(process, args, timeout, descendants, identities)
        if returncode:
            raise subprocess.CalledProcessError(returncode, args)
        return subprocess.CompletedProcess(args, returncode)
    except BaseException:
        _stop_process_group(process, descendants, identities)
        raise
    finally:
        _close_pidfds(identities)
