"""Identity-safe cleanup, including children missed between polling scans."""
import errno
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, call, patch

import processes


class ProcessCleanup(unittest.TestCase):
    def test_ancestry_does_not_join_different_parent_generations(self):
        def fields(ppid, session, start):
            result = ['0'] * 20
            result[1], result[3], result[19] = str(ppid), str(session), start
            return result
        for reparented in (False, True):
            reads = {}
            def stat(pid):
                pid = int(pid)
                reads[pid] = reads.get(pid, 0) + 1
                if pid == 10:
                    return fields(1, 10, 'root')
                if pid == 20:
                    return fields(10, 10, 'new-parent')
                # The first record belongs to the old generation of parent 20;
                # a fresh read sees reparenting before that PID was reused.
                return fields(1 if reparented and reads[30] > 1 else 20, 99, 'child')
            with self.subTest(reparented=reparented), \
                 patch.object(Path, 'iterdir', return_value=iter([Path('/proc/10'), Path('/proc/30'), Path('/proc/20')])), \
                 patch.object(processes, '_stat_fields', side_effect=stat):
                descendants = processes._descendant_pids(10)
            self.assertEqual(set(descendants), {20} if reparented else {20, 30})

    def test_signal_pids_does_not_signal_an_untracked_pid(self):
        with patch.object(os, 'kill') as kill, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            processes._signal_pids({5678, 6789}, signal.SIGTERM, {5678: ('start', None)})
        kill.assert_not_called()
        send_signal.assert_not_called()

    def test_pid_reused_between_discovery_and_open_is_never_signalled(self):
        identities = {}
        with patch.object(processes, '_open_pidfd', return_value=9), \
             patch.object(processes, '_stat_fields', return_value=['0'] * 19 + ['new-start']), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            processes._remember_pids({5678: 'old-start'}, identities)
            processes._signal_pids({5678}, signal.SIGTERM, identities)
            processes._close_pidfds(identities)
        close.assert_called_once_with(9)
        send_signal.assert_not_called()

    def test_interrupted_validation_never_makes_descriptor_signalable(self):
        identities = {}
        with patch.object(processes, '_open_pidfd', return_value=9), \
             patch.object(processes, '_stat_fields', side_effect=KeyboardInterrupt()), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            with self.assertRaises(KeyboardInterrupt):
                processes._remember_pids({5678: 'start'}, identities)
            processes._signal_pids({5678}, signal.SIGTERM, identities)
        self.assertNotIn(5678, identities)
        close.assert_called_once_with(9)
        send_signal.assert_not_called()

    def test_new_observed_identity_replaces_an_old_pid_descriptor(self):
        identities = {5678: ('old-start', 9)}
        with patch.object(processes, '_open_pidfd', return_value=10), \
             patch.object(processes, '_stat_fields', return_value=['0'] * 19 + ['new-start']), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            processes._remember_pids({5678: 'new-start'}, identities)
            processes._signal_pids({5678}, signal.SIGTERM, identities)
            processes._close_pidfds(identities)
        self.assertEqual(close.call_args_list, [call(9), call(10)])
        send_signal.assert_called_once_with(10, signal.SIGTERM, None, 0)

    def test_failed_replacement_keeps_only_the_old_validated_identity(self):
        identities = {5678: ('old-start', 9)}
        with patch.object(processes, '_open_pidfd', return_value=10), \
             patch.object(processes, '_stat_fields', side_effect=KeyboardInterrupt()), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            with self.assertRaises(KeyboardInterrupt):
                processes._remember_pids({5678: 'new-start'}, identities)
            processes._signal_pids({5678}, signal.SIGTERM, identities)
            processes._close_pidfds(identities)
        self.assertEqual(close.call_args_list, [call(10), call(9)])
        send_signal.assert_called_once_with(9, signal.SIGTERM, None, 0)

    def test_identity_validation_errors_are_reported_and_descriptor_closed(self):
        for error in (PermissionError('stat denied'), OSError('stat failed'), IndexError('bad stat')):
            identities = {}
            with self.subTest(error=error), \
                 patch.object(processes, '_open_pidfd', return_value=9), \
                 patch.object(processes, '_stat_fields', side_effect=error), \
                 patch.object(os, 'close') as close, \
                 patch.object(signal, 'pidfd_send_signal') as send_signal:
                with self.assertRaisesRegex(RuntimeError, 'verify identity'):
                    processes._remember_pids({5678: 'start'}, identities)
            self.assertNotIn(5678, identities)
            close.assert_called_once_with(9)
            send_signal.assert_not_called()

    def test_exited_process_during_validation_is_safely_ignored(self):
        identities = {}
        with patch.object(processes, '_open_pidfd', return_value=9), \
             patch.object(processes, '_stat_fields', side_effect=FileNotFoundError()), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            processes._remember_pids({5678: 'start'}, identities)
            processes._signal_pids({5678}, signal.SIGTERM, identities)
        close.assert_called_once_with(9)
        send_signal.assert_not_called()

    def test_cleanup_paths_signal_and_close_each_identity_once(self):
        for outcome in (subprocess.TimeoutExpired(['node'], 120), KeyboardInterrupt(), (3, {5678})):
            with self.subTest(outcome=outcome):
                process = Mock(pid=1234)
                process.wait.return_value = 0
                with patch.object(subprocess, 'Popen', return_value=process), \
                     patch.object(processes, '_wait_for_process') as wait, \
                     patch.object(processes, '_wait_unreaped', return_value=0), \
                     patch.object(processes, '_wait_pidfds'), \
                     patch.object(processes, '_descendant_pids', return_value={5678}), \
                     patch.object(processes, '_open_pidfd', side_effect=[8, 9, 10]), \
                     patch.object(os, 'close') as close, \
                     patch.object(signal, 'pidfd_send_signal') as send_signal:
                    if isinstance(outcome, BaseException):
                        wait.side_effect = outcome
                        expected = type(outcome)
                    else:
                        wait.return_value = outcome
                        expected = subprocess.CalledProcessError
                    with self.assertRaises(expected):
                        processes._run_bounded(['node'], timeout=120)
                self.assertEqual(send_signal.call_args_list, [
                    call(9, signal.SIGTERM, None, 0), call(10, signal.SIGTERM, None, 0),
                    call(9, signal.SIGKILL, None, 0), call(10, signal.SIGKILL, None, 0),
                ])
                self.assertEqual(close.call_args_list, [call(8), call(9), call(10)])

    def test_success_closes_pidfds_without_signalling(self):
        with patch.object(subprocess, 'Popen', return_value=Mock(pid=1234)), \
             patch.object(processes, '_wait_for_process', return_value=(0, set())), \
             patch.object(processes, '_open_pidfd', side_effect=[8, 9]), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            self.assertEqual(processes._run_bounded(['node'], timeout=120).returncode, 0)
        self.assertEqual(close.call_args_list, [call(8), call(9)])
        send_signal.assert_not_called()

    def test_pidfd_failure_refuses_to_launch_a_command(self):
        for error in (AttributeError('unavailable'), OSError(errno.EPERM, 'denied')):
            with self.subTest(error=error), \
                 patch.object(os, 'pidfd_open', side_effect=error), \
                 patch.object(subprocess, 'Popen') as launch:
                with self.assertRaises((OSError, RuntimeError)):
                    processes._run_bounded(['node'], timeout=120)
                launch.assert_not_called()

    def test_root_without_pidfd_uses_popen_signalling(self):
        process = Mock(pid=1234)
        with patch.object(processes, '_wait_unreaped', return_value=0), \
                     patch.object(processes, '_wait_pidfds'), \
                     patch.object(processes, '_descendant_pids', return_value=set()), \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            processes._stop_process_group(process, identities={1234: (None, None)})
        self.assertEqual(process.send_signal.call_args_list, [call(signal.SIGTERM), call(signal.SIGKILL)])
        send_signal.assert_not_called()

    def test_unexpected_wait_error_still_cleans_up_and_closes(self):
        process = Mock(pid=1234)
        with patch.object(subprocess, 'Popen', return_value=process), \
             patch.object(processes, '_wait_for_process', side_effect=ValueError('wait failed')), \
             patch.object(processes, '_wait_unreaped', return_value=0), \
                     patch.object(processes, '_wait_pidfds'), \
                     patch.object(processes, '_descendant_pids', return_value=set()), \
             patch.object(processes, '_open_pidfd', side_effect=[8, 9]), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal'):
            with self.assertRaisesRegex(ValueError, 'wait failed'):
                processes._run_bounded(['node'], timeout=120)
        self.assertEqual(close.call_args_list, [call(8), call(9)])

    def test_cleanup_acquisition_error_still_stops_root_and_closes(self):
        process = Mock(pid=1234)
        with patch.object(processes, '_wait_unreaped', return_value=0), \
                     patch.object(processes, '_wait_pidfds'), \
                     patch.object(processes, '_descendant_pids', side_effect=OSError('proc unavailable')), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            with self.assertRaisesRegex(RuntimeError, 'retain process identities'):
                processes._stop_process_group(process, identities={1234: (None, 9)})
        self.assertEqual(send_signal.call_count, 2)
        close.assert_called_once_with(9)

    def test_reaped_root_never_authorizes_new_descendants(self):
        process = Mock(pid=1234)
        with patch.object(processes, '_wait_unreaped', side_effect=ChildProcessError()), \
             patch.object(processes, '_wait_pidfds'), \
             patch.object(processes, '_descendant_pids') as discover, \
             patch.object(signal, 'pidfd_send_signal') as send_signal, \
             patch.object(os, 'close'):
            processes._stop_process_group(process, {5678}, {1234: (None, 9), 5678: ('start', 10)})
        discover.assert_not_called()
        self.assertEqual(send_signal.call_count, 4)

    def test_nonzero_root_stays_unreaped_until_cleanup_finishes(self):
        real_discover = processes._descendant_pids
        states = []
        def discover(pid):
            states.append(processes._stat_fields(pid)[0])
            return real_discover(pid)
        with patch.object(processes, '_descendant_pids', side_effect=discover):
            with self.assertRaises(subprocess.CalledProcessError):
                processes._run_bounded([sys.executable, '-c', 'raise SystemExit(3)'], timeout=5)
        self.assertGreaterEqual(states.count('Z'), 2)

    def test_receipt_cleanup_never_signals_a_reused_pid(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / 'child'
            receipt.write_text('5678:old-start')
            with patch.object(processes, '_open_pidfd', return_value=9), \
                 patch.object(processes, '_stat_fields', return_value=['0'] * 19 + ['new-start']), \
                 patch.object(os, 'close') as close, \
                 patch.object(signal, 'pidfd_send_signal') as send_signal:
                self.cleanup_receipt(receipt)
            send_signal.assert_not_called()
            close.assert_called_once_with(9)

    def test_real_success_reaps_the_root(self):
        launched = []
        popen = subprocess.Popen
        def launch(*args, **kwargs):
            process = popen(*args, **kwargs)
            launched.append(process)
            return process
        with patch.object(subprocess, 'Popen', side_effect=launch):
            result = processes._run_bounded([sys.executable, '-c', 'pass'], timeout=5)
        self.assertEqual(result.returncode, 0)
        with self.assertRaises(ChildProcessError):
            processes._wait_unreaped(launched[0], 0)

    def test_child_forked_after_kill_snapshot_is_found_before_reaping(self):
        process = Mock(pid=1234)
        with patch.object(processes, '_wait_unreaped', return_value=0), \
                     patch.object(processes, '_wait_pidfds'), \
             patch.object(processes, '_descendant_pids', side_effect=[{}, {}, {5678: 'child'}, {}]), \
             patch.object(processes, '_open_pidfd', return_value=10), \
             patch.object(processes, '_stat_fields', return_value=['0'] * 19 + ['child']), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            processes._stop_process_group(process, identities={1234: (None, 9)})
        self.assertIn(call(10, signal.SIGKILL, None, 0), send_signal.call_args_list)
        self.assertEqual(close.call_args_list, [call(9), call(10)])
        process.wait.assert_called_once_with(timeout=10)

    def test_exit_observation_has_a_deadline(self):
        descriptor = processes._open_pidfd(os.getpid())
        try:
            with self.assertRaisesRegex(RuntimeError, 'did not exit'):
                processes._wait_pidfds({os.getpid(): ('self', descriptor)}, 0)
        finally:
            os.close(descriptor)

    def test_real_orphan_spawned_between_scans_is_stopped(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / 'child'
            script = (
                'import subprocess, time, pathlib; time.sleep(0.1); '
                'child=subprocess.Popen(["sleep", "30"]); '
                f'pathlib.Path({str(receipt)!r}).write_text(str(child.pid) + ":" + '
                'pathlib.Path(f"/proc/{child.pid}/stat").read_text().rsplit(")", 1)[1].split()[19]); '
                'raise SystemExit(1)'
            )
            try:
                with self.assertRaises(subprocess.CalledProcessError):
                    processes._run_bounded([sys.executable, '-c', script], timeout=5)
                child_pid = int(receipt.read_text().split(':')[0])
                self.assert_stopped(child_pid)
            finally:
                self.cleanup_receipt(receipt)

    def test_real_timeout_stops_an_observed_detached_child(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / 'child'
            script = (
                'import subprocess, time, pathlib; '
                'child=subprocess.Popen(["sleep", "30"], start_new_session=True); '
                f'pathlib.Path({str(receipt)!r}).write_text(str(child.pid) + ":" + '
                'pathlib.Path(f"/proc/{child.pid}/stat").read_text().rsplit(")", 1)[1].split()[19]); '
                'time.sleep(30)'
            )
            try:
                with self.assertRaises(subprocess.TimeoutExpired):
                    processes._run_bounded([sys.executable, '-c', script], timeout=0.8)
                self.assert_stopped(int(receipt.read_text().split(':')[0]))
            finally:
                self.cleanup_receipt(receipt)

    def cleanup_receipt(self, receipt):
        if not receipt.exists():
            return
        pid, start = receipt.read_text().split(':')
        identities = {}
        try:
            processes._remember_pids({int(pid): start}, identities)
            processes._signal_pids({int(pid)}, signal.SIGKILL, identities)
        finally:
            processes._close_pidfds(identities)

    def assert_stopped(self, pid):
        for _ in range(100):
            try:
                state = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[0]
            except FileNotFoundError:
                return
            if state == 'Z':
                return
            time.sleep(0.01)
        self.fail(f'Owned child {pid} survived cleanup')


if __name__ == '__main__':
    unittest.main()
