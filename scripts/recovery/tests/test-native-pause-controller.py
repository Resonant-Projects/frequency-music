import importlib.util
import json
import pathlib
import tempfile
import subprocess
import sys
import fcntl
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('pause', pathlib.Path(__file__).parents[1] / 'native-pause-controller.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class Controller(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = pathlib.Path(self.temp.name) / 'run'
        self.scope = patch.object(m, 'BASE', self.base)
        self.scope.start()
        self.events = []
        self.backend = 'running'
        self.lost_pause = False
        self.lost_resume = False
        self.refuse_resume = False
        self.arm_failed = False
        self.command_patch = patch.object(m, 'command', self.command)
        self.command_patch.start()
        self.state_patch = patch.object(m, 'backend_state', lambda: self.backend)
        self.state_patch.start()
        self.request_patch = patch.object(m, 'request', self.request)
        self.request_patch.start()
    def tearDown(self):
        patch.stopall()
        self.temp.cleanup()
    def command(self, args, timeout=10):
        self.events.append(args)
        if args[0] == 'docker': return b'private-key\n'
        if args[0] == 'systemd-run' and self.arm_failed: raise OSError('private detail')
        return b''
    def request(self, path, body):
        self.events.append(path)
        if path.endswith('/pause_deployment'):
            self.assertTrue(m.load()['owned'])
            self.assertTrue(any(isinstance(x, list) and x[:2] == ['systemctl', 'is-active'] for x in self.events))
            self.backend = 'paused'
            if self.lost_pause: raise TimeoutError('private detail')
        elif path.endswith('/unpause_deployment'):
            if self.refuse_resume: raise OSError('private detail')
            self.backend = 'running'
            if self.lost_resume: raise TimeoutError('private detail')
        return b''
    def stop_events(self):
        return [x for x in self.events if isinstance(x, list) and x[:2] == ['systemctl', 'stop']]
    def test_success_arms_before_pause_then_verified_resume_cleans_key(self):
        self.assertEqual(m.dispatch('begin')['state'], 'paused')
        self.assertTrue((self.base / 'key').exists())
        result = m.dispatch('resume')
        self.assertEqual(result['state'], 'running')
        self.assertFalse(m.load()['owned'])
        self.assertFalse((self.base / 'key').exists())
        self.assertEqual(len(self.stop_events()), 1)
        self.assertNotIn('private-key', json.dumps(result))
    def test_preexisting_pause_is_never_unpaused(self):
        for state in ('paused', 'disabled', 'suspended'):
            with self.subTest(state=state):
                if self.base.exists():
                    import shutil
                    shutil.rmtree(self.base)
                self.backend = state
                self.events.clear()
                with self.assertRaises(m.Refused): m.dispatch('begin')
                self.assertFalse(any(isinstance(x, str) for x in self.events))
                self.assertFalse(m.load()['owned'])
                self.assertEqual(self.backend, state)
    def test_failed_watchdog_arm_prevents_pause(self):
        self.arm_failed = True
        with self.assertRaises(OSError): m.dispatch('begin')
        self.assertEqual(self.backend, 'running')
        self.assertFalse(m.load()['owned'])
    def test_lost_pause_ack_resumes_immediately_and_retains_timer(self):
        self.lost_pause = True
        with self.assertRaises(TimeoutError): m.dispatch('begin')
        self.assertEqual(self.backend, 'running')
        self.assertTrue(m.load()['owned'])
        self.assertTrue((self.base / 'key').exists())
        self.assertEqual(self.stop_events(), [])
        self.assertTrue(m.dispatch('watchdog')['ok'])
        self.assertFalse(m.load()['owned'])
        self.assertFalse((self.base / 'key').exists())
    def test_failed_immediate_resume_leaves_watchdog_and_key(self):
        self.lost_pause = self.refuse_resume = True
        with self.assertRaises(TimeoutError): m.dispatch('begin')
        self.assertEqual(self.backend, 'paused')
        self.assertTrue(m.load()['owned'])
        self.assertTrue((self.base / 'key').exists())
        self.assertEqual(self.stop_events(), [])
        self.refuse_resume = False
        self.assertTrue(m.dispatch('watchdog')['ok'])
        self.assertEqual(self.backend, 'running')
    def test_lost_resume_ack_accepts_running_readback(self):
        m.dispatch('begin')
        self.lost_resume = True
        self.assertTrue(m.dispatch('resume')['ok'])
    def test_watchdog_resumes_without_coordinator_and_does_not_stop_itself(self):
        m.dispatch('begin')
        result = m.dispatch('watchdog')
        self.assertEqual(result['state'], 'running')
        self.assertEqual(self.stop_events(), [])
    def test_watchdog_does_not_change_unowned_pause(self):
        self.base.mkdir()
        m.save({'owned': False})
        self.backend = 'paused'
        self.assertTrue(m.dispatch('watchdog')['ok'])
        self.assertEqual(self.backend, 'paused')
        self.assertEqual(self.events, [])
    def test_existing_run_refused(self):
        m.dispatch('begin')
        with self.assertRaises(m.Refused): m.dispatch('begin')
        self.assertEqual(self.backend, 'paused')
    def test_system_suspension_not_overridden(self):
        m.dispatch('begin')
        self.backend = 'suspended'
        with self.assertRaises(m.Refused): m.dispatch('resume')
        self.assertTrue(m.load()['owned'])
        self.assertEqual(self.stop_events(), [])
    def test_watchdog_failure_budget_retains_owned_evidence(self):
        m.dispatch('begin')
        self.refuse_resume = True
        with patch.object(m.time, 'monotonic', side_effect=[0, 26]):
            with self.assertRaisesRegex(m.Refused, 'watchdog_resume_failed'):
                m.dispatch('watchdog')
        self.assertTrue(m.load()['owned'])
        self.assertTrue((self.base / 'key').exists())
    def subprocess_prelude(self):
        return ("import importlib.util,pathlib,os,signal,time,sys; "
                "s=importlib.util.spec_from_file_location('m'," + repr(str(pathlib.Path(m.__file__))) + "); "
                "m=importlib.util.module_from_spec(s); s.loader.exec_module(m); "
                "m.os.geteuid=lambda:0; pathlib.Path.read_text=lambda self:'convex-hatchet'; "
                "m.BASE=pathlib.Path(" + repr(str(self.base)) + "); "
                "original_open=os.open; m.os.open=lambda path,*args:original_open(" +
                repr(str(self.base.parent / 'lock')) + ",*args); ")
    def test_main_deadline_cannot_be_swallowed(self):
        code = self.subprocess_prelude() + "\n" + """
def blocked(_):
    while True:
        try: time.sleep(10)
        except BaseException: pass
m.dispatch=blocked
signal.alarm=lambda _: signal.setitimer(signal.ITIMER_REAL, .1)
sys.argv=['controller', 'begin']
m.main()
"""
        result = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, timeout=3)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr, '')
    def test_hard_deadline_with_closed_stdout(self):
        code = self.subprocess_prelude() + "os.close(1); m.hard_deadline(None,None)"
        result = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, timeout=3)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr, '')
    def test_main_watchdog_waits_for_controller_lock(self):
        with open(self.base.parent / 'lock', 'w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            code = self.subprocess_prelude() + "m.dispatch=lambda _: {'ok':True}; sys.argv=['controller','watchdog']; sys.exit(m.main())"
            process = subprocess.Popen([sys.executable, '-c', code], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                time.sleep(.3)
                self.assertIsNone(process.poll())
                fcntl.flock(lock, fcntl.LOCK_UN)
                stdout, stderr = process.communicate(timeout=3)
                self.assertEqual(process.returncode, 0)
                self.assertTrue(json.loads(stdout)['ok'])
                self.assertEqual(stderr, '')
            finally:
                if process.poll() is None: process.kill(); process.wait()
    def test_timer_has_independent_deadline_and_no_key_in_argv(self):
        m.dispatch('begin')
        argv = next(x for x in self.events if isinstance(x, list) and x[0] == 'systemd-run')
        self.assertIn('--on-active=120s', argv)
        self.assertIn('--property=RuntimeMaxSec=30s', argv)
        self.assertEqual(argv[-1], 'watchdog')
        self.assertNotIn('private-key', ' '.join(argv))


class BackendStateShape(unittest.TestCase):
    """Exercise the real parser: the deployed backend wraps the state in an object."""
    def query(self, value):
        with patch.object(m, 'request', lambda path, body: json.dumps({'status': 'success', 'value': value}).encode()), \
             patch.object(m, 'BASE', pathlib.Path(tempfile.mkdtemp())):
            return m.backend_state()
    def test_object_state_shape_from_deployed_backend(self):
        self.assertEqual(self.query({'state': 'running'}), 'running')
        self.assertEqual(self.query({'state': 'paused'}), 'paused')
    def test_bare_string_shape_still_accepted(self):
        self.assertEqual(self.query('running'), 'running')
    def test_unknown_shapes_refused(self):
        for value in ({'state': 'running', 'extra': 1}, {'phase': 'running'}, 'stopped', 7, None, {'state': 'active'}):
            with self.assertRaises(m.Refused):
                self.query(value)
    def test_non_success_envelope_refused(self):
        with patch.object(m, 'request', lambda path, body: b'{"status":"error","value":{"state":"running"}}'):
            with self.assertRaises(m.Refused):
                m.backend_state()

if __name__ == '__main__': unittest.main()
