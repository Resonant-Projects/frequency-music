# Service identities: consumer inventory and auth-failure alerting

This is improvements ledger #20. `AUTH_BYPASS_ENABLED=true` is intentional and
stays on (SEC-01 in `plans/README.md`), so the controls here are secret hygiene:
know every consumer, rotate them together, and notice when something presents a
stale secret. Never print, paste, or commit a secret value. Rows below name the
1Password reference only.

## Identities

| Identity | Secret | Presented as | Server check |
| --- | --- | --- | --- |
| Service bypass | `AUTH_BYPASS_SECRET` (`DEV_BYPASS_SECRET` is a Varlock alias, `ref(AUTH_BYPASS_SECRET)`) | `devBypassSecret` argument on public queries, mutations, and actions | `requireAuth` in `convex/auth.ts`, only when `AUTH_BYPASS_ENABLED=true` |
| Agent tools | `AGENT_TOOL_SECRET` | `secret` in the JSON body of `POST /agent-tools/*`; `agentSecret` on `agentTools:*` actions; `secret` on `decisionIntents:propose` | `agentToolSecretRejection` in `convex/auth.ts` |
| Media service | the same `AGENT_TOOL_SECRET` | `secret` in the JSON body of the six media lifecycle tools | the same check, recorded as surface `media_tool` |

Every check uses plan 014's `constantTimeEqual`. The Convex deployment
environment holds the expected values. 1Password items:
`op://Country Manor Lab/auth-bypass-secret/credential` and
`op://Country Manor Lab/agent-tool-secret/credential`.

## Consumer inventory

### `AUTH_BYPASS_SECRET` / `devBypassSecret`

| Consumer | Files | Runtime | Host | Resolution |
| --- | --- | --- | --- | --- |
| Convex cron workflows (batch extraction, batch hypotheses) | `convex/workflows.ts` (`startBatchExtractionInternal`, `startBatchHypothesisInternal`) | Convex internal mutation, then `@convex-dev/workflow` steps | Production Convex backend | Read from the deployment's own `process.env.AUTH_BYPASS_SECRET` and passed as a workflow argument |
| Operator CLI scripts through the shared client | `scripts/lib/convexClient.ts` (`getDevBypassSecret`) used by `backfill-passages`, `classify-concepts`, `cleanup-concept-domain-duplicates`, `disable-dead-feeds`, `embed-backfill`, `fetch-youtube-transcripts`, `generate-starter-kit`, `graph-backfill`, `merge-vocabulary-references`, `operator-extraction`, `probe-embeddings`, `probe-passages`, `seed-concept-domains`, `smart-fetch` | `vpx tsx` (Node) | Operator workstation | `import "varlock/auto-load"` resolves the root `.env.schema` `op()` reference through the 1Password service account |
| Ingest scripts through `scripts/lib/ingest.ts` (`sources:create`, `sources:updateText`) | `smart-fetch`, `fetch-full-articles`, `fetch-notion-full-text`, `fetch-readwise-articles`, `ingest-manifest`, `sync-notion-tag` | `vpx tsx` | Operator workstation | Varlock, as above |
| Scripts that read the env directly | `scripts/backfill-claims.ts`, `scripts/migrate-dedupe-keys.ts`, `scripts/find-dupes.ts` (falls back to `DEV_BYPASS_SECRET`), `scripts/langsmith/export-edit-captures.ts` (prefers `CONVEX_DEV_BYPASS_SECRET`), `scripts/essay-audio/episodes.ts` | `vpx tsx` | Operator workstation | Varlock auto-load, then `process.env` |
| Public editorial export (CI) | `.github/workflows/public-editorial-export.yml` → `scripts/export-editorial.ts` | GitHub Actions, `workflow_dispatch` only | Self-hosted ephemeral GARM/Incus runner | GitHub Actions secret `AUTH_BYPASS_SECRET`, exported as `DEV_BYPASS_SECRET`. Rotate it with the 1Password item |
| Web e2e seeding and cleanup | `web/tests/e2e/cleanup.ts`, `web/tests/e2e/phase-three.spec.ts` | Playwright (Node side, never bundled) | Developer workstation | `web/.env.schema` `op()` reference, or `varlock run --` |
| Unidentified ~6h caller | Unknown; matches the `scripts/lib/ingest.ts` pattern (`sources:create`, then ~20 `sources:updateText`) | Unknown | Unknown; suspected host or LXC cron (n8n ruled out) | A **pre-rotation** secret baked into its environment. See `docs/proxmox-worker-runbook-2026-07-12.md` |

`VITE_AUTH_BYPASS` in `web/` and `.cursor/skills/verify-frequency-music` is a
client display flag, not a secret, and grants nothing server-side.

### `AGENT_TOOL_SECRET`

| Consumer | Files | Runtime | Host | Resolution |
| --- | --- | --- | --- | --- |
| LangGraph worker | `agent/src/tools/convexTools.ts`, `agent/src/worker/runner.ts` | Bun in Docker (`agent/docker-compose.yml`, `langgraph-worker`) | CT107 on prox6 today; the Kubernetes migration in `docs/frequency-worker-handoff.md` moves it to one cluster consumer | `agent/.env` `env_file` on the host, or `agent/.env.schema` `op()` reference through Varlock. The host copy must be refreshed by hand on rotation |
| LangGraph Studio dev server (opt-in `dev` profile) | `agent/docker-compose.yml` (`langgraph-dev`) | Bun in Docker | Same host as the worker, only while the profile runs | The same `agent/.env` `env_file`. Restart it with the worker on rotation |
| Agent MCP server (outbound) | `agent/src/mcp/main.ts` | Bun (`vp run mcp`) | Wherever the operator runs it | `agent/.env.schema`. Its inbound `MCP_SHARED_SECRET` is a separate secret |
| Worker smoke test | `agent/scripts/smoke-research-pipeline.ts` | Bun | Operator workstation | Process environment, or the four allowlisted keys it parses from a local `.env` |
| Eval dataset export | `scripts/export-eval-datasets.ts` | `vpx tsx` | Operator workstation | Varlock auto-load |
| Recovery guest receipt reads | `scripts/recovery/guest-receipt-reads.py` | Python | Isolated restore guest | Reads only whether the name is set (`ENV_NAMES`); never the value |

