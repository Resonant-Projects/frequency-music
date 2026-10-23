"""Safety boundaries for local deployment ownership and environment isolation."""
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("control", Path(__file__).with_name("control.py"))
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)


class LocalBoundary(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.patch = patch.object(control, "RUNS", Path(self.temp.name))
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.info = {
            "repo": str(control.REPO), "run": "proof", "name": "frequency-verify-proof",
            "owner": str(control.REPO) + ":proof", "backend": "http://127.0.0.1:3210",
            "site": "http://127.0.0.1:3211", "frontend": "http://127.0.0.1:4173",
        }
        self.out = control.directory("proof")
        self.out.mkdir()
        self.save()

    def save(self):
        (self.out / "instance.json").write_text(json.dumps(self.info))

    def test_nonlocal_or_ambiguous_origins_refused_before_any_command(self):
        for origin in ["https://remote.invalid", "http://localhost:3210", "http://127.0.0.1:3210/path",
                       "http://user@127.0.0.1:3210", "http://127.0.0.1:9", "http://127.0.0.1:99999"]:
            for key in ["backend", "site", "frontend"]:
                with self.subTest(origin=origin, key=key):
                    prior = self.info[key]
                    self.info[key] = origin
                    self.save()
                    with patch.object(control, "execute") as execute, self.assertRaises(RuntimeError):
                        control.deploy("proof")
                    execute.assert_not_called()
                    self.info[key] = prior

    def test_clean_environment_carries_no_inherited_credentials_or_urls(self):
        with patch.dict(control.os.environ, {"CONVEX_SELF_HOSTED_ADMIN_KEY": "synthetic-foreign-key",
                    "CONVEX_SELF_HOSTED_URL": "https://remote.invalid", "ANTHROPIC_API_KEY": "synthetic",
                    "VITE_CONVEX_URL": "https://remote.invalid", "HTTP_PROXY": "http://remote.invalid"}):
            self.assertEqual(set(control.clean_env()), {"PATH", "CI", "APP_ENV", "NO_COLOR"})

    def test_invalid_run_ids_cannot_escape_owned_directory(self):
        for run in ["../foreign", "/tmp/foreign", "a/b", "", "A", "a" * 47]:
            with self.subTest(run=run), self.assertRaises(ValueError):
                control.directory(run)

    def test_docker_is_pinned_to_local_socket_with_no_inherited_secrets(self):
        with patch.dict(control.os.environ, {"DOCKER_HOST": "tcp://remote.invalid:2376", "DOCKER_CONTEXT": "foreign",
                                           "CONVEX_SELF_HOSTED_ADMIN_KEY": "synthetic-foreign-key"}):
            with patch.object(control.subprocess, "check_output", return_value="local\n") as command:
                self.assertEqual(control.execute(["docker", "version"]), "local")
                self.assertEqual(command.call_args.kwargs["env"], {
                    "PATH": control.os.environ["PATH"], "DOCKER_HOST": "unix:///var/run/docker.sock",
                })

    def test_state_cannot_name_another_checkouts_resources(self):
        for key in ["repo", "owner", "name", "run"]:
            with self.subTest(key=key):
                prior = self.info[key]
                self.info[key] = "foreign"
                self.save()
                with self.assertRaises(RuntimeError):
                    control.load("proof")
                self.info[key] = prior

    def test_foreign_docker_label_refuses_cleanup_without_skipping_safe_cleanup(self):
        for filename in ("local-admin-key", "local.env", "identity.json"):
            (self.out / filename).write_text("secret")
        present = SimpleNamespace(returncode=0, stderr="")
        with patch.object(control, "_inspect_resource", return_value=present), \
             patch.object(control, "execute", return_value='[{"Config":{"Labels":{}}}]') as execute:
            with self.assertRaisesRegex(RuntimeError, "Refusing foreign container"):
                control.stop("proof")
        self.assertEqual(len(execute.call_args_list), 3)
        self.assertTrue(all("rm" not in call.args[0] for call in execute.call_args_list))
        cleanup = json.loads((self.out / "cleanup.json").read_text())
        self.assertEqual(cleanup["status"], "fail")
        self.assertTrue(cleanup["local_credentials_removed"])

    def test_deploy_failure_still_tears_down_the_owned_run(self):
        with patch.object(control, "start") as start, patch.object(control, "deploy", side_effect=RuntimeError("failed")), \
             patch.object(control, "stop") as stop:
            with self.assertRaisesRegex(RuntimeError, "failed"):
                control.run_all("proof")
            start.assert_called_once_with("proof")
            stop.assert_called_once_with("proof")


    def test_execute_allows_a_longer_command_timeout(self):
        with patch.object(control.subprocess, "check_output", return_value="ok\n") as command:
            self.assertEqual(control.execute(["docker", "pull", control.IMAGE], timeout=900), "ok")
        self.assertEqual(command.call_args.kwargs["timeout"], 900)

    def test_fingerprint_handles_a_deleted_tracked_file(self):
        with patch.object(control, "REPO", Path(self.temp.name)), \
             patch.object(control, "execute", return_value="deleted.txt\0"):
            self.assertEqual(len(control.fingerprint()), 64)

    def test_missing_image_is_pulled_with_a_long_timeout(self):
        missing = SimpleNamespace(returncode=1, stderr="Error: No such image")
        with patch.object(control, "_inspect_resource", return_value=missing), \
             patch.object(control, "execute") as execute:
            control._ensure_image()
        execute.assert_called_once_with(["docker", "pull", control.IMAGE], timeout=900)

    def test_existing_volume_is_refused_before_creation(self):
        present = SimpleNamespace(returncode=0, stderr="")
        with patch.object(control, "_inspect_resource", return_value=present):
            with self.assertRaisesRegex(RuntimeError, "reuse existing volume"):
                control._require_fresh_volume("frequency-verify-proof")

    def test_stop_preserves_a_preexisting_owned_volume_rejected_by_start(self):
        self.info["created_resources"] = {"network": True, "volume": False, "container": False}
        self.save()
        present = SimpleNamespace(returncode=0, stderr="")
        with patch.object(control, "_inspect_resource", return_value=present), \
             patch.object(control, "execute", return_value='[{"Config":{"Labels":{}}}]') as execute:
            with self.assertRaisesRegex(RuntimeError, "Refusing foreign"):
                control.stop("proof")
        self.assertTrue(all("volume" not in call.args[0] for call in execute.call_args_list))

    def test_stop_reports_daemon_failure_after_removing_credentials(self):
        for filename in ("local-admin-key", "local.env", "identity.json"):
            (self.out / filename).write_text("secret")
        unavailable = SimpleNamespace(returncode=1, stderr="Cannot connect to the Docker daemon")
        with patch.object(control, "_inspect_resource", return_value=unavailable):
            with self.assertRaisesRegex(RuntimeError, "Cleanup failed"):
                control.stop("proof")
        cleanup = json.loads((self.out / "cleanup.json").read_text())
        self.assertEqual(cleanup["status"], "fail")
        self.assertIn("container inspect failed", " ".join(cleanup["errors"]))
        self.assertTrue(cleanup["local_credentials_removed"])
        self.assertFalse((self.out / "local-admin-key").exists())

    def test_stop_catches_ownership_probe_timeout(self):
        (self.out / "local-admin-key").write_text("secret")
        present = SimpleNamespace(returncode=0, stderr="")
        timeout = subprocess.TimeoutExpired(["docker", "inspect"], 30)
        with patch.object(control, "_inspect_resource", return_value=present), \
             patch.object(control, "owned", side_effect=timeout):
            with self.assertRaisesRegex(RuntimeError, "Cleanup failed"):
                control.stop("proof")
        cleanup = json.loads((self.out / "cleanup.json").read_text())
        self.assertEqual(cleanup["status"], "fail")
        self.assertIn("ownership check failed", " ".join(cleanup["errors"]))
        self.assertTrue(cleanup["local_credentials_removed"])

    def test_stop_continues_after_probe_timeout_and_cleans_later_resources(self):
        for filename in ("local-admin-key", "local.env", "identity.json"):
            (self.out / filename).write_text("secret")
        missing = SimpleNamespace(returncode=1, stderr="Error: No such object")
        timeout = subprocess.TimeoutExpired(["docker"], 30)
        with patch.object(control, "_inspect_resource", side_effect=[timeout, missing, missing]) as inspect:
            with self.assertRaisesRegex(RuntimeError, "Cleanup failed"):
                control.stop("proof")
        self.assertEqual(inspect.call_count, 3)
        cleanup = json.loads((self.out / "cleanup.json").read_text())
        self.assertEqual(cleanup["status"], "fail")
        self.assertIn("container inspect timed out", cleanup["errors"])
        self.assertTrue(cleanup["local_credentials_removed"])

    def test_exercise_bounds_seed_and_browser_subprocesses(self):
        calls = []
        def run(*args, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(returncode=0)
        with patch.object(control, "owned"), patch.object(control, "check_source"), \
             patch.object(control, "_run_bounded", side_effect=run):
            control.exercise("proof")
        self.assertEqual([call["timeout"] for call in calls], [120, 900])

    def test_bounded_child_timeout_terminates_and_reaps_the_process_group(self):
        process = SimpleNamespace(pid=1234, wait=unittest.mock.Mock(return_value=0))
        with patch.object(control.subprocess, "Popen", return_value=process), \
             patch.object(control, "_wait_for_process", side_effect=subprocess.TimeoutExpired(["node"], 120)), \
             patch.object(control, "_descendant_pids", return_value=set()), \
             patch.object(control, "_process_group_exists", return_value=True), \
             patch.object(control.os, "killpg") as killpg:
            with self.assertRaises(subprocess.TimeoutExpired):
                control._run_bounded(["node", "seed.mjs"], timeout=120)
        self.assertEqual(killpg.call_count, 2)

    def test_bounded_nonzero_child_terminates_descendants(self):
        process = SimpleNamespace(pid=1236, wait=unittest.mock.Mock(return_value=0))
        with patch.object(control.subprocess, "Popen", return_value=process), \
             patch.object(control, "_wait_for_process", return_value=(3, set())), \
             patch.object(control, "_process_group_exists", return_value=True), \
             patch.object(control.os, "killpg") as killpg:
            with self.assertRaises(subprocess.CalledProcessError):
                control._run_bounded(["playwright"], timeout=900)
        self.assertEqual(killpg.call_count, 2)

    def test_bounded_child_kills_detached_descendant_group(self):
        process = SimpleNamespace(pid=1237, wait=unittest.mock.Mock(return_value=0))
        with patch.object(control.subprocess, "Popen", return_value=process), \
             patch.object(control, "_wait_for_process", side_effect=subprocess.TimeoutExpired(["node"], 120)), \
             patch.object(control, "_descendant_pids", side_effect=[{5678}, {5678}, {5678}]), \
             patch.object(control, "_process_group_exists", return_value=False), \
             patch.object(control.os, "kill") as kill:
            with self.assertRaises(subprocess.TimeoutExpired):
                control._run_bounded(["playwright"], timeout=900)
        self.assertEqual(
            kill.call_args_list,
            [
                unittest.mock.call(5678, control.signal.SIGTERM),
                unittest.mock.call(5678, control.signal.SIGKILL),
            ],
        )

    def test_bounded_child_interrupt_terminates_and_reaps_the_process_group(self):
        process = SimpleNamespace(pid=1235, wait=unittest.mock.Mock(return_value=0))
        with patch.object(control.subprocess, "Popen", return_value=process), \
             patch.object(control, "_wait_for_process", side_effect=KeyboardInterrupt()), \
             patch.object(control, "_descendant_pids", return_value=set()), \
             patch.object(control, "_process_group_exists", return_value=True), \
             patch.object(control.os, "killpg") as killpg:
            with self.assertRaises(KeyboardInterrupt):
                control._run_bounded(["node", "seed.mjs"], timeout=120)
        self.assertEqual(killpg.call_count, 2)

    def test_failed_start_relay_uses_live_handle_before_signalling(self):
        relay = SimpleNamespace(pid=4322, poll=unittest.mock.Mock(return_value=None), wait=unittest.mock.Mock())
        info = {"relay_started": None}
        receipt = self.out / "instance.json"
        with patch.object(control, "_stop_process_group") as terminate:
            control._cleanup_failed_start_relay(relay, info, receipt)
        terminate.assert_called_once_with(relay)
        self.assertEqual(info["relay_started"], "<relay-exited-during-start>")

    def test_failed_start_relay_does_not_signal_a_reused_pid(self):
        relay = SimpleNamespace(pid=4323, poll=unittest.mock.Mock(return_value=1), wait=unittest.mock.Mock())
        info = {"relay_started": None}
        receipt = self.out / "instance.json"
        with patch.object(control, "_stop_process_group") as terminate:
            control._cleanup_failed_start_relay(relay, info, receipt)
        terminate.assert_not_called()
        self.assertEqual(info["relay_started"], "<relay-exited-during-start>")

    def test_stop_refuses_to_signal_an_unverified_relay_identity(self):
        self.info["relay_pid"] = 4321
        self.info["relay_started"] = None
        self.save()
        missing = SimpleNamespace(returncode=1, stderr="Error: No such object")
        with patch.object(control.os, "killpg") as killpg, \
             patch.object(control, "_inspect_resource", return_value=missing):
            with self.assertRaisesRegex(RuntimeError, "Cleanup failed"):
                control.stop("proof")
        killpg.assert_not_called()
        cleanup = json.loads((self.out / "cleanup.json").read_text())
        self.assertIn("Relay identity was not verified", " ".join(cleanup["errors"]))

    def test_journeys_are_serial_because_later_steps_use_the_first_source(self):
        source = (control.REPO / "web/tests/local/journeys.spec.ts").read_text()
        self.assertIn('test.describe.configure({ mode: "serial" });', source)


if __name__ == "__main__":
    unittest.main()
