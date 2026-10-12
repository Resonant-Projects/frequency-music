#!/usr/bin/env python3
"""Offline safety/contract tests; never launch the application or contact Convex."""
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import tempfile
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


if __name__ == "__main__":
    unittest.main()
