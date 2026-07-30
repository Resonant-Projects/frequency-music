# Proxmox Agent Deployment Notes

The Proxmox cluster for this project is reachable at:

```text
prox.rproj.art
```

The root `.env.local` now carries Proxmox API credentials:

```text
PROXMOX_TOKEN_ID
PROXMOX_TOKEN_SECRET
```

Recommended derived API URL for scripts:

```text
PROXMOX_API_URL=https://prox.rproj.art:8006/api2/json
```

## Secret handling

- Never print the token id or token secret in logs.
- Do not pass the secret as a command-line argument.
- Prefer reading `PROXMOX_TOKEN_ID` and `PROXMOX_TOKEN_SECRET` from environment variables or runtime container secrets.
- Do not bake Proxmox credentials into Docker images.
- Do not commit populated `.env`, `.env.local`, or compose override files.

## Intended deployment shape

Use Proxmox for the always-on LangGraph runtime once local dry-run graphs are verified.

Suggested services:

1. `langgraph-worker`
   - Runs the registered LangGraph graphs from `agent/`.
   - Needs Convex tool env vars, model-provider env vars, and LangSmith env vars.

2. `agent-runner` or queue poller
   - Optional later service that polls Convex `agentRuns` for queued runs.
   - Should not exist until `agentRuns` audit tables are implemented.

3. reverse proxy / internal route
   - Optional, depending on whether LangGraph needs inbound access or only outbound Convex/model access.

Run the Proxmox connectivity spike with:

```bash
cd agent
vp run smoke:proxmox
```

It reads `PROXMOX_TOKEN_ID` and `PROXMOX_TOKEN_SECRET` from the environment, falling back to the repository root `.env.local` when run from `agent/`. It prints cluster version and sanitized node summaries only. If the cluster certificate is not trusted locally, set `PROXMOX_ALLOW_SELF_SIGNED=true` for the spike/container runtime.

## Local build/smoke sequence

Before preparing any Proxmox runtime, verify the local agent package and LangGraph image build:

```bash
cd agent
vp run verify
vp run automation:local
```

`vp run automation:local` runs TypeScript verification and the local LangGraph Docker build, producing the local image tag configured by `agent/package.json` (`resonant-projects-agent:local`). It intentionally skips Proxmox connectivity by default so normal local automation remains low-friction and does not require cluster credentials.

To include the secret-safe Proxmox API smoke check in the same fail-fast sequence:

```bash
cd agent
RUN_PROXMOX_SMOKE=true vp run automation:local
```

The automation must not print token values. The optional smoke step delegates to `agent/scripts/spike-proxmox.ts`, which reads credentials from environment variables or the root `.env.local` fallback and prints only sanitized cluster metadata.

Do not use this sequence to deploy yet: it is build/smoke preparation only. Do not copy Proxmox tokens, Codex sessions, or other secrets into Docker images.

## Deployment runbook (gate satisfied — 2026-07-01)

The gating condition ("Convex audit tables + narrow audit-write tools") is now met:
`agentRuns`/`agentRunEvents` exist, the queue surface (`enqueue`/`claimNextPending`/
`sweepStaleRuns` + `/agent-tools/{claimNextPendingRun,getAgentRun}`) is deployed, and
the worker runner (`agent/src/worker/runner.ts`, `vp run worker`) is implemented.
Cluster confirmed online (v9.2.3; nodes `prox`/`prox2`/`prox3`).

### 1. Provision the host
- Create an LXC/VM on `prox` or `prox2`: 2 vCPU / 4 GB, Docker installed.
- Add it to the Pulse-agent candidate list (monitoring plan); alert on the worker
  container being down and on `sweep-stale-agent-runs` firing.

### 2. Configure secrets (never baked into the image)
Create `agent/.env` on the host (NOT committed) with:
```
CONVEX_SITE_URL=<convex http actions url>
AGENT_TOOL_SECRET=<agent tool secret>
OPENROUTER_API_KEY=<openrouter key>
FIRECRAWL_API_KEY=<firecrawl key>
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=<langsmith key>          # op item s37crgkfad35vq6wyoymg3szja
CODEX_ENABLED=true
CODEX_HOME=/data/codex-home
WORKER_ID=prox-worker-1
WORKER_POLL_INTERVAL_MS=15000
# WORKER_GRAPH_NAME=research-pipeline       # optional: restrict this worker to one graph
```

### 3. Seed Codex subscription auth ONCE
- Run `codex login` on a trusted machine (browser OAuth against the ChatGPT plan).
- Copy that machine's `~/.codex/auth.json` into the `codex-home` volume **only if
  missing** — Codex refreshes tokens in place; re-seeding every deploy discards
  refreshed tokens. Also drop a `config.toml` with `cli_auth_credentials_store = "file"`
  (no OS keyring exists in the container).

### 4. Deploy
```bash
cd frequency-music
docker compose -f agent/docker-compose.yml build
docker compose -f agent/docker-compose.yml up -d langgraph-worker
# optional: docker compose -f agent/docker-compose.yml --profile memory up -d postgres
# optional: docker compose -f agent/docker-compose.yml --profile dev up langgraph-dev
```
The compose services build from the repository root so the image can copy the
agent workspace together with its imported `convex/shared` contracts.
Egress required: Convex site URL, OpenRouter, OpenAI/ChatGPT, Firecrawl, LangSmith.

### 5. Verify
- `vpx convex run agentRuns:... ` enqueue a `research-pipeline` run; watch the worker
  claim → execute → reach a terminal status (events in the app / `/agent-runs`).
- Grep container logs for token-shaped strings — expect none.
- 72-hour soak: enqueue ≥5 runs across days; zero manual intervention.

### Cutover (after the plan-04 comparison resolves in the agent's favor)
Only then flip the Friday cron to enqueue-only and demote Convex-side brief
generation to fallback. Keep the deterministic path as the documented fallback.
