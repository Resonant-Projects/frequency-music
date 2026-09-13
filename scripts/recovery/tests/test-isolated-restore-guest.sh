#!/usr/bin/env bash
# Offline failure-case tests for isolated-restore-guest.sh using PATH shims for
# pct, pvesm, pvesh and hostname. No Proxmox host is contacted. Each case states
# the expected exit status; a wrong status fails the suite.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
helper="$here/../isolated-restore-guest.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export SHIM_STATE="$work/state"; mkdir -p "$SHIM_STATE" "$work/bin"
export ISOLATED_RESTORE_RUN_DIR="$work/runs"
export ISOLATED_RESTORE_LXC_BASE="$work/lxc"
export ISOLATED_RESTORE_PVE_LXC_DIR="$work/pve"
export ISOLATED_RESTORE_MEMINFO="$work/meminfo"
export ISOLATED_RESTORE_BOOT_ATTEMPTS=3
export ISOLATED_RESTORE_SLEEP=0
export ISOLATED_RESTORE_READY_SECONDS=2
export PATH="$work/bin:$PATH"

cat > "$work/bin/hostname" <<'EOF'
#!/usr/bin/env bash
cat "$SHIM_STATE/hostname"
EOF
cat > "$work/bin/pvesh" <<'EOF'
#!/usr/bin/env bash
cat "$SHIM_STATE/cluster.json"
EOF
cat > "$work/bin/pvesm" <<'EOF'
#!/usr/bin/env bash
case "$1 $2" in
  "status --storage") printf 'Name Type Status Total Used Available %%\nceph-vm rbd active 1 1 %s 1\n' "$(cat "$SHIM_STATE/ceph_avail")" ;;
  "list nas-docker") printf 'Volid Format Type Size VMID\n'; cat "$SHIM_STATE/archives" ;;
  "list ceph-vm") printf 'Volid Format Type Size VMID\n'; cat "$SHIM_STATE/volumes" 2>/dev/null || true ;;
  *) echo "pvesm shim: unsupported $*" >&2; exit 2 ;;
esac
EOF
cat > "$work/bin/pct" <<'EOF'
#!/usr/bin/env bash
echo "pct $*" >> "$SHIM_STATE/calls.log"
cmd=$1; ctid=$2; shift 2 || true
case "$cmd" in
  config) cat "$SHIM_STATE/config" ;;
  status) cat "$SHIM_STATE/status" ;;
  set)
    if [ "$1" = "--delete" ] && [ "$2" = "net0" ]; then
      grep -v '^net0' "$SHIM_STATE/config" > "$SHIM_STATE/config.new" || true; mv "$SHIM_STATE/config.new" "$SHIM_STATE/config"
      [ -f "$SHIM_STATE/refuse_net_delete" ] && echo "net0: 1" >> "$SHIM_STATE/config"
    fi ;;
  mount|unmount|stop|push|start) ;;
  pull) cp "$SHIM_STATE/guest-identities.json" "$2" ;;
  restore) cp "$SHIM_STATE/restored.config" "$SHIM_STATE/config"; echo "status: stopped" > "$SHIM_STATE/status"; touch "$SHIM_STATE/../pve/$ctid.conf" ;;
  destroy) : > "$SHIM_STATE/volumes"; [ -f "$SHIM_STATE/leave_volume" ] && cp "$SHIM_STATE/leave_volume" "$SHIM_STATE/volumes"; rm -f "$SHIM_STATE/../pve/$ctid.conf"; touch "$SHIM_STATE/destroyed" ;;
  exec) shift; [ "$1" = "--" ] && shift; bash "$SHIM_STATE/exec.sh" "$@" ;;
  *) echo "pct shim: unsupported $cmd" >&2; exit 2 ;;
esac
EOF
chmod +x "$work/bin/"*

