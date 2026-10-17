#!/usr/bin/env bash
# Restore-receipt reads (work order items 2, 3, 4 and 5 to 7) on a running
# disposable guest restored by isolated-restore-guest.sh. Runs as root on the
# Proxmox node after `read-identities`, while app-postgres-1 and
# app-convex-backend-1 are the only running containers.
#
#   host-receipt-reads.sh <ctid>
#
# Read-only toward the guest's data. Prints allowlisted values only: unit
# names, interface kinds, image digests, timestamps, and PostgreSQL recovery
# events as fixed tokens parsed inside the guest. The guest-side reader (guest-receipt-reads.py,
# pushed into the guest) writes only allowlisted shapes; the pulled file lands
# in the run directory and is never overwritten. Every guest call carries a
# host-side deadline. Exits 1 on any failed check before evidence is pulled,
# and 2 after pulling evidence whose receipt checks failed.
set -euo pipefail
RUN_DIR="${ISOLATED_RESTORE_RUN_DIR:-/root/isolated-restore-runs}"
READER="${RECEIPT_READER:-/root/guest-receipt-reads.py}"
READ_SECONDS="${RECEIPT_READ_SECONDS:-1560}"
die() { echo "host-receipt-reads: $*" >&2; exit 1; }
C=${1:-}
[[ "$C" =~ ^91[123]$ ]] || die "ctid must be 911, 912 or 913"
REC="$RUN_DIR/$C.record"
[ -f "$REC" ] || die "no run record for $C; refusing"
rec() { awk -v k="$1" -F'=' '$1==k{print substr($0, length(k)+2)}' "$REC"; }
[ "$(rec ctid)" = "$C" ] || die "run record ctid mismatch"
[ "$(rec node)" = "$(hostname)" ] || die "run record node mismatch"
[ -f "$READER" ] || die "guest reader not found: $READER"
stamp=$(rec created_at | tr -d ':-')
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || die "run record timestamp invalid"
out="$RUN_DIR/$C-$stamp-receipt-reads.json"
[ ! -e "$out" ] || die "$out already exists; refusing to overwrite evidence"
gx() { timeout --kill-after=5 30 pct exec "$C" -- "$@"; }

# Live isolation gate: the same assertions as the helper's assert_guest_isolated.
[ "$(pct status "$C")" = "status: running" ] || die "guest not running"
cfg=$(pct config "$C") || die "pct config $C failed"
val() { awk -v k="$1" -F': ' '$1==k{print $2}' <<<"$cfg"; }
[ "$(val hostname)" = "$(rec hostname)" ] || die "hostname differs from run record"
[ "$(val rootfs | cut -d, -f1)" = "$(rec rootfs)" ] || die "rootfs volume differs from run record"
[ "$(val mp0 | cut -d, -f1)" = "$(rec mp0)" ] || die "mp0 volume differs from run record"
if grep -qE '^(net|mp[1-9]|unused[0-9]|dev[0-9]|lxc\.|hookscript)' <<<"$cfg"; then die "network, extra mount, device, hookscript or raw lxc keys on $C"; fi
gx test -f "/etc/isolated-restore-$C" || die "prepare marker missing"
bad=$(gx sh -c 'for i in /sys/class/net/*; do n=${i##*/}; [ "$n" = bonding_masters ] && [ -f "$i" ] && [ ! -L "$i" ] && continue; [ "$n" = lo ] && continue; [ -d "$i/bridge" ] && continue; [ -e "$i/master" ] && continue; echo "$n"; done') || die "interface read failed"
[ -z "$bad" ] || die "unexpected interfaces in guest: $bad"
running=$(gx docker ps --format '{{.Names}}' | sort | tr '\n' ' ') || die "container list failed"
[ "$running" = "app-convex-backend-1 app-postgres-1 " ] || die "unexpected running containers: $running"
echo "isolation gate ok: no net/mp1+/unused/dev/hookscript/lxc keys; interfaces lo and bridges only; running: ${running% }"
echo "guest interfaces (name:kind):"
gx sh -c 'for i in /sys/class/net/*; do n=${i##*/}; k=other; [ "$n" = bonding_masters ] && [ -f "$i" ] && [ ! -L "$i" ] && k=bonding-control-file; [ "$n" = lo ] && k=loopback; [ -d "$i/bridge" ] && k=bridge; [ -e "$i/master" ] && k=bridge-port; echo "  $n:$k"; done'
echo "guest default routes: $(gx sh -c 'ip route show default 2>/dev/null | grep -c . || true')"
echo "guest running services:"
gx systemctl list-units --type=service --state=running --no-legend --plain | awk '{print "  " $1}'

