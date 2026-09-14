#!/usr/bin/env bash
# Offline tests for the rehearsal command block in the recovery record. The
# block is extracted verbatim from the document and run against fake ssh, scp
# and vpx; no host is contacted and the helper script is never executed.
#
# Two properties here are easy to break and invisible when broken:
#   * every connection needs both the SSH options (which catch a dead
#     transport) and a wall-clock ceiling (which catches a responsive host
#     running a wedged command, including the unbounded pct restore/mount);
#   * no connection may be wrapped in a shell function, because `set -e` alone
#     does not run the ERR trap for a failure inside one, which would silently
#     skip cleanup and leave the guest on the node.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
doc="$here/../../../docs/frequency-backend-recovery-preparation-20260913.md"
[ -f "$doc" ] || { echo "FAIL record not found at $doc"; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/docs/evidence" "$work/scripts/recovery"
touch "$work/scripts/recovery/isolated-restore-guest.sh" "$work/scripts/recovery/guest-module-identities.py"
pass=0; failn=0
ok()  { echo "ok   $1"; pass=$((pass + 1)); }
bad() { echo "FAIL $1"; failn=$((failn + 1)); }

python3 - "$doc" "$work/block.sh" <<'PY'
import re, sys
md = open(sys.argv[1], encoding="utf-8").read()
blocks = re.findall(r"```bash\n(set -e\b.*?)```", md, re.S)
if len(blocks) != 1:
    print(f"expected exactly one rehearsal block, found {len(blocks)}", file=sys.stderr)
    raise SystemExit(1)
open(sys.argv[2], "w", encoding="utf-8").write(blocks[0])
PY
block=$(cat "$work/block.sh")

# --- static guards on the extracted text ---
grep -q 'trap .*ERR' <<<"$block" && ok "block installs an ERR trap" || bad "block has no ERR trap"
grep -q 'ConnectTimeout=' <<<"$block" && grep -q 'ServerAliveInterval=' <<<"$block" && grep -q 'BatchMode=yes' <<<"$block" \
  && ok "ssh options bound the handshake and a dropped connection" || bad "ssh options missing"
# Every line that runs ssh or scp must be prefixed with a timeout ceiling.
unbounded=$(grep -nE '(^|[;(]|&& )[[:space:]]*(ssh|scp) ' <<<"$block" || true)
[ -z "$unbounded" ] && ok "every connection carries a wall-clock ceiling" \
  || { bad "connection without a ceiling"; sed 's/^/     /' <<<"$unbounded"; }
# The ERR trap's own cleanup connection must be bounded too.
grep -qE "trap '.*timeout [0-9]+ ssh" <<<"$block" && ok "the cleanup trap's connection is bounded" || bad "cleanup connection unbounded"
# No connection may sit inside a shell function: set -e would skip the ERR trap.
grep -qE '^[A-Za-z_][A-Za-z0-9_]*\(\)' <<<"$block" && bad "block defines a shell function; ERR trap would need set -E" \
  || ok "no connection is wrapped in a function, so set -e reaches the ERR trap"
grep -q '<stamp>' <<<"$block" && bad "block contains a <stamp> placeholder, which bash reads as a redirection" \
  || ok "block has no placeholder that bash would treat as a redirection"

# --- fakes ---
cat > "$work/bin/vpx" <<'EOF'
#!/usr/bin/env bash
echo "vpx $*" >> "$LOG"; exit 0
EOF
# scp materialises the pulled evidence file, so the block's own "did the pull
# produce anything" guard is exercised rather than tripped by the harness.
cat > "$work/bin/scp" <<'EOF'
#!/usr/bin/env bash
echo "scp $*" >> "$LOG"
src=${*: -2:1}; dest=${*: -1}
case "$src" in
  *:*module-identities.json)
    [ -n "${NO_PULL:-}" ] && exit 0
    [ -d "$dest" ] && : > "$dest/913-20260913T000000Z-module-identities.json" ;;