good_config() {
  cat > "$SHIM_STATE/config" <<EOF
arch: amd64
hostname: convex-hatchet-restore-913
memory: 8192
mp0: ceph-vm:vm-913-disk-1,mp=/srv/app-data,backup=1,size=64G
onboot: 0
rootfs: ceph-vm:vm-913-disk-0,size=32G
tags: disposable-restore
unprivileged: 1
EOF
}
reset_state() {
  rm -rf "$SHIM_STATE" "$work/runs" "$work/lxc" "$work/pve"; mkdir -p "$SHIM_STATE" "$work/pve"
  echo prox4 > "$SHIM_STATE/hostname"
  echo "MemAvailable:   40000000 kB" > "$work/meminfo"
  echo '[{"vmid":113},{"vmid":107}]' > "$SHIM_STATE/cluster.json"
  echo $((200 * 1024 * 1024)) > "$SHIM_STATE/ceph_avail"
  echo 'nas-docker:backup/vzdump-lxc-113-2026_09_07-10_31_51.tar.zst tar.zst backup 17516650393 113' > "$SHIM_STATE/archives"
  echo "status: stopped" > "$SHIM_STATE/status"
  good_config; cp "$SHIM_STATE/config" "$SHIM_STATE/restored.config"
  echo 'net0: name=veth0,bridge=vmbr0,hwaddr=BC:24:11:2B:10:EB,ip=172.16.10.24/27' >> "$SHIM_STATE/restored.config"
  printf 'exit 0\n' > "$SHIM_STATE/exec.sh"
}
pass=0; failn=0
expect() {  # expect <0|1> <label> [--msg <text>] <helper args...>; want=1 means exactly rc=1 from die()
  local want=$1 label=$2; shift 2
  local msg=""
  if [ "${1:-}" = "--msg" ]; then msg=$2; shift 2; fi
  local rc=0
  bash "$helper" "$@" > "$work/last.out" 2>&1 || rc=$?
  if [ "$rc" = "$want" ] && { [ -z "$msg" ] || grep "^isolated-restore: " "$work/last.out" | grep -q -F -- "$msg"; }; then
    echo "ok   $label (rc=$rc)"; pass=$((pass + 1))
  else
    echo "FAIL $label (rc=$rc, wanted $want${msg:+, msg '$msg'})"; sed 's/^/     /' "$work/last.out"; failn=$((failn + 1))
  fi
}
A='nas-docker:backup/vzdump-lxc-113-2026_09_07-10_31_51.tar.zst'

# --- preflight ---
reset_state
expect 0 "preflight passes on clean state" preflight 913 "$A" prox4
expect 1 "preflight rejects wrong node" --msg "run on prox5" preflight 913 "$A" prox5
expect 1 "preflight rejects ctid outside 911-913" preflight 900 "$A" prox4
expect 1 "preflight rejects non-CT113 archive" preflight 913 'nas-docker:backup/vzdump-lxc-112-2026_09_07-10_31_51.tar.zst' prox4
echo '[{"vmid":913}]' > "$SHIM_STATE/cluster.json"
expect 1 "preflight rejects ctid present in cluster" --msg "exists somewhere in the cluster" preflight 913 "$A" prox4
reset_state; echo 1000 > "$SHIM_STATE/ceph_avail"
expect 1 "preflight rejects insufficient ceph-vm space" preflight 913 "$A" prox4
reset_state; echo "MemAvailable:   1000 kB" > "$work/meminfo"
expect 1 "preflight rejects insufficient node memory" --msg "MemAvailable" preflight 913 "$A" prox4
reset_state; printf 'ceph-vm:vm-913-disk-7 raw rootdir 1 913\n' > "$SHIM_STATE/volumes"
expect 1 "preflight rejects pre-existing volumes for the ctid" --msg "pre-existing volumes" preflight 913 "$A" prox4

