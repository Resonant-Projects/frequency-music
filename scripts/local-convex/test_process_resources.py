"""Descriptor lifetime stays bounded by live processes during long commands."""
import os
from pathlib import Path
import subprocess
import sys
import unittest

import processes


class ProcessResources(unittest.TestCase):
    def test_exited_children_do_not_exhaust_a_low_descriptor_limit(self):
        script = '''
import os, resource, subprocess
import processes
soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
limit = 64 if soft == resource.RLIM_INFINITY else min(64, soft)
resource.setrlimit(resource.RLIMIT_NOFILE, (limit, hard))
identities = {}
try:
    for _ in range(100):
        child = subprocess.Popen(['sleep', '0.01'])
        try:
            start = processes._stat_fields(child.pid)[19]
            processes._remember_pids({child.pid: start}, identities)
        finally:
            child.wait()
        processes._prune_exited(identities, os.getpid())
    assert all(identity[1] is None for identity in identities.values())
finally:
    processes._close_pidfds(identities)
'''
        result = subprocess.run([sys.executable, '-c', script],
                                cwd=Path(__file__).parent, capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_concurrent_children_are_drained_after_descriptor_exhaustion(self):
        self.run_concurrent_children(False)

    def test_observed_detached_children_are_drained_under_descriptor_pressure(self):
        self.run_concurrent_children(True)

    def run_concurrent_children(self, detached):
        script = r'''import json, os, resource, signal, subprocess, sys, tempfile, time
from pathlib import Path
import processes
soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
resource.setrlimit(resource.RLIMIT_NOFILE, (64, hard))
with tempfile.TemporaryDirectory() as directory:
    receipt = Path(directory) / 'children.json'
    root_script = """import json, subprocess, time
from pathlib import Path
children = []
for _ in range(192):
    child = subprocess.Popen(['sleep', '30'], start_new_session=False)
    start = Path(f'/proc/{child.pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
    children.append((child.pid, start))
Path(RECEIPT).write_text(json.dumps(children))
time.sleep(30)
""".replace('RECEIPT', repr(str(receipt)))
    original_wait = processes._wait_for_process
    def ready_wait(*args):
        deadline = time.monotonic() + 5
        while not receipt.exists():
            if time.monotonic() >= deadline:
                raise RuntimeError('child setup timed out')
            time.sleep(0.01)
        return original_wait(*args)
    processes._wait_for_process = ready_wait
    try:
        try:
            processes._run_bounded([sys.executable, '-c', root_script], timeout=5)
        except (OSError, RuntimeError, subprocess.TimeoutExpired):
            pass
        alive = []
        for pid, start in json.loads(receipt.read_text()):
            try:
                fields = processes._stat_fields(pid)
                if fields[19] == start and fields[0] not in ('Z', 'X'):
                    alive.append(pid)
            except FileNotFoundError:
                pass
        assert not alive, f'Concurrent children survived: {alive}'
    finally:
        if receipt.exists():
            for pid, start in json.loads(receipt.read_text()):
                identities = {}
                try:
                    processes._remember_pids({pid: start}, identities)
                    processes._signal_pids({pid}, signal.SIGKILL, identities)
                finally:
                    processes._close_pidfds(identities)
'''
        script = script.replace('start_new_session=False', f'start_new_session={detached!r}')
        result = subprocess.run([sys.executable, '-c', script],
                                cwd=Path(__file__).parent, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_exited_root_descriptor_is_kept_for_cleanup(self):
        child = subprocess.Popen([sys.executable, '-c', 'pass'])
        identities = {}
        try:
            processes._remember_pids({child.pid}, identities)
            descriptor = identities[child.pid][1]
            processes._wait_unreaped(child, 5)
            processes._prune_exited(identities, child.pid)
            self.assertEqual(identities[child.pid][1], descriptor)
            os.fstat(descriptor)
        finally:
            child.wait()
            processes._close_pidfds(identities)


if __name__ == '__main__':
    unittest.main()
