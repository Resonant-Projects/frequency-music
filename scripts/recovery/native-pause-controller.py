#!/usr/bin/env python3
"""CT113-only native pause with independent local recovery. Never stops workers."""
import fcntl
import json
import os
import pathlib
import signal
import stat
import subprocess
import sys
import time
import tempfile
import urllib.request

BASE = pathlib.Path('/run/frequency-native-pause')
UNIT = 'frequency-native-pause-resume'
ORIGIN = 'http://127.0.0.1:3210'

class Refused(Exception):
    pass

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None

def command(args, timeout=10):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, timeout=timeout).stdout

def save(state):
    with tempfile.NamedTemporaryFile(mode='w', dir=BASE, prefix='state-', delete=False) as handle:
        path = pathlib.Path(handle.name)
        json.dump(state, handle)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(path, BASE / 'state.json')
    fd = os.open(BASE, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)

def load():
    return json.loads((BASE / 'state.json').read_text())

def request(path, body):
    key = (BASE / 'key').read_text().strip()
    if not key or len(key) > 16384 or any(c.isspace() for c in key):
        raise Refused('invalid_key')
    opener = urllib.request.build_opener(NoRedirect, urllib.request.ProxyHandler({}))
    req = urllib.request.Request(ORIGIN + path, json.dumps(body).encode(),
        {'Content-Type': 'application/json', 'Authorization': 'Convex ' + key}, method='POST')
    with opener.open(req, timeout=5) as response:
        if response.status != 200:
            raise Refused('http_status')
        data = response.read(65537)
    if len(data) > 65536:
        raise Refused('response_limit')
    return data

def backend_state():
    envelope = json.loads(request('/api/query', {
        'path': '_system/frontend/deploymentState:deploymentState',
        'format': 'json', 'args': [{}]}))
    if not isinstance(envelope, dict) or envelope.get('status') != 'success':
        raise Refused('state_query_failed')
    value = envelope.get('value')
    # The deployed backend answers {"state": "running"}; older builds answered
    # the bare string. Accept exactly those two shapes and nothing else.
    if isinstance(value, dict) and set(value) == {'state'}:
        value = value['state']
    if value not in ('running', 'paused', 'disabled', 'suspended'):
        raise Refused('invalid_state')
    return value

def arm():
    script = str(pathlib.Path(__file__).resolve())
    command(['systemd-run', '--quiet', '--unit=' + UNIT, '--on-active=120s',
             '--timer-property=AccuracySec=1s', '--property=RuntimeMaxSec=30s',
             '--property=TimeoutStopSec=1s', '--property=UMask=0077',
             '/usr/bin/python3', script, 'watchdog'])
    command(['systemctl', 'is-active', '--quiet', UNIT + '.timer'])

def disarm():
    command(['systemctl', 'stop', UNIT + '.timer'])

def begin():
    if BASE.exists():
        raise Refused('existing_run_requires_recovery')
    BASE.mkdir(mode=0o700)
    # No credential leaves CT113 or appears in argv/journal.
    raw = command(['docker', 'exec', 'app-convex-backend-1', './generate_admin_key.sh'])
    lines = raw.decode().splitlines()
    if not lines:
        raise Refused('key_derivation_failed')
    key = lines[-1].strip()
    if not key or len(key) > 16384 or any(c.isspace() for c in key):
        raise Refused('invalid_key')
    with open(BASE / 'key', 'x') as handle:
        handle.write(key)
    state = {'owned': False, 'pause_ack': False, 'phase': 'prepared'}
    save(state)
    arm()
    if backend_state() != 'running':
        disarm()
        (BASE / 'key').unlink()
        raise Refused('preexisting_nonrunning_state')
    # Persist ownership BEFORE sending pause, including lost acknowledgement.
    state.update(owned=True, phase='pause_requested', requested_unix=time.time())
    save(state)
    request('/api/v1/pause_deployment', {})
    state['pause_ack'] = True
    save(state)
    if backend_state() != 'paused':
        raise Refused('pause_not_verified')
    state['phase'] = 'paused'
    save(state)
    return {'ok': True, 'state': 'paused', 'watchdog_seconds': 120,
            'worker_stop_authorized': False}

