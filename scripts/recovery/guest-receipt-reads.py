#!/usr/bin/env python3
"""Bounded, read-only restore-receipt reads from an isolated guest's Convex backend.

Runs inside a network-isolated restore guest (Python 3.9+ standard library
only), under the same guest-side admin-key trap that `read-identities` uses.
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
import decimal
import hashlib
import json
import os
import re
import stat
import struct
import subprocess
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = os.environ.get("RESTORE_BACKEND_ORIGIN", "http://127.0.0.1:3210")
KEY_FILE = os.environ.get("RESTORE_ADMIN_KEY_FILE", "/root/.restore-admin-key")
OUT_FILE = os.environ.get("RESTORE_RECEIPT_OUT", "/root/restore-receipt-reads.json")
DEADLINE = float(os.environ.get("RESTORE_RECEIPT_DEADLINE_SECONDS", "1500"))
CLIENT = "npm-1.46.0"  # AUDITED_CONVEX_VERSION in scripts/lib/convex-provenance.ts
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
UDF_TYPES = ("Query", "Mutation", "Action", "HttpAction")
INTEGER = re.compile(r"^[A-Za-z0-9+/]{11}=$")


class Rejected(Exception):
    """Carries a fixed classification code, never backend text."""


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


# ---- deployment metadata, same output shape as inspectDeployment() ----

def js_number(value):
    """JSON.stringify(number): ECMAScript Number::toString over the shortest round-trip digits.

    JSON.parse yields an IEEE double, so integers beyond 2**53 are rounded first.
    """
    if isinstance(value, int):
        if abs(value) <= 2 ** 53:
            return str(value)
        value = float(value)
    if value != value or value in (float("inf"), float("-inf")):
        return "null"
    if value == 0:
        return "0"
    sign = "-" if value < 0 else ""
    shortest = decimal.Decimal(repr(abs(value))).as_tuple()
    raw = "".join(str(d) for d in shortest.digits)
    n = len(raw) + shortest.exponent  # value = 0.<digits> * 10**n
    digits = raw.rstrip("0") or "0"
    k = len(digits)
    if k <= n <= 21:
        text = digits + "0" * (n - k)
    elif 0 < n <= 21:
        text = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        text = "0." + "0" * -n + digits
    else:
        exponent = n - 1
        text = digits[0] + ("." + digits[1:] if k > 1 else "") + "e" + ("+" if exponent >= 0 else "-") + str(abs(exponent))
    return sign + text


def utf16_order(key):
    """JavaScript compares strings by UTF-16 code unit; big-endian UTF-16 bytes sort the same way."""
    return key.encode("utf-16-be", "surrogatepass")


def canonical(item, depth=0):
    """Port of metadataHash()'s canonical form in convex-deployment-inspect.ts."""
    if depth > 64:
        raise Rejected("metadata_depth")
    if item is None:
        return "null"
    if isinstance(item, bool):
        return "true" if item else "false"
    if isinstance(item, str):
        return json.dumps(item, ensure_ascii=False)
    if isinstance(item, (int, float)):
        return js_number(item)
    if isinstance(item, list):
        return "[" + ",".join(canonical(child, depth + 1) for child in item) + "]"
    if isinstance(item, dict):
        return "{" + ",".join(
            json.dumps(k, ensure_ascii=False) + ":" + canonical(item[k], depth + 1) for k in sorted(item, key=utf16_order)) + "}"
    raise Rejected("metadata_type")


