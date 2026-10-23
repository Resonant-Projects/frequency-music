#!/usr/bin/env python3
"""Own a disposable local Convex proof."""
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
    if args[0] == "docker":
        kwargs["env"] = docker_env()
    kwargs.setdefault("timeout", 30)
    return subprocess.check_output(args, text=True, **kwargs).strip()


def _open_pidfd(pid):
    try:
        return os.pidfd_open(pid, 0)
    except (AttributeError, OSError):
        return None


def _remember_pids(pids, identities):
    for pid in pids:
        if pid in identities:
            continue
        identities[pid] = _open_pidfd(pid)


def _descendant_pids(root_pid):
    parents = {root_pid}
    descendants = set()
    try:
        entries = os.listdir("/proc")
    except OSError:
        return descendants
    processes = []
    for entry in entries:
        if not entry.isdigit():
            continue
        try:
            tail = Path("/proc") / entry / "stat"
            fields = tail.read_text().rsplit(")", 1)[1].split()
            processes.append((int(entry), int(fields[1])))
        except (OSError, ValueError, IndexError):
            continue
    while parents:
        children = {pid for pid, ppid in processes if ppid in parents}
        children -= descendants
        descendants.update(children)
        parents = children
    return descendants


def _signal_pids(pids, sig, identities):
    for pid in pids:
        pidfd = identities.get(pid)
        if pidfd is None:
            continue
        try:
            signal.pidfd_send_signal(pidfd, sig, None, 0)
        except ProcessLookupError:
            pass


def _close_pidfds(identities):
    for pidfd in identities.values():
        if pidfd is not None:
            try:
                os.close(pidfd)
            except OSError:
                pass


def _stop_process_group(process, known_descendants=None, identities=None):
    identities = identities if identities is not None else {}
    _remember_pids({process.pid}, identities)
    descendants = set(known_descendants or ()) | _descendant_pids(process.pid)
    _remember_pids(descendants, identities)
    try:
        if not identities:
            return
        _signal_pids({process.pid}, signal.SIGTERM, identities)
        _signal_pids(descendants, signal.SIGTERM, identities)
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            pass
        descendants |= _descendant_pids(process.pid)
        _remember_pids(descendants, identities)
        _signal_pids({process.pid}, signal.SIGKILL, identities)
        _signal_pids(descendants, signal.SIGKILL, identities)
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            pass
    finally:
        _close_pidfds(identities)


def _wait_for_process(process, args, timeout, descendants, identities):
    deadline = time.monotonic() + timeout
    while True:
        descendants |= _descendant_pids(process.pid)
        _remember_pids(descendants, identities)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired(args, timeout)
        try:
            return process.wait(timeout=min(0.25, remaining)), descendants
        except subprocess.TimeoutExpired:
            continue


def _run_bounded(args, *, timeout, **kwargs):
    process = subprocess.Popen(args, start_new_session=True, **kwargs)
    descendants = set()
    identities = {}
    _remember_pids({process.pid}, identities)
    try:
        returncode, descendants = _wait_for_process(process, args, timeout, descendants, identities)
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        descendants |= _descendant_pids(process.pid)
        _remember_pids(descendants, identities)
        _stop_process_group(process, descendants, identities)
        raise
    if returncode:
        _stop_process_group(process, descendants, identities)
        raise subprocess.CalledProcessError(returncode, args)
    _close_pidfds(identities)
    return subprocess.CompletedProcess(args, returncode)


def directory(run):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,45}", run):
        raise ValueError("Use 1–46 lowercase letters, digits or hyphens for run id")
    return RUNS / run


def write(path, value):
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    os.replace(temporary, path)


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
        content = path.read_bytes() if path.exists() else b"<missing>"
        digest.update(name.encode() + b"\0" + content + b"\0")
    return digest.hexdigest()


def check_source(info):
    if info["source_sha256"] != fingerprint():
        raise RuntimeError("Checkout changed since start; use a fresh run")


def port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def clean_env():
    return {"PATH": os.environ["PATH"], "CI": "1", "APP_ENV": "test", "NO_COLOR": "1"}


def docker_env():
    return {"PATH": os.environ["PATH"], "DOCKER_HOST": "unix:///var/run/docker.sock"}


def owned(info, kind, name):
    observed = json.loads(execute(["docker", kind, "inspect", name]))[0]
    labels = observed.get("Labels") or observed.get("Config", {}).get("Labels") or {}
    if labels.get(LABEL) != info["owner"]:
        raise RuntimeError(f"Refusing foreign {kind}: {name}")
    return observed


