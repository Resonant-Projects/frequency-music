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
    def test_signal_pids_does_not_signal_an_untracked_pid(self):
        with patch.object(os, 'kill') as kill, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            processes._signal_pids({5678, 6789}, signal.SIGTERM, {5678: None})
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

    def test_cleanup_paths_signal_and_close_each_identity_once(self):
        for outcome in (subprocess.TimeoutExpired(['node'], 120), KeyboardInterrupt(), (3, {5678})):
            with self.subTest(outcome=outcome):
                process = Mock(pid=1234)
                process.wait.return_value = 0
                with patch.object(subprocess, 'Popen', return_value=process), \
                     patch.object(processes, '_wait_for_process') as wait, \
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
        with patch.object(processes, '_descendant_pids', return_value=set()), \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            processes._stop_process_group(process, identities={1234: None})
        self.assertEqual(process.send_signal.call_args_list, [call(signal.SIGTERM), call(signal.SIGKILL)])
        send_signal.assert_not_called()

    def test_unexpected_wait_error_still_cleans_up_and_closes(self):
        process = Mock(pid=1234)
        with patch.object(subprocess, 'Popen', return_value=process), \
             patch.object(processes, '_wait_for_process', side_effect=ValueError('wait failed')), \
             patch.object(processes, '_descendant_pids', return_value=set()), \
             patch.object(processes, '_open_pidfd', side_effect=[8, 9]), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal'):
            with self.assertRaisesRegex(ValueError, 'wait failed'):
                processes._run_bounded(['node'], timeout=120)
        self.assertEqual(close.call_args_list, [call(8), call(9)])

    def test_cleanup_acquisition_error_still_stops_root_and_closes(self):
        process = Mock(pid=1234)
        with patch.object(processes, '_descendant_pids', side_effect=OSError('proc unavailable')), \
             patch.object(os, 'close') as close, \
             patch.object(signal, 'pidfd_send_signal') as send_signal:
            with self.assertRaisesRegex(RuntimeError, 'retain process identities'):
                processes._stop_process_group(process, identities={1234: 9})
        self.assertEqual(send_signal.call_count, 2)
        close.assert_called_once_with(9)

    def test_real_orphan_spawned_between_scans_is_stopped(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / 'child'
            script = (
                'import subprocess, time, pathlib; time.sleep(0.1); '
                'child=subprocess.Popen(["sleep", "30"]); '
                f'pathlib.Path({str(receipt)!r}).write_text(str(child.pid)); '
                'raise SystemExit(1)'
            )
            child_fd = None
            try:
                with self.assertRaises(subprocess.CalledProcessError):
                    processes._run_bounded([sys.executable, '-c', script], timeout=5)
                child_pid = int(receipt.read_text())
                self.assert_stopped(child_pid)
            finally:
                if receipt.exists():
                    child_fd = processes._open_pidfd(int(receipt.read_text()))
                if child_fd is not None:
                    try:
                        signal.pidfd_send_signal(child_fd, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    os.close(child_fd)

    def test_real_timeout_stops_an_observed_detached_child(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / 'child'
            script = (
                'import subprocess, time, pathlib; '
                'child=subprocess.Popen(["sleep", "30"], start_new_session=True); '
                f'pathlib.Path({str(receipt)!r}).write_text(str(child.pid)); '
                'time.sleep(30)'
            )
            try:
                with self.assertRaises(subprocess.TimeoutExpired):
                    processes._run_bounded([sys.executable, '-c', script], timeout=0.8)
                self.assert_stopped(int(receipt.read_text()))
            finally:
                if receipt.exists():
                    fd = processes._open_pidfd(int(receipt.read_text()))
                    if fd is not None:
                        try:
                            signal.pidfd_send_signal(fd, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        os.close(fd)

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