# --- restore + record ---
reset_state
expect 0 "restore strips net0 and writes record" restore 913 "$A" prox4
grep -q 'restore 913' "$SHIM_STATE/calls.log" && grep -q 'set 913 --delete net0' "$SHIM_STATE/calls.log" || { echo "FAIL restore did not delete net0"; failn=$((failn+1)); }
grep -q '^rootfs=ceph-vm:vm-913-disk-0$' "$work/runs/913.record" && grep -q '^mp0=ceph-vm:vm-913-disk-1$' "$work/runs/913.record" || { echo "FAIL record lacks volids"; failn=$((failn+1)); }
expect 1 "second restore refused while record exists" restore 913 "$A" prox4
reset_state; touch "$SHIM_STATE/refuse_net_delete"
expect 1 "restore fails closed when net0 cannot be removed" --msg "network entries remain" restore 913 "$A" prox4
[ ! -f "$work/runs/913.record" ] || { echo "FAIL record written despite isolation failure"; failn=$((failn+1)); }
# Ownership and storage assertions run before the record exists, on the restored config.
reset_state; sed -i.bak 's#^rootfs: ceph-vm:vm-913-disk-0#rootfs: local-lvm:vm-913-disk-0#' "$SHIM_STATE/restored.config"
expect 1 "restore rejects rootfs on another storage" --msg "rootfs 'local-lvm:vm-913-disk-0,size=32G' is not this guest's ceph-vm volume" restore 913 "$A" prox4
[ ! -f "$work/runs/913.record" ] || { echo "FAIL record written despite rootfs storage failure"; failn=$((failn+1)); }
reset_state; sed -i.bak 's#^mp0: ceph-vm:vm-913-disk-1#mp0: ceph-vm:vm-113-disk-1#' "$SHIM_STATE/restored.config"
expect 1 "restore rejects mp0 belonging to another guest" --msg "mp0 'ceph-vm:vm-113-disk-1,mp=/srv/app-data,backup=1,size=64G' is not this guest's ceph-vm volume" restore 913 "$A" prox4
[ ! -f "$work/runs/913.record" ] || { echo "FAIL record written despite mp0 ownership failure"; failn=$((failn+1)); }
reset_state; sed -i.bak 's#mp=/srv/app-data#mp=/mnt/other#' "$SHIM_STATE/restored.config"
expect 1 "restore rejects mp0 at another mount point" --msg "mp0 mount point is not /srv/app-data" restore 913 "$A" prox4
reset_state; echo 'unused0: ceph-vm:vm-913-disk-5' >> "$SHIM_STATE/restored.config"
expect 1 "restore rejects an unused volume entry" --msg "unexpected mounts, unused volumes, hookscript or raw lxc keys" restore 913 "$A" prox4
reset_state; sed -i.bak 's#^unprivileged: 1#unprivileged: 0#' "$SHIM_STATE/restored.config"
expect 1 "restore rejects a privileged guest" --msg "is not unprivileged" restore 913 "$A" prox4
reset_state; echo 'hookscript: local:snippets/evil.sh' >> "$SHIM_STATE/restored.config"
expect 1 "restore rejects an archived hookscript" --msg "hookscript" restore 913 "$A" prox4

# --- isolation config assertions (via prepare, which needs a record) ---
make_rootfs() {
  local r="$work/lxc/913/rootfs"; rm -rf "$r"
  mkdir -p "$r/etc/systemd/system/multi-user.target.wants" "$r/etc/systemd/system/timers.target.wants" "$r/etc/op" "$r/var/lib/docker/containers/abc"
  for u in docker.service containerd.service app-compose.service cron.service; do ln -s "/etc/systemd/system/$u" "$r/etc/systemd/system/multi-user.target.wants/$u"; done
  ln -s /etc/systemd/system/lab-heartbeat.timer "$r/etc/systemd/system/timers.target.wants/lab-heartbeat.timer"
  echo token > "$r/etc/op/service-account.env"
  echo '{"RestartPolicy":{"Name":"unless-stopped","MaximumRetryCount":0},"Binds":[]}' > "$r/var/lib/docker/containers/abc/hostconfig.json"
}
seed_record() { bash "$helper" restore 913 "$A" prox4 >/dev/null; }
reset_state; seed_record; make_rootfs
expect 0 "prepare passes with allow-listed units" prepare 913
[ -L "$work/lxc/913/rootfs/etc/systemd/system/app-compose.service" ] || { echo "FAIL app-compose not masked"; failn=$((failn+1)); }
[ ! -e "$work/lxc/913/rootfs/etc/systemd/system/multi-user.target.wants/cron.service" ] || { echo "FAIL cron wants link remains"; failn=$((failn+1)); }
[ ! -e "$work/lxc/913/rootfs/etc/op/service-account.env" ] || { echo "FAIL service-account env remains"; failn=$((failn+1)); }
grep -q '"Name": "no"' "$work/lxc/913/rootfs/var/lib/docker/containers/abc/hostconfig.json" || { echo "FAIL restart policy not rewritten"; failn=$((failn+1)); }
[ -f "$work/lxc/913/rootfs/etc/isolated-restore-913" ] || { echo "FAIL marker missing"; failn=$((failn+1)); }