# Item 4: runtime identity, read inside the guest.
img=$(gx docker inspect --format '{{.Image}}' app-convex-backend-1) || die "backend image read failed"
[[ "$img" =~ ^sha256:[0-9a-f]{64}$ ]] || die "backend image id malformed"
echo "app-convex-backend-1 image id: $img"
digests=$(gx docker image inspect --format '{{json .RepoDigests}}' "$img") || die "backend repo digest read failed"
[[ "$digests" =~ @sha256:[0-9a-f]{64} ]] || die "backend repo digest missing"
echo "app-convex-backend-1 repo digests: $digests"
echo "app-convex-backend-1 started at: $(gx docker inspect --format '{{.State.StartedAt}}' app-convex-backend-1)"
echo "app-postgres-1 image id: $(gx docker inspect --format '{{.Image}}' app-postgres-1)"

# Item 2: PostgreSQL recovery on its first start. The guest reader parses the
# container log inside the guest and prints fixed event tokens only.
pg_started=$(gx docker inspect --format '{{.State.StartedAt}}' app-postgres-1) || die "postgres start time read failed"
[[ "$pg_started" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$ ]] || die "postgres start time malformed"
echo "app-postgres-1 started at: $pg_started"
timeout --kill-after=5 30 pct push "$C" "$READER" /root/guest-receipt-reads.py --perms 0700 || die "push failed"
recovery=$(gx python3 /root/guest-receipt-reads.py --postgres-recovery "$pg_started") || die "postgres recovery read failed: $recovery"
echo "postgres recovery since that start: $recovery"

# Items 5 to 7: guest-side reads under the same admin-key trap as read-identities.
# The reader exits 0 when its checks pass, 2 when it wrote the file but a check
# failed, and 1 when it wrote nothing. Evidence is pulled for 0 and 2.
reads_rc=0
timeout --kill-after=5 "$READ_SECONDS" pct exec "$C" -- sh -c 'trap "rm -f /root/.restore-admin-key" EXIT HUP INT TERM; umask 077; rm -f /root/.restore-admin-key /root/restore-receipt-reads.json || exit 1; set -C; docker exec app-convex-backend-1 ./generate_admin_key.sh | tail -1 > /root/.restore-admin-key || exit 1; set +C; python3 /root/guest-receipt-reads.py' \
  || reads_rc=$?
[ "$reads_rc" = 0 ] || [ "$reads_rc" = 2 ] || die "receipt reads failed inside guest (see classification above)"
gx sh -c '[ ! -e /root/.restore-admin-key ]' || die "admin key file still present in guest"
umask 077
timeout --kill-after=5 30 pct pull "$C" /root/restore-receipt-reads.json "$out" || die "pull failed"
gx rm -f /root/restore-receipt-reads.json /root/guest-receipt-reads.py || true
python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d.get("format")=="frequency-restore-receipt-reads-v1" and d.get("deploymentAuthorized") is False' "$out" \
  || die "pulled receipt file failed shape check"
echo "receipt reads file: $out sha256=$(sha256sum "$out" | cut -d' ' -f1)"
if [ "$reads_rc" = 2 ]; then
  echo "receipt checks: failed (see checks in the pulled file)"
  exit 2
fi
echo "receipt checks: passed"
