#!/usr/bin/env python3
"""Query the agent repository's Harbor artifacts with the robot credentials.

digest REF        print REF's digest, or nothing when REF is absent
amd64 REF         print the linux/amd64 image digest of index REF
signed REF        exit 0 when REF has a cosign signature accessory
scan REF SECONDS  wait for REF's vulnerability scan; print its summary
"""
import base64, json, os, sys, time, urllib.error, urllib.parse, urllib.request

REPORT = "application/vnd.security.vulnerability.report; version=1.1"
env = os.environ
project, _, repository = env["HARBOR_REPOSITORY"].partition("/")
repository = urllib.parse.quote(urllib.parse.quote(repository, safe=""), safe="")
base = f"https://{env['HARBOR_REGISTRY']}/api/v2.0/projects/{project}/repositories/{repository}/artifacts"
auth = base64.b64encode(f"{env['HARBOR_USERNAME']}:{env['HARBOR_PASSWORD']}".encode()).decode()


def api(ref, suffix="", method="GET"):
    request = urllib.request.Request(
        f"{base}/{urllib.parse.quote(ref, safe=':')}{suffix}",
        data=b"" if method == "POST" else None,
        method=method,
        # Ask for the generic report the scan wait parses. Harbor
        # already returns it by default; this pins it.
        headers={"Accept": "application/json", "Authorization": f"Basic {auth}",
                 "X-Accept-Vulnerabilities": REPORT},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read() or b"null")
    except urllib.error.HTTPError as err:
        if err.code == 404 and method == "GET":
            return None
        sys.exit(f"{method} {ref}{suffix}: HTTP {err.code}")


command, ref = sys.argv[1], sys.argv[2]
if command == "digest":
    print((api(ref) or {}).get("digest", ""))
elif command == "amd64":
    artifact = api(ref)
    if artifact is None:
        sys.exit(f"{ref} is not in Harbor")
    children = artifact.get("references") or []
    amd64 = [
        child["child_digest"]
        for child in children
        if (child.get("platform") or {}).get("os") == "linux"
        and (child.get("platform") or {}).get("architecture") == "amd64"
    ]
    if children and not amd64:
        sys.exit(f"{ref} has no linux/amd64 image")
    print(amd64[0] if amd64 else artifact["digest"])
elif command == "signed":
    accessories = (api(ref, "?with_accessory=true") or {}).get("accessories") or []
    sys.exit(0 if any(a.get("type") == "signature.cosign" for a in accessories) else 1)
elif command == "scan":
    started = time.monotonic()
    requested = False
    while True:
        artifact = api(ref, "?with_scan_overview=true&with_accessory=true") or {}
        overview = (artifact.get("scan_overview") or {}).get(REPORT) or {}
        status = overview.get("scan_status")
        if status == "Success":
            summary = overview.get("summary") or {}
            print(json.dumps({
                "digest": ref,
                "scanner": overview.get("scanner"),
                "severity": overview.get("severity"),
                "total": summary.get("total"),
                "fixable": summary.get("fixable"),
                "counts": summary.get("summary"),
            }, indent=2))
            break
        if status in ("Error", "Stopped"):
            sys.exit(f"{ref} scan status {status}")
        # The project scans on push; request one only if none has started.
        if not status and not requested and time.monotonic() - started > 60:
            api(ref, "/scan", "POST")
            requested = True
        if time.monotonic() - started > int(sys.argv[3]):
            sys.exit(f"{ref} scan did not finish within {sys.argv[3]}s")
        time.sleep(15)
else:
    sys.exit(__doc__)