esac
exit 0
EOF
cat > "$work/bin/ssh" <<'EOF'
#!/usr/bin/env bash
remote=${*: -1}
step=$(sed -E 's/.*isolated-restore-guest\.sh ([a-z-]+).*/\1/' <<<"$remote")
echo "ssh $step" >> "$LOG"
[ -n "${FAIL_STEP:-}" ] && [ "$step" = "$FAIL_STEP" ] && exit 3
[ -n "${HANG_STEP:-}" ] && [ "$step" = "$HANG_STEP" ] && sleep 3600
exit 0
EOF
chmod +x "$work/bin/"*

run_block() {  # CEILING rewrites every step ceiling so a stall case finishes quickly
  local src="$work/block.sh"
  if [ -n "${CEILING:-}" ]; then
    sed -E "s/timeout [0-9]+ (ssh|scp)/timeout $CEILING \1/g" "$work/block.sh" > "$work/block-run.sh"
    src="$work/block-run.sh"
  fi
  ( cd "$work" && PATH="$work/bin:$PATH" LOG="$work/log" bash "$src" ) > "$work/out" 2>&1
}

# A: every step succeeds.
: > "$work/log"; rc=0; run_block || rc=$?
[ "$rc" -eq 0 ] && ok "block completes when every connection succeeds" || { bad "clean run exited $rc"; sed 's/^/     /' "$work/out"; }
grep -q '^ssh preflight$' "$work/log" && grep -q '^ssh restore$' "$work/log" \
  && grep -q '^ssh read-identities$' "$work/log" && grep -q '^ssh destroy$' "$work/log" \
  && ok "clean run reaches destroy" || bad "clean run did not reach destroy"
grep -q 'rehearsal step failed' "$work/out" && bad "clean run ran the failure trap" || ok "clean run did not run the failure trap"
grep -q '^vpx tsx scripts/convex-identity-delta.ts' "$work/log" && ok "clean run compares the pulled identities offline" || bad "identity delta not invoked"

# B: the evidence pull produces nothing.
rm -f "$work/docs/evidence"/*module-identities.json
: > "$work/log"; rc=0; NO_PULL=1 run_block || rc=$?; unset NO_PULL
[ "$rc" -ne 0 ] && ok "block fails closed when the evidence pull produces nothing" || bad "empty pull exited 0"
grep -q '^ssh destroy$' "$work/log" && ok "empty pull still purges the guest" || bad "empty pull did not purge"
rm -f "$work/docs/evidence"/*module-identities.json

# C: a mid-sequence step fails.
: > "$work/log"; rc=0; FAIL_STEP=start-db run_block || rc=$?; unset FAIL_STEP
[ "$rc" -ne 0 ] && ok "block exits non-zero when a step fails" || bad "failing step exited 0"
grep -q 'rehearsal step failed' "$work/out" && ok "ERR trap ran on a failed step" || bad "ERR trap did not run on a failed step"
grep -q '^ssh destroy$' "$work/log" && ok "failed step triggers destroy" || bad "failed step did not trigger destroy"
grep -q '^ssh start-backend$' "$work/log" && bad "block continued past a failed step" || ok "block stopped at the failed step"

# D: a step stalls on a responsive host; only the ceiling can stop it.
: > "$work/log"; rc=0; start=$SECONDS
CEILING=2 HANG_STEP=preflight run_block || rc=$?
elapsed=$((SECONDS - start)); unset CEILING HANG_STEP
[ "$rc" -ne 0 ] && ok "block exits non-zero when a step stalls" || bad "stalled step exited 0"
[ "$elapsed" -lt 30 ] && ok "stalled step is bounded (${elapsed}s)" || bad "stalled step took ${elapsed}s"
grep -q 'rehearsal step failed' "$work/out" && ok "ERR trap ran on a stalled step" || bad "ERR trap did not run on a stalled step"
grep -q '^ssh destroy$' "$work/log" && ok "stalled step triggers destroy" || bad "stalled step did not trigger destroy"
grep -q '^ssh restore$' "$work/log" && bad "block continued past a stalled step" || ok "block stopped at the stalled step"

echo "passed=$pass failed=$failn"
[ "$failn" -eq 0 ]
