#!/usr/bin/env python3
"""Own a disposable localhost Convex deployment and real UI persistence proof."""
import argparse
import json
import hashlib
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request

REPO = Path(__file__).resolve().parents[2]
RUNS = REPO / "web/artifacts/local-convex"
IMAGE = "ghcr.io/convex/convex-backend@sha256:294944b33dc55e8f68b2feda11c5e7b195f7778b9ad2951f1bea2744ad392e5a"
LABEL = "frequency.local-verification"


def execute(args, **kwargs):
    return subprocess.check_output(args, text=True, timeout=30, **kwargs).strip()


def directory(run):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,45}", run):
        raise ValueError("Use 1–46 lowercase letters, digits or hyphens for run id")
    return RUNS / run


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def load(run):
    info = json.loads((directory(run) / "instance.json").read_text())
    if info["repo"] != str(REPO) or info["run"] != run:
        raise RuntimeError("Run does not belong to this checkout")
    if info["owner"] != str(REPO) + ":" + run or info["name"] != "frequency-verify-" + run:
        raise RuntimeError("Resource ownership does not match run")
    for key in ("backend", "site", "frontend"):
        if not re.fullmatch(r"http://127\.0\.0\.1:[1-9][0-9]{3,4}", info[key]) or int(info[key].rsplit(":", 1)[1]) > 65535:
            raise RuntimeError("Only explicit 127.0.0.1 origins are accepted")
    return info


