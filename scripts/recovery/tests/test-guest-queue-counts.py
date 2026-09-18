import importlib.util
import pathlib
import unittest
import tempfile
import os
import json
import http.server
import threading
import subprocess
import sys

spec = importlib.util.spec_from_file_location("counts", pathlib.Path(__file__).parents[1] / "guest-queue-counts.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def page(rows, done=True, cursor="", **extra):
    return {"status": "success", "value": {"page": rows, "isDone": done, "continueCursor": cursor, **extra}}

def row(identity="a", status="running", created=1):
    return {"_id": identity, "status": status, "_creationTime": created, "secret_payload": "NEVER_EMIT"}

class Counts(unittest.TestCase):
    def test_complete_aggregate_and_no_payload(self):
        pages = iter([page([row()], False, "next"), page([row("b", "completed", 2)])])
        result = m.count_pages(lambda _: next(pages))
        self.assertEqual(result["counts"]["running"], 1)
        self.assertEqual(result["rows"], 2)
        self.assertFalse(result["worker_idle_proven"])
        self.assertFalse(result["atomic"])
        self.assertNotIn("NEVER_EMIT", str(result))

    def test_rejects_invalid_and_incomplete_results(self):
        for value in [page([row(status="invented")]), page([row(), row()]),
                      page([row(created=2), row("b", created=1)]),
                      page([], pageStatus="SplitRecommended"),
                      {"status": "error", "errorMessage": "NEVER_EMIT"}, page([], False)]:
            with self.subTest(value=value), self.assertRaises(m.Rejected):
                m.count_pages(lambda _: value)

    def test_rejects_cursor_cycle(self):
        with self.assertRaisesRegex(m.Rejected, "cursor_cycle"):
            m.count_pages(lambda _: page([], False, "same"))

    def test_empty_is_complete_not_idle_proof(self):
        result = m.count_pages(lambda _: page([]))
        self.assertEqual(result["rows"], 0)
        self.assertFalse(result["worker_idle_proven"])

    def test_http_request_and_secret_free_result(self):
        seen = []
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_POST(self):
                request = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                seen.append((self.path, self.headers["Authorization"], request))
                body = json.dumps(page([row()])).encode()
                self.send_response(200); self.end_headers(); self.wfile.write(body)
        server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp:
                key = pathlib.Path(temp) / "key"; key.write_text("test-secret"); key.chmod(0o600)
                result = m.collect("http://127.0.0.1:" + str(server.server_port), str(key))
                self.assertEqual(result["counts"]["running"], 1)
                self.assertNotIn("test-secret", str(result))
                self.assertEqual(seen[0][0], "/api/query")
                self.assertEqual(seen[0][1], "Convex test-secret")
                self.assertEqual(seen[0][2]["path"], "_system/cli/tableData")
                self.assertEqual(seen[0][2]["args"][0]["table"], "agentRuns")
                key.chmod(0o644)
                with self.assertRaisesRegex(m.Rejected, "key_file_permissions"):
                    m.collect("http://127.0.0.1:" + str(server.server_port), str(key))
                self.assertEqual(len(seen), 1)
        finally:
            server.shutdown(); server.server_close(); thread.join()

    def test_process_deadline_stops_hung_reader(self):
        code = "import importlib.util,time; s=importlib.util.spec_from_file_location('m'," + repr(str(pathlib.Path(m.__file__))) + "); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.DEADLINE=.1; m.collect=lambda *_:time.sleep(30); m.main()"
        result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=3)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout), {"complete": False, "code": "deadline_exceeded"})
        self.assertEqual(result.stderr, "")

    def test_hostname_loopback_is_rejected_without_resolution(self):
        with self.assertRaisesRegex(m.Rejected, "origin_not_loopback"):
            m.collect("http://localhost:3210", "/absent/key")

    def test_nonlocal_origin_rejected_before_key_read(self):
        with self.assertRaisesRegex(m.Rejected, "origin_not_loopback"):
            m.collect("http://production.invalid", "/absent/key")

if __name__ == "__main__":
    unittest.main()
