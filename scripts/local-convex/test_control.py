"""Safety boundaries for local deployment ownership and environment isolation."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
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

    def test_foreign_docker_label_refuses_cleanup(self):
        with patch.object(control.subprocess, "run") as inspect:
            inspect.return_value.returncode = 0
            with patch.object(control, "execute", return_value='[{"Config":{"Labels":{}}}]') as execute:
                with self.assertRaisesRegex(RuntimeError, "Refusing foreign container"):
                    control.stop("proof")
                self.assertEqual(len(execute.call_args_list), 1)
                self.assertNotIn("rm", execute.call_args.args[0])

    def test_deploy_failure_still_tears_down_the_owned_run(self):
        with patch.object(control, "start") as start, patch.object(control, "deploy", side_effect=RuntimeError("failed")), \
             patch.object(control, "stop") as stop:
            with self.assertRaisesRegex(RuntimeError, "failed"):
                control.run_all("proof")
            start.assert_called_once_with("proof")
            stop.assert_called_once_with("proof")


if __name__ == "__main__":
    unittest.main()
