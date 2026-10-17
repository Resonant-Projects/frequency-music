#!/usr/bin/env bash
# Offline cases for host-receipt-reads.sh using PATH shims for pct, hostname and
# timeout. No Proxmox host or guest is contacted. Each case states the exact
# expected exit status and, where given, the failure message.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
script="$here/../host-receipt-reads.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export SHIM_STATE="$work/state"
export ISOLATED_RESTORE_RUN_DIR="$work/runs"
export RECEIPT_READER="$work/reader.py"
export PATH="$work/bin:$PATH"
mkdir -p "$work/bin"
echo 'print("reader")' > "$RECEIPT_READER"

cat > "$work/bin/timeout" <<'EOF'
#!/usr/bin/env bash
[ "$1" = --kill-after=5 ] || exit 99; shift
echo "timeout $1 ${*:2}" >> "$SHIM_STATE/calls.log"; shift; exec "$@"
EOF
cat > "$work/bin/hostname" <<'EOF'
#!/usr/bin/env bash
echo prox4
EOF
cat > "$work/bin/pct" <<'EOF'
#!/usr/bin/env bash
echo "pct $*" >> "$SHIM_STATE/calls.log"
cmd=$1; shift 2
case "$cmd" in
  status) cat "$SHIM_STATE/status" ;;
  config) cat "$SHIM_STATE/config" ;;
  push) [ -f "$1" ] ;;
  pull) cp "$SHIM_STATE/pulled.json" "$2" ;;
  exec) shift; bash "$SHIM_STATE/../exec.sh" "$@" ;;
  *) exit 2 ;;
esac
EOF
# Guest command emulation, keyed on the exact command shape the script sends.
cat > "$work/exec.sh" <<'EOF'
case "$*" in
  "test -f /etc/isolated-restore-913") [ ! -f "$SHIM_STATE/no_marker" ] ;;
  "sh -c for i in /sys/class/net/*; do n=\${i##*/}; k=other;"*) printf '  lo:loopback\n  docker0:bridge\n' ;;
  "sh -c for i in /sys/class/net/*;"*'echo "$n"; done') cat "$SHIM_STATE/bad_ifaces" 2>/dev/null || true ;;
  "docker ps --format {{.Names}}") cat "$SHIM_STATE/running" ;;
  "sh -c ip route show default"*) echo 0 ;;
  "systemctl list-units"*) printf 'docker.service loaded active running Docker\nsystemd-journald.service loaded active running Journal\n' ;;
  "docker inspect --format {{.Image}} app-convex-backend-1") cat "$SHIM_STATE/image" ;;
  "docker image inspect"*) if [ -f "$SHIM_STATE/no_digest" ]; then echo '[]'; else echo '["ghcr.io/get-convex/convex-backend@sha256:d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4"]'; fi ;;
  "docker inspect --format {{.State.StartedAt}} app-convex-backend-1") echo 2026-10-17T16:31:00.1Z ;;
  "docker inspect --format {{.Image}} app-postgres-1") echo sha256:78bf ;;
  "docker inspect --format {{.State.StartedAt}} app-postgres-1") echo 2026-10-17T16:30:00.123456789Z ;;
  "python3 /root/guest-receipt-reads.py --postgres-recovery 2026-10-17T16:30:00.123456789Z")
    if [ -f "$SHIM_STATE/recovery_fails" ]; then echo '{"ok": false, "classification": "log_read_failed"}'; exit 1; fi
    echo '{"ok": true, "events": [{"at": "2026-10-17 16:30:01.1 UTC", "event": "ready_to_accept_connections"}]}' ;;
  "sh -c trap \"rm -f /root/.restore-admin-key\""*) [ ! -f "$SHIM_STATE/reader_fails" ] || exit 1; [ ! -f "$SHIM_STATE/checks_fail" ] || exit 2 ;;
  "sh -c [ ! -e /root/.restore-admin-key ]") [ ! -f "$SHIM_STATE/key_left" ] ;;
  "rm -f "*) ;;
  *) echo "exec shim: unexpected $*" >&2; exit 98 ;;
esac
EOF
chmod +x "$work/bin/"*

