# Frequency Music Agent Runtime

This directory hosts LangGraph/LangChain agents for the research-to-composition workflow.

## Graphs

`agent/langgraph.json` currently registers:

- `weekly-brief` — existing DeepAgents weekly brief graph.
- `research-pipeline` — new dry-run LangGraph skeleton for externalizing orchestration from Convex.
- `source-scout` — need-directed source and feed discovery driven by graph gaps.

The worker also runs `transcript-capture` (not a Studio graph). It handles YouTube Sources that arrive with no text. YouTube rate-limits subtitle downloads (`timedtext`, HTTP 429) from the Lab IP even with a PO token, so the worker downloads each video's lowest-bitrate original-language DASH audio with yt-dlp instead (HLS streams are MPEG-TS, which Groq rejects). The pinned musl binary is in the image. The bgutil PO-token server, built from its pinned source, runs from the same image as a pod sidecar (`node /opt/bgutil-server/build/main.js --host 127.0.0.1`). The audio is transcribed with Groq Whisper (`whisper-large-v3-turbo`). Audio over Groq's 25 MB upload limit (downloads up to 150 MB) is re-encoded with ffmpeg into 30-minute mono 16 kHz Opus segments, which are transcribed in order and joined. A run handles at most 20 videos, 20 seconds apart, stops at the first YouTube or Groq rate limit, and records every outcome through `recordTranscriptCapture`. A captured transcript enters `text_ready` with its model and language; private, members-only, over-two-hour or silent videos are parked for review. The Convex cron `enqueue-transcript-capture` queues a run every 3 hours while transcripts are awaited.

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

- `ANTHROPIC_API_KEY` selects the direct Anthropic API for every graph, including tool-binding calls, ahead of legacy OpenRouter keys and Codex flags. The adapter pins the Anthropic endpoint so a stale proxy URL cannot divert the key or credits.
- `convex/shared/llmPolicy.ts` owns model IDs and reasoning effort. Haiku 5.5 handles bounded relevance and stance checks; Sonnet 5.5 handles query planning, correspondence synthesis, and weekly briefs; Opus 5.5 handles hypothesis and recipe drafts. Every 5.5 call uses adaptive thinking with medium effort, or high for Opus, and omits sampling parameters. Structured calls use native JSON schema.
- Prompt caching is targeted, not global. `src/models/promptCache.ts` marks the end of a prefix that repeats across sequential calls in one run (same model and schema) with a 5-minute Anthropic cache breakpoint: the Evidence Hunter's claims for one target and Source Scout's result judgments, each only when the group holds more than one call, and the tournament's three scoring judges for each candidate. The joined text equals the unsplit prompt. One-shot calls stay unmarked, because a write with no later read costs 1.25x. Prefixes under 512 tokens do not cache. The weekly brief already caches through the deepagents middleware. Tournament budgets count cache reads and writes at face value.
- Without an Anthropic key, explicit `CODEX_ENABLED=true` retains the legacy Codex provider for non-tool nodes and its OpenRouter fallback. `CODEX_SPECIALIST=true` also applies only without an Anthropic key. Anthropic failures do not switch billing providers.
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

Required for inference and Convex tools:

- `CONVEX_SITE_URL`
- `AGENT_TOOL_SECRET`
- `ANTHROPIC_API_KEY` from the item referenced in `agent/.env.schema`

Optional model/provider variables:

- `CODEX_ENABLED` (legacy non-tool Codex path, only without `ANTHROPIC_API_KEY`)
- `CODEX_HOME` (defaults to `~/.codex`; the worker mounts a volume here)
- `CODEX_MODEL` (optional model override passed to the SDK)
- `CODEX_SANDBOX_MODE` (`read-only` | `workspace-write`)
- `CODEX_WORKDIR` (scratch working directory for Codex threads)
- `OPENROUTER_API_KEY`
- `FIRECRAWL_API_URL` (self-hosted Firecrawl base URL for Source Scout web discovery, for example the Lab's `http://172.16.10.38:3002`; empty means Firecrawl Cloud)
- `FIRECRAWL_API_KEY` (Firecrawl Cloud only; sent only to `https://api.firecrawl.dev`, never to a self-hosted URL; failed searches warn and skip)
- `WEEKLY_BRIEF_AGENT_MODEL`
- `GROQ_API_KEY` (transcript capture; without it, runs skip and say so) and `GROQ_TRANSCRIPTION_MODEL`
- `YTDLP_PATH`, `YTDLP_PLUGIN_DIRS` (set by the agent image), `FFMPEG_PATH` (optional; defaults to `ffmpeg` on `PATH`) and `BGUTIL_POT_BASE_URL` (the pod's PO-token sidecar, `http://127.0.0.1:4416`)

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

### Patched braces dependency

The production install applies `patches/braces@3.0.3.patch` through Bun's
`patchedDependencies`. Upstream `braces` has no published fix for
[CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The local
patch bounds parser nesting and the compile, expand, and stringify AST walkers
at 64 levels. Deep input fails with a controlled `SyntaxError` before recursive
stack exhaustion. Normal glob alternatives, ranges, and escaped literals retain
their existing behavior.

The patched package identifies itself as downstream version
`3.0.4-frequency.1`; this is a Frequency patch release, not an upstream release.
The upstream source stays pinned at `braces@3.0.3`, and the lockfile pins the
patch hash. Regression tests reproduce the upstream crash using a 9,999-character
pattern and cover direct AST inputs. Remove the patch when an upstream release
provides equivalent bounds. Image scans continue to reject High and Critical
findings without ignore rules or VEX exceptions.

The pinned bgutil token sidecar source also applies exact security overrides
for `proxy-addr@2.0.8` and `source-map-js@1.2.2` before its locked production
install. These overrides belong to the sidecar, not the agent package.
