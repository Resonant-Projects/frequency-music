"""Bound local commands and signal retained Linux process identities."""
import os
from pathlib import Path
import signal
import select
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
    observations = pids.items() if isinstance(pids, dict) else ((pid, None) for pid in pids)
    for pid, start in observations:
        previous = identities.get(pid)
        if previous is not None and previous[0] == start:
            continue
        pidfd = _open_pidfd(pid)
        try:
            if pidfd is not None and start is not None:
                try:
                    unchanged = _stat_fields(pid)[19] == start
                except (FileNotFoundError, ProcessLookupError):
                    unchanged = False
                except (OSError, ValueError, IndexError) as exc:
                    raise RuntimeError(f"Unable to verify identity for process {pid}") from exc
                if not unchanged:
                    continue
            # Only validated descriptors become eligible for signaling. The
            # local finally owns the in-flight descriptor until this transfer.
            identities[pid] = (start, pidfd)
            pidfd = None
            if previous is not None and previous[1] is not None:
                os.close(previous[1])
        finally:
            if pidfd is not None:
                os.close(pidfd)


def _stat_fields(pid):
    return (Path('/proc') / str(pid) / 'stat').read_text().rsplit(')', 1)[1].split()


def _validated_edge(pid, ppid, starts):
    if ppid not in starts:
        return False
    try:
        before = _stat_fields(ppid)[19]
        child = _stat_fields(pid)
        after = _stat_fields(ppid)[19]
        return (before == after == starts[ppid] and child[19] == starts[pid]
                and int(child[1]) == ppid)
    except (FileNotFoundError, ProcessLookupError):
        return False
    except (OSError, ValueError, IndexError) as exc:
        raise RuntimeError(f"Unable to verify ancestry for process {pid}") from exc


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
        children = {pid for pid, ppid in processes
                    if ppid in parents and pid not in descendants
                    and _validated_edge(pid, ppid, starts)}
        descendants.update(children)
        parents = children
    return {pid: starts[pid] for pid in descendants}


def _signal_pids(pids, sig, identities):
    for pid in pids:
        identity = identities.get(pid)
        pidfd = identity[1] if identity is not None else None
        if pidfd is not None:
            try:
                signal.pidfd_send_signal(pidfd, sig, None, 0)
            except ProcessLookupError:
                pass


def _close_pidfds(identities):
    descriptors = [identity[1] for identity in identities.values()]
    identities.clear()
    for pidfd in descriptors:
        if pidfd is not None:
            os.close(pidfd)


def _wait_unreaped(process, timeout):
    deadline = time.monotonic() + timeout
    while True:
        result = os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        if result is not None:
            return result.si_status if result.si_code == os.CLD_EXITED else -result.si_status
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired(process.args, timeout)
        time.sleep(min(0.01, remaining))


def _wait_pidfds(identities, timeout):
    pending = {identity[1] for identity in identities.values() if identity[1] is not None}
    poller = select.poll()
    for descriptor in pending:
        poller.register(descriptor, select.POLLIN)
    deadline = time.monotonic() + timeout
    while pending:
        remaining = max(0, deadline - time.monotonic())
        events = poller.poll(int(remaining * 1000))
        for descriptor, event in events:
            if event & (select.POLLERR | select.POLLNVAL):
                raise RuntimeError("Unable to observe retained process exit")
            if event & (select.POLLIN | select.POLLHUP):
                pending.discard(descriptor)
                poller.unregister(descriptor)
        if pending and time.monotonic() >= deadline:
            raise RuntimeError("Retained processes did not exit during cleanup")


def _drain_children(process, identities):
    deadline = time.monotonic() + 10
    while True:
        _wait_pidfds(identities, max(0, deadline - time.monotonic()))
        try:
            _wait_unreaped(process, 0)
        except ChildProcessError:
            return
        observed = _descendant_pids(process.pid)
        previous = dict(identities)
        _remember_pids(observed, identities)
        fresh = {pid for pid in observed if identities.get(pid) != previous.get(pid)}
        _signal_pids(fresh, signal.SIGKILL, identities)
        observations = observed.items() if isinstance(observed, dict) else ((pid, None) for pid in observed)
        unresolved = any(pid not in identities or identities[pid][0] != start
                         for pid, start in observations)
        if not fresh and not unresolved:
            return
        if time.monotonic() >= deadline:
            raise RuntimeError("Process cleanup did not quiesce")


def _stop_process_group(process, known_descendants=None, identities=None):
    supplied = identities is not None
    identities = identities if supplied else {}
    descendants = set(known_descendants or ())
    acquisition_error = None
    try:
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                root_owned = True
                try:
                    _wait_unreaped(process, 0)
                except subprocess.TimeoutExpired:
                    pass
                except ChildProcessError:
                    root_owned = False
                # Keep the root unreaped until the last discovery scan. If a
                # Popen fallback reaped it, admit no new numeric PID targets.
                if root_owned and not supplied:
                    _remember_pids({process.pid}, identities)
                observed = _descendant_pids(process.pid) if root_owned else {}
                descendants.update(observed)
                _remember_pids(observed, identities)
            except (OSError, RuntimeError) as exc:
                # Still stop every retained identity and the unreaped root.
                acquisition_error = exc
            root_identity = identities.get(process.pid)
            if root_identity is None or root_identity[1] is None:
                process.send_signal(sig)
            else:
                _signal_pids({process.pid}, sig, identities)
            _signal_pids(descendants, sig, identities)
            try:
                _wait_unreaped(process, 10)
            except (subprocess.TimeoutExpired, ChildProcessError):
                pass
        try:
            _drain_children(process, identities)
        except (OSError, RuntimeError) as exc:
            acquisition_error = exc
        if acquisition_error is not None:
            raise RuntimeError("Unable to retain process identities during cleanup") from acquisition_error
    finally:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            pass
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
            return _wait_unreaped(process, min(0.25, remaining)), descendants
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
        process.wait()
        return subprocess.CompletedProcess(args, returncode)
    except BaseException:
        _stop_process_group(process, descendants, identities)
        raise
    finally:
        _close_pidfds(identities)
