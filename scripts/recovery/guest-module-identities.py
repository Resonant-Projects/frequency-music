#!/usr/bin/env python3
"""Emit sanitized root module identities from a Convex backend on localhost.

Runs inside an isolated restore guest (Python 3.8+ standard library only).
The admin key is read from a mode-0600 file, never from arguments. The raw
/api/get_config_hashes body can contain configuration, so it is parsed in
memory and discarded; only {path, environment, hash} identities are written.
Output goes to a new mode-0600 file. Stdout carries counts and the output
digest, never a body, key, or backend error text. The request ignores proxy
environment variables and never follows redirects.

Deadline: the whole exchange (connect, headers, body) runs on a worker thread
while the main thread waits at most RESTORE_DEADLINE_SECONDS (default 30) of
wall-clock time. On expiry the process prints a fixed failure and terminates
with os._exit, so a stalled or slowly dripping socket cannot extend the run.
A 4 MiB cap bounds the body.
"""

import hashlib
import json
import os
import re
import socket
import stat
import sys
import threading
from typing import NoReturn
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = os.environ.get("RESTORE_BACKEND_ORIGIN", "http://127.0.0.1:3210")
LOOPBACK_HOSTS = ("127.0.0.1", "localhost", "::1")
KEY_FILE = os.environ.get("RESTORE_ADMIN_KEY_FILE", "/root/.restore-admin-key")
OUT_FILE = os.environ.get("RESTORE_IDENTITIES_OUT", "/root/restore-module-identities.json")
DEADLINE_SECONDS = float(os.environ.get("RESTORE_DEADLINE_SECONDS", "30"))
CAP_BYTES = 4 * 1024 * 1024
CHUNK = 64 * 1024
HASH = re.compile(r"^[a-f0-9]{64}$")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def emit_failure(classification: str, **extra) -> None:
    print(json.dumps({"ok": False, "classification": classification, **extra}), flush=True)


def fail(classification: str, **extra) -> NoReturn:
    emit_failure(classification, **extra)
    sys.exit(1)


def read_key() -> str:
    try:
        mode = stat.S_IMODE(os.stat(KEY_FILE).st_mode)
        if mode & 0o077:
            fail("key_file_permissions")
        with open(KEY_FILE, encoding="utf-8") as handle:
            key = handle.read().strip()
    except OSError:
        fail("key_file_unreadable")
    if not key or "\n" in key:
        fail("key_file_malformed")
    return key


def exchange(request: urllib.request.Request, result: dict, done: threading.Event) -> None:
    """Worker thread: never calls sys.exit; reports through `result`."""
    opener = urllib.request.build_opener(NoRedirect, urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=DEADLINE_SECONDS) as response:
            status = response.status
            chunks, length = [], 0
            while True:
                chunk = response.read(CHUNK)
                if not chunk:
                    break
                length += len(chunk)
                if length > CAP_BYTES:
                    result["error"] = ("limits_exceeded", None)
                    return
                chunks.append(chunk)
            result["status"] = status
            result["raw"] = b"".join(chunks)
    except urllib.error.HTTPError as error:
        result["error"] = ("http_error", error.code)
    except (TimeoutError, socket.timeout):  # socket.timeout is distinct before Python 3.10
        result["error"] = ("deadline_exceeded", None)
    except urllib.error.URLError as error:
        kind = "deadline_exceeded" if isinstance(error.reason, (TimeoutError, socket.timeout)) else "transport_error"
        result["error"] = (kind, None)
    except Exception:  # noqa: BLE001 - any transport failure is reported without detail
        result["error"] = ("transport_error", None)
    finally:
        done.set()


def require_loopback_origin(origin: str) -> None:
    """The admin key is a live production credential; it may only travel to loopback."""
    parts = urllib.parse.urlsplit(origin)
    if (
        parts.scheme != "http"
        or parts.hostname not in LOOPBACK_HOSTS
        or parts.username
        or parts.password
        or parts.path not in ("", "/")
        or parts.query
        or parts.fragment
    ):
        fail("origin_not_loopback")


def main() -> None:
    require_loopback_origin(ORIGIN)
    if os.path.exists(OUT_FILE):
        fail("output_exists")
    key = read_key()
    body = json.dumps({"version": "1.34.1", "adminKey": key}).encode("utf-8")
    request = urllib.request.Request(
        ORIGIN.rstrip("/") + "/api/get_config_hashes",
        data=body,
        method="POST",
        headers={
            "Authorization": "Convex " + key,
            "Content-Type": "application/json",
            "Convex-Client": "npm-cli-1.34.1",
        },
    )
    result: dict = {}
    done = threading.Event()
    worker = threading.Thread(target=exchange, args=(request, result, done), daemon=True)
    worker.start()
    if not done.wait(DEADLINE_SECONDS):
        emit_failure("deadline_exceeded")
        os._exit(1)  # do not wait for the blocked socket read
    if "error" in result:
        classification, code = result["error"]
        if code is None:
            fail(classification)
        fail(classification, httpStatus=code)
    status, raw = result["status"], result["raw"]
    if status != 200:
        fail("http_error", httpStatus=status)
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        fail("malformed_response")
    del raw
    modules = parsed.get("moduleHashes") if isinstance(parsed, dict) else None
    if not isinstance(modules, list) or not 1 <= len(modules) <= 10_000:
        fail("malformed_response")
    identities = []
    seen = set()
    for item in modules:
        if not isinstance(item, dict):
            fail("malformed_response")
        path, environment, digest = item.get("path"), item.get("environment"), item.get("hash")
        if (
            not isinstance(path, str)
            or not 1 <= len(path) <= 1024
            or environment not in ("isolate", "node")
            or not isinstance(digest, str)
            or not HASH.match(digest)
        ):
            fail("malformed_response")
        if path in seen:
            fail("duplicate_module_entry")
        seen.add(path)
        identities.append({"path": path, "environment": environment, "hash": digest})
    del parsed
    identities.sort(key=lambda module: module["path"])
    payload = json.dumps({"moduleHashes": identities}, indent=2).encode("utf-8")
    try:
        fd = os.open(OUT_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        fail("output_exists")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
    except OSError:
        try:
            os.unlink(OUT_FILE)
        except OSError:
            pass
        fail("output_write_failed")
    print(
        json.dumps(
            {
                "ok": True,
                "classification": "success_envelope",
                "httpStatus": status,
                "moduleCount": len(identities),
                "outputFile": OUT_FILE,
                "outputSha256": hashlib.sha256(payload).hexdigest(),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
