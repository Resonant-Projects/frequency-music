#!/usr/bin/env python3
"""Bounded, read-only restore-receipt reads from an isolated guest's Convex backend.

Runs inside a network-isolated restore guest (Python 3.9+ standard library
only, with guest_receipt_metadata.py and guest_receipt_postgres.py beside it), under the same guest-side admin-key trap that `read-identities` uses.
It reads, from a numeric-loopback origin only:

* the deployment metadata `scripts/lib/convex-deployment-inspect.ts` reads
  (components, per-component module and function inventory, cron schedules,
  per-component schema fingerprints), reproduced in the same output shape so
  it can be compared with a live inspection file offline;
* one fixed read-only query per expected component;
* presence (never values) of a fixed list of environment variable names;
* with `--postgres-recovery <container start time>` instead (no key used):
  PostgreSQL's first-start recovery events as fixed tokens with their
  timestamp and LSN, plus severity counts, parsed from `docker logs` in memory;
* document counts for a fixed table list, with `claims` and `audioArtifacts`
  split by an allowlisted `status`;
* for a bounded sample of ready `audioArtifacts` rows, whether the referenced
  `_storage` blob is readable through the URL the deployed
  `audioArtifacts:playbackInternal` query resolves (path only, fetched from
  loopback without the key), and its byte length and SHA-256 match the
  `_storage` metadata row. The row itself records no byte size.

Exit status: 0 when every check this reader decides passes, 2 when the file
was written but a check failed (see `checks`), 1 when nothing was written.

Raw responses, rows, values, ids, error messages and log lines stay in
memory and are discarded. The output file (new, mode 0600) holds only the
allowlisted shapes above; stdout holds a fixed classification and the output
digest. A watchdog ends the process after RESTORE_RECEIPT_DEADLINE_SECONDS.
"""

import base64
import hashlib
import json
import os
import re
import stat
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request

# The host pushes the two modules beside this script and removes all three
# afterwards, so leave no bytecode directory behind in the guest.
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from guest_receipt_metadata import Rejected, cron_schedule, inspect, js_number, metadata_hash  # noqa: E402,F401
from guest_receipt_postgres import parse_postgres_recovery, postgres_recovery  # noqa: E402,F401

ORIGIN = os.environ.get("RESTORE_BACKEND_ORIGIN", "http://127.0.0.1:3210")
KEY_FILE = os.environ.get("RESTORE_ADMIN_KEY_FILE", "/root/.restore-admin-key")
OUT_FILE = os.environ.get("RESTORE_RECEIPT_OUT", "/root/restore-receipt-reads.json")
DEADLINE = float(os.environ.get("RESTORE_RECEIPT_DEADLINE_SECONDS", "1500"))
CLIENT = "npm-1.48.0"  # AUDITED_CONVEX_VERSION in scripts/lib/convex-provenance.ts
RESPONSE_CAP = 32 * 1024 * 1024
TOTAL_CAP = 4 * 1024 * 1024 * 1024
BLOB_CAP = 256 * 1024 * 1024
SAMPLE_SIZE = 8
SAMPLE_CANDIDATES = 32  # blind-hidden artifacts resolve no playback URL and are skipped
PROBE_NAME = "restore-receipt-probe"

# One read-only query per expected component, with arguments that touch no
# external system. Results are classified by type only.
COMPONENT_PROBES = (
    ("workflow", "workflow:list", {"order": "desc", "paginationOpts": {"numItems": 1, "cursor": None}}),
    ("workflow/workpool", "lib:statusBatch", {"ids": []}),
    ("workflow/workpool/batchWorker", "lib:status", {"name": PROBE_NAME}),
    ("aggregate", "btree:paginateNamespaces", {"limit": 1}),
    ("aggregate/batchWorker", "lib:status", {"name": PROBE_NAME}),
    ("actionCache", "lib:get", {"name": PROBE_NAME, "args": {}, "ttl": None}),
)
ENV_NAMES = (
    "FREQUENCY_WORKER_CLAIMS_PAUSED",
    "DECISION_SIGNERS_ENABLED",
    "DOCKET_PREPARATION_ENABLED",
    "HYPOTHESIS_TOURNAMENT_ENABLED",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "AGENT_TOOL_SECRET",
)
# table -> allowlisted status values (None: total count only)
COUNT_TABLES = (
    ("claims", ("active", "superseded")),
    ("extractions", None),
    ("sources", None),
    ("agentRuns", ("queued", "running", "needs_review", "completed", "failed", "cancelled")),
    ("mediaJobs", None),
    ("audioArtifacts", ("pending", "ready", "failed")),
)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirect, urllib.request.ProxyHandler({}))
RECEIVED = [0]


