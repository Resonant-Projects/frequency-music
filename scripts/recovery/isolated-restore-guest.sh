#!/usr/bin/env bash
# Isolated whole-LXC restore rehearsal helper. Runs as root on one Proxmox node.
# Every subcommand exits non-zero on any failed check; nothing relies on an
# operator noticing a missing line.
#
#   preflight  <ctid> <archive-volid> <node>  read-only checks, no mutation
#   restore    <ctid> <archive-volid> <node>  preflight again, pct restore (stopped),
#                                             strip networking, write the run record
#   prepare    <ctid>                         offline pre-first-boot suppression
#   wait-boot  <ctid>                         bounded wait for systemd running|degraded
#   verify     <ctid>                         post-boot isolation assertions, before
#                                             any container is started
#   start-db   <ctid>                         start PostgreSQL, bounded readiness,
#                                             print sizes and counts
#   start-backend <ctid>                      start Convex, bounded readiness,
#                                             print /version
#   read-identities <ctid> <extractor.py>     bounded localhost identity read; the
#                                             sanitized file lands in the run dir
#   destroy    <ctid>                         destroy only the guest and the exact
#                                             volumes named in this run's record
#
# Only CTIDs 911-913 are accepted (documented disposable range). The guest never
# keeps a network interface. On the offline rootfs, every enabled unit link is
# enumerated (wants and requires links under /etc, /usr/lib and /lib systemd
# directories) and must be on an explicit allow-list; compose reconciliation,
# cron, apt automation, postfix and all lab-* units are masked; every Docker
# container restart policy is rewritten to "no"; the 1Password service-account
# env and registry auth are removed. Docker stays enabled so the operator can
# start exactly the intended containers by hand.
#
# Recovery note: if `prepare` is interrupted between mount and unmount the guest
# stays locked as "mounted"; run `pct unmount <ctid>` and rerun `prepare`.
set -euo pipefail

TAG="disposable-restore"
STORAGE="ceph-vm"
RUN_DIR="${ISOLATED_RESTORE_RUN_DIR:-/root/isolated-restore-runs}"
LXC_BASE="${ISOLATED_RESTORE_LXC_BASE:-/var/lib/lxc}"
PVE_LXC_DIR="${ISOLATED_RESTORE_PVE_LXC_DIR:-/etc/pve/lxc}"
MEMINFO="${ISOLATED_RESTORE_MEMINFO:-/proc/meminfo}"
BOOT_ATTEMPTS="${ISOLATED_RESTORE_BOOT_ATTEMPTS:-40}"
READY_SECONDS="${ISOLATED_RESTORE_READY_SECONDS:-120}"
SLEEP="${ISOLATED_RESTORE_SLEEP:-3}"
MIN_CEPH_AVAIL_KIB=$((150 * 1024 * 1024))   # 150 GiB for a 32+64 GiB restore
MIN_FREE_MEM_KIB=$((12 * 1024 * 1024))      # 12 GiB headroom for an 8 GiB guest

ALLOWED_ENABLED=(
  'containerd.service' 'docker.service' 'docker.socket'
  'ssh.service' 'ssh.socket' 'sshd-keygen.service'
  'networking.service' 'container-getty@*.service' 'wtmpdb-update-boot.service'
  'run-lock.mount' 'remote-fs.target' 'e2scrub_reap.service'
  'apparmor.service' 'nftables.service'
  'systemd-networkd.socket' 'systemd-pcrextend.socket' 'systemd-sysext.socket'
  'systemd-confext.service' 'systemd-network-generator.service' 'systemd-pcrlock-*.service'
  'systemd-pstore.service' 'systemd-sysext.service' 'systemd-timesyncd.service'
  'systemd-udev-load-credentials.service'
  'dpkg-db-backup.timer' 'e2scrub_all.timer' 'fstrim.timer' 'logrotate.timer' 'man-db.timer'
)
UNITS_TO_MASK=(
  app-compose.service
  lab-guest-patch.timer lab-guest-patch.service
  lab-heartbeat.timer lab-heartbeat.service
  lab-postgresql-backup.timer lab-postgresql-backup.service
  lab-postgresql-restore-validation.timer lab-postgresql-restore-validation.service
  cron.service
  apt-daily.timer apt-daily-upgrade.timer unattended-upgrades.service
  postfix.service postfix-resolvconf.path
)
CREDENTIAL_FILES_TO_REMOVE=(
  etc/op/service-account.env
  etc/docker/lab-registry-auth/config.json
  root/.docker/config.json
)