def _resource_is_missing(kind, stderr):
    message = str(stderr or "").lower()
    return any(
        phrase in message
        for phrase in (
            f"no such {kind}",
            "no such object",
            "not found",
        )
    )


def _inspect_resource(kind, name):
    return subprocess.run(
        ["docker", kind, "inspect", name],
        env=docker_env(),
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )


def _ensure_image():
    found = _inspect_resource("image", IMAGE)
    if found.returncode == 0:
        return
    if not _resource_is_missing("image", found.stderr):
        raise RuntimeError(
            "Unable to inspect the local Docker image: " + (found.stderr or "unknown error").strip()
        )
    execute(["docker", "pull", IMAGE], timeout=900)


def _require_fresh_volume(name):
    found = _inspect_resource("volume", name)
    if found.returncode == 0:
        raise RuntimeError(f"Refusing to reuse existing volume: {name}")
    if not _resource_is_missing("volume", found.stderr):
        raise RuntimeError(
            "Unable to inspect the local Docker volume: " + (found.stderr or "unknown error").strip()
        )


def _cleanup_failed_start_relay(relay, info, receipt):
    if relay is None or info.get("relay_started") is not None:
        return
    if relay.poll() is None:
        _stop_process_group(relay)
    info["relay_started"] = "<relay-exited-during-start>"
    write(receipt, info)


def start(run):
    out = directory(run)
    out.mkdir(parents=True, exist_ok=False)
    os.chmod(out, 0o700)
    (out / "scratch").mkdir()
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
            "frontend": f"http://127.0.0.1:{ports[2]}", "image": IMAGE, "source_sha256": fingerprint(),
            "created_resources": {"network": False, "volume": False, "container": False}}
    write(out / "instance.json", info)
    relay = None
    try:
        _ensure_image()
        execute(["docker", "network", "create", "--internal", "--label", f"{LABEL}={owner}", name])
        info["created_resources"]["network"] = True
        write(out / "instance.json", info)
        _require_fresh_volume(name)
        execute(["docker", "volume", "create", "--label", f"{LABEL}={owner}", name])
        info["created_resources"]["volume"] = True
        write(out / "instance.json", info)
        cidfile = out / "container.cid"
        try:
            execute(["docker", "run", "-d", "--cidfile", str(cidfile), "--name", name,
                     "--label", f"{LABEL}={owner}", "--network", name,
                     "--mount", f"type=volume,source={name},target=/convex/data",
                     "-e", f"INSTANCE_NAME={name}", "-e", "DISABLE_BEACON=1",
                     "-e", f"CONVEX_CLOUD_ORIGIN={info['backend']}",
                     "-e", f"CONVEX_SITE_ORIGIN={info['site']}", IMAGE])
        finally:
            try:
                if cidfile.is_file() and cidfile.read_text().strip():
                    info["created_resources"]["container"] = True
                    write(out / "instance.json", info)
            except OSError:
                pass
        container = owned(info, "container", name)
        address = container["NetworkSettings"]["Networks"][name]["IPAddress"]
        relay_log = (out / "relay.log").open("w")
        relay = subprocess.Popen([sys.executable, str(REPO / "scripts/local-convex/relay.py"),
                                  address, str(ports[0]), str(ports[1])],
                                 stdout=relay_log, stderr=subprocess.STDOUT, start_new_session=True)
        info["relay_pid"] = relay.pid
        info["relay_started"] = None
        write(out / "instance.json", info)
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
        _cleanup_failed_start_relay(relay, info, out / "instance.json")
        stop(run, info)
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
    (release / "convex/crons.ts").write_text('import { cronJobs } from "convex/server";\nexport default cronJobs();\n')
    shutil.copyfile(REPO / "scripts/local-convex/seed.ts.txt", release / "convex/localVerification.ts")
    key = (out / "local-admin-key").read_text()
    env = clean_env()
    env["TMPDIR"] = str(out / "scratch")
    env.update(CONVEX_SELF_HOSTED_URL=info["backend"], CONVEX_SELF_HOSTED_ADMIN_KEY=key,
               CLERK_JWT_ISSUER_DOMAIN="http://127.0.0.1:9")
    cli = str(REPO / "node_modules/.bin/convex")
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
    env["TMPDIR"] = str(directory(run) / "scratch")
    env["LOCAL_CONVEX_RUN"] = run
    _run_bounded(["node", str(REPO / "scripts/local-convex/seed.mjs"), run],
                 cwd=REPO, env=env, timeout=120)
    _run_bounded([str(REPO / "web/node_modules/.bin/playwright"), "test", "--config",
                  "tests/local/playwright.config.ts", "--reporter=list"],
                 cwd=REPO / "web", env=env, timeout=900)
    check_source(info)