def fingerprint():
    paths = ["convex", "web/src", "web/tests/local", "web/vite.config.ts", "web/package.json", "web/bun.lock",
             "scripts/local-convex", "package.json", "bun.lock", "tsconfig.json"]
    names = execute(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", *paths], cwd=REPO).split("\0")
    digest = hashlib.sha256()
    for name in sorted(set(filter(None, names))):
        path = REPO / name
        digest.update(name.encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def check_source(info):
    if info["source_sha256"] != fingerprint():
        raise RuntimeError("Checkout changed since start; use a fresh run")


def port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def clean_env():
    # No inherited credentials, deployment selection, proxies or service URLs.
    return {"PATH": os.environ["PATH"], "CI": "1", "APP_ENV": "test", "NO_COLOR": "1"}


def owned(info, kind, name):
    observed = json.loads(execute(["docker", kind, "inspect", name]))[0]
    labels = observed.get("Labels") or observed.get("Config", {}).get("Labels") or {}
    if labels.get(LABEL) != info["owner"]:
        raise RuntimeError(f"Refusing foreign {kind}: {name}")
    return observed


def start(run):
    out = directory(run)
    out.mkdir(parents=True, exist_ok=False)
    os.chmod(out, 0o700)
    ports = []
    while len(ports) < 3:
        value = port()
        if value not in ports:
            ports.append(value)
    owner = str(REPO) + ":" + run
    name = "frequency-verify-" + run
    info = {"repo": str(REPO), "run": run, "owner": owner, "name": name,
            "backend": f"http://127.0.0.1:{ports[0]}",
            "site": f"http://127.0.0.1:{ports[1]}",
            "frontend": f"http://127.0.0.1:{ports[2]}", "image": IMAGE, "source_sha256": fingerprint()}
    write(out / "instance.json", info)
    try:
        execute(["docker", "network", "create", "--internal", "--label", f"{LABEL}={owner}", name])
        execute(["docker", "volume", "create", "--label", f"{LABEL}={owner}", name])
        execute(["docker", "run", "-d", "--name", name, "--label", f"{LABEL}={owner}",
                 "--network", name, "--mount", f"type=volume,source={name},target=/convex/data",
                 "-e", f"INSTANCE_NAME={name}", "-e", "DISABLE_BEACON=1",
                 "-e", f"CONVEX_CLOUD_ORIGIN={info['backend']}",
                 "-e", f"CONVEX_SITE_ORIGIN={info['site']}", IMAGE])
        container = owned(info, "container", name)
        address = container["NetworkSettings"]["Networks"][name]["IPAddress"]
        relay_log = (out / "relay.log").open("w")
        relay = subprocess.Popen([sys.executable, str(REPO / "scripts/local-convex/relay.py"),
                                  address, str(ports[0]), str(ports[1])],
                                 stdout=relay_log, stderr=subprocess.STDOUT, start_new_session=True)
        info["relay_pid"] = relay.pid
        info["relay_started"] = execute(["ps", "-p", str(relay.pid), "-o", "lstart="])
        write(out / "instance.json", info)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(60):
            try:
                with opener.open(info["backend"] + "/version", timeout=1) as response:
                    info["version"] = response.read().decode()
                    break
            except OSError:
                time.sleep(0.5)
        else:
            raise RuntimeError("Local backend did not become ready")
        # Fresh key generated only from the new empty container's own identity.
        key = execute(["docker", "exec", name, "./generate_admin_key.sh"], stderr=subprocess.PIPE)
        secret = out / "local-admin-key"
        secret.write_text(key)
        os.chmod(secret, 0o600)
        network = owned(info, "network", name)
        if not network["Internal"]:
            raise RuntimeError("Backend network must have no external route")
        write(out / "instance.json", info)
        print(json.dumps({"status": "started", "backend": info["backend"],
                          "frontend": info["frontend"], "image": IMAGE,
                          "version": info["version"], "internal_network": True}))
    except BaseException:
        stop(run)
        raise


def deploy(run):
    info = load(run)
    owned(info, "container", info["name"])
    check_source(info)
    out = directory(run)
    release = out / "release"
    release.mkdir()
    shutil.copytree(REPO / "convex", release / "convex")
    for filename in ("package.json", "tsconfig.json"):
        shutil.copyfile(REPO / filename, release / filename)
    (release / "node_modules").symlink_to(REPO / "node_modules", target_is_directory=True)
    # Keep the repo's functions/components/schema. Suppress scheduled producers
    # only in the disposable copy so a UI proof cannot invoke cron workloads.
    (release / "convex/crons.ts").write_text('import { cronJobs } from "convex/server";\nexport default cronJobs();\n')
    shutil.copyfile(REPO / "scripts/local-convex/seed.ts.txt", release / "convex/localVerification.ts")
    key = (out / "local-admin-key").read_text()
    env = clean_env()
    env.update(CONVEX_SELF_HOSTED_URL=info["backend"], CONVEX_SELF_HOSTED_ADMIN_KEY=key,
               CLERK_JWT_ISSUER_DOMAIN="http://127.0.0.1:9")
    cli = str(REPO / "node_modules/.bin/convex")
    # env set's inherited env is this explicit local-only dictionary; cwd has no
    # .env files and never contains credentials from the repository.
    config = out / "local.env"
    config.write_text(f"CONVEX_SELF_HOSTED_URL={info['backend']}\nCONVEX_SELF_HOSTED_ADMIN_KEY={key}\n")
    os.chmod(config, 0o600)
    with (out / "deploy.log").open("w") as log:
        subprocess.run([cli, "env", "set", "CLERK_JWT_ISSUER_DOMAIN", "http://127.0.0.1:9"],
                       cwd=release, env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=180)
        subprocess.run([cli, "deploy", "--env-file", str(config), "--codegen", "disable", "--typecheck", "disable"],
                       cwd=release, env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=180)
    print((out / "deploy.log").read_text().replace(key, "<LOCAL_KEY>"))
    print(json.dumps({"status": "deployed", "backend": info["backend"],
                      "source_exceptions": ["empty crons in disposable copy", "synthetic seed/snapshot module"]}))


def exercise(run):
    info = load(run)
    owned(info, "container", info["name"])
    check_source(info)
    if (directory(run) / "identity.json").exists():
        raise RuntimeError("Exercise requires an unseeded deployment; use a fresh run")
    env = clean_env()
    env["LOCAL_CONVEX_RUN"] = run
    subprocess.run(["node", str(REPO / "scripts/local-convex/seed.mjs"), run],
                   cwd=REPO, env=env, check=True)
    subprocess.run([str(REPO / "web/node_modules/.bin/playwright"), "test", "--config",
                    "tests/local/playwright.config.ts", "--reporter=list"],
                   cwd=REPO / "web", env=env, check=True)
    check_source(info)


def stop(run):
    info = load(run)
    out = directory(run)
    name = info["name"]
    if "relay_pid" in info:
        observed = subprocess.run(["ps", "-p", str(info["relay_pid"]), "-o", "lstart="],
                                  capture_output=True, text=True, check=False)
        if observed.returncode == 0:
            if observed.stdout.strip() != info["relay_started"]:
                raise RuntimeError("Relay PID identity changed; refusing kill")
            os.killpg(info["relay_pid"], signal.SIGTERM)
    for kind in ("container", "volume", "network"):
        found = subprocess.run(["docker", kind, "inspect", name], capture_output=True, check=False)
        if found.returncode:
            continue
        owned(info, kind, name)
        cmd = ["docker", kind, "rm"]
        if kind == "container":
            cmd.append("-f")
        execute(cmd + [name])
    for _ in range(50):
        released = True
        for key in ("backend", "site"):
            with socket.socket() as probe:
                if probe.connect_ex(("127.0.0.1", int(info[key].rsplit(":", 1)[1]))) == 0:
                    released = False
        if released:
            break
        time.sleep(0.1)
    else:
        raise RuntimeError("Owned relay listeners did not stop")
    for filename in ("local-admin-key", "local.env", "identity.json"):
        (out / filename).unlink(missing_ok=True)
    shutil.rmtree(out / "release", ignore_errors=True)
    write(out / "cleanup.json", {"status": "pass", "container_removed": name,
          "volume_removed": name, "network_removed": name, "local_credentials_removed": True})
    print((out / "cleanup.json").read_text())


def run_all(run):
    start(run)
    try:
        deploy(run)
        exercise(run)
    finally:
        stop(run)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["start", "deploy", "exercise", "stop", "run"])
    parser.add_argument("run_id")
    args = parser.parse_args()
    {"start": start, "deploy": deploy, "exercise": exercise, "stop": stop, "run": run_all}[args.action](args.run_id)


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    main()