def metadata_hash(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def label(value, nullable=False):
    if value is None and nullable:
        return None
    if not isinstance(value, str) or len(value) > 1024:
        raise Rejected("invalid_metadata")
    return value


def schedule_integer(value, low, high):
    if not isinstance(value, dict) or set(value) != {"$integer"} or not isinstance(value["$integer"], str) \
            or not INTEGER.match(value["$integer"]):
        raise Rejected("invalid_schedule")
    integer = struct.unpack("<q", base64.b64decode(value["$integer"]))[0]
    if not low <= integer <= high:
        raise Rejected("invalid_schedule")
    return integer


def cron_schedule(spec):
    kind = spec.get("type") if isinstance(spec, dict) else None
    out = {"type": kind}
    def optional_minute():
        if "minuteUTC" in spec and spec["minuteUTC"] is not None:
            out["minuteUTC"] = schedule_integer(spec["minuteUTC"], 0, 59)
    if kind == "interval":
        out["seconds"] = schedule_integer(spec.get("seconds"), 0, 2**53 - 1)
    elif kind == "hourly":
        optional_minute()
    elif kind == "daily":
        out["hourUTC"] = schedule_integer(spec.get("hourUTC"), 0, 23)
        optional_minute()
    elif kind == "weekly":
        out["dayOfWeek"] = schedule_integer(spec.get("dayOfWeek"), 0, 6)
        out["hourUTC"] = schedule_integer(spec.get("hourUTC"), 0, 23)
        optional_minute()
    elif kind == "monthly":
        out["day"] = schedule_integer(spec.get("day"), 1, 31)
        out["hourUTC"] = schedule_integer(spec.get("hourUTC"), 0, 23)
        optional_minute()
    elif kind == "cron":
        expr = spec.get("cronExpr")
        if not isinstance(expr, str) or len(expr) > 256 or not re.match(r"^[0-9*,/-]+(?:[ \t]+[0-9*,/-]+){4}$", expr):
            raise Rejected("invalid_schedule")
        out["cronExpr"] = expr
    else:
        raise Rejected("invalid_schedule")
    return out


def inspect(base, key):
    raw_components = query(base, key, "_system/frontend/components:list", {})
    if not isinstance(raw_components, list) or len(raw_components) > 100:
        raise Rejected("invalid_components")
    components = []
    for item in raw_components:
        if not isinstance(item, dict) or not isinstance(item.get("args"), dict):
            raise Rejected("invalid_components")
        component = {"id": label(item.get("id")), "path": label(item.get("path")), "state": label(item.get("state"))}
        if "name" in item:
            component["name"] = label(item["name"], nullable=True)
        if "httpPrefix" in item:
            component["httpPrefix"] = label(item["httpPrefix"], nullable=True)
        component["argsCount"] = len(item["args"])
        component["argsOmitted"] = True
        components.append(component)
    if len({c["id"] for c in components}) != len(components) or len({c["path"] for c in components}) != len(components):
        raise Rejected("duplicate_components")
    component_ids = [None] + [c["id"] for c in components if c["path"] != ""]

    raw_modules = query(base, key, "_system/frontend/modules:listForAllComponents", {})
    if not isinstance(raw_modules, list) or len(raw_modules) != len(component_ids):
        raise Rejected("incomplete_module_inventory")
    modules = []
    for entry in raw_modules:
        if not isinstance(entry, list) or len(entry) != 2 or not isinstance(entry[1], list):
            raise Rejected("invalid_modules")
        component_id = label(entry[0], nullable=True)
        if component_id not in component_ids:
            raise Rejected("incomplete_module_inventory")
        out_modules = []
        for module_entry in entry[1]:
            if not isinstance(module_entry, list) or len(module_entry) != 2 or not isinstance(module_entry[1], dict):
                raise Rejected("invalid_modules")
            path, module = label(module_entry[0]), module_entry[1]
            functions = []
            for fn in module.get("functions", []):
                if fn.get("udfType") not in UDF_TYPES or fn.get("visibility", {}).get("kind") not in ("public", "internal"):
                    raise Rejected("invalid_function")
                functions.append({"name": label(fn.get("name")), "udfType": fn["udfType"],
                                  "visibility": {"kind": fn["visibility"]["kind"]}})
            if len({f["name"] for f in functions}) != len(functions):
                raise Rejected("duplicate_functions")
            crons = []
            for cron in module.get("cronSpecs") or []:
                identifier, spec = cron[0], cron[1]
                crons.append({"identifier": label(identifier), "udfPath": label(spec.get("udfPath")),
                              "schedule": cron_schedule(spec.get("cronSchedule")), "argsOmitted": True})
            out_modules.append({"path": path, "functions": functions, "crons": crons})
        if len({m["path"] for m in out_modules}) != len(out_modules):
            raise Rejected("duplicate_modules")
        modules.append({"componentId": component_id, "modules": out_modules})
    if len({m["componentId"] for m in modules}) != len(modules):
        raise Rejected("incomplete_module_inventory")

    schemas = []
    for component_id in component_ids:
        value = query(base, key, "_system/frontend/getSchemas", {"componentId": component_id})
        if not isinstance(value, dict):
            raise Rejected("invalid_schema")
        def fingerprint(field):
            text = value.get(field)
            if text is None:
                return None
            if not isinstance(text, str):
                raise Rejected("invalid_schema")
            return metadata_hash(json.loads(text))
        schemas.append({"componentId": component_id, "activeHash": fingerprint("active"),
                        "inProgressHash": fingerprint("inProgress")})
    return {"components": components, "modules": modules, "schemas": schemas}


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
    sections = (("inspection", lambda: inspect(base, key)),
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


# ---- PostgreSQL first-start recovery (item 2), parsed inside the guest ----

PG_PREFIX = re.compile(r"^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)? [A-Z]{2,5}) \[\d+\] (?P<sev>[A-Z]+):  (?P<msg>.*)$")
PG_EVENTS = (
    ("interrupted", re.compile(r"database system was interrupted; last known up at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [A-Z]{2,5})")),
    ("clean_shutdown_at", re.compile(r"database system was shut down at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [A-Z]{2,5})")),
    ("automatic_recovery_in_progress", re.compile(r"database system was not properly shut down; automatic recovery in progress")),
    ("redo_starts_at", re.compile(r"redo starts at ([0-9A-F]{1,8}/[0-9A-F]{1,8})")),
    ("redo_done_at", re.compile(r"redo done at ([0-9A-F]{1,8}/[0-9A-F]{1,8}) system usage: .*")),
    ("wal_end_invalid_record_length_at", re.compile(r"invalid record length at ([0-9A-F]{1,8}/[0-9A-F]{1,8}): expected at least \d+, got \d+")),
    ("end_of_recovery_checkpoint_started", re.compile(r"checkpoint starting: end-of-recovery(?: [a-z-]+)*")),
    ("ready_to_accept_connections", re.compile(r"database system is ready to accept connections")),
)


def parse_postgres_recovery(lines):
    """Fixed event tokens with their timestamp and an LSN or timestamp value; nothing else."""
    events, severities, total = [], {"FATAL": 0, "PANIC": 0, "ERROR": 0, "WARNING": 0}, 0
    for line in lines:
        total += 1
        match = PG_PREFIX.match(line.rstrip("\n"))
        if not match:
            continue
        if match["sev"] in severities:
            severities[match["sev"]] += 1
        if match["sev"] != "LOG":
            continue
        for name, pattern in PG_EVENTS:
            found = pattern.fullmatch(match["msg"])
            if found:
                event = {"at": match["ts"], "event": name}
                if found.groups():
                    event["value"] = found.group(1)
                events.append(event)
                break
    return {"events": events, "severityCounts": severities, "linesScanned": total}


def postgres_recovery(since):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z", since):
        raise Rejected("invalid_since")
    try:
        logs = subprocess.run(["docker", "logs", "--since", since, "app-postgres-1"], stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, timeout=30, check=True).stdout
    except Exception:  # noqa: BLE001
        raise Rejected("log_read_failed") from None
    return parse_postgres_recovery(logs.decode("utf-8", "replace").splitlines())


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
