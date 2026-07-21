# Frequency Music Agent Runtime

This directory hosts LangGraph/LangChain agents for the research-to-composition workflow.

## Graphs

`agent/langgraph.json` currently registers:

- `weekly-brief` — existing DeepAgents weekly brief graph.
- `research-pipeline` — new dry-run LangGraph skeleton for externalizing orchestration from Convex.
- `source-scout` — need-directed source and feed discovery driven by graph gaps.

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
- `getResearchModel()` uses the Codex SDK provider when `CODEX_ENABLED=true` for non-tool specialist nodes, wrapped in an automatic OpenRouter fallback.
- `src/models/codexSdk.ts` (`CodexSdkChatModel`) wraps `@openai/codex-sdk`, which drives the local `codex` CLI binary through a thread API (`new Codex()` → `startThread()` → `thread.run(prompt, { outputSchema })`) and reuses the CLI's ChatGPT-subscription login state from `CODEX_HOME/auth.json`. There is no HTTP endpoint; the old `codexAppServer.ts` adapter targeted a protocol that does not exist and has been removed.
- The Codex model is invoke-only: `bindTools` throws so tool-binding paths route to OpenRouter. Structured output is native via `withStructuredOutput(zodSchema)` → JSON Schema (`target: "openAi"`) → `thread.run(prompt, { outputSchema })`.
- `src/models/withFallback.ts` (`withFallback(codexSdk, openRouterAnthropic)`) retries once on transient Codex errors, then falls back to OpenRouter on auth/quota/unknown Codex errors, tagging `llmOutput.provider` with whichever provider answered.
- Codex `thread.run` is wrapped in a LangSmith `traceable` (`codex_sdk.run`) guarded by `LANGSMITH_TRACING`, so Codex calls stay traced even though the SDK does not auto-instrument.
- `src/subagents/codexWorker.ts` (`runCodexTask`) delegates a whole subtask to a Codex thread with a seeded scratch workspace and structured `outputSchema`, returning parsed output, thread id, and usage (default `sandboxMode: "read-only"`).
- `research-pipeline` calls a specialist before storing a sanitized `reviewDraft`; if the model is unavailable or returns invalid JSON, the graph records a fallback warning and still produces a safe needs-review draft.

Run the Codex SDK spike (proves subscription auth + structured output) with:

```bash
cd agent
bun scripts/spike-codex-sdk.ts
```

Prereqs: the `codex` CLI installed with `codex login` completed, and `OPENAI_API_KEY`/`CODEX_API_KEY` unset so the SDK reuses login state. The spike prints only parsed JSON, thread id, and usage — never token or `auth.json` contents.

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

- `CODEX_ENABLED` (set `true` to use the Codex SDK provider for non-tool calls)
- `CODEX_HOME` (defaults to `~/.codex`; the worker mounts a volume here)
- `CODEX_MODEL` (optional model override passed to the SDK)
- `CODEX_SANDBOX_MODE` (`read-only` | `workspace-write`)
- `CODEX_WORKDIR` (scratch working directory for Codex threads)
- `OPENROUTER_API_KEY`
- `TAVILY_API_KEY` (Source Scout web discovery; failed searches warn and skip)
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

Run the actual research-pipeline smoke against Convex audit tools with:

```bash
cd agent
bun run smoke:research-pipeline
```

This loads Convex tool env from the current environment or the repository root `.env.local`, creates a Convex `agentRun`, appends audit events, invokes the dry-run `research-pipeline` graph in `smokeMode`, and marks the run completed. It prints the run id and non-secret audit message summaries only. Smoke mode treats optional/read-scope tool authorization failures as non-fatal warnings so the audit path can still be verified without broad campaign access.

To include that smoke in the local automation gate:

```bash
cd agent
RUN_RESEARCH_PIPELINE_SMOKE=true bun run automation:local
```

Run the repo Convex test suite from the repository root when Convex schema/functions change:

```bash
bun test convex/*.test.ts
```
