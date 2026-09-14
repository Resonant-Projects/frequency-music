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

cat > "$work/bin/timeout" <<'EOF'
#!/usr/bin/env bash
# shim: record the deadline, then run the command (never hangs in tests)
[ "$1" = --kill-after=5 ] || exit 99; shift
echo "timeout $1" >> "$SHIM_STATE/calls.log"; shift; exec "$@"
EOF
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
  config)
    cat "$SHIM_STATE/config"
    # Multiple writes reproduce grep -q closing the pipe before pct finishes.
    if [ -f "$SHIM_STATE/large_config" ]; then
      for ((i=0; i<10000; i++)); do printf '# padding for config pipe regression\n' || exit 1; done
    fi ;;
  status) cat "$SHIM_STATE/status" ;;
  set)
    if [ "$1" = "--delete" ] && [ "$2" = "net0" ]; then
      grep -v '^net0' "$SHIM_STATE/config" > "$SHIM_STATE/config.new" || true; mv "$SHIM_STATE/config.new" "$SHIM_STATE/config"
      [ -f "$SHIM_STATE/refuse_net_delete" ] && echo "net0: 1" >> "$SHIM_STATE/config"
    fi ;;
  mount|unmount|stop|push|start) ;;
  pull) cp "$SHIM_STATE/guest-identities.json" "$2" ;;
  restore) cp "$SHIM_STATE/restored.config" "$SHIM_STATE/config"; echo "status: stopped" > "$SHIM_STATE/status"; touch "$SHIM_STATE/../pve/$ctid.conf"; [ ! -f "$SHIM_STATE/fail_restore" ] ;;
  destroy)
    touch "$SHIM_STATE/destroyed"
    [ -f "$SHIM_STATE/purge_fails" ] && exit 9         # purge itself reports failure
    [ -f "$SHIM_STATE/purge_noop" ] && exit 0          # exits 0, removes nothing
    : > "$SHIM_STATE/volumes"; [ -f "$SHIM_STATE/leave_volume" ] && cp "$SHIM_STATE/leave_volume" "$SHIM_STATE/volumes"
    rm -f "$SHIM_STATE/../pve/$ctid.conf" ;;
  exec) shift; [ "$1" = "--" ] && shift; bash "$SHIM_STATE/exec.sh" "$@" ;;
  *) echo "pct shim: unsupported $cmd" >&2; exit 2 ;;
esac
EOF
chmod +x "$work/bin/"*
# A pct wrapper whose `stop` actually flips the reported status, for cases that
# need a running guest to become stopped.
printf '#!/usr/bin/env bash\necho "pct $*" >> "$SHIM_STATE/calls.log"\n[ "$1" = stop ] && echo "status: stopped" > "$SHIM_STATE/status"\nexec bash "$SHIM_STATE/../bin/pct.real" "$@"\n' > "$work/bin/pct.stopper"
chmod +x "$work/bin/pct.stopper"

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
seed_record() { bash "$helper" restore 913 "$A" prox4 >/dev/null; }
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
reset_state; touch "$SHIM_STATE/fail_restore"
expect 1 "failed restore purges verified partial guest" --msg "verified partial guest purged" restore 913 "$A" prox4
[ -f "$SHIM_STATE/destroyed" ] || { echo "FAIL partial guest was not purged"; failn=$((failn+1)); }
reset_state; touch "$SHIM_STATE/fail_restore"
sed -i.bak 's/hostname: convex-hatchet-restore-913/hostname: unrelated/' "$SHIM_STATE/restored.config"
expect 1 "failed restore refuses unverifiable partial guest" --msg "unverifiable partial state" restore 913 "$A" prox4
[ ! -f "$SHIM_STATE/destroyed" ] || { echo "FAIL unverified partial guest purged"; failn=$((failn+1)); }