die() { echo "isolated-restore: $*" >&2; exit 1; }

require_ctid() { [[ "${1:-}" =~ ^91[123]$ ]] || die "ctid must be 911, 912 or 913"; }

require_archive() {
  [[ "${1:-}" =~ ^nas-docker:backup/vzdump-lxc-113-[0-9]{4}_[0-9]{2}_[0-9]{2}-[0-9]{2}_[0-9]{2}_[0-9]{2}\.tar\.zst$ ]] \
    || die "archive must be a nas-docker CT113 vzdump volid"
}

ctid_absent_clusterwide() {
  pvesh get /cluster/resources --type vm --output-format json \
    | python3 -c 'import json,sys; ids={r["vmid"] for r in json.load(sys.stdin)}; sys.exit(0 if int(sys.argv[1]) not in ids else 1)' "$1"
}

config_value() { pct config "$1" | awk -v k="$2" -F': ' '$1==k{print $2}'; }

volid_of() { echo "${1%%,*}"; }   # "ceph-vm:vm-913-disk-0,size=32G" -> "ceph-vm:vm-913-disk-0"

# Storage targets must be this guest's own volumes on the expected storage.
# This runs before any offline mutation and again before destruction.
assert_isolated_config() {
  local ctid=$1 rootfs mp0
  pct config "$ctid" | grep -q '^net' && die "network entries remain on $ctid"
  pct config "$ctid" | grep -E '^(mp[1-9]|unused[0-9]|dev[0-9]|lxc\.)' && die "unexpected mounts, unused volumes or raw lxc keys on $ctid"
  [ "$(config_value "$ctid" onboot)" = "0" ] || die "onboot is not 0 on $ctid"
  [ "$(config_value "$ctid" unprivileged)" = "1" ] || die "guest $ctid is not unprivileged"
  [ "$(config_value "$ctid" hostname)" = "convex-hatchet-restore-$ctid" ] || die "hostname mismatch on $ctid"
  pct config "$ctid" | grep -q "^tags: .*$TAG" || die "guest $ctid lacks tag $TAG"
  rootfs=$(config_value "$ctid" rootfs); mp0=$(config_value "$ctid" mp0)
  [[ "$(volid_of "$rootfs")" =~ ^${STORAGE}:vm-${ctid}-disk-[0-9]+$ ]] || die "rootfs '$rootfs' is not this guest's $STORAGE volume"
  [[ "$(volid_of "$mp0")" =~ ^${STORAGE}:vm-${ctid}-disk-[0-9]+$ ]] || die "mp0 '$mp0' is not this guest's $STORAGE volume"
  [[ "$mp0" == *",mp=/srv/app-data,"* || "$mp0" == *",mp=/srv/app-data" ]] || die "mp0 mount point is not /srv/app-data"
  return 0
}

record_path() { echo "$RUN_DIR/$1.record"; }

write_record() {
  local ctid=$1 archive=$2 node=$3
  mkdir -p "$RUN_DIR"; chmod 700 "$RUN_DIR"
  umask 077
  {
    echo "ctid=$ctid"
    echo "node=$node"
    echo "archive=$archive"
    echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "hostname=convex-hatchet-restore-$ctid"
    echo "rootfs=$(volid_of "$(config_value "$ctid" rootfs)")"
    echo "mp0=$(volid_of "$(config_value "$ctid" mp0)")"
  } > "$(record_path "$ctid")"
}

