# Proxmox Worker + UNAUTHORIZED Scheduler — Handoff Packet (2026-07-12)

Everything here needs host access to `prox.rproj.art`, which this session could
**not** obtain from Keith's Mac: `~/.ssh/id_ed25519`, the 1P **Homelab OpenTofu
SSH Key** (read in OpenSSH format), the **Proxmox API** token in `.env.local`,
and `:8006` ticket auth with the **Proxmox API** item all returned
`Permission denied` / `401`. So the remote work is packaged, not executed.

## What IS done (verified from the Mac)

- **Worker Docker image was broken; now fixed.** `agent/Dockerfile:40`
  (`bun install --frozen-lockfile`) failed with *"lockfile had changes, but
  lockfile is frozen"*. Regenerated `agent/bun.lock` (`cd agent && vp install`);
  `POSTGRES_PASSWORD=unused docker compose -f agent/docker-compose.yml build
  langgraph-worker` now succeeds → **"Image agent-langgraph-worker Built"**.
  The lockfile fix is committed. So the June-4 offline worker's *image* is no
  longer a blocker.
- **n8n cleared as the UNAUTHORIZED source.** Logged into `zap.rproj.art` REST
  API (1P **n8n** creds) and pulled the full workflow + execution inventory:
  20 workflows (9 active) — only *Gmail→Parcel tracking*, *audio-chunking/
  transcription*, *Notion voice notes*, and n8n self-backup. **None call Convex;
  none run on a 6-hour cadence.** The scheduler is not in n8n.
- **Scheduler is LIVE — burst captured 2026-07-12.** A 40-minute Convex log
  capture caught a burst **08:58:44–09:01:10** (PT): one `sources:create` then
  ~20 `sources:updateText` calls, every one `UNAUTHORIZED: Authentication
  required`. This is the fetch/ingest pattern (create a source, then updateText
  per source) iterating with the **pre-rotation** bypass secret. It fires at the
  **top of the hour on a ~6h cadence** (≈03:00 / 09:00 / 15:00 / 21:00 PT), so
  the next confirmation window is ~15:00 PT. NOT dormant — the earlier "no burst"
  read was a too-short first window. Harmless today (the mutations reject), but
  it's the fingerprint to catch the job by.

## What Keith needs to do on the host

### 1. Refresh the worker env and restart

`agent/.env` on the host still has the **dead** OpenRouter key and the
**stale** `AGENT_TOOL_SECRET`. Current values (resolve from 1P, never paste):

```
CONVEX_SITE_URL     = op://Country Manor Lab/…            # http actions url
AGENT_TOOL_SECRET   = op://Country Manor Lab/agent-tool-secret/credential
OPENROUTER_API_KEY  = op://Country Manor Lab/OpenRouter API Key - Frequency Music/credential
LANGSMITH_API_KEY   = op://Country Manor Lab/… (item s37crgkfad35vq6wyoymg3szja)
```

Then, from a checkout on the host (the image now builds):

```bash
POSTGRES_PASSWORD=unused docker compose -f agent/docker-compose.yml build langgraph-worker
docker compose -f agent/docker-compose.yml up -d langgraph-worker
```

Verify: enqueue a `research-pipeline` run and watch it reach a terminal status;
grep container logs for token-shaped strings (expect none). Full runbook:
`docs/proxmox-agent-deployment.md` §"Deployment runbook".

### 2. Find and fix the UNAUTHORIZED scheduler (host cron is the remaining suspect)

The stale bypass secret hitting `sources:updateText` on a ~6h cadence is most
likely a **host or LXC cron** running the fetch scripts
(`scripts/lib/ingest.ts` → `smart-fetch.ts` → `sources:updateText`) with the
pre-rotation `AUTH_BYPASS_SECRET` baked into its env. Confirm with:

```bash
# on prox (and each LXC):
crontab -l | grep -iE 'convex|updateText|fetch|frequency|resonant'
for c in $(pct list | awk 'NR>1{print $1}'); do
  echo "[ct $c]"; pct exec $c -- crontab -l 2>/dev/null | grep -iE 'convex|fetch|frequency'
  pct exec $c -- sh -c 'grep -rl AUTH_BYPASS_SECRET /root /opt /etc 2>/dev/null'
done
```

Fix = refresh that env's `AUTH_BYPASS_SECRET` to
`op://Country Manor Lab/auth-bypass-secret/credential`, or disable the job if
it's the dead worker's leftover. Confirm no new UNAUTHORIZED at the next
6h window.

**No-host-access alternative (canary):** insert one `text_ready` source whose
URL points at an endpoint you control; at the next burst the caller
fingerprints itself (source IP + User-Agent) on your endpoint — identifies the
host without shell access.

## Structural fix (so this class stops recurring)

`sources:updateText` is a public mutation gated only by a **dev bypass secret**
with unmanaged production consumers. Recommended: (a) inventory every consumer
of `AUTH_BYPASS_SECRET` at rotation time, (b) add Convex-side alerting on
repeated auth failures to one function (turns a 5-minute log buffer into a
signal), (c) longer-term, give the worker/scripts a real service identity
instead of the shared bypass secret. Filed in the improvements ledger.