reset_state; seed_record; make_rootfs
ln -s /etc/systemd/system/evil-producer.service "$work/lxc/913/rootfs/etc/systemd/system/multi-user.target.wants/evil-producer.service"
expect 1 "prepare rejects an enabled unit outside the allow-list" --msg "outside the allow-list" prepare 913

reset_state; seed_record; make_rootfs; rm -rf "$work/lxc/913/rootfs/var/lib/docker/containers"
expect 1 "prepare fails when no container hostconfig is found" prepare 913

reset_state; seed_record; make_rootfs
sed -i.bak 's#^rootfs: ceph-vm:vm-913-disk-0#rootfs: ceph-vm:vm-913-disk-4#' "$SHIM_STATE/config"
expect 1 "prepare refuses when the live rootfs volume drifted from the record" --msg "rootfs volume differs from run record" prepare 913
reset_state; seed_record; make_rootfs
sed -i.bak 's#^mp0: ceph-vm:vm-913-disk-1#mp0: ceph-vm:vm-913-disk-6#' "$SHIM_STATE/config"
expect 1 "prepare refuses when the live mp0 volume drifted from the record" --msg "mp0 volume differs from run record" prepare 913
reset_state; make_rootfs
expect 1 "prepare refuses without a run record" --msg "no run record" prepare 913
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/etc/systemd/system/multi-user.target.requires" "$work/lxc/913/rootfs/usr/lib/systemd/system/multi-user.target.wants"
ln -s /etc/systemd/system/evil-requires.service "$work/lxc/913/rootfs/etc/systemd/system/multi-user.target.requires/evil-requires.service"
expect 1 "prepare rejects an enabled unit under a .requires directory" --msg "outside the allow-list" prepare 913
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/usr/lib/systemd/system/multi-user.target.wants"
ln -s /usr/lib/systemd/system/vendor-producer.service "$work/lxc/913/rootfs/usr/lib/systemd/system/multi-user.target.wants/vendor-producer.service"
expect 1 "prepare rejects a vendor-enabled unit under /usr/lib" --msg "outside the allow-list" prepare 913
reset_state; seed_record; make_rootfs
printf '#!/bin/sh\nexit 0\n' > "$work/lxc/913/rootfs/etc/rc.local"; chmod +x "$work/lxc/913/rootfs/etc/rc.local"
expect 0 "prepare removes an executable rc.local" prepare 913
[ ! -e "$work/lxc/913/rootfs/etc/rc.local" ] || { echo "FAIL rc.local remains"; failn=$((failn+1)); }
# Host-escape vectors: symlinked systemd directory and data-root pointing outside the rootfs.
reset_state; seed_record; make_rootfs
outside="$work/host-etc-systemd"; mkdir -p "$outside"; touch "$outside/host-unit.service"
rm -rf "$work/lxc/913/rootfs/etc/systemd/system"; ln -s "$outside" "$work/lxc/913/rootfs/etc/systemd/system"
expect 1 "prepare refuses a symlinked systemd directory" --msg "escapes the mounted rootfs" prepare 913
[ -f "$outside/host-unit.service" ] && [ ! -e "$outside/app-compose.service" ] || { echo "FAIL prepare touched the host-side directory"; failn=$((failn+1)); }
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/etc/docker" "$work/host-docker/containers/zzz"
echo '{"RestartPolicy":{"Name":"unless-stopped"}}' > "$work/host-docker/containers/zzz/hostconfig.json"
echo "{\"data-root\": \"/../../../../$(basename "$work")/host-docker\"}" > "$work/lxc/913/rootfs/etc/docker/daemon.json"
expect 1 "prepare refuses a data-root that escapes the rootfs" prepare 913
grep -q 'unless-stopped' "$work/host-docker/containers/zzz/hostconfig.json" || { echo "FAIL prepare rewrote a host-side container config"; failn=$((failn+1)); }
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/etc/docker"; ln -s "$work/host-docker" "$work/lxc/913/rootfs/var/lib/docker-link"
echo '{"data-root": "/var/lib/docker-link"}' > "$work/lxc/913/rootfs/etc/docker/daemon.json"
expect 1 "prepare refuses a data-root symlinked outside the rootfs" prepare 913