record_value() { awk -v k="$2" -F'=' '$1==k{print substr($0, length(k)+2)}' "$(record_path "$1")"; }

# The live config must match the record written when this run created the guest.
assert_record_matches() {
  local ctid=$1
  [ -f "$(record_path "$ctid")" ] || die "no run record for $ctid in $RUN_DIR; refusing"
  [ "$(record_value "$ctid" ctid)" = "$ctid" ] || die "run record ctid mismatch"
  [ "$(record_value "$ctid" node)" = "$(hostname)" ] || die "run record node mismatch"
  [ "$(record_value "$ctid" hostname)" = "$(config_value "$ctid" hostname)" ] || die "hostname differs from run record"
  [ "$(record_value "$ctid" rootfs)" = "$(volid_of "$(config_value "$ctid" rootfs)")" ] || die "rootfs volume differs from run record"
  [ "$(record_value "$ctid" mp0)" = "$(volid_of "$(config_value "$ctid" mp0)")" ] || die "mp0 volume differs from run record"
}

strip_networking() {
  local ctid=$1
  [ "$(pct status "$ctid")" = "status: stopped" ] || die "guest must be stopped"
  pct set "$ctid" --delete net0 2>/dev/null || true
  pct set "$ctid" --onboot 0
  assert_isolated_config "$ctid"
}

run_preflight() {
  local ctid=$1 archive=$2 node=$3
  require_ctid "$ctid"; require_archive "$archive"
  [ -n "$node" ] || die "node required"
  [ "$(hostname)" = "$node" ] || die "run on $node (this is $(hostname))"
  ctid_absent_clusterwide "$ctid" || die "ctid $ctid exists somewhere in the cluster"
  [ ! -e "$PVE_LXC_DIR/$ctid.conf" ] || die "local config for $ctid exists"
  [ ! -f "$(record_path "$ctid")" ] || die "a run record for $ctid already exists; destroy or archive it first"
  local orphans
  orphans=$(pvesm list "$STORAGE" | awk -v p="^${STORAGE}:vm-${ctid}-" '$1 ~ p {print $1}')
  [ -z "$orphans" ] || die "pre-existing volumes for $ctid on $STORAGE: $orphans"
  local size
  size=$(pvesm list nas-docker --content backup | awk -v v="$archive" '$1==v{print $4}')
  [ -n "$size" ] || die "archive not listed on nas-docker"
  local avail
  avail=$(pvesm status --storage "$STORAGE" | awk 'NR==2{print $6}')
  [ "${avail:-0}" -ge "$MIN_CEPH_AVAIL_KIB" ] || die "$STORAGE available ${avail:-0} KiB below minimum"
  local freemem
  freemem=$(awk '/MemAvailable/{print $2}' "$MEMINFO")
  [[ "$freemem" =~ ^[0-9]+$ ]] || die "could not read MemAvailable from $MEMINFO"
  [ "$freemem" -ge "$MIN_FREE_MEM_KIB" ] || die "node MemAvailable $freemem KiB below minimum"
  echo "preflight ok ctid=$ctid archive=$archive bytes=$size ${STORAGE}_avail_kib=$avail mem_avail_kib=$freemem"
}

cmd_restore() {
  local ctid=$1 archive=$2 node=$3
  run_preflight "$ctid" "$archive" "$node"
  pct restore "$ctid" "$archive" \
    --storage "$STORAGE" --unprivileged 1 --hostname "convex-hatchet-restore-$ctid" \
    --onboot 0 --protection 0 --memory 8192 --cores 4 --swap 1024 --tags "$TAG" \
    --start 0
  # The archive's own net0 (production MAC and IP) survives pct restore; strip
  # it before anything else can start the guest.
  strip_networking "$ctid"
  write_record "$ctid" "$archive" "$node"
  echo "restored ctid=$ctid (stopped, no network) record=$(record_path "$ctid")"
  cat "$(record_path "$ctid")"
}