reset_state; touch "$SHIM_STATE/refuse_net_delete"
expect 1 "restore fails closed when net0 cannot be removed" --msg "guest 913 purged" restore 913 "$A" prox4
[ ! -f "$work/runs/913.record" ] || { echo "FAIL record written despite isolation failure"; failn=$((failn+1)); }
grep -q 'destroy 913 --purge' "$SHIM_STATE/calls.log" || { echo "FAIL guest not purged after isolation failure"; failn=$((failn+1)); }
reset_state; : > "$work/runs-blocked"   # a regular file where the run dir must be created
ISOLATED_RESTORE_RUN_DIR="$work/runs-blocked" expect 1 "restore purges the guest when the run record cannot be written" --msg "guest 913 purged" restore 913 "$A" prox4
[ ! -e "$work/runs-blocked/913.record" ] && [ ! -f "$work/runs/913.record" ] || { echo "FAIL partial record left behind"; failn=$((failn+1)); }
grep -q 'destroy 913 --purge' "$SHIM_STATE/calls.log" || { echo "FAIL guest not purged after record failure"; failn=$((failn+1)); }
reset_state; touch "$SHIM_STATE/refuse_net_delete" "$SHIM_STATE/purge_fails"
expect 1 "restore reports a purge that failed outright" --msg "AND purge failed" restore 913 "$A" prox4
reset_state; touch "$SHIM_STATE/refuse_net_delete" "$SHIM_STATE/purge_noop"
expect 1 "restore reports the guest still exists when the purge removes nothing" --msg "still exists, inspect before retrying" restore 913 "$A" prox4
grep -q "guest 913 purged" "$work/last.out" && { echo "FAIL restore claimed a purge that did not happen"; failn=$((failn+1)); }
reset_state; touch "$SHIM_STATE/refuse_net_delete"
printf 'ceph-vm:vm-913-disk-0 raw rootdir 1 913\n' > "$SHIM_STATE/leave_volume"
expect 1 "restore reports the guest still exists when the purge leaves volumes" --msg "left volumes behind" restore 913 "$A" prox4
# Ownership and storage assertions run before the record exists, on the restored config.
reset_state; sed -i.bak 's#^rootfs: ceph-vm:vm-913-disk-0#rootfs: local-lvm:vm-913-disk-0#' "$SHIM_STATE/restored.config"
expect 1 "restore rejects rootfs on another storage" --msg "rootfs 'local-lvm:vm-913-disk-0,size=32G' is not this guest's ceph-vm volume" restore 913 "$A" prox4
grep -q 'destroy 913 --purge' "$SHIM_STATE/calls.log" || { echo "FAIL guest not purged after storage failure"; failn=$((failn+1)); }
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
# A config larger than a pipe buffer must not let the net gate be skipped: piping
# into `grep -q` lets grep exit on the first match and can leave the writer with
# SIGPIPE, which pipefail turns into 141 and the `&& die` never runs. Exercised
# through destroy, which asserts the config without stripping networking first.
reset_state; seed_record
{ echo 'net0: name=veth0,bridge=vmbr0,hwaddr=BC:24:11:2B:10:EB,ip=172.16.10.24/27'
  awk 'BEGIN{for(i=0;i<9000;i++) printf "description: pad-%d-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n", i}'
  cat "$SHIM_STATE/config"; } > "$SHIM_STATE/config.padded"
mv "$SHIM_STATE/config.padded" "$SHIM_STATE/config"
[ "$(wc -c < "$SHIM_STATE/config")" -gt 65536 ] || { echo "FAIL padded config is not larger than a pipe buffer"; failn=$((failn+1)); }
expect 1 "the net gate holds on a config larger than a pipe buffer" --msg "network entries remain" destroy 913
[ ! -f "$SHIM_STATE/destroyed" ] || { echo "FAIL destroy purged a guest whose net gate was skipped"; failn=$((failn+1)); }
for decoy in 'production;not-disposable-restore-x' 'xdisposable-restoreX' 'disposable-restore-DECOY'; do
  reset_state; sed -i.bak "s#^tags: disposable-restore#tags: $decoy#" "$SHIM_STATE/restored.config"
  expect 1 "restore rejects tag decoy '$decoy'" --msg "lacks tag disposable-restore" restore 913 "$A" prox4
done
reset_state; sed -i.bak 's#^tags: disposable-restore#tags: production;disposable-restore;lab#' "$SHIM_STATE/restored.config"
expect 0 "restore accepts the tag alongside others" restore 913 "$A" prox4