# --- wait-boot ---
reset_state; seed_record
printf '[ "$1" = systemctl ] && [ "$2" = is-system-running ] && { echo starting; exit 1; }; exit 0\n' > "$SHIM_STATE/exec.sh"
expect 1 "wait-boot exits non-zero when systemd never settles" wait-boot 913
printf '[ "$1" = systemctl ] && [ "$2" = is-system-running ] && { echo degraded; exit 1; }; exit 0\n' > "$SHIM_STATE/exec.sh"
expect 0 "wait-boot accepts degraded" wait-boot 913

# --- verify ---
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
cat > "$SHIM_STATE/exec.sh" <<'EOF'
case "$1" in
  test) exit 0 ;;
  sh) case "$3" in *"/sys/class/net"*) exit 0 ;; *) exit 0 ;; esac ;;
  systemctl) case "$2" in is-system-running) echo degraded; exit 1 ;; is-enabled) echo masked; exit 0 ;; --failed) exit 0 ;; esac ;;
  docker) echo -n "" ; exit 0 ;;
esac
exit 0
EOF
expect 0 "verify passes with isolation intact" verify 913
cat > "$SHIM_STATE/exec.sh" <<'EOF'
case "$1" in
  test) exit 0 ;;
  sh) case "$3" in *"/sys/class/net"*) echo veth0; exit 0 ;; *) exit 0 ;; esac ;;
  systemctl) case "$2" in is-system-running) echo degraded; exit 1 ;; is-enabled) echo masked; exit 0 ;; esac ;;
  docker) exit 0 ;;
esac
exit 0
EOF
expect 1 "verify fails on a non-bridge interface" --msg "unexpected interfaces in guest: veth0" verify 913
cat > "$SHIM_STATE/exec.sh" <<'EOF'
case "$1" in
  test) exit 0 ;;
  sh) exit 0 ;;
  systemctl) case "$2" in is-system-running) echo degraded; exit 1 ;; is-enabled) echo masked; exit 0 ;; esac ;;
  docker) echo abc123; exit 0 ;;
esac
exit 0
EOF
expect 1 "verify fails when a container is already running" --msg "is running but not allowed at this step" verify 913
cat > "$SHIM_STATE/exec.sh" <<'EOF'
case "$1" in
  test) exit 0 ;;
  sh) exit 0 ;;
  systemctl) case "$2" in is-system-running) echo degraded; exit 1 ;; is-enabled) [ "$3" = cron.service ] && { echo enabled; exit 0; }; echo masked; exit 0 ;; esac ;;
  docker) exit 0 ;;
esac
exit 0
EOF
expect 1 "verify fails when a unit is not masked" --msg "cron.service not masked" verify 913

# --- readiness commands return non-zero, behind the live isolation gate ---
# exec shim that satisfies the isolation gate; RUNNING lists container names,
# TIMEOUT_RC / START_RC / DB_QUERY_RC inject failures.
isolated_exec_shim() {
  cat > "$SHIM_STATE/exec.sh" <<'EOS'
case "$1" in
  test) exit 0 ;;
  sh) exit 0 ;;
  systemctl) case "$2" in is-system-running) echo degraded; exit 1 ;; is-enabled) echo masked; exit 0 ;; --failed) exit 0 ;; esac ;;
  docker) case "$2" in
      ps) cat "$SHIM_STATE/running" 2>/dev/null; exit 0 ;;
      start) exit "${START_RC:-0}" ;;
      exec) exit "${DB_QUERY_RC:-0}" ;;
    esac ;;
  timeout) exit "${TIMEOUT_RC:-0}" ;;
  curl) echo unknown; exit 0 ;;
  rm) exit 0 ;;
esac
exit 0
EOS
}
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"; isolated_exec_shim
TIMEOUT_RC=124 expect 1 "start-db fails when PostgreSQL never becomes ready" --msg "PostgreSQL not ready" start-db 913
START_RC=1 expect 1 "start-db fails when docker start fails" --msg "docker start app-postgres-1 failed" start-db 913
expect 0 "start-db passes the isolation gate and readiness" start-db 913
printf 'app-hatchet-engine-1\n' > "$SHIM_STATE/running"
expect 1 "start-db refuses when an unexpected container is already running" --msg "not allowed at this step" start-db 913
printf 'app-postgres-1\n' > "$SHIM_STATE/running"
TIMEOUT_RC=124 expect 1 "start-backend fails when Convex never becomes ready" --msg "Convex backend not ready" start-backend 913
expect 0 "start-backend passes with only PostgreSQL running" start-backend 913
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"; isolated_exec_shim
echo 'net0: name=veth0,bridge=vmbr0' >> "$SHIM_STATE/config"
expect 1 "start-db refuses when networking was re-attached after verify" --msg "network entries remain" start-db 913
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
isolated_exec_shim; sed -i.bak 's#is-enabled) echo masked; exit 0 ;;#is-enabled) echo enabled; exit 0 ;;#' "$SHIM_STATE/exec.sh"
expect 1 "start-db refuses when prepare's masks are not in effect" --msg "not masked" start-db 913