allowed_enabled() {
  local unit=$1 pattern
  for pattern in "${ALLOWED_ENABLED[@]}"; do
    # shellcheck disable=SC2053
    [[ "$unit" == $pattern ]] && return 0
  done
  return 1
}

cmd_prepare() {
  local ctid=$1
  require_ctid "$ctid"
  assert_record_matches "$ctid"
  strip_networking "$ctid"
  local root="$LXC_BASE/$ctid/rootfs"
  pct mount "$ctid" >/dev/null
  trap 'pct unmount "$ctid" >/dev/null 2>&1 || true' EXIT
  [ -d "$root/etc/systemd/system" ] || die "rootfs did not mount"

  for unit in "${UNITS_TO_MASK[@]}"; do
    rm -f "$root/etc/systemd/system/$unit"
    ln -s /dev/null "$root/etc/systemd/system/$unit"
    chown -h 100000:100000 "$root/etc/systemd/system/$unit" 2>/dev/null || true
    find "$root/etc/systemd/system" "$root/usr/lib/systemd/system" "$root/lib/systemd/system" -type l -name "$unit" \( -path '*.wants/*' -o -path '*.requires/*' \) -delete 2>/dev/null || true
  done

  # rc-local.service is generator-activated when /etc/rc.local is executable.
  rm -f "$root/etc/rc.local"
  local link unit unexpected=() enablement_dirs=()
  for dir in etc/systemd/system usr/lib/systemd/system lib/systemd/system; do
    [ -d "$root/$dir" ] && enablement_dirs+=("$root/$dir")
  done
  while IFS= read -r link; do
    unit=${link##*/}
    allowed_enabled "$unit" || unexpected+=("${link#"$root"}")
  done < <(find "${enablement_dirs[@]}" -type l \( -path '*.wants/*' -o -path '*.requires/*' \) | sort)
  if ((${#unexpected[@]})); then
    printf 'unexpected enabled unit: %s\n' "${unexpected[@]}" >&2
    die "offline rootfs has enabled units outside the allow-list"
  fi
  echo "enabled units surviving on offline rootfs:"
  find "${enablement_dirs[@]}" -type l \( -path '*.wants/*' -o -path '*.requires/*' \) | sed "s#^$root#  #" | sort

  for file in "${CREDENTIAL_FILES_TO_REMOVE[@]}"; do
    rm -f "$root/$file"
  done

  python3 - "$root" <<'PY'
import glob, json, os, sys
root = sys.argv[1]
data_root = "/var/lib/docker"
daemon_json = os.path.join(root, "etc/docker/daemon.json")
if os.path.exists(daemon_json):
    with open(daemon_json, encoding="utf-8") as handle:
        data_root = json.load(handle).get("data-root", data_root)
changed = 0
for path in glob.glob(f"{root}{data_root}/containers/*/hostconfig.json"):
    with open(path, "r+", encoding="utf-8") as handle:
        config = json.load(handle)
        config["RestartPolicy"] = {"Name": "no", "MaximumRetryCount": 0}
        handle.seek(0); handle.truncate(); json.dump(config, handle)
    changed += 1
if changed == 0:
    print("no Docker container hostconfig found under " + data_root, file=sys.stderr)
    sys.exit(1)
print(f"restart policies set to no: {changed}")
PY

  date -u +%Y-%m-%dT%H:%M:%SZ > "$root/etc/isolated-restore-$ctid"
  chown 100000:100000 "$root/etc/isolated-restore-$ctid" 2>/dev/null || true
  pct unmount "$ctid" >/dev/null
  trap - EXIT
  echo "prepared ctid=$ctid: no net, autostart suppressed, credentials removed"
}

cmd_wait_boot() {
  local ctid=$1 state="" i
  require_ctid "$ctid"
  assert_record_matches "$ctid"
  for ((i = 1; i <= BOOT_ATTEMPTS; i++)); do
    state=$(pct exec "$ctid" -- systemctl is-system-running 2>/dev/null || true)
    case "$state" in running|degraded) echo "boot ok ctid=$ctid systemd=$state"; return 0;; esac
    sleep "$SLEEP"
  done
  echo "failed units:" >&2; pct exec "$ctid" -- systemctl --failed --no-legend >&2 || true
  die "guest did not reach running|degraded within $((BOOT_ATTEMPTS * SLEEP)) s (last state '$state')"
}

cmd_verify() {
  local ctid=$1
  require_ctid "$ctid"
  assert_record_matches "$ctid"
  [ "$(pct status "$ctid")" = "status: running" ] || die "guest not running"
  assert_isolated_config "$ctid"
  pct exec "$ctid" -- test -f "/etc/isolated-restore-$ctid" || die "prepare marker missing"
  # Only lo, bridges (dockerd creates docker0 and compose bridges at daemon
  # start) and bridge-enslaved ports are acceptable. A pct-provided interface
  # has no master and is not a bridge.
  local bad
  bad=$(pct exec "$ctid" -- sh -c 'for i in /sys/class/net/*; do n=${i##*/}; [ "$n" = lo ] && continue; [ -d "$i/bridge" ] && continue; [ -e "$i/master" ] && continue; echo "$n"; done')
  [ -z "$bad" ] || die "unexpected interfaces in guest: $bad"
  local state
  state=$(pct exec "$ctid" -- systemctl is-system-running 2>/dev/null || true)
  case "$state" in running|degraded) ;; *) die "guest systemd state '$state'";; esac
  for unit in "${UNITS_TO_MASK[@]}"; do
    [ "$(pct exec "$ctid" -- systemctl is-enabled "$unit" 2>/dev/null || true)" = "masked" ] \
      || die "$unit not masked"
  done
  local running
  running=$(pct exec "$ctid" -- docker ps -q | wc -l | tr -d ' ')
  [ "$running" -eq 0 ] || die "$running container(s) already running; autostart suppression failed"
  pct exec "$ctid" -- sh -c 'command -v curl >/dev/null && command -v timeout >/dev/null && command -v python3 >/dev/null' \
    || die "guest lacks curl, timeout or python3"
  echo "verify ok ctid=$ctid systemd=$state running_containers=0"
  echo "failed units (evidence):"; pct exec "$ctid" -- systemctl --failed --no-legend || true
}

cmd_start_db() {
  local ctid=$1
  require_ctid "$ctid"; assert_record_matches "$ctid"
  pct exec "$ctid" -- docker start app-postgres-1 >/dev/null || die "docker start app-postgres-1 failed"
  pct exec "$ctid" -- timeout "$READY_SECONDS" sh -c 'until docker exec app-postgres-1 pg_isready -q; do sleep 2; done' \
    || die "PostgreSQL not ready within $READY_SECONDS s"
  echo "databases (name|bytes):"
  pct exec "$ctid" -- docker exec app-postgres-1 psql -U postgres -At -c \
    "select datname, pg_database_size(datname) from pg_database where not datistemplate order by 1" \
    || die "database size query failed"
  echo "self_hosted_convex counts (documents|indexes|leases|persistence_globals):"
  pct exec "$ctid" -- docker exec app-postgres-1 psql -U postgres -d self_hosted_convex -At -c \
    "select (select count(*) from documents), (select count(*) from indexes), (select count(*) from leases), (select count(*) from persistence_globals)" \
    || die "count query failed"
}

cmd_start_backend() {
  local ctid=$1
  require_ctid "$ctid"; assert_record_matches "$ctid"
  pct exec "$ctid" -- docker start app-convex-backend-1 >/dev/null || die "docker start app-convex-backend-1 failed"
  pct exec "$ctid" -- timeout "$READY_SECONDS" sh -c 'until curl -fsS -m 5 http://127.0.0.1:3210/version >/dev/null; do sleep 2; done' \
    || die "Convex backend not ready within $READY_SECONDS s"
  local version
  version=$(pct exec "$ctid" -- curl -fsS -m 5 http://127.0.0.1:3210/version) || die "version read failed"
  echo "version: $version"
}

cmd_read_identities() {
  local ctid=$1 extractor=$2 out
  require_ctid "$ctid"; assert_record_matches "$ctid"
  [ -f "$extractor" ] || die "extractor script not found: $extractor"
  out="$RUN_DIR/$ctid-module-identities.json"
  [ ! -e "$out" ] || die "$out already exists; refusing to overwrite evidence"
  pct push "$ctid" "$extractor" /root/guest-module-identities.py --perms 0700 || die "push failed"
  # The key is derived inside the guest from the archived instance secret, so it
  # is a live production credential; it exists only briefly in a 0600 file.
  pct exec "$ctid" -- sh -c 'umask 077; rm -f /root/restore-module-identities.json; docker exec app-convex-backend-1 ./generate_admin_key.sh | tail -1 > /root/.restore-admin-key; python3 /root/guest-module-identities.py; r=$?; rm -f /root/.restore-admin-key; exit $r' \
    || die "identity read failed inside guest (see classification above)"
  umask 077
  pct pull "$ctid" /root/restore-module-identities.json "$out" || die "pull failed"
  pct exec "$ctid" -- rm -f /root/restore-module-identities.json /root/guest-module-identities.py
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); m=d["moduleHashes"]; assert isinstance(m,list) and m and all(set(x)=={"path","environment","hash"} for x in m); print("identities:", len(m))' "$out" \
    || die "pulled identity file failed shape check"
  local digest
  digest=$(python3 -c 'import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$out") || die "digest failed"
  echo "identities file: $out sha256=$digest"
}

cmd_destroy() {
  local ctid=$1 rootfs mp0
  require_ctid "$ctid"
  [ -e "$PVE_LXC_DIR/$ctid.conf" ] || die "no local guest $ctid"
  assert_record_matches "$ctid"
  pct config "$ctid" | grep -q '^net' && die "guest has network; not ours"
  pct config "$ctid" | grep -q "^tags: .*$TAG" || die "tag mismatch; refusing"
  rootfs=$(record_value "$ctid" rootfs); mp0=$(record_value "$ctid" mp0)
  if [ "$(pct status "$ctid")" = "status: running" ]; then pct stop "$ctid"; fi
  pct destroy "$ctid" --purge
  local remaining
  remaining=$(pvesm list "$STORAGE" | awk -v a="$rootfs" -v b="$mp0" '$1==a||$1==b{print $1}')
  [ -z "$remaining" ] || die "run-owned volumes remain: $remaining"
  mv "$(record_path "$ctid")" "$(record_path "$ctid").destroyed-$(date -u +%Y%m%dT%H%M%SZ)"
  echo "destroyed ctid=$ctid volumes=[$rootfs $mp0] confirmed absent; record archived"
}

case "${1:-}" in
  preflight)       require_ctid "${2:-}"; run_preflight "${2:-}" "${3:-}" "${4:-}" ;;
  restore)         require_ctid "${2:-}"; cmd_restore "${2:-}" "${3:-}" "${4:-}" ;;
  prepare)         cmd_prepare "${2:-}" ;;
  wait-boot)       cmd_wait_boot "${2:-}" ;;
  verify)          cmd_verify "${2:-}" ;;
  start-db)        cmd_start_db "${2:-}" ;;
  start-backend)   cmd_start_backend "${2:-}" ;;
  read-identities) cmd_read_identities "${2:-}" "${3:-}" ;;
  destroy)         cmd_destroy "${2:-}" ;;
  *) die "usage: $0 preflight|restore|prepare|wait-boot|verify|start-db|start-backend|read-identities|destroy ..." ;;
esac
