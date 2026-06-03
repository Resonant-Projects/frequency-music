# Frequency Music Agent Runtime

This directory hosts LangGraph/LangChain agents for the research-to-composition workflow.

## Graphs

`agent/langgraph.json` currently registers:

- `weekly-brief` — existing DeepAgents weekly brief graph.
- `research-pipeline` — new dry-run LangGraph skeleton for externalizing orchestration from Convex.

## Architecture boundary

Convex remains the source-of-truth database and control plane:

- source, extraction, hypothesis, recipe, thesis, and failure data
- auth and `AGENT_TOOL_SECRET` validation
- narrow HTTP tool routes under `/agent-tools/*`
- simple cron wakeups and audit state

LangGraph owns reasoning-heavy orchestration:

- loading research scope from Convex
- selecting next candidates
- routing candidate work
- specialist agent/subagent stages
- quality gates and critiques
- eventual draft/proposal writes through narrow tools

The new `research-pipeline` graph is intentionally dry-run first. It can load scope and select/route a candidate, but write-producing routes stop before mutation until audit tables and write tools are implemented.

## Model provider selection

Model construction is centralized in `src/models/`.

- `getResearchModel({ requiresToolBinding: true })` uses the OpenRouter/Anthropic-compatible path so DeepAgents can bind tools.
- `getResearchModel()` can use Codex App Server when `CODEX_APP_SERVER_URL` is set.
- `src/models/codexAppServer.ts` assumes an OpenAI-compatible `/v1/chat/completions` endpoint. Tool calling is not assumed yet.

Run the Codex endpoint spike with:

```bash
cd agent
bun scripts/spike-codex-app-server.ts
```

The spike prints only non-secret metadata and the model response. It must not print `CODEX_APP_SERVER_AUTH_TOKEN`.

Run the Proxmox connectivity spike with:

```bash
cd agent
bun run smoke:proxmox
```

The spike reads `PROXMOX_TOKEN_ID` and `PROXMOX_TOKEN_SECRET` from environment variables, falling back to the repository root `.env.local` when run from `agent/`. It prints sanitized node summaries only. If the cluster certificate is not trusted locally, set `PROXMOX_ALLOW_SELF_SIGNED=true`.

## Environment

Copy `agent/.env.example` to `agent/.env` for local LangGraph runs, or source the root `.env.local` before invoking scripts.

Required for Convex tools:

- `CONVEX_SITE_URL`
- `AGENT_TOOL_SECRET`

Optional model/provider variables:

- `CODEX_APP_SERVER_URL`
- `CODEX_APP_SERVER_AUTH_TOKEN`
- `CODEX_APP_SERVER_MODEL`
- `OPENROUTER_API_KEY`
- `WEEKLY_BRIEF_AGENT_MODEL`

Optional tracing variables:

- `LANGSMITH_API_KEY`
- `LANGSMITH_TRACING`
- `LANGSMITH_PROJECT`

Optional Proxmox deployment variables:

- `PROXMOX_API_URL=https://prox.rproj.art:8006/api2/json`
- `PROXMOX_TOKEN_ID`
- `PROXMOX_TOKEN_SECRET`

Do not commit populated `.env` or `.env.local` files.

## Verification

```bash
cd agent
bun run verify
bun run build
```

`bun run build` invokes the LangGraph Docker build path; it requires Docker to be installed/running locally. On machines without Docker, use `bun run verify` for TypeScript verification and build the container on a Docker-capable host or Proxmox build runner.

For one local pre-deployment check that fails fast on typecheck or image-build failures:

```bash
cd agent
bun run automation:local
```

`bun run automation:local` runs `bun run verify` and then the LangGraph Docker build. It skips Proxmox connectivity by default so local verification does not require cluster credentials or network access. To include the existing secret-safe Proxmox smoke script, run:

```bash
cd agent
RUN_PROXMOX_SMOKE=true bun run automation:local
```

The automation prints step names and command results, but does not print environment variable values. The Proxmox smoke script continues to read credentials from the environment or root `.env.local` fallback and prints only sanitized cluster metadata.

Run the repo Convex test suite from the repository root when Convex schema/functions change:

```bash
bun test convex/*.test.ts
```