# --- read-identities ---
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"; isolated_exec_shim
printf 'app-postgres-1\napp-convex-backend-1\n' > "$SHIM_STATE/running"
echo '{"moduleHashes":[{"path":"a.js","environment":"isolate","hash":"'"$(printf 'a%.0s' $(seq 1 64))"'"}]}' > "$SHIM_STATE/guest-identities.json"
expect 0 "read-identities pulls and shape-checks the sanitized file" read-identities 913 "$here/../guest-module-identities.py"
[ -f "$work/runs/913-module-identities.json" ] || { echo "FAIL identities file missing"; failn=$((failn+1)); }
expect 1 "read-identities refuses to overwrite existing evidence" --msg "refusing to overwrite evidence" read-identities 913 "$here/../guest-module-identities.py"
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"; isolated_exec_shim
printf 'app-postgres-1\napp-convex-backend-1\n' > "$SHIM_STATE/running"
sed -i.bak 's#^  sh) exit 0 ;;#  sh) case "$3" in *generate_admin_key*) exit 1 ;; *) exit 0 ;; esac ;;#' "$SHIM_STATE/exec.sh"
expect 1 "read-identities fails when the guest read fails" --msg "identity read failed inside guest" read-identities 913 "$here/../guest-module-identities.py"
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"; isolated_exec_shim
printf 'app-postgres-1\napp-convex-backend-1\napp-hatchet-engine-1\n' > "$SHIM_STATE/running"
expect 1 "read-identities refuses when an unexpected container is running" --msg "not allowed at this step" read-identities 913 "$here/../guest-module-identities.py"

# --- destroy ---
reset_state; touch "$work/pve/913.conf"
expect 1 "destroy refuses without a run record" destroy 913
reset_state; seed_record
sed -i.bak 's#^mp0=ceph-vm:vm-913-disk-1#mp0=ceph-vm:vm-913-disk-9#' "$work/runs/913.record"
expect 1 "destroy refuses when record volumes differ from live config" --msg "mp0 volume differs from run record" destroy 913
[ ! -f "$SHIM_STATE/destroyed" ] || { echo "FAIL destroy ran despite record mismatch"; failn=$((failn+1)); }
reset_state; seed_record; echo 'mp1: ceph-vm:vm-113-disk-1,mp=/mnt/prod' >> "$SHIM_STATE/config"
expect 1 "destroy refuses when a volume was attached after the record" --msg "unexpected mounts" destroy 913
[ ! -f "$SHIM_STATE/destroyed" ] || { echo "FAIL destroy ran with an extra attachment"; failn=$((failn+1)); }
reset_state; seed_record
printf 'ceph-vm:vm-913-disk-1 raw rootdir 1 913\n' > "$SHIM_STATE/leave_volume"
expect 1 "destroy fails when a run-owned volume remains" --msg "run-owned volumes remain" destroy 913
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
printf 'ceph-vm:vm-913-disk-0 raw rootdir 1 913\nceph-vm:vm-913-disk-1 raw rootdir 1 913\nceph-vm:vm-113-disk-0 raw rootdir 1 113\n' > "$SHIM_STATE/volumes"
expect 0 "destroy succeeds for the recorded guest and archives the record" destroy 913
grep -q 'stop 913' "$SHIM_STATE/calls.log" && grep -q 'destroy 913 --purge' "$SHIM_STATE/calls.log" || { echo "FAIL destroy sequence"; failn=$((failn+1)); }
[ ! -f "$work/runs/913.record" ] && ls "$work/runs"/913.record.destroyed-* >/dev/null 2>&1 || { echo "FAIL record not archived"; failn=$((failn+1)); }
expect 1 "destroy refuses a second time (record archived, guest gone)" destroy 913

echo "passed=$pass failed=$failn"
[ "$failn" -eq 0 ]