# --- isolation config assertions (via prepare, which needs a record) ---
make_rootfs() {
  local r="$work/lxc/913/rootfs"; rm -rf "$r"
  mkdir -p "$r/etc/systemd/system/multi-user.target.wants" "$r/etc/systemd/system/timers.target.wants" "$r/etc/op" "$r/var/lib/docker/containers/abc"
  for u in docker.service containerd.service app-compose.service cron.service; do ln -s "/etc/systemd/system/$u" "$r/etc/systemd/system/multi-user.target.wants/$u"; done
  ln -s /etc/systemd/system/lab-heartbeat.timer "$r/etc/systemd/system/timers.target.wants/lab-heartbeat.timer"
  echo token > "$r/etc/op/service-account.env"
  echo '{"RestartPolicy":{"Name":"unless-stopped","MaximumRetryCount":0},"Binds":[]}' > "$r/var/lib/docker/containers/abc/hostconfig.json"
}
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
# find(1) does not descend into a symlinked .wants directory but systemd follows
# it, so units enabled inside one would never reach the allow-list.
for d in multi-user.target.wants multi-user.target.requires multi-user.target.upholds; do
  reset_state; seed_record; make_rootfs
  r="$work/lxc/913/rootfs"; mkdir -p "$r/opt/hidden-wants"
  ln -s /etc/systemd/system/evil-producer.service "$r/opt/hidden-wants/evil-producer.service"
  rm -rf "$r/etc/systemd/system/$d"; ln -s ../../../opt/hidden-wants "$r/etc/systemd/system/$d"
  expect 1 "prepare rejects a symlinked $d directory" --msg "symlinked enablement directories" prepare 913
  grep -q "symlinked enablement directory: /etc/systemd/system/$d" "$work/last.out" || { echo "FAIL symlinked dir not named"; failn=$((failn+1)); }
done
for base in etc/systemd/system usr/local/lib/systemd/system; do
  reset_state; seed_record; make_rootfs
  mkdir -p "$work/lxc/913/rootfs/$base/multi-user.target.upholds"
  ln -s /etc/systemd/system/evil.service "$work/lxc/913/rootfs/$base/multi-user.target.upholds/evil.service"
  expect 1 "prepare rejects unapproved upholds under $base" --msg "outside the allow-list" prepare 913
done
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/usr/local/lib/systemd/system/multi-user.target.wants"
ln -s /etc/systemd/system/evil.service "$work/lxc/913/rootfs/usr/local/lib/systemd/system/multi-user.target.wants/evil.service"
expect 1 "prepare audits local vendor wants" --msg "outside the allow-list" prepare 913

reset_state; seed_record; make_rootfs
ln -s custom.target "$work/lxc/913/rootfs/etc/systemd/system/default.target"
expect 1 "prepare rejects a custom default target" --msg "custom default.target" prepare 913
reset_state; seed_record; make_rootfs
printf '[Unit]\nRequires=evil.service\n' > "$work/lxc/913/rootfs/etc/systemd/system/multi-user.target"
expect 1 "prepare rejects unapproved boot target dependency" --msg "unapproved boot target dependency" prepare 913
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/var/lib/systemd/linger"; touch "$work/lxc/913/rootfs/var/lib/systemd/linger/root"
expect 1 "prepare rejects lingering user accounts" --msg "lingering user accounts" prepare 913

# The marker write uses `>`, which follows a symlink out of the rootfs.
reset_state; seed_record; make_rootfs
mkdir -p "$work/hostside"; echo "ORIGINAL HOST FILE CONTENT" > "$work/hostside/victim"
ln -s "$work/hostside/victim" "$work/lxc/913/rootfs/etc/isolated-restore-913"
expect 0 "prepare replaces a symlinked marker path instead of following it" prepare 913
grep -q 'ORIGINAL HOST FILE CONTENT' "$work/hostside/victim" || { echo "FAIL prepare truncated a host-side file through the marker symlink"; failn=$((failn+1)); }
[ -f "$work/lxc/913/rootfs/etc/isolated-restore-913" ] && [ ! -L "$work/lxc/913/rootfs/etc/isolated-restore-913" ] || { echo "FAIL marker is not a regular file inside the rootfs"; failn=$((failn+1)); }
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/etc/rc3.d"; ln -s ../init.d/legacy-producer "$work/lxc/913/rootfs/etc/rc3.d/S99legacy-producer"
expect 1 "prepare rejects an enabled SysV runlevel link" --msg "outside the allow-list" prepare 913
grep -q 'unexpected enabled unit: /etc/rc3.d/S99legacy-producer' "$work/last.out" || { echo "FAIL SysV link not named"; failn=$((failn+1)); }
for rc in rcS.d rc2.d rc4.d rc5.d; do
  reset_state; seed_record; make_rootfs
  mkdir -p "$work/lxc/913/rootfs/etc/$rc"; ln -s "../init.d/legacy-$rc" "$work/lxc/913/rootfs/etc/$rc/S99legacy-$rc"
  expect 1 "prepare rejects an enabled SysV link under $rc" --msg "outside the allow-list" prepare 913