def stop(run, info=None):
    info = info or load(run)
    out = directory(run)
    name = info["name"]
    errors = []
    removed = {kind: False for kind in ("container", "volume", "network")}

    if "relay_pid" in info:
        try:
            if info.get("relay_started") is None:
                errors.append("Relay identity was not verified; refusing kill")
            else:
                observed = subprocess.run(
                    ["ps", "-p", str(info["relay_pid"]), "-o", "lstart="],
                    capture_output=True,
                    text=True,
                    check=False,
                    timeout=30,
                )
                if observed.returncode == 0:
                    if observed.stdout.strip() != info["relay_started"]:
                        raise RuntimeError("Relay PID identity changed; refusing kill")
                    os.killpg(info["relay_pid"], signal.SIGTERM)
                elif observed.stderr.strip():
                    errors.append("relay probe failed: " + observed.stderr.strip())
        except subprocess.TimeoutExpired:
            errors.append("relay probe timed out")
        except ProcessLookupError:
            pass
        except RuntimeError as exc:
            errors.append(str(exc))

    created_resources = info.get("created_resources", {})
    for kind in ("container", "volume", "network"):
        if created_resources.get(kind, True) is False:
            continue
        try:
            found = _inspect_resource(kind, name)
        except subprocess.TimeoutExpired:
            errors.append(f"{kind} inspect timed out")
            continue
        except OSError as exc:
            errors.append(f"{kind} inspect failed: {exc}")
            continue
        if found.returncode:
            if _resource_is_missing(kind, found.stderr):
                removed[kind] = True
            else:
                errors.append(
                    f"{kind} inspect failed: {(found.stderr or 'unknown error').strip()}"
                )
            continue
        try:
            owned(info, kind, name)
        except Exception as exc:
            if isinstance(exc, RuntimeError) and str(exc).startswith("Refusing foreign"):
                errors.append(str(exc))
            else:
                errors.append(f"{kind} ownership check failed: {exc}")
            continue
        try:
            cmd = ["docker", kind, "rm"]
            if kind == "container":
                cmd.append("-f")
            execute(cmd + [name])
            removed[kind] = True
        except Exception as exc:
            errors.append(f"{kind} removal failed: {exc}")

    for _ in range(50):
        released = True
        for key in ("backend", "site"):
            try:
                with socket.socket() as probe:
                    probe.settimeout(1)
                    if probe.connect_ex(("127.0.0.1", int(info[key].rsplit(":", 1)[1]))) == 0:
                        released = False
            except OSError as exc:
                errors.append(f"{key} listener probe failed: {exc}")
        if released:
            break
        time.sleep(0.1)
    else:
        errors.append("Owned relay listeners did not stop")

    for filename in ("local-admin-key", "local.env", "identity.json", "container.cid"):
        try:
            (out / filename).unlink(missing_ok=True)
        except OSError as exc:
            errors.append(f"credential cleanup failed for {filename}: {exc}")
    try:
        shutil.rmtree(out / "release", ignore_errors=False)
    except FileNotFoundError:
        pass
    except OSError as exc:
        errors.append(f"release cleanup failed: {exc}")
    try:
        shutil.rmtree(out / "scratch", ignore_errors=False)
    except FileNotFoundError:
        pass
    except OSError as exc:
        errors.append(f"scratch cleanup failed: {exc}")

    cleanup = {
        "status": "pass" if not errors else "fail",
        "container_removed": name if removed["container"] else None,
        "volume_removed": name if removed["volume"] else None,
        "network_removed": name if removed["network"] else None,
        "local_credentials_removed": not any(
            (out / filename).exists() for filename in ("local-admin-key", "local.env", "identity.json", "container.cid")
        ),
    }
    if errors:
        cleanup["errors"] = errors
    write(out / "cleanup.json", cleanup)
    print((out / "cleanup.json").read_text())
    if errors:
        raise RuntimeError("Cleanup failed: " + "; ".join(errors))


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