reset_state() {
  rm -rf "$SHIM_STATE" "$work/runs"; mkdir -p "$SHIM_STATE" "$work/runs"
  printf 'ctid=913\nnode=prox4\narchive=a\ncreated_at=2026-10-17T16:29:05Z\nhostname=convex-hatchet-restore-913\nrootfs=ceph-vm:vm-913-disk-0\nmp0=ceph-vm:vm-913-disk-1\n' > "$work/runs/913.record"
  cat > "$SHIM_STATE/config" <<'CFG'
hostname: convex-hatchet-restore-913
mp0: ceph-vm:vm-913-disk-1,mp=/srv/app-data,backup=1,size=64G
onboot: 0
rootfs: ceph-vm:vm-913-disk-0,size=32G
tags: disposable-restore
unprivileged: 1
CFG
  echo "status: running" > "$SHIM_STATE/status"
  printf 'app-postgres-1\napp-convex-backend-1\n' > "$SHIM_STATE/running"
  echo "sha256:$(printf 'd%.0s' {1..64})" > "$SHIM_STATE/image"
  echo '{"format": "frequency-restore-receipt-reads-v1", "deploymentAuthorized": false}' > "$SHIM_STATE/pulled.json"
}
pass=0; failn=0
expect() {  # expect <rc> <label> [--msg <text>] <args...>
  local want=$1 label=$2 msg="" rc=0; shift 2
  if [ "${1:-}" = --msg ]; then msg=$2; shift 2; fi
  bash "$script" "$@" > "$work/last.out" 2>&1 || rc=$?
  if [ "$rc" = "$want" ] && { [ -z "$msg" ] || grep "^host-receipt-reads: " "$work/last.out" | grep -q -F -- "$msg"; }; then
    echo "ok   $label (rc=$rc)"; pass=$((pass + 1))
  else
    echo "FAIL $label (rc=$rc, wanted $want${msg:+, msg '$msg'})"; sed 's/^/     /' "$work/last.out"; failn=$((failn + 1))
  fi
}
check() { if eval "$2"; then echo "ok   $1"; pass=$((pass + 1)); else echo "FAIL $1"; failn=$((failn + 1)); fi; }

reset_state
expect 0 "happy path pulls the receipt file" 913
check "happy path reports passed checks" "grep -qx 'receipt checks: passed' '$work/last.out'"
check "repository digest is printed" "grep -q '^app-convex-backend-1 repo digests: .*@sha256:d715e9ec' '$work/last.out'"
check "output names the run-owned file" "grep -q '^receipt reads file: $work/runs/913-20261017T162905Z-receipt-reads.json sha256=[0-9a-f]\{64\}$' '$work/last.out'"
check "pulled file is private" "[ \"\$(stat -c %a '$work/runs/913-20261017T162905Z-receipt-reads.json' 2>/dev/null || stat -f %Lp '$work/runs/913-20261017T162905Z-receipt-reads.json')\" = 600 ]"
check "running services listed by name only" "grep -qx '  docker.service' '$work/last.out' && ! grep -q 'Docker$' '$work/last.out'"
check "every pct exec, push and pull carries a deadline" "[ \"\$(grep -c '^pct \(exec\|push\|pull\)' '$SHIM_STATE/calls.log')\" = \"\$(grep -c '^timeout [0-9]* pct \(exec\|push\|pull\)' '$SHIM_STATE/calls.log')\" ]"
check "guest reader runs under the key trap and its own deadline" "grep -q '^timeout 1560 pct exec 913 -- sh -c trap \"rm -f /root/.restore-admin-key\" EXIT HUP INT TERM;' '$SHIM_STATE/calls.log'"
expect 1 "refuses to overwrite earlier evidence" --msg "already exists" 913

reset_state; echo 'net0: name=veth0,bridge=vmbr0' >> "$SHIM_STATE/config"
expect 1 "refuses a guest with a network entry" --msg "network, extra mount" 913
reset_state; echo 'hookscript: local:snippets/x' >> "$SHIM_STATE/config"
expect 1 "refuses a guest with a hookscript" --msg "hookscript" 913
reset_state; echo eth0 > "$SHIM_STATE/bad_ifaces"
expect 1 "refuses an unexpected guest interface" --msg "unexpected interfaces in guest: eth0" 913
reset_state; printf 'app-postgres-1\napp-convex-backend-1\napp-hatchet-engine-1\n' > "$SHIM_STATE/running"
expect 1 "refuses an extra running container" --msg "unexpected running containers" 913
reset_state; echo app-postgres-1 > "$SHIM_STATE/running"
expect 1 "refuses before the backend runs" --msg "unexpected running containers" 913
reset_state; touch "$SHIM_STATE/no_marker"
expect 1 "refuses without the prepare marker" --msg "prepare marker missing" 913
reset_state; echo "status: stopped" > "$SHIM_STATE/status"
expect 1 "refuses a stopped guest" --msg "guest not running" 913
reset_state; sed -i.bak 's#^rootfs: ceph-vm:vm-913-disk-0#rootfs: ceph-vm:vm-113-disk-0#' "$SHIM_STATE/config"
expect 1 "refuses a live rootfs that differs from the record" --msg "rootfs volume differs" 913
reset_state; sed -i.bak 's#^node=prox4#node=prox5#' "$work/runs/913.record"
expect 1 "refuses a record from another node" --msg "node mismatch" 913
reset_state; rm "$work/runs/913.record"
expect 1 "refuses without a run record" --msg "no run record" 913
reset_state
expect 1 "refuses a CTID outside 911-913" --msg "ctid must be" 113
reset_state; echo notadigest > "$SHIM_STATE/image"
expect 1 "refuses a malformed image id" --msg "image id malformed" 913
reset_state; touch "$SHIM_STATE/recovery_fails"
expect 1 "fails when the guest-side recovery parse fails" --msg "postgres recovery read failed" 913
check "recovery is read through the guest parser, never raw logs" "grep -q '^timeout 30 pct exec 913 -- python3 /root/guest-receipt-reads.py --postgres-recovery ' '$SHIM_STATE/calls.log' && ! grep -q 'docker logs' '$SHIM_STATE/calls.log'"
reset_state; touch "$SHIM_STATE/reader_fails"
expect 1 "fails when the guest reader fails" --msg "receipt reads failed inside guest" 913
check "no file pulled after a reader failure" "[ ! -e '$work/runs/913-20261017T162905Z-receipt-reads.json' ]"
reset_state; touch "$SHIM_STATE/checks_fail"
expect 2 "pulls evidence, then exits 2 when receipt checks fail" 913
check "failed-check evidence is pulled" "[ -f '$work/runs/913-20261017T162905Z-receipt-reads.json' ] && grep -q '^receipt checks: failed' '$work/last.out'"
reset_state; touch "$SHIM_STATE/no_digest"
expect 1 "refuses a backend image without a repository digest" --msg "repo digest missing" 913
reset_state; touch "$SHIM_STATE/key_left"
expect 1 "fails when the admin key survives" --msg "admin key file still present" 913
check "no file pulled while the key survives" "[ ! -e '$work/runs/913-20261017T162905Z-receipt-reads.json' ]"
reset_state; echo '{"format": "other"}' > "$SHIM_STATE/pulled.json"
expect 1 "fails a pulled file of the wrong shape" --msg "failed shape check" 913