done
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/etc/rc3.d"; ln -s ../init.d/killer "$work/lxc/913/rootfs/etc/rc3.d/K01killer"
expect 0 "prepare ignores SysV stop links" prepare 913
reset_state; seed_record; make_rootfs
mkdir -p "$work/lxc/913/rootfs/etc/rc3.d"; ln -s ../init.d/docker "$work/lxc/913/rootfs/etc/rc3.d/S20docker"
touch "$work/lxc/913/rootfs/etc/systemd/system/docker.service"
expect 0 "prepare accepts a SysV link shadowed by a native unit" prepare 913
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

reset_state; seed_record
echo 'lxc.environment: SYNTHETIC_SECRET=do-not-log-this-fixture' >> "$SHIM_STATE/config"
expect 1 "start rejects raw config without leaking its value" --msg "unexpected mounts" start 913
if grep -q 'do-not-log-this-fixture' "$work/last.out"; then
  echo "FAIL rejected config leaked its value"; failn=$((failn+1))
fi

# --- start: gated on the current stopped config ---
reset_state; seed_record
printf '[ "$1" = systemctl ] && [ "$2" = is-system-running ] && { echo running; exit 0; }; exit 0\n' > "$SHIM_STATE/exec.sh"
expect 0 "start re-asserts the stopped config, starts and waits for boot" start 913
grep -q '^pct start 913$' "$SHIM_STATE/calls.log" || { echo "FAIL start did not call pct start"; failn=$((failn+1)); }
[ "$(grep -cE '^pct (exec|start)' "$SHIM_STATE/calls.log")" -eq "$(grep -c '^timeout' "$SHIM_STATE/calls.log")" ] || { echo "FAIL start has a guest call without a host-side deadline"; failn=$((failn+1)); }
reset_state; seed_record; touch "$SHIM_STATE/large_config"
printf '[ "$1" = systemctl ] && [ "$2" = is-system-running ] && { echo running; exit 0; }; exit 0\n' > "$SHIM_STATE/exec.sh"
expect 0 "start accepts a tagged config from a multi-write producer" start 913
reset_state; seed_record; touch "$SHIM_STATE/large_config"
echo 'net0: name=veth0,bridge=vmbr0' >> "$SHIM_STATE/config"
expect 1 "start rejects networking from a multi-write producer" --msg "network entries remain" start 913
reset_state; seed_record; echo 'net0: name=veth0,bridge=vmbr0' >> "$SHIM_STATE/config"
expect 1 "start refuses when a network entry was attached after prepare" --msg "network entries remain" start 913
grep -q '^pct start' "$SHIM_STATE/calls.log" && { echo "FAIL start booted a guest with networking"; failn=$((failn+1)); }
reset_state; seed_record; echo 'hookscript: local:snippets/evil.sh' >> "$SHIM_STATE/config"
expect 1 "start refuses when a hookscript was attached after prepare" --msg "hookscript" start 913
grep -q '^pct start' "$SHIM_STATE/calls.log" && { echo "FAIL start booted a guest with a hookscript"; failn=$((failn+1)); }
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
expect 1 "start refuses a guest that is not stopped" --msg "is not stopped" start 913
reset_state
expect 1 "start refuses without a run record" --msg "no run record" start 913
reset_state; seed_record
printf '[ "$1" = systemctl ] && [ "$2" = is-system-running ] && { echo starting; exit 1; }; exit 0\n' > "$SHIM_STATE/exec.sh"
expect 1 "start exits non-zero when systemd never settles after pct start" --msg "did not reach running|degraded" start 913

