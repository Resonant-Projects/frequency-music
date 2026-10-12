#!/usr/bin/env python3
"""Own a loopback-only Frequency frontend, with persistent proof artifacts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

SKILL = Path(__file__).resolve().parents[1]
REPO = SKILL.parents[2]
WEB = REPO / "web"
EVIDENCE = SKILL / "evidence"


def command(args, **kwargs):
    return subprocess.check_output(args, cwd=REPO, text=True, **kwargs).strip()


def fingerprint():
    digest = hashlib.sha256()
    files = command(["git", "ls-files", "web", "docs/essays", "convex/_generated"]).splitlines()
    for name in sorted(files):
        path = REPO / name
        digest.update(name.encode())
        digest.update(path.read_bytes() if path.is_file() else b"MISSING")
    return digest.hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n")


def directory(run):
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}", run):
        raise RuntimeError("Run ID must be 1-80 letters, digits, underscores or hyphens")
    return EVIDENCE / run


def state(run):
    result = json.loads((directory(run) / "instance.json").read_text())
    if result["repo"] != str(REPO) or result["mode"] != "offline-local-ui":
        raise RuntimeError("This run does not belong to this checkout")
    return result


def group_members(pgid):
    rows = command(["ps", "-axo", "pid=,pgid=,stat="]).splitlines()
    return [int(row.split()[0]) for row in rows
            if int(row.split()[1]) == pgid and not row.split()[2].startswith("Z")]


def listeners(port):
    result = subprocess.run(["lsof", "-nP", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"],
                            text=True, capture_output=True, check=False)
    return [int(line) for line in result.stdout.splitlines()]


def stop_owned(info):
    pgid = info["pgid"]
    if not group_members(pgid):
        return
    # PID reuse must not turn an old receipt into permission to stop another process.
    observed = subprocess.run(["ps", "-p", str(pgid), "-o", "lstart="],
                              text=True, capture_output=True, check=False)
    if observed.returncode:
        # A concurrent cleanup may have reaped the leader before its children drain.
        for _ in range(50):
            if not group_members(pgid):
                return
            time.sleep(0.1)
        raise RuntimeError("Leader absent but group remains; refusing an unverified kill")
    actual = observed.stdout.strip()
    if actual != info["process_started"]:
        raise RuntimeError("Process identity changed; refusing cleanup")
    os.killpg(pgid, signal.SIGTERM)
    for _ in range(50):
        if not group_members(pgid):
            return
        time.sleep(0.1)
    os.killpg(pgid, signal.SIGKILL)


def launch(run, port):
    out = directory(run)
    out.mkdir(parents=True, exist_ok=False)
    scratch_base = (Path.home() / ".hermes/cache/scratch").resolve()
    scratch_base.mkdir(parents=True, exist_ok=True)
    if str(scratch_base).startswith(("/tmp", "/private/tmp")):
        raise RuntimeError("Set TMPDIR to a non-system scratch directory")
    scratch = Path(tempfile.mkdtemp(prefix=f"frequency-{run}-", dir=scratch_base))
    if port == 0:
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
    if listeners(port):
        shutil.rmtree(scratch)
        raise RuntimeError(f"Port {port} already owned; refusing to reuse it")
    env = {key: value for key, value in os.environ.items() if not key.startswith("VITE_")}
    env.update(VITE_AUTH_BYPASS="1", VITE_E2E_MODE="0", VITE_CONVEX_URL="http://127.0.0.1:9",
               TMPDIR=str(scratch))
    args = ["vp", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(port),
            "--strictPort", "--mode", "verification"]
    info = {"repo": str(REPO), "url": f"http://127.0.0.1:{port}", "port": port,
            "scratch": str(scratch), "scratch_base": str(scratch_base),
            "mode": "offline-local-ui", "head": command(["git", "rev-parse", "HEAD"]),
            "source_sha256": fingerprint(), "command": args, "environment": {
                "VITE_AUTH_BYPASS": "1", "VITE_E2E_MODE": "0", "VITE_CONVEX_URL": "http://127.0.0.1:9"}}
    with (out / "launch.log").open("w") as log:
        proc = subprocess.Popen(args, cwd=WEB, env=env, stdout=log, stderr=subprocess.STDOUT,
                                start_new_session=True)
        info.update(pgid=proc.pid, process_started=command(["ps", "-p", str(proc.pid), "-o", "lstart="]))
        write_json(out / "instance.json", info)
        print(json.dumps(info), flush=True)
        def interrupted(_sig, _frame):
            raise KeyboardInterrupt
        signal.signal(signal.SIGTERM, interrupted)
        signal.signal(signal.SIGINT, interrupted)
        try:
            code = proc.wait()
            if code not in (0, -signal.SIGTERM, -signal.SIGINT):
                raise RuntimeError(f"Launch exited {code}; see {out / 'launch.log'}")
        finally:
            stop_owned(info)
            proc.wait(timeout=10)


def doctor(run):
    info = state(run)
    if not group_members(info["pgid"]):
        raise RuntimeError("Owned process group is not running")
    if command(["ps", "-p", str(info["pgid"]), "-o", "lstart="]) != info["process_started"]:
        raise RuntimeError("Process identity changed")
    if fingerprint() != info["source_sha256"] or command(["git", "rev-parse", "HEAD"]) != info["head"]:
        raise RuntimeError("Checkout changed since launch; relaunch with a fresh run ID")
    deadline = time.monotonic() + 120
    while True:
        owned = group_members(info["pgid"])
        pids = listeners(info["port"])
        if pids and all(pid in owned for pid in pids):
            break
        if pids or not owned or time.monotonic() > deadline:
            raise RuntimeError("No listener owned by this run")
        time.sleep(0.2)
    with urllib.request.urlopen(info["url"] + "/essays", timeout=10) as response:
        if response.status != 200 or b"/src/main.tsx" not in response.read():
            raise RuntimeError("Unexpected frontend response")
    result = {"status": "pass", "mode": info["mode"], "head": info["head"],
              "source_sha256": info["source_sha256"], "url": info["url"], "listener_pids": pids,
              "scope": "local essay UI, not Clerk or Convex health"}
    write_json(directory(run) / "doctor-process.json", result)
    drive(run, "doctor", check=False)
    print(json.dumps(result))


def drive(run, feature, check=True):
    if check and feature != "ingest":
        doctor(run)
    info = state(run)
    result = subprocess.run(["node", str(SKILL / "scripts/drive.mjs"), feature,
                             str(directory(run) / "instance.json")], cwd=WEB, check=False,
                            env=dict(os.environ, TMPDIR=info["scratch"]))
    if result.returncode:
        raise RuntimeError(f"{feature} failed with exit {result.returncode}; run cleanup {run}")


def cleanup(run):
    info = state(run)
    stop_owned(info)
    for _ in range(50):
        if not group_members(info["pgid"]) and not listeners(info["port"]):
            break
        time.sleep(0.1)
    if group_members(info["pgid"]) or listeners(info["port"]):
        raise RuntimeError("Cleanup did not release process group and port")
    scratch = Path(info["scratch"])
    if scratch.parent != Path(info["scratch_base"]) or not scratch.name.startswith(f"frequency-{run}-"):
        raise RuntimeError("Unexpected scratch path; refusing removal")
    if scratch.exists():
        shutil.rmtree(scratch)
    kept = sorted(p.name for p in directory(run).iterdir() if p.is_file())
    if "instance.json" not in kept or "launch.log" not in kept:
        raise RuntimeError("Evidence disappeared")
    result = {"status": "pass", "port_released": info["port"], "process_group_stopped": info["pgid"],
              "scratch_removed": not scratch.exists(), "evidence_preserved": kept}
    write_json(directory(run) / "cleanup.json", result)
    print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["launch", "doctor", "drive", "cleanup"])
    parser.add_argument("run_id")
    parser.add_argument("feature", nargs="?", choices=["essays", "navigation", "search", "ingest"])
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    try:
        if args.action == "launch":
            launch(args.run_id, args.port)
        elif args.action == "doctor":
            doctor(args.run_id)
        elif args.action == "cleanup":
            cleanup(args.run_id)
        elif args.feature:
            drive(args.run_id, args.feature)
        else:
            parser.error("drive requires a feature")
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