def require_loopback(origin):
    parts = urllib.parse.urlsplit(origin)
    if (parts.scheme != "http" or parts.hostname not in ("127.0.0.1", "::1")
            or parts.username or parts.password or parts.path not in ("", "/")
            or parts.query or parts.fragment):
        raise Rejected("origin_not_loopback")
    return origin.rstrip("/")


def read_key():
    try:
        fd = os.open(KEY_FILE, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError:
        raise Rejected("key_file_unreadable") from None
    with os.fdopen(fd, "r") as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_uid != os.getuid():
            raise Rejected("key_file_permissions")
        key = handle.read(16385).strip()
    if not key or len(key) > 16384 or any(c.isspace() for c in key):
        raise Rejected("key_file_malformed")
    return key


def post(base, key, endpoint, body):
    request = urllib.request.Request(
        base + endpoint, json.dumps(body).encode("utf-8"),
        {"Content-Type": "application/json", "Authorization": "Convex " + key, "Convex-Client": CLIENT},
        method="POST")
    try:
        with OPENER.open(request, timeout=60) as response:
            raw = response.read(RESPONSE_CAP + 1)
    except urllib.error.HTTPError as error:
        # 560 carries a UDF error envelope; read it so the caller can classify.
        try:
            if error.code != 560:
                raise Rejected("http_error") from None
            raw = error.read(RESPONSE_CAP + 1)
        finally:
            error.close()
    except Exception:  # noqa: BLE001 - classified without detail
        raise Rejected("transport_error") from None
    RECEIVED[0] += len(raw)
    if len(raw) > RESPONSE_CAP or RECEIVED[0] > TOTAL_CAP:
        raise Rejected("byte_limit")
    try:
        envelope = json.loads(raw)
    except ValueError:
        raise Rejected("malformed_response") from None
    if not isinstance(envelope, dict) or envelope.get("status") not in ("success", "error"):
        raise Rejected("malformed_response")
    return envelope


def query(base, key, path, args, fmt="convex_encoded_json"):
    envelope = post(base, key, "/api/query", {"path": path, "format": fmt, "args": [args]})
    if envelope["status"] != "success":
        raise Rejected("query_failed")
    return envelope.get("value")


# ---- component execution probes ----

def component_probes(base, key):
    results = []
    for component_path, function, args in COMPONENT_PROBES:
        entry = {"componentPath": component_path, "function": function}
        try:
            envelope = post(base, key, "/api/function",
                            {"componentPath": component_path, "path": function, "format": "json", "args": args})
            entry["status"] = envelope["status"]
            if envelope["status"] == "success":
                value = envelope.get("value")
                entry["resultType"] = "null" if value is None else type(value).__name__
        except Rejected as error:
            entry["status"] = "rejected"
            entry["classification"] = str(error)
        results.append(entry)
    return results


# ---- environment variable presence ----

def env_presence(base, key):
    presence = {}
    for name in ENV_NAMES:
        value = query(base, key, "_system/cli/queryEnvironmentVariables:get", {"name": name}, fmt="json")
        if value is not None and not isinstance(value, dict):
            raise Rejected("invalid_env_response")
        presence[name] = value is not None
        del value
    return presence


# ---- document counts and blob sample ----

def paginate(base, key, table, visit):
    cursor, seen_cursors, ids, pages, size = None, set(), set(), 0, 200
    while True:
        value = query(base, key, "_system/cli/tableData",
                      {"table": table, "order": "asc", "paginationOpts": {"cursor": cursor, "numItems": size}},
                      fmt="json")
        if not isinstance(value, dict) or type(value.get("isDone")) is not bool:
            raise Rejected("invalid_page")
        if value.get("pageStatus") is not None:
            if size <= 10:
                raise Rejected("split_page")
            size //= 2  # retry the same cursor with a smaller page
            continue
        rows, next_cursor = value.get("page"), value.get("continueCursor")
        if not isinstance(rows, list) or len(rows) > size or not isinstance(next_cursor, str):
            raise Rejected("invalid_page")
        for row in rows:
            identity = row.get("_id") if isinstance(row, dict) else None
            if not isinstance(identity, str) or identity in ids:
                raise Rejected("invalid_identity")
            ids.add(identity)
            visit(row)
        pages += 1
        if value["isDone"]:
            return len(ids), pages
        if next_cursor in seen_cursors or pages > 100000:
            raise Rejected("cursor_cycle")
        seen_cursors.add(next_cursor)
        cursor = next_cursor


def counts_and_sample(base, key):
    counts, ready = {}, []
    for table, statuses in COUNT_TABLES:
        by_status = dict.fromkeys(statuses or (), 0)
        other = [0]
        def visit(row, by_status=by_status, statuses=statuses, table=table, other=other):
            if statuses is None:
                return
            status = row.get("status")
            if status in by_status:
                by_status[status] += 1
            else:
                other[0] += 1
            if table == "audioArtifacts" and status == "ready" and isinstance(row.get("storageId"), str):
                ready.append((row["_id"], row["storageId"]))
        try:
            total, pages = paginate(base, key, table, visit)
            entry = {"complete": True, "total": total, "pages": pages}
            if statuses is not None:
                entry["byStatus"] = by_status
                entry["otherStatusCount"] = other[0]
        except Rejected as error:
            entry = {"complete": False, "classification": str(error)}
        counts[table] = entry

    sample = {"population": len(ready), "candidatesTried": 0, "noPlaybackUrl": 0, "sampled": 0, "passed": 0,
              "failed": 0, "failures": []}
    if not ready:
        return counts, sample
    step = max(1, len(ready) // SAMPLE_CANDIDATES)
    candidates = ready[::step][:SAMPLE_CANDIDATES]
    wanted, metadata = {storage for _, storage in candidates}, {}
    def visit_storage(row):
        if row.get("_id") in wanted:
            metadata[row["_id"]] = (row.get("size"), row.get("sha256"))
    try:
        storage_total, _ = paginate(base, key, "_storage", visit_storage)
        counts["_storage"] = {"complete": True, "total": storage_total}
    except Rejected as error:
        counts["_storage"] = {"complete": False, "classification": str(error)}
    for artifact_id, storage_id in candidates:
        if sample["sampled"] >= SAMPLE_SIZE:
            break
        sample["candidatesTried"] += 1
        path = playback_path(base, key, artifact_id)
        if path is None:
            sample["noPlaybackUrl"] += 1  # blind-hidden or otherwise not playable; not sampled
            continue
        sample["sampled"] += 1
        reason = path if path in PLAYBACK_FAILURES else blob_check(base, path, metadata.get(storage_id))
        if reason is None:
            sample["passed"] += 1
        else:
            sample["failed"] += 1
            sample["failures"].append(reason)
    return counts, sample


PLAYBACK_FAILURES = ("playback_query_failed", "playback_url_invalid")
STORAGE_PATH = re.compile(r"^/api/storage/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def playback_path(base, key, artifact_id):
    """The deployed read-only `audioArtifacts:playbackInternal` resolves ctx.storage.getUrl.

    Only the URL's /api/storage/<uuid> path is kept; its host (the production
    origin) is discarded, and the blob is fetched from the loopback origin.
    """
    try:
        envelope = post(base, key, "/api/function",
                        {"path": "audioArtifacts:playbackInternal", "format": "json", "args": {"artifactId": artifact_id}})
    except Rejected:
        return "playback_query_failed"
    if envelope["status"] != "success":
        return "playback_query_failed"
    value = envelope.get("value")
    if value is None:
        return None
    url = value.get("url") if isinstance(value, dict) else None
    if not isinstance(url, str):
        return "playback_url_invalid"
    parts = urllib.parse.urlsplit(url)
    if parts.query or parts.fragment or not STORAGE_PATH.match(parts.path):
        return "playback_url_invalid"
    return parts.path


def blob_check(base, path, meta):
    if meta is None:
        return "storage_row_missing"
    size, stored_sha = meta
    if isinstance(size, str) and size.isdigit():
        size = int(size)  # int64 may arrive as a decimal string
    if type(size) not in (int, float) or not isinstance(stored_sha, str):
        return "storage_row_invalid"
    request = urllib.request.Request(base + path, method="GET")
    digest, length = hashlib.sha256(), 0
    try:
        with OPENER.open(request, timeout=120) as response:
            if response.status != 200:
                return "blob_http_status"
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                length += len(chunk)
                if length > BLOB_CAP:
                    return "blob_over_cap"
                digest.update(chunk)
    except Exception:  # noqa: BLE001
        return "blob_unreadable"
    if length != int(size):
        return "size_mismatch"
    raw = digest.digest()
    if stored_sha not in (base64.b64encode(raw).decode(), base64.urlsafe_b64encode(raw).decode(), raw.hex()):
        return "sha256_mismatch"
    return None


def evaluate(result):
    """Receipt checks this reader can decide alone; live comparisons happen offline."""
    def complete(section):
        return isinstance(section, (dict, list)) and not (isinstance(section, dict) and section.get("complete") is False)
    sample = result.get("audioBlobSample") or {}
    counts = result.get("counts")
    checks = {
        "inspectionComplete": complete(result.get("inspection")),
        "componentProbesAllSucceeded": isinstance(result.get("componentProbes"), list)
        and len(result["componentProbes"]) == len(COMPONENT_PROBES)
        and all(p.get("status") == "success" for p in result["componentProbes"]),
        "environmentPresenceComplete": isinstance(result.get("environmentPresence"), dict)
        and set(result["environmentPresence"]) == set(ENV_NAMES),
        "countsComplete": isinstance(counts, dict) and counts.get("complete") is not False
        and all(isinstance(v, dict) and v.get("complete") is True for v in counts.values())
        and all(table in counts for table, _ in COUNT_TABLES),
        "blobSamplePassed": sample.get("sampled", 0) > 0 and sample.get("failed", 1) == 0,
    }
    return checks, all(checks.values())


def collect():
    base = require_loopback(ORIGIN)
    if os.path.lexists(OUT_FILE):
        raise Rejected("output_exists")
    key = read_key()
    result = {"format": "frequency-restore-receipt-reads-v1", "deploymentAuthorized": False}
    sections = (("inspection", lambda: inspect(lambda path, args: query(base, key, path, args))),
                ("componentProbes", lambda: component_probes(base, key)),
                ("environmentPresence", lambda: env_presence(base, key)))
    for name, read in sections:
        try:
            result[name] = read()
        except Rejected as error:
            result[name] = {"complete": False, "classification": str(error)}
        except Exception:  # noqa: BLE001
            result[name] = {"complete": False, "classification": "read_failed"}
    try:
        result["counts"], result["audioBlobSample"] = counts_and_sample(base, key)
    except Rejected as error:
        result["counts"] = {"complete": False, "classification": str(error)}
    except Exception:  # noqa: BLE001
        result["counts"] = {"complete": False, "classification": "read_failed"}
    del key
    result["checks"], result["allChecksPassed"] = evaluate(result)
    payload = json.dumps(result, indent=2, sort_keys=True).encode("utf-8")
    fd = os.open(OUT_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as handle:
        handle.write(payload)
    return {"ok": result["allChecksPassed"],
            "classification": "receipt_reads_written" if result["allChecksPassed"] else "receipt_checks_failed",
            "written": True, "outputFile": OUT_FILE, "outputSha256": hashlib.sha256(payload).hexdigest()}


def main():
    if sys.argv[1:2] == ["--postgres-recovery"]:
        try:
            print(json.dumps({"ok": True, **postgres_recovery(sys.argv[2] if len(sys.argv) == 3 else "")}), flush=True)
            return 0
        except Rejected as error:
            print(json.dumps({"ok": False, "classification": str(error)}), flush=True)
            return 1
    outcome = {}
    def worker():
        try:
            outcome.update(collect())
        except Rejected as error:
            outcome.update(ok=False, classification=str(error))
        except Exception:  # noqa: BLE001
            outcome.update(ok=False, classification="read_failed")
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    thread.join(DEADLINE)
    if thread.is_alive():
        print(json.dumps({"ok": False, "classification": "deadline_exceeded"}), flush=True)
        os._exit(1)
    print(json.dumps(outcome), flush=True)
    if outcome.get("ok"):
        return 0
    return 2 if outcome.get("written") else 1  # 2: file written, a receipt check failed


if __name__ == "__main__":
    sys.exit(main())