# --- wait-boot ---
reset_state; seed_record
printf '[ "$1" = systemctl ] && [ "$2" = is-system-running ] && { echo starting; exit 1; }; exit 0\n' > "$SHIM_STATE/exec.sh"
expect 1 "wait-boot exits non-zero when systemd never settles" wait-boot 913
printf '[ "$1" = systemctl ] && [ "$2" = is-system-running ] && { echo degraded; exit 1; }; exit 0\n' > "$SHIM_STATE/exec.sh"
expect 0 "wait-boot accepts degraded" wait-boot 913
grep -q '^timeout 20$' "$SHIM_STATE/calls.log" || { echo "FAIL boot probes not wrapped in a host-side timeout"; failn=$((failn+1)); }

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
: > "$SHIM_STATE/calls.log"
expect 0 "start-db passes the isolation gate and readiness" start-db 913
[ "$(grep -c '^pct exec' "$SHIM_STATE/calls.log")" -eq "$(grep -c '^timeout' "$SHIM_STATE/calls.log")" ] || { echo "FAIL start-db has a guest call without a host-side deadline"; failn=$((failn+1)); }
grep -q '^timeout 22$' "$SHIM_STATE/calls.log" || { echo "FAIL start-db readiness not wrapped in READY+PROBE host deadline"; failn=$((failn+1)); }
printf 'app-hatchet-engine-1\n' > "$SHIM_STATE/running"
expect 1 "start-db refuses when an unexpected container is already running" --msg "not allowed at this step" start-db 913
printf 'app-postgres-1\n' > "$SHIM_STATE/running"
TIMEOUT_RC=124 expect 1 "start-backend fails when Convex never becomes ready" --msg "Convex backend not ready" start-backend 913
: > "$SHIM_STATE/calls.log"
expect 0 "start-backend passes with only PostgreSQL running" start-backend 913
[ "$(grep -c '^pct exec' "$SHIM_STATE/calls.log")" -eq "$(grep -c '^timeout' "$SHIM_STATE/calls.log")" ] || { echo "FAIL start-backend has a guest call without a host-side deadline"; failn=$((failn+1)); }
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
: > "$SHIM_STATE/calls.log"
expect 0 "read-identities pulls and shape-checks the sanitized file" read-identities 913 "$here/../guest-module-identities.py"
[ "$(grep -cE '^pct (exec|push|pull)' "$SHIM_STATE/calls.log")" -eq "$(grep -c '^timeout' "$SHIM_STATE/calls.log")" ] || { echo "FAIL read-identities has a guest call without a host-side deadline"; failn=$((failn+1)); }
ls "$work/runs"/913-*-module-identities.json >/dev/null 2>&1 || { echo "FAIL per-run identities file missing"; failn=$((failn+1)); }
grep -q 'trap "rm -f /root/.restore-admin-key" EXIT HUP INT TERM' "$SHIM_STATE/calls.log" || { echo "FAIL guest-side key trap not installed"; failn=$((failn+1)); }
expect 1 "read-identities refuses to overwrite existing evidence" --msg "refusing to overwrite evidence" read-identities 913 "$here/../guest-module-identities.py"
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"; isolated_exec_shim
printf 'app-postgres-1\napp-convex-backend-1\n' > "$SHIM_STATE/running"
sed -i.bak 's#^  sh) exit 0 ;;#  sh) case "$3" in *generate_admin_key*) exit 1 ;; *) exit 0 ;; esac ;;#' "$SHIM_STATE/exec.sh"
expect 1 "read-identities fails when the guest read fails" --msg "identity read failed inside guest" read-identities 913 "$here/../guest-module-identities.py"
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"; isolated_exec_shim
printf 'app-postgres-1\napp-convex-backend-1\n' > "$SHIM_STATE/running"
sed -i.bak 's#^  sh) exit 0 ;;#  sh) case "$3" in *"! -e /root/.restore-admin-key"*) exit 1 ;; *) exit 0 ;; esac ;;#' "$SHIM_STATE/exec.sh"
expect 1 "read-identities fails when the admin key file survives in the guest" --msg "admin key file still present" read-identities 913 "$here/../guest-module-identities.py"
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
reset_state; echo "status: running" > "$SHIM_STATE/status"; touch "$work/pve/913.conf"
expect 1 "destroy does not stop an unrecorded running guest" --msg "no run record" destroy 913
if grep -q '^pct stop' "$SHIM_STATE/calls.log"; then echo "FAIL stopped unowned guest"; failn=$((failn+1)); fi
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
sed -i.bak 's/^node=prox4/node=another-node/' "$work/runs/913.record"
expect 1 "destroy does not stop a guest recorded on another node" --msg "node mismatch" destroy 913
if grep -q '^pct stop' "$SHIM_STATE/calls.log"; then echo "FAIL stopped wrong-node guest"; failn=$((failn+1)); fi

