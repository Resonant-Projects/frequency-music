import base64
import hashlib
import http.server
import importlib.util
import json
import os
import pathlib
import stat
import subprocess
import sys
import tempfile
import threading
import unittest

spec = importlib.util.spec_from_file_location("reads", pathlib.Path(__file__).parents[1] / "guest-receipt-reads.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

SECRET = "NEVER_EMIT"
BLOB = b"x" * 3000
BLOB_SHA = base64.b64encode(hashlib.sha256(BLOB).digest()).decode()
SCHEMA = json.dumps({"tables": [{"tableName": "claims", "indexes": []}], "schemaValidation": True})
# metadataHash() from scripts/lib/convex-deployment-inspect.ts over FIXTURE, run with vpx tsx.
FIXTURE = json.loads(r'''{"tables":[{"tableName":"claims","indexes":[{"indexDescriptor":"by_status","fields":["status"]}],"documentType":{"type":"object","value":{"status":{"fieldType":{"type":"union","value":[{"type":"literal","value":"active"},{"type":"literal","value":"superseded"}]},"optional":false},"n":{"fieldType":{"type":"number"},"optional":true},"é ünï \"q\" \\ \n\t\u0001\u001f":{"fieldType":{"type":"any"},"optional":false}}}}],"schemaValidation":true,"zeta":null,"alpha":[1,2,3,-7,0,12345678901],"Bool":false,"_x":{"b":true,"a":"😀","B":"Z"}}''')
FIXTURE_TS_HASH = "912c66cb81db6b56e97d345f0506a98f3e251bc932d4748d3caeb7a70c9d2b90"


def integer(n):
    return {"$integer": base64.b64encode(n.to_bytes(8, "little", signed=True)).decode()}


def uuid_for(artifact_id):
    return "00000000-0000-4000-8000-%012d" % int(artifact_id[1:])


HIDDEN = "a3"  # blind-hidden: playbackInternal returns null


def backend(tables, storage_overrides=None, split_once=False, probes_fail=True):
    seen = {"requests": [], "split": split_once}
    components = [
        {"id": "root", "name": None, "path": "", "state": "active", "httpPrefix": None, "args": {}},
        {"id": "c1", "name": "workflow", "path": "workflow", "state": "active", "args": {"secret": SECRET}},
    ]
    modules = [
        [None, [["crons.js", {"functions": [{"name": "default", "udfType": "Query", "visibility": {"kind": "public"}, "args": SECRET}],
                              "cronSpecs": [["tick", {"udfPath": "a:b", "udfArgs": SECRET,
                                                      "cronSchedule": {"type": "daily", "hourUTC": integer(4), "minuteUTC": integer(5)}}]]}]]],
        ["c1", [["workflow.js", {"functions": [{"name": "list", "udfType": "Query", "visibility": {"kind": "public"}}]}]]],
    ]

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def send(self, code, obj):
            raw = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            seen["requests"].append(("GET", self.path, self.headers.get("Authorization")))
            # Like upstream storage_get: the segment must be a UUID, never a document id.
            segment = self.path[len("/api/storage/"):] if self.path.startswith("/api/storage/") else ""
            if len(segment) == 36 and segment.count("-") == 4:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(BLOB)
            else:
                self.send(400, {"code": "InvalidStoragePath"})

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            seen["requests"].append(("POST", self.path, body.get("path"), body.get("componentPath")))
            if self.headers["Authorization"] != "Convex test-key":
                return self.send(401, {})
            if self.path == "/api/function" and body["path"] == "audioArtifacts:playbackInternal":
                assert "componentPath" not in body
                artifact = body["args"]["artifactId"]
                if artifact == HIDDEN:
                    return self.send(200, {"status": "success", "value": None})
                return self.send(200, {"status": "success", "value": {
                    "url": "https://convex.production.invalid/api/storage/" + uuid_for(artifact), "mimeType": "audio/wav"}})
            if self.path == "/api/function":
                if body["componentPath"] == "actionCache" and probes_fail:
                    return self.send(560, {"status": "error", "errorMessage": SECRET})
                return self.send(200, {"status": "success", "value": {"page": [SECRET]}, "logLines": [SECRET]})
            path, args = body["path"], body["args"][0]
            if path == "_system/frontend/components:list":
                value = components
            elif path == "_system/frontend/modules:listForAllComponents":
                value = modules
            elif path == "_system/frontend/getSchemas":
                value = {"active": SCHEMA}
            elif path == "_system/cli/queryEnvironmentVariables:get":
                value = {"name": args["name"], "value": SECRET} if args["name"].endswith("_KEY") else None
            elif path == "_system/cli/tableData":
                rows = tables.get(args["table"], [])
                if args["table"] == "_storage" and storage_overrides:
                    rows = [dict(r, **storage_overrides.get(r["_id"], {})) for r in rows]
                start, n = int(args["paginationOpts"]["cursor"] or 0), args["paginationOpts"]["numItems"]
                if seen["split"] and n > 100:
                    seen["split"] = False
                    return self.send(200, {"status": "success", "value": {"page": rows[start:start + n], "isDone": False,
                                                                          "continueCursor": "bad", "pageStatus": "SplitRequired"}})
                value = {"page": rows[start:start + n], "isDone": start + n >= len(rows),
                         "continueCursor": str(start + n), "pageStatus": None}
            else:
                return self.send(200, {"status": "error", "errorMessage": SECRET})
            self.send(200, {"status": "success", "value": value})

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, seen


def default_tables(storage_count=20):
    return {
        "claims": [{"_id": f"c{i}", "status": "active" if i % 3 else "superseded", "text": SECRET} for i in range(450)],
        "extractions": [{"_id": f"e{i}", "body": SECRET} for i in range(7)],
        "agentRuns": [{"_id": "r1", "status": "completed"}, {"_id": "r2", "status": "invented"}],
        "audioArtifacts": [{"_id": f"a{i}", "status": "ready", "storageId": f"s{i}", "scriptMd": SECRET} for i in range(storage_count)]
        + [{"_id": "ap", "status": "pending"}],
        "_storage": [{"_id": f"s{i}", "size": 3000, "sha256": BLOB_SHA} for i in range(storage_count)],
    }


class Reads(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.temp.name)
        self.key = root / "key"
        self.key.write_text("test-key\n")
        self.key.chmod(0o600)
        self.out = root / "out.json"
        self.saved = (m.ORIGIN, m.KEY_FILE, m.OUT_FILE)
        m.KEY_FILE, m.OUT_FILE = str(self.key), str(self.out)
        m.RECEIVED[0] = 0

    def tearDown(self):
        m.ORIGIN, m.KEY_FILE, m.OUT_FILE = self.saved
        self.temp.cleanup()

    def run_against(self, server):
        m.ORIGIN = "http://127.0.0.1:" + str(server.server_port)
        try:
            outcome = m.collect()
        finally:
            server.shutdown()
            server.server_close()
        return outcome, json.loads(self.out.read_text())

    def test_allowlisted_output_and_no_values(self):
        server, seen = backend(default_tables())
        outcome, result = self.run_against(server)
        text = self.out.read_text()
        self.assertEqual(outcome["outputSha256"], hashlib.sha256(text.encode()).hexdigest())
        self.assertEqual(stat.S_IMODE(os.stat(self.out).st_mode), 0o600)
        for leaked in (SECRET, "test-key"):
            self.assertNotIn(leaked, text)
            self.assertNotIn(leaked, json.dumps(outcome))
        inspection = result["inspection"]
        self.assertEqual(inspection["components"][1], {"id": "c1", "name": "workflow", "path": "workflow", "state": "active",
                                                       "argsCount": 1, "argsOmitted": True})
        self.assertEqual(inspection["modules"][0]["modules"][0]["crons"][0]["schedule"], {"type": "daily", "hourUTC": 4, "minuteUTC": 5})
        self.assertEqual(inspection["modules"][0]["modules"][0]["functions"],
                         [{"name": "default", "udfType": "Query", "visibility": {"kind": "public"}}])
        self.assertEqual([s["componentId"] for s in inspection["schemas"]], [None, "c1"])
        self.assertEqual(inspection["schemas"][0]["activeHash"], m.metadata_hash(json.loads(SCHEMA)))
        self.assertIsNone(inspection["schemas"][0]["inProgressHash"])
        probes = {p["componentPath"]: p for p in result["componentProbes"]}
        self.assertEqual(len(probes), 6)
        self.assertEqual(probes["workflow"], {"componentPath": "workflow", "function": "workflow:list", "status": "success", "resultType": "dict"})
        self.assertEqual(probes["actionCache"], {"componentPath": "actionCache", "function": "lib:get", "status": "error"})
        self.assertEqual(result["environmentPresence"], {name: name.endswith("_KEY") for name in m.ENV_NAMES})
        counts = result["counts"]
        self.assertEqual(counts["claims"]["byStatus"], {"active": 300, "superseded": 150})
        self.assertEqual(counts["agentRuns"]["otherStatusCount"], 1)
        self.assertEqual(counts["extractions"], {"complete": True, "total": 7, "pages": 1})
        self.assertEqual(counts["sources"]["total"], 0)
        self.assertEqual(counts["_storage"], {"complete": True, "total": 20})
        self.assertEqual(result["audioBlobSample"], {"population": 20, "candidatesTried": 9, "noPlaybackUrl": 1,
                                                     "sampled": 8, "passed": 8, "failed": 0, "failures": []})
        storage_gets = [r for r in seen["requests"] if r[0] == "GET"]
        self.assertEqual(len(storage_gets), 8)
        self.assertTrue(all(r[2] is None for r in storage_gets), "the admin key must not travel with blob reads")
        self.assertTrue(all(r[1].startswith("/api/storage/00000000-") for r in storage_gets))
        self.assertFalse(result["allChecksPassed"])
        self.assertEqual(result["checks"], {"inspectionComplete": True, "componentProbesAllSucceeded": False,
                                            "environmentPresenceComplete": True, "countsComplete": True, "blobSamplePassed": True})
        self.assertEqual((outcome["ok"], outcome["classification"], outcome["written"]), (False, "receipt_checks_failed", True))

    def test_all_checks_pass(self):
        server, _ = backend(default_tables(), probes_fail=False)
        outcome, result = self.run_against(server)
        self.assertTrue(result["allChecksPassed"])
        self.assertEqual((outcome["ok"], outcome["classification"]), (True, "receipt_reads_written"))

    def test_exit_status_distinguishes_written_failures(self):
        code = ("import importlib.util; s=importlib.util.spec_from_file_location('m'," + repr(str(pathlib.Path(m.__file__)))
                + "); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.collect=lambda: {'ok': False, 'written': True}; raise SystemExit(m.main())")
        self.assertEqual(subprocess.run([sys.executable, "-c", code], capture_output=True, timeout=5).returncode, 2)
        code = code.replace("'written': True", "'written': False")
        self.assertEqual(subprocess.run([sys.executable, "-c", code], capture_output=True, timeout=5).returncode, 1)

    def test_playback_url_must_be_a_storage_uuid_path(self):
        for url in ("https://x/api/storage/a1", "https://x/api/other/" + uuid_for("a1"), "https://x/api/storage/" + uuid_for("a1") + "?t=1", None):
            with self.subTest(url=url):
                envelope = {"status": "success", "value": {"url": url}}
                original = m.post
                m.post = lambda *_args, **_kw: envelope
                try:
                    self.assertEqual(m.playback_path("http://127.0.0.1:9", "k", "a1"), "playback_url_invalid")
                finally:
                    m.post = original

    def test_blob_mismatches_are_counted_not_described(self):
        overrides = {"s0": {"size": 9}, "s2": {"sha256": base64.b64encode(b"\0" * 32).decode()}}
        server, _ = backend(default_tables(), storage_overrides=overrides)
        _, result = self.run_against(server)
        sample = result["audioBlobSample"]
        self.assertEqual((sample["sampled"], sample["passed"], sample["failed"]), (8, 6, 2))
        self.assertFalse(result["checks"]["blobSamplePassed"])
        self.assertEqual(sorted(sample["failures"]), ["sha256_mismatch", "size_mismatch"])

    def test_missing_storage_row_and_int64_string_size(self):
        tables = default_tables(storage_count=2)
        tables["_storage"] = [{"_id": "s0", "size": "3000", "sha256": BLOB_SHA}]
        server, _ = backend(tables)
        _, result = self.run_against(server)
        self.assertEqual(result["audioBlobSample"]["failures"], ["storage_row_missing"])
        self.assertEqual(result["audioBlobSample"]["passed"], 1)

    def test_split_page_retries_smaller(self):
        server, _ = backend(default_tables(), split_once=True)
        _, result = self.run_against(server)
        self.assertEqual(result["counts"]["claims"]["total"], 450)

    def test_metadata_hash_matches_typescript(self):
        self.assertEqual(m.metadata_hash(FIXTURE), FIXTURE_TS_HASH)

    def test_key_order_matches_utf16_comparison(self):
        value = {"\ue000": 1, "\U0001F600": 2, "a": {"\uffff": True, "\U00010000": False}}
        self.assertEqual(m.metadata_hash(value), "336c3cf03bbe92a0169c7889fc40fad85376a676f788a2e7b15f09853000af3e")

    def test_numbers_match_json_stringify(self):
        # JSON.stringify(v) for each value, printed by node (vpx tsx) on 2026-10-17.
        values = [1.5, 0.1, -2.5e-8, 1e21, 1e-7, 1.2345e-6, 123456789012345680000, 5e-324, 1.7976931348623157e308, 100,
                  1e20, 0.000001, 1.234e-5, -0.0, 3.14159, 2 ** 53 + 2, 0.1 + 0.2, 1e300, 123.456e-10, 2.0]
        expected = ["1.5", "0.1", "-2.5e-8", "1e+21", "1e-7", "0.0000012345", "123456789012345680000", "5e-324",
                    "1.7976931348623157e+308", "100", "100000000000000000000", "0.000001", "0.00001234", "0", "3.14159",
                    "9007199254740994", "0.30000000000000004", "1e+300", "1.23456e-8", "2"]
        self.assertEqual([m.js_number(v) for v in values], expected)
        self.assertEqual(m.js_number(12345678901234567891), m.js_number(float(12345678901234567891)))

    def test_fractional_schema_hash_matches_typescript(self):
        value = {"min": 1.5, "ratio": [0.1, -2.5e-8, 1e21, 1e-7], "big": 123456789012345680000}
        self.assertEqual(m.metadata_hash(value), "20bd5a194b2c7d26c8d3f2d08bd7795589515e41893e7ac446abb32ad4fd9f1b")

    def test_postgres_recovery_emits_fixed_tokens_only(self):
        lines = [
            "2026-10-17 16:30:00.101 UTC [1] LOG:  database system was interrupted; last known up at 2026-10-17 16:14:02 UTC",
            "2026-10-17 16:30:00.200 UTC [1] LOG:  database system was not properly shut down; automatic recovery in progress",
            "2026-10-17 16:30:00.300 UTC [1] LOG:  redo starts at 3/9A2B3C40",
            "2026-10-17 16:30:01.000 UTC [1] LOG:  invalid record length at 3/9B0000A0: expected at least 24, got 0",
            "2026-10-17 16:30:01.010 UTC [1] LOG:  redo done at 3/9B000068 system usage: CPU: user: 0.10 s",
            "2026-10-17 16:30:01.020 UTC [1] LOG:  checkpoint starting: end-of-recovery immediate wait",
            "2026-10-17 16:30:02.000 UTC [1] LOG:  database system is ready to accept connections",
            "2026-10-17 16:30:03.000 UTC [77] ERROR:  relation NEVER_EMIT redo starts at 1/2 does not exist",
            "2026-10-17 16:30:03.000 UTC [77] STATEMENT:  select 'NEVER_EMIT redo starts at 1/2'",
            "2026-10-17 16:30:04.000 UTC [78] LOG:  redo starts at 1/2 NEVER_EMIT",
            "2026-10-17 16:30:05.000 UTC [79] FATAL:  password authentication failed for user NEVER_EMIT",
            "NEVER_EMIT database system is ready to accept connections",
        ]
        result = m.parse_postgres_recovery(lines)
        self.assertNotIn(SECRET, json.dumps(result))
        self.assertEqual([e["event"] for e in result["events"]], [
            "interrupted", "automatic_recovery_in_progress", "redo_starts_at", "wal_end_invalid_record_length_at",
            "redo_done_at", "end_of_recovery_checkpoint_started", "ready_to_accept_connections"])
        self.assertEqual(result["events"][4], {"at": "2026-10-17 16:30:01.010 UTC", "event": "redo_done_at", "value": "3/9B000068"})
        self.assertEqual(result["severityCounts"], {"FATAL": 1, "PANIC": 0, "ERROR": 1, "WARNING": 0})
        self.assertEqual(result["linesScanned"], len(lines))

    def test_postgres_recovery_rejects_bad_since(self):
        for since in ("", "2026-10-17 16:30:00", "1h", "2026-10-17T16:30:00Z; rm -rf /"):
            with self.subTest(since=since), self.assertRaisesRegex(m.Rejected, "invalid_since"):
                m.postgres_recovery(since)

    def test_cron_schedule_bounds(self):
        with self.assertRaises(m.Rejected):
            m.cron_schedule({"type": "daily", "hourUTC": integer(24)})
        with self.assertRaises(m.Rejected):
            m.cron_schedule({"type": "cron", "cronExpr": "@daily"})
        self.assertEqual(m.cron_schedule({"type": "hourly"}), {"type": "hourly"})

    def test_non_numeric_loopback_rejected_before_key_read(self):
        for origin in ("http://localhost:3210", "http://production.invalid", "https://127.0.0.1:3210", "http://u:p@127.0.0.1:3210"):
            m.ORIGIN, m.KEY_FILE = origin, "/absent/key"
            with self.subTest(origin=origin), self.assertRaisesRegex(m.Rejected, "origin_not_loopback"):
                m.collect()

    def test_key_file_must_be_private_regular_file(self):
        m.ORIGIN = "http://127.0.0.1:9"
        self.key.chmod(0o644)
        with self.assertRaisesRegex(m.Rejected, "key_file_permissions"):
            m.collect()
        self.key.chmod(0o600)
        link = pathlib.Path(self.temp.name) / "link"
        link.symlink_to(self.key)
        m.KEY_FILE = str(link)
        with self.assertRaisesRegex(m.Rejected, "key_file_unreadable"):
            m.collect()

    def test_refuses_existing_output(self):
        m.ORIGIN = "http://127.0.0.1:9"
        self.out.write_text("{}")
        with self.assertRaisesRegex(m.Rejected, "output_exists"):
            m.collect()

    def test_process_deadline_stops_hung_reader(self):
        code = ("import importlib.util,time; s=importlib.util.spec_from_file_location('m'," + repr(str(pathlib.Path(m.__file__)))
                + "); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.DEADLINE=.1; m.collect=lambda: time.sleep(30); m.main()")
        result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout), {"ok": False, "classification": "deadline_exceeded"})
        self.assertEqual(result.stderr, "")


if __name__ == "__main__":
    unittest.main()