def resume(watchdog=False):
    state = load()
    if not state.get('owned'):
        return {'ok': True, 'state': 'unowned_no_mutation'}
    current = backend_state()
    if current not in ('running', 'paused'):
        raise Refused('unexpected_state_during_recovery')
    # Always send resume for an owned run, including a lost pause response.
    # On uncertain pause acknowledgement the timer stays armed even after this
    # immediate recovery, providing another independent recovery attempt.
    if current == 'paused':
        try:
            request('/api/v1/unpause_deployment', {})
        except Exception:
            pass  # Lost acknowledgement is resolved by authenticated readback.
    if backend_state() != 'running':
        raise Refused('resume_not_verified')
    if state.get('pause_ack') or watchdog:
        state.update(owned=False, phase='resumed', resumed_unix=time.time())
        save(state)
        if not watchdog:
            disarm()
        (BASE / 'key').unlink(missing_ok=True)
        return {'ok': True, 'state': 'running', 'watchdog_retained': False}
    state['phase'] = 'running_ack_uncertain'
    save(state)
    return {'ok': False, 'state': 'running', 'watchdog_retained': True,
            'code': 'pause_ack_uncertain'}

def dispatch(action):
    if action == 'begin':
        if BASE.exists():
            raise Refused('existing_run_requires_recovery')
        try:
            return begin()
        except Exception:
            # Even a failed/lost pause response is an owned recovery operation.
            if (BASE / 'state.json').exists() and load().get('owned'):
                try:
                    resume()
                except Exception:
                    pass  # Armed independent timer/key remain for recovery.
            raise
    if action == 'resume':
        return resume()
    if action == 'watchdog':
        # The service budget bounds retries even if the network is unavailable.
        until = time.monotonic() + 25
        while True:
            try:
                return resume(watchdog=True)
            except Exception:
                if time.monotonic() >= until:
                    raise Refused('watchdog_resume_failed') from None
                time.sleep(1)
    raise Refused('invalid_action')

def hard_deadline(_signum, _frame):
    # Cannot be swallowed by recovery exception handlers or urllib reads.
    # Process exit releases the flock; the already-armed local timer recovers.
    # Do not write: disconnected or blocked SSH stdout must not delay exit.
    os._exit(1)

def main():
    os.umask(0o077)
    try:
        if os.geteuid() != 0 or pathlib.Path('/etc/hostname').read_text().strip() != 'convex-hatchet':
            raise Refused('requires_CT113_convex_hatchet_root')
        action = sys.argv[1] if len(sys.argv) == 2 else ''
        if action not in ('begin', 'resume', 'watchdog'):
            raise Refused('invalid_action')
        # One native pause owner per guest. Never wait behind a hung controller.
        fd = os.open('/run/frequency-native-pause.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as lock:
            signal.signal(signal.SIGALRM, hard_deadline)
            signal.signal(signal.SIGTERM, hard_deadline)
            signal.signal(signal.SIGHUP, hard_deadline)
            signal.signal(signal.SIGINT, hard_deadline)
            signal.alarm(28)
            while True:
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    if action != 'watchdog':
                        raise
                    time.sleep(.1)
            if BASE.exists():
                info = BASE.lstat()
                if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o700:
                    raise Refused('unsafe_run_directory')
            result = dispatch(action)
            signal.alarm(0)
        print(json.dumps(result))
        return 0 if result.get('ok') else 1
    except BaseException:
        print(json.dumps({'ok': False, 'code': 'operation_failed',
                          'instruction': 'retain_run_and_check_resume_watchdog'}))
        return 1

if __name__ == '__main__':
    sys.exit(main())
