#!/usr/bin/env python3
"""Bounded, read-only aggregate of agentRuns through Convex's built-in table query.

Raw rows stay in memory. This is a sequential observation, not an atomic snapshot,
worker-idle proof, or permission to stop a worker. Requires Python 3.8+.
"""
import json
import os
import stat
import sys
import threading
import time
import urllib.parse
import urllib.request

STATUSES = ("queued", "running", "needs_review", "completed", "failed", "cancelled")
PAGE_BYTES = 4 * 1024 * 1024
TOTAL_BYTES = 32 * 1024 * 1024
MAX_PAGES = 100
MAX_ROWS = 10000
DEADLINE = 45


class Rejected(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def count_pages(query):
    counts = dict.fromkeys(STATUSES, 0)
    cursor = None
    cursors, ids = set(), set()
    last_creation = -1
    for pages in range(1, MAX_PAGES + 1):
        envelope = query(cursor)
        if not isinstance(envelope, dict) or envelope.get("status") != "success":
            raise Rejected("query_failed")
        page = envelope.get("value")
        if not isinstance(page, dict) or type(page.get("isDone")) is not bool:
            raise Rejected("invalid_page")
        if page.get("pageStatus") is not None:
            raise Rejected("split_page")
        rows = page.get("page")
        next_cursor = page.get("continueCursor")
        if not isinstance(rows, list) or len(rows) > 100:
            raise Rejected("invalid_page")
        if not isinstance(next_cursor, str) or len(next_cursor) > 16384:
            raise Rejected("invalid_cursor")
        for row in rows:
            if not isinstance(row, dict):
                raise Rejected("invalid_row")
            identity, status, creation = row.get("_id"), row.get("status"), row.get("_creationTime")
            if not isinstance(identity, str) or not 1 <= len(identity) <= 256 or identity in ids:
                raise Rejected("invalid_identity")
            if not isinstance(status, str) or status not in counts:
                raise Rejected("unknown_status")
            if type(creation) not in (int, float) or not last_creation <= creation < 1e16:
                raise Rejected("invalid_order")
            last_creation = creation
            ids.add(identity)
            if len(ids) > MAX_ROWS:
                raise Rejected("row_limit")
            counts[status] += 1
        if page["isDone"]:
            return {"complete": True, "counts": counts, "rows": len(ids), "pages": pages,
                    "atomic": False, "worker_idle_proven": False,
                    "query": "_system/cli/tableData", "table": "agentRuns"}
        if not next_cursor or next_cursor in cursors:
            raise Rejected("cursor_cycle")
        cursors.add(next_cursor)
        cursor = next_cursor
    raise Rejected("page_limit")


def collect(origin, key_file):
    parsed = urllib.parse.urlsplit(origin)
    if (parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1")
            or parsed.username or parsed.password or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment):
        raise Rejected("origin_not_loopback")
    fd = os.open(key_file, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "r") as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_uid != os.getuid():
            raise Rejected("key_file_permissions")
        key = handle.read(16385).strip()
    if not key or len(key) > 16384 or any(c.isspace() for c in key):
        raise Rejected("invalid_key")
    opener = urllib.request.build_opener(NoRedirect, urllib.request.ProxyHandler({}))
    received = 0
    def query(cursor):
        nonlocal received
        body = json.dumps({"path": "_system/cli/tableData", "format": "json", "args": [{
            "table": "agentRuns", "order": "asc", "paginationOpts": {"cursor": cursor, "numItems": 100}}]}).encode()
        request = urllib.request.Request(origin.rstrip("/") + "/api/query", body,
            {"Content-Type": "application/json", "Authorization": "Convex " + key}, method="POST")
        with opener.open(request, timeout=10) as response:
            raw = response.read(PAGE_BYTES + 1)
        received += len(raw)
        if len(raw) > PAGE_BYTES or received > TOTAL_BYTES:
            raise Rejected("byte_limit")
        return json.loads(raw)
    return count_pages(query)


def main():
    started = time.time()
    result = {}
    def worker():
        try:
            result.update(collect(os.environ.get("RESTORE_BACKEND_ORIGIN", "http://127.0.0.1:3210"),
                                  os.environ.get("RESTORE_ADMIN_KEY_FILE", "/root/.restore-admin-key")))
        except Rejected as error:
            result.update(complete=False, code=str(error))
        except Exception:
            result.update(complete=False, code="read_failed")
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    thread.join(DEADLINE)
    if thread.is_alive():
        print(json.dumps({"complete": False, "code": "deadline_exceeded"}), flush=True)
        os._exit(1)
    result.update(started_unix=started, finished_unix=time.time())
    print(json.dumps(result), flush=True)
    return 0 if result.get("complete") else 1


if __name__ == "__main__":
    sys.exit(main())
