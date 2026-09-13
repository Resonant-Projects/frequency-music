#!/usr/bin/env bash
# Offline smoke test for guest-module-identities.py against a local fake backend.
# Exercises: success (no config leak, 0600 output), 4 MiB overflow, HTTP error,
# malformed identity, redirect refusal, key-file permission check, rerun refusal.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
script="$here/../guest-module-identities.py"
work=$(mktemp -d)
trap 'rm -rf "$work"; [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null || true' EXIT
umask 077
echo "fake-key" > "$work/key"
export RESTORE_ADMIN_KEY_FILE="$work/key"
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')
export RESTORE_BACKEND_ORIGIN="http://127.0.0.1:$port"

start_fake() {  # start_fake <mode>; fails if the fake dies or never listens
  python3 "$here/fake-backend.py" "$1" "$port" & pid=$!
  local i
  for i in $(seq 1 40); do
    kill -0 "$pid" 2>/dev/null || { echo "FAIL fake backend exited for mode $1"; exit 1; }
    python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(0.2); s.connect(("127.0.0.1",int(sys.argv[1]))); s.close()' "$port" 2>/dev/null && return 0
    sleep 0.1
  done
  echo "FAIL fake backend never listened for mode $1"; exit 1
}

run_mode() {
  local mode=$1 expect=$2
  start_fake "$mode"
  rm -f "$work/out.json"
  local out
  out=$(RESTORE_IDENTITIES_OUT="$work/out.json" python3 "$script" || true)
  kill "$pid"; wait "$pid" 2>/dev/null || true; pid=""
  grep -q "\"classification\": \"$expect\"" <<<"$out" || { echo "FAIL $mode: $out"; exit 1; }
  grep -q -i "leak" <<<"$out" && { echo "FAIL $mode leaked into stdout"; exit 1; }
  echo "ok $mode -> $expect"
}

run_mode ok success_envelope
[ "$(stat -f '%Lp' "$work/out.json" 2>/dev/null || stat -c '%a' "$work/out.json")" = "600" ] || { echo "FAIL output mode"; exit 1; }
grep -q LEAK "$work/out.json" && { echo "FAIL config leaked into output file"; exit 1; }
python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert [m["path"] for m in d["moduleHashes"]]==["a.js","b.js"]' "$work/out.json"
echo "ok output file sanitized, sorted, 0600"
# rerun with existing output must refuse before any request
out=$(RESTORE_IDENTITIES_OUT="$work/out.json" python3 "$script" || true)
grep -q '"output_exists"' <<<"$out" || { echo "FAIL rerun: $out"; exit 1; }; echo "ok rerun -> output_exists"
run_mode big limits_exceeded
run_mode err http_error
run_mode bad malformed_response
run_mode redirect http_error
chmod 644 "$work/key"
out=$(RESTORE_IDENTITIES_OUT="$work/out2.json" python3 "$script" || true)
grep -q '"key_file_permissions"' <<<"$out" || { echo "FAIL perms: $out"; exit 1; }; echo "ok loose key file -> key_file_permissions"
chmod 600 "$work/key"
# Hard wall-clock deadline: the fake never completes the exchange. The process
# must finish within deadline + 3 s, report deadline_exceeded, and leave no file.
bounded_mode() {
  local mode=$1 deadline=2 limit=5 waited=0
  start_fake "$mode"
  rm -f "$work/out-$mode.json" "$work/stdout-$mode"
  RESTORE_DEADLINE_SECONDS=$deadline RESTORE_IDENTITIES_OUT="$work/out-$mode.json" \
    python3 "$script" > "$work/stdout-$mode" 2>&1 & cpid=$!
  while kill -0 "$cpid" 2>/dev/null; do
    sleep 0.5; waited=$((waited + 1))
    if [ "$waited" -ge $((limit * 2)) ]; then kill -9 "$cpid" 2>/dev/null; echo "FAIL $mode: extractor still running after ${limit}s"; kill "$pid"; exit 1; fi
  done
  wait "$cpid" && { echo "FAIL $mode: exit 0"; kill "$pid"; exit 1; }
  kill "$pid"; wait "$pid" 2>/dev/null || true; pid=""
  grep -q '"classification": "deadline_exceeded"' "$work/stdout-$mode" || { echo "FAIL $mode: $(cat "$work/stdout-$mode")"; exit 1; }
  [ ! -e "$work/out-$mode.json" ] || { echo "FAIL $mode: output file exists"; exit 1; }
  echo "ok $mode -> deadline_exceeded within ${limit}s, no output file"
}
bounded_mode drip    # socket blocks inside one read
bounded_mode stall   # no headers ever
bounded_mode slow    # bytes keep arriving under the per-socket timeout; only the wall clock can stop it
echo "smoke test passed"
