#!/usr/bin/env python3
"""Offline safety/contract tests; never launch the application or contact Convex."""
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("frequency_control", HERE / "control.py")
assert SPEC is not None and SPEC.loader is not None
control = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(control)


class VerificationContract(unittest.TestCase):
    def test_registered_skill_and_discovery_link(self):
        text = (control.SKILL / "SKILL.md").read_text()
        self.assertTrue(text.startswith("---\nname: verify-frequency-music\n"))
        self.assertIn("description:", text.split("---")[1])
        for heading in ["Launch", "Doctor", "Drive", "Evidence", "Cleanup", "Helpers"]:
            self.assertIn("## " + heading, text)
        link = control.REPO / ".agents/skills/verify-frequency-music"
        self.assertTrue(link.is_symlink())
        self.assertEqual(str(link.readlink()), "../../.cursor/skills/verify-frequency-music")
        self.assertEqual(link.resolve(), control.SKILL)

    def test_feature_map_shape(self):
        expected = ["Sub-features", "How to get to it (user POV)",
                    "Driving it with Playwright", "Gotchas"]
        for filename in ["essays.md", "navigation.md", "search.md", "ingest.md"]:
            text = (control.SKILL / "features" / filename).read_text()
            self.assertEqual(re.findall(r"^## (.+)$", text, re.MULTILINE), expected)
            self.assertIn("Preconditions:", text)
            self.assertTrue(text.startswith("# "))

    def test_ingest_refuses_before_doctor_opens_browser(self):
        info = {"scratch": "/owned-scratch"}
        failed = subprocess.CompletedProcess([], 1)
        with patch.object(control, "state", return_value=info), \
             patch.object(control, "doctor") as doctor, \
             patch.object(control.subprocess, "run", return_value=failed):
            with self.assertRaisesRegex(RuntimeError, "ingest failed"):
                control.drive("safe-run", "ingest")
            doctor.assert_not_called()

    def test_run_id_cannot_escape_evidence(self):
        for value in ["../other", "/absolute", "", "a/b", "x" * 81]:
            with self.assertRaises(RuntimeError):
                control.directory(value)

    def test_pid_reuse_refuses_kill(self):
        observed = subprocess.CompletedProcess([], 0, "another process", "")
        with patch.object(control, "group_members", return_value=[42]), \
             patch.object(control.subprocess, "run", return_value=observed), \
             patch.object(control.os, "killpg") as kill:
            with self.assertRaisesRegex(RuntimeError, "identity changed"):
                control.stop_owned({"pgid": 42, "process_started": "owned process"})
            kill.assert_not_called()

    def test_concurrent_cleanup_drain_is_not_an_error(self):
        observed = subprocess.CompletedProcess([], 1, "", "")
        with patch.object(control, "group_members", side_effect=[[43], []]), \
             patch.object(control.subprocess, "run", return_value=observed), \
             patch.object(control.os, "killpg") as kill:
            control.stop_owned({"pgid": 42, "process_started": "owned process"})
            kill.assert_not_called()

    def test_doctor_refuses_foreign_listener(self):
        info = {"pgid": 42, "process_started": "owned", "head": "head", "source_sha256": "source", "port": 99}
        with patch.object(control, "state", return_value=info), \
             patch.object(control, "group_members", return_value=[42]), \
             patch.object(control, "command", side_effect=["owned", "head"]), \
             patch.object(control, "fingerprint", return_value="source"), \
             patch.object(control, "listeners", return_value=[43]), \
             patch.object(control, "write_json"), \
             patch.object(control.urllib.request, "urlopen") as fetch:
            with self.assertRaisesRegex(RuntimeError, "listener owned"):
                control.doctor("safe-run")
            fetch.assert_not_called()

    def test_cleanup_removes_only_scratch_and_keeps_proof(self):
        root = Path.home() / ".hermes/cache/scratch"
        root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=root) as temp:
            base = Path(temp)
            scratch = base / "frequency-safe-run-owned"
            scratch.mkdir()
            (scratch / "throwaway").write_text("temporary")
            evidence = base / "proof"
            evidence.mkdir()
            for filename in ["instance.json", "launch.log", "essays-result.json", "essays-trace.zip"]:
                (evidence / filename).write_text("keep")
            info = {"scratch": str(scratch), "scratch_base": str(base), "pgid": 42, "port": 99}
            with patch.object(control, "state", return_value=info), \
                 patch.object(control, "stop_owned"), \
                 patch.object(control, "group_members", return_value=[]), \
                 patch.object(control, "listeners", return_value=[]), \
                 patch.object(control, "directory", return_value=evidence):
                control.cleanup("safe-run")
            self.assertFalse(scratch.exists())
            result = json.loads((evidence / "cleanup.json").read_text())
            self.assertIn("essays-trace.zip", result["evidence_preserved"])
            self.assertTrue((evidence / "essays-result.json").is_file())