# Execute the script's actual interface snippets against a fake /sys/class/net.
if python3 - "$script" "$work" <<'PYNET'
import os, pathlib, subprocess, sys
script, work = map(pathlib.Path, sys.argv[1:])
net = work / "fake-sys-class-net"; devices = work / "fake-devices"
for name in ("lo", "eth0", "docker0", "veth1"):
    (devices / name).mkdir(parents=True)
(devices / "docker0" / "bridge").mkdir(); (devices / "veth1" / "master").touch()
net.mkdir()
for name in ("lo", "eth0", "docker0", "veth1"):
    (net / name).symlink_to(devices / name)
(net / "bonding_masters").write_text("")            # the bonding driver's control file
(net / "stray").write_text("")                       # any other regular file still reports
(devices / "decoy").mkdir(); (net / "bonding_masters2").symlink_to(devices / "decoy")
snippets = [l.split("sh -c '", 1)[1].rsplit("'", 1)[0] for l in script.read_text().splitlines() if "for i in /sys/class/net/*" in l]
assert len(snippets) == 2, len(snippets)
gate = next(s for s in snippets if 'echo "$n"; done' in s)
listing = next(s for s in snippets if "k=other" in s)
run = lambda s: subprocess.run(["sh", "-c", s.replace("/sys/class/net", str(net))], capture_output=True, text=True, check=True).stdout.split()
assert run(gate) == ["bonding_masters2", "eth0", "stray"], run(gate)
assert run(listing) == ["bonding_masters:bonding-control-file", "bonding_masters2:other", "docker0:bridge", "eth0:other",
                        "lo:loopback", "stray:other", "veth1:bridge-port"], run(listing)
PYNET
then echo "ok   interface snippets skip only the bonding control file"; pass=$((pass + 1)); else echo "FAIL interface snippets"; failn=$((failn + 1)); fi

# Execute the actual guest key-trap shell against linked key files, using inert commands.
if python3 - "$script" "$work" <<'PYKEY'
import pathlib, subprocess, sys
script, work = map(pathlib.Path, sys.argv[1:])
line = next(l for l in script.read_text().splitlines() if 'trap "rm -f /root/.restore-admin-key"' in l)
command = line.split("-- sh -c '", 1)[1].rsplit("'", 1)[0]
root = work / "key-regression"; root.mkdir()
command = command.replace("/root/", str(root) + "/").replace(
    "docker exec app-convex-backend-1 ./generate_admin_key.sh", "printf synthetic-key").replace(
    "python3 " + str(root) + "/guest-receipt-reads.py", "true")
target, key = root / "target", root / ".restore-admin-key"
for kind in ("symlink", "hardlink"):
    target.write_text("unchanged")
    key.symlink_to(target) if kind == "symlink" else key.hardlink_to(target)
    subprocess.run(["sh", "-c", command], check=True)
    assert target.read_text() == "unchanged", kind
    assert not key.exists(), kind
PYKEY
then echo "ok   admin key creation preserves symlink and hardlink targets"; pass=$((pass + 1)); else echo "FAIL admin key regression"; failn=$((failn + 1)); fi

echo "passed=$pass failed=$failn"
[ "$failn" -eq 0 ]
