#!/usr/bin/env bash
# Rerun of the recovery-preparation rehearsal block for the 2026-10-17 receipt, part A,
# from the repository root on devbox. Adaptations from the documented block, none to
# the helper beyond the reviewed change in this branch:
#   - SSH destination H is root@prox4.rproj.art; the helper's node argument N is prox4.
#   - Archive A is the 2026-10-17 on-demand archive; evidence lands in the receipt directory.
#   - Every host step, not only restore, runs in its own systemd unit (systemd-run --wait
#     --pipe) under a runtime limit, so a dropped SSH session cannot kill a step; both
#     cleanup paths stop every unit of this run (glob "$P-*") before destroy.
#   - After read-identities, host-receipt-reads.sh collects items 2-7; deltas run against
#     the 2026-10-17 references. Step timestamps measure restore, boot and backend ready.
set -e   # any failed step stops the sequence
H=root@prox4.rproj.art; N=prox4; C=913; A='nas-docker:backup/vzdump-lxc-113-2026_10_17-12_15_58.tar.zst'
EVID=docs/evidence/wave2-restore-receipt-20261017
MANIFEST=/tmp/laneA-rollout-20261017/release-81150337a777594c3a39f2be0a5f75b5e226d9d3/convex-root-modules.json
R="bash /root/isolated-restore-guest.sh"
P="isolated-restore-$C-$(date -u +%Y%m%dT%H%M%SZ)"
U="systemd-run --service-type=exec --wait --pipe --property=TimeoutStopSec=30 --property=KillMode=control-group"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o ConnectionAttempts=1 -o ServerAliveInterval=15 -o ServerAliveCountMax=3)
trap 'echo "rehearsal step failed"' ERR
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'rc=$?; trap - EXIT HUP INT TERM; echo "rehearsal step failed; purging CT $C"; timeout 900 ssh "${SSH_OPTS[@]}" "$H" "systemctl stop \"$P-*\" && $R destroy $C" || echo "destroy refused or failed; CT $C may still exist, inspect before retrying"; exit "$rc"' EXIT
[ "$(sha256sum "$MANIFEST" | cut -d' ' -f1)" = 8961e78e41a9d148f8b43a24098b4a0374e2c9957d114e25adbc07c56328f2fb ]
echo "step scp $(date -u +%FT%TZ)"
timeout 300 scp "${SSH_OPTS[@]}" scripts/recovery/isolated-restore-guest.sh scripts/recovery/guest-module-identities.py scripts/recovery/guest-receipt-reads.py scripts/recovery/host-receipt-reads.sh "$H":/root/
timeout 60 ssh "${SSH_OPTS[@]}" "$H" "sha256sum /root/isolated-restore-guest.sh /root/guest-module-identities.py /root/guest-receipt-reads.py /root/host-receipt-reads.sh"
echo "step preflight $(date -u +%FT%TZ)"
timeout 120 ssh "${SSH_OPTS[@]}" "$H" "$R preflight $C $A $N"           # read-only
# ---- first mutation begins here ----
echo "step restore start $(date -u +%FT%TZ) epoch=$(date -u +%s)"
timeout 2700 ssh "${SSH_OPTS[@]}" "$H" "$U --unit=$P-restore.service --property=RuntimeMaxSec=2400 $R restore $C $A $N"
echo "step restore end $(date -u +%FT%TZ) epoch=$(date -u +%s)"
echo "step prepare $(date -u +%FT%TZ)"
timeout 900 ssh "${SSH_OPTS[@]}" "$H" "$U --unit=$P-prepare.service --property=RuntimeMaxSec=840 $R prepare $C"
echo "step start (first boot) $(date -u +%FT%TZ) epoch=$(date -u +%s)"
timeout 600 ssh "${SSH_OPTS[@]}" "$H" "$U --unit=$P-start.service --property=RuntimeMaxSec=540 $R start $C"
echo "step boot settled $(date -u +%FT%TZ) epoch=$(date -u +%s)"
echo "step verify $(date -u +%FT%TZ)"
timeout 300 ssh "${SSH_OPTS[@]}" "$H" "$U --unit=$P-verify.service --property=RuntimeMaxSec=240 $R verify $C"
echo "step start-db $(date -u +%FT%TZ) epoch=$(date -u +%s)"
timeout 600 ssh "${SSH_OPTS[@]}" "$H" "$U --unit=$P-db.service --property=RuntimeMaxSec=540 $R start-db $C"
echo "step start-backend $(date -u +%FT%TZ) epoch=$(date -u +%s)"
timeout 600 ssh "${SSH_OPTS[@]}" "$H" "$U --unit=$P-backend.service --property=RuntimeMaxSec=540 $R start-backend $C"
echo "step backend ready $(date -u +%FT%TZ) epoch=$(date -u +%s)"
echo "step read-identities $(date -u +%FT%TZ)"
IDENTITY_OUTPUT=$(timeout 600 ssh "${SSH_OPTS[@]}" "$H" "$U --unit=$P-identities.service --property=RuntimeMaxSec=540 $R read-identities $C /root/guest-module-identities.py")
printf '%s\n' "$IDENTITY_OUTPUT"
REMOTE_IDENTITIES=$(printf '%s\n' "$IDENTITY_OUTPUT" | awk '/^identities file: / {print $3}')
[[ "$REMOTE_IDENTITIES" =~ ^/root/isolated-restore-runs/$C-[0-9]{8}T[0-9]{6}Z-module-identities\.json$ ]]
IDENTITIES="$EVID/${REMOTE_IDENTITIES##*/}"
[ ! -e "$IDENTITIES" ]   # refuse stale local evidence from this exact run
timeout 300 scp "${SSH_OPTS[@]}" "$H:$REMOTE_IDENTITIES" "$EVID/"
[ -f "$IDENTITIES" ]   # fails the step if the pull produced nothing
echo "step receipt-reads $(date -u +%FT%TZ)"
READS_RC=0
READS_OUTPUT=$(timeout 1800 ssh "${SSH_OPTS[@]}" "$H" "$U --unit=$P-reads.service --property=RuntimeMaxSec=1740 bash /root/host-receipt-reads.sh $C") || READS_RC=$?
printf '%s\n' "$READS_OUTPUT"
[ "$READS_RC" = 0 ] || [ "$READS_RC" = 2 ]   # 2: evidence pulled, a receipt check failed
REMOTE_READS=$(printf '%s\n' "$READS_OUTPUT" | awk '/^receipt reads file: / {print $4}')
[[ "$REMOTE_READS" =~ ^/root/isolated-restore-runs/$C-[0-9]{8}T[0-9]{6}Z-receipt-reads\.json$ ]]
READS="$EVID/${REMOTE_READS##*/}"
[ ! -e "$READS" ]
timeout 300 scp "${SSH_OPTS[@]}" "$H:$REMOTE_READS" "$EVID/"
[ -f "$READS" ]
echo "step deltas $(date -u +%FT%TZ)"
vpx tsx scripts/convex-identity-delta.ts \
  docs/evidence/wave2-rollout-20261017/deployed-module-identities.json \
  "$IDENTITIES" > "$EVID/identity-delta-vs-deployed.json"
cat "$EVID/identity-delta-vs-deployed.json"
vpx tsx scripts/convex-module-delta.ts "$MANIFEST" "$IDENTITIES" > "$EVID/module-delta-vs-81150337.json"
cat "$EVID/module-delta-vs-81150337.json"
[ "$READS_RC" = 0 ] || { echo "receipt checks failed (evidence kept)"; false; }
# ---- evidence recorded, then cleanup constrained to the recorded guest and its volumes ----
echo "step destroy $(date -u +%FT%TZ)"
timeout 900 ssh "${SSH_OPTS[@]}" "$H" "systemctl stop \"$P-*\" && $R destroy $C && rm -f /root/isolated-restore-guest.sh /root/guest-module-identities.py /root/guest-receipt-reads.py /root/host-receipt-reads.sh"
trap - EXIT HUP INT TERM ERR
echo "step done $(date -u +%FT%TZ)"