class ReviewRegressions(unittest.TestCase):
    def setUp(self):
        root = Path.home() / ".hermes/cache/scratch"
        root.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=root)
        self.base = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_fingerprint_covers_shared_helpers_and_new_inputs_not_evidence(self):
        repo = self.base / "repo"
        repo.mkdir()
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        skill = repo / ".cursor/skills/verify-frequency-music"
        paths = ["web/src/main.tsx", "convex/shared/statuses.ts",
                 ".cursor/skills/verify-frequency-music/scripts/drive.mjs", "package.json"]
        for name in paths:
            path = repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("original")
        subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
        with patch.object(control, "REPO", repo), patch.object(control, "SKILL", skill):
            for name in paths:
                before = control.fingerprint()
                (repo / name).write_text("edited")
                self.assertNotEqual(before, control.fingerprint(), name)
            before = control.fingerprint()
            (repo / "web/src/new.ts").write_text("new module")
            self.assertNotEqual(before, control.fingerprint())
            before = control.fingerprint()
            for name in ["evidence/run/instance.json", "scripts/__pycache__/control.pyc"]:
                path = skill / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("self-mutating")
            self.assertEqual(before, control.fingerprint())

    def test_browser_failure_overwrites_previous_doctor_pass(self):
        info = {"pgid": 42, "process_started": "owned", "head": "head",
                "source_sha256": "source", "port": 99, "url": "http://127.0.0.1:99",
                "mode": "offline-local-ui"}
        receipt = self.base / "doctor-process.json"
        control.write_json(receipt, {"status": "pass"})
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self): return b"/src/main.tsx"
        with patch.object(control, "directory", return_value=self.base), \
             patch.object(control, "state", return_value=info), \
             patch.object(control, "group_members", return_value=[42]), \
             patch.object(control, "command", side_effect=["owned", "head"]), \
             patch.object(control, "fingerprint", return_value="source"), \
             patch.object(control, "listeners", return_value=[42]), \
             patch.object(control.urllib.request, "urlopen", return_value=Response()), \
             patch.object(control, "drive", side_effect=RuntimeError("browser assertion failed")):
            with self.assertRaisesRegex(RuntimeError, "browser assertion"):
                control.doctor("safe-run")
        self.assertEqual(json.loads(receipt.read_text())["status"], "fail")

    def test_preflight_failure_overwrites_previous_doctor_pass(self):
        receipt = self.base / "doctor-process.json"
        control.write_json(receipt, {"status": "pass"})
        with patch.object(control, "directory", return_value=self.base), \
             patch.object(control, "state", side_effect=RuntimeError("missing instance")):
            with self.assertRaisesRegex(RuntimeError, "missing instance"):
                control.doctor("safe-run")
        self.assertEqual(json.loads(receipt.read_text())["status"], "fail")

    def run_failed_launch(self, failure):
        out = self.base / "proof"
        scratch = self.base / "frequency-safe-run-owned"
        child_file = self.base / "child.pid"
        spawned = []
        popen = subprocess.Popen
        command = control.command
        write_json = control.write_json
        def write_receipt(path, data):
            if failure == "receipt" and path.name == "instance.json":
                raise OSError("receipt write failed")
            return write_json(path, data)
        def spawn(args, **kwargs):
            if args[0] != "vp":
                return popen(args, **kwargs)
            if failure == "popen":
                raise FileNotFoundError("vp unavailable")
            descendant = ("import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)"
                          if failure == "stubborn" else "import time; time.sleep(60)")
            program = ("import subprocess,sys,time; "
                       f"p=subprocess.Popen([sys.executable,'-c',{descendant!r}]); "
                       f"open({str(child_file)!r},'w').write(str(p.pid)); " +
                       ("time.sleep(0.2); sys.exit(7)" if failure in ("leader-exit", "stubborn") else "time.sleep(60)"))
            proc = popen([sys.executable, "-c", program], **kwargs)
            spawned.append(proc)
            deadline = time.monotonic() + 5
            while not child_file.exists():
                if time.monotonic() > deadline:
                    raise RuntimeError("fixture did not start")
                time.sleep(0.01)
            if failure == "interrupt":
                # Signal in the window immediately after Popen, before identity/receipt.
                os.kill(os.getpid(), signal.SIGTERM)
            return proc
        def inspect(args, **kwargs):
            if failure == "ps" and args[:2] == ["ps", "-p"]:
                raise subprocess.CalledProcessError(1, args)
            return command(args, **kwargs)
        def allocate(**_):
            scratch.mkdir()
            return str(scratch)
        try:
            with patch.object(control, "directory", return_value=out), \
                 patch.object(control.tempfile, "mkdtemp", side_effect=allocate), \
                 patch.object(control.subprocess, "Popen", side_effect=spawn), \
                 patch.object(control, "command", side_effect=inspect), \
                 patch.object(control, "write_json", side_effect=write_receipt):
                with self.assertRaises((RuntimeError, OSError, subprocess.SubprocessError, KeyboardInterrupt)):
                    control.launch("safe-run", 0)
            if spawned:
                self.assertEqual(control.group_members(spawned[0].pid), [], "descendant survived")
                self.assertIsNotNone(spawned[0].returncode, "leader was not reaped")
            self.assertFalse(scratch.exists(), "scratch survived failed launch")
            self.assertTrue((out / "launch.log").exists(), "lost diagnostic evidence")
            receipt = json.loads((out / "launch-cleanup.json").read_text())
            self.assertEqual(receipt["status"], "pass")
            self.assertTrue(receipt["scratch_removed"])
            self.assertTrue(receipt["leader_reaped"])
        finally:
            for proc in spawned:
                if proc.returncode is None:
                    try: os.killpg(proc.pid, signal.SIGKILL)
                    except ProcessLookupError: pass
                    proc.wait(timeout=5)

    def test_missing_executable_removes_scratch(self):
        self.run_failed_launch("popen")

    def test_identity_lookup_failure_stops_unreceipted_descendant(self):
        self.run_failed_launch("ps")

    def test_leader_exit_stops_real_descendant_before_reaping(self):
        self.run_failed_launch("leader-exit")

    def test_receipt_failure_stops_unreceipted_descendant(self):
        self.run_failed_launch("receipt")

    def test_leader_exit_escalates_for_sigterm_ignoring_descendant(self):
        self.run_failed_launch("stubborn")

    def test_interrupt_before_receipt_stops_real_descendant(self):
        # Run this in a separate interpreter: old code's missing SIGTERM handler
        # must not kill the suite itself.
        if os.environ.get("FREQUENCY_INTERRUPT_CHILD") == "1":
            self.run_failed_launch("interrupt")
            return
        result = subprocess.run([sys.executable, str(Path(__file__).resolve()),
                                 "ReviewRegressions.test_interrupt_before_receipt_stops_real_descendant"],
                                env=dict(os.environ, FREQUENCY_INTERRUPT_CHILD="1"),
                                capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