# A gate that refuses must never leave a production-derived guest running, and
# the record gate is a gate: it has to come after the stop, not before it.
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
sed -i.bak 's#^mp0=ceph-vm:vm-913-disk-1#mp0=ceph-vm:vm-913-disk-9#' "$work/runs/913.record"
cp "$work/bin/pct" "$work/bin/pct.real"; cp "$work/bin/pct.stopper" "$work/bin/pct"; chmod +x "$work/bin/pct"
expect 1 "destroy stops a running guest before refusing a drifted record" --msg "mp0 volume differs from run record" destroy 913
grep -q '^pct stop 913' "$SHIM_STATE/calls.log" || { echo "FAIL destroy left a running guest running on a record mismatch"; failn=$((failn+1)); }
[ ! -f "$SHIM_STATE/destroyed" ] || { echo "FAIL destroy purged despite record mismatch"; failn=$((failn+1)); }
cp "$work/bin/pct.real" "$work/bin/pct"
reset_state; seed_record; echo 'mp1: ceph-vm:vm-113-disk-1,mp=/mnt/prod' >> "$SHIM_STATE/config"
expect 1 "destroy refuses when a volume was attached after the record" --msg "unexpected mounts" destroy 913
[ ! -f "$SHIM_STATE/destroyed" ] || { echo "FAIL destroy ran with an extra attachment"; failn=$((failn+1)); }
# A running guest that fails the config gate is stopped first, then left unpurged.
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
echo 'net0: name=veth0,bridge=vmbr0' >> "$SHIM_STATE/config"
cp "$work/bin/pct" "$work/bin/pct.real"; cp "$work/bin/pct.stopper" "$work/bin/pct"; chmod +x "$work/bin/pct"
expect 1 "destroy stops a running guest before refusing an unsafe config" --msg "network entries remain" destroy 913
grep -q '^pct stop 913' "$SHIM_STATE/calls.log" || { echo "FAIL destroy did not stop the unsafe running guest"; failn=$((failn+1)); }
[ ! -f "$SHIM_STATE/destroyed" ] || { echo "FAIL destroy purged a guest with an unsafe config"; failn=$((failn+1)); }
cp "$work/bin/pct.real" "$work/bin/pct"
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
expect 1 "destroy fails when the guest does not stop" --msg "did not stop" destroy 913
[ ! -f "$SHIM_STATE/destroyed" ] || { echo "FAIL destroy purged a guest that never stopped"; failn=$((failn+1)); }
reset_state; seed_record
printf 'ceph-vm:vm-913-disk-1 raw rootdir 1 913\n' > "$SHIM_STATE/leave_volume"
expect 1 "destroy fails when a run-owned volume remains" --msg "run-owned volumes remain" destroy 913
reset_state; seed_record; echo "status: running" > "$SHIM_STATE/status"
printf 'ceph-vm:vm-913-disk-0 raw rootdir 1 913\nceph-vm:vm-913-disk-1 raw rootdir 1 913\nceph-vm:vm-113-disk-0 raw rootdir 1 113\n' > "$SHIM_STATE/volumes"
cp "$work/bin/pct.stopper" "$work/bin/pct"; chmod +x "$work/bin/pct"
expect 0 "destroy stops, purges the recorded guest and archives the record" destroy 913
cp "$work/bin/pct.real" "$work/bin/pct"
grep -q 'stop 913' "$SHIM_STATE/calls.log" && grep -q 'destroy 913 --purge' "$SHIM_STATE/calls.log" || { echo "FAIL destroy sequence"; failn=$((failn+1)); }
[ ! -f "$work/runs/913.record" ] && ls "$work/runs"/913.record.destroyed-* >/dev/null 2>&1 || { echo "FAIL record not archived"; failn=$((failn+1)); }
expect 1 "destroy refuses a second time (record archived, guest gone)" destroy 913

# Execute the actual guest shell against linked key files, using inert commands.
python3 - "$helper" "$work" <<'PYKEY'
import pathlib, re, subprocess, sys
helper, work = map(pathlib.Path, sys.argv[1:])
source = helper.read_text()
command = next(line.split("-- sh -c '", 1)[1].rsplit("'", 1)[0] for line in source.splitlines() if "trap \"rm -f /root/.restore-admin-key" in line)
root = work / "key-regression"
root.mkdir()
command = command.replace("/root/", str(root) + "/").replace("docker exec app-convex-backend-1 ./generate_admin_key.sh", "printf synthetic-key").replace("python3 " + str(root) + "/guest-module-identities.py", "true")
target = root / "target"
key = root / ".restore-admin-key"
for kind in ("symlink", "hardlink"):
    target.write_text("unchanged")
    if kind == "symlink": key.symlink_to(target)
    else: key.hardlink_to(target)
    subprocess.run(["sh", "-c", command], check=True)
    assert target.read_text() == "unchanged", kind
    assert not key.exists(), kind
PYKEY
if [ "$?" -eq 0 ]; then echo "ok   admin key creation preserves symlink and hardlink targets"; pass=$((pass+1)); else failn=$((failn+1)); fi

echo "passed=$pass failed=$failn"
[ "$failn" -eq 0 ]