### Media service identity

| Consumer | Files | Runtime | Host | Resolution |
| --- | --- | --- | --- | --- |
| Media service | `media/src/config.ts`, `media/src/convex.ts` (`callTool`) | Bun in Docker | ai-5090-02 (`homelab-infra/hosts/frequency-media/`) | `media/.env.schema` `op()` reference through Varlock and the 1Password service account. Only the six `media_write` tools in `docs/agent-tool-surface.md` |

Test suites (`convex/*.test.ts`, `harness/`, `agent/tests/`, `media/tests/`)
stub synthetic values and never hold a real secret.

## Rotation checklist

1. Rotate the 1Password item.
2. Set the new value in the Convex deployment environment (operator-gated).
3. Refresh every consumer that copies the value instead of resolving it at
   start: the worker's `agent/.env` on its host, and the GitHub Actions secret
   `AUTH_BYPASS_SECRET`. Restart every service that holds the old value: the
   media service, the worker, and `langgraph-dev` if its profile is running.
4. Watch the auth-failure alerts below for the next 24 hours. A consumer that
   was missed shows up as a `secret_mismatch` burst.

## Auth-failure recording and alerting

Each rejection is classified with one fixed reason: `missing_secret`,
`secret_mismatch`, `bypass_disabled` (a secret was presented while bypass is
off), or `server_unconfigured`. It also gets a surface (`bypass`, `agent_tool`,
`media_tool`) and a bounded operation label such as `http:claimNextMediaJob`.
Nothing derived from the presented secret is kept. No hash is stored, and the
only header kept is a truncated `User-Agent` on HTTP rejections, with any
copy of the presented secret replaced by `[REDACTED]`. A call with no
identity and no `devBypassSecret` is an ordinary signed-out request, so it is
not counted.

### What gets persisted, and why not everything

Convex rolls back every write in a query or mutation that throws, including
scheduled functions. A rejected public query or mutation therefore cannot
persist its own failure. That covers `sources:updateText`, the ~6h caller's
target.

| Rejected at | Persisted to `authFailureCounters` | Log line |
| --- | --- | --- |
| `POST /agent-tools/*` (worker, MCP, media) | Yes | `[auth-failure] … persisted=true` |
| `agentTools:*` actions | Yes | `persisted=true` |
| `requireAuth` inside a public action | Yes (`requireAuth:action`) | `persisted=true` |
| `requireAuth` inside a public query or mutation | No | `[auth-failure] surface=bypass … operation=requireAuth:transaction persisted=false` |
| `decisionIntents:propose` (mutation) | No | `persisted=false` |

`authFailureCounters` holds one row per hour, surface, reason, and operation.
It keeps 14 days: each new hourly row deletes up to 25 expired rows. The table
stores no `_storage` ids, so `mediaSweeper` needs no reference check for it.

### Alerts

When a surface reaches 3 rejections in one hour, the rejecting action writes
one `console.error` line after its counter commits. It is not written inside
the mutation, because Convex keeps console output from attempts that lose an
OCC race. Committed increments are serialized, so the line fires once per
surface per hour:

```text
[auth-failure-alert] surface=agent_tool window=2026-10-17T21:00:00.000Z rejections=3 threshold=3 action=see docs/service-identity-inventory.md
```

The alert goes to the deployment's existing observability path, the Convex
function log, which is where the 2026-07-12 hunt caught the ~6h burst. This
change adds no new push channel. Reading it:

- Persisted counters: `authFailures:summary` (requires a signed-in user or
  `devBypassSecret`). It returns the last 24 hours of rows, per-surface totals,
  and `alertingSurfaces`, the surfaces with an hour at or above the threshold.
  Totals cover every row; the row list is capped at 200, newest first, and
  `countersTruncated` says when rows were left out.
- Everything, including transactional rejections: filter the Convex log for
  `[auth-failure]` (dashboard Logs, or `vpx convex logs`). Both read
  production. The function path on each log line names the rejected mutation.

### Follow-ups this change does not do

- **Push delivery.** The Discord and Telegram decision-signer bots could carry
  alerts, but they are the human decision channel. Choosing that channel is a
  product decision.
- **Persisting mutation-path rejections.** A Convex webhook log stream pointed
  at an HMAC-verified HTTP action could count `[auth-failure]` lines from rolled
  back mutations. It needs operator setup and a signing secret. Whether the
  self-hosted backend offers log streams has not been verified.
- **Bypass secret in workflow arguments.** `convex/workflows.ts` passes
  `AUTH_BYPASS_SECRET` as a workflow argument, so `@convex-dev/workflow` keeps
  it in its journal. Reading the value inside each step instead would keep it
  out of stored data.
- **Ingest and MCP secrets.** `INGEST_SHARED_SECRET` (`/ingest/*`) and
  `MCP_SHARED_SECRET` are separate shared secrets and are not counted here.
- **A real service identity** for the worker and scripts (ledger #20,
  longer term).
