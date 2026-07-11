# 01 — Codex SDK Inference Provider (Subscription Auth)
> Landed: 32166aa (2026-07-09)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make OpenAI Codex, authenticated with the local ChatGPT-subscription OAuth session, the primary inference provider for non-tool-binding agent work — replacing per-token OpenRouter spend for those calls — with OpenRouter kept as the tool-binding provider and automatic fallback.

**Why this shape.** `codex app-server` is a JSON-RPC-over-stdio agent protocol (what T3 Code's `CodexAppServerManager` wraps), not an OpenAI-compatible HTTP endpoint — the existing `agent/src/models/codexAppServer.ts` adapter targets a protocol that doesn't exist. We don't need T3 Code's full protocol manager because we don't need an interactive UI; the official `@openai/codex-sdk` wraps the same binary with a thread API (`new Codex()` → `startThread()` → `thread.run(prompt, { outputSchema })`) and reuses the CLI's login state from `CODEX_HOME/auth.json`. Structured JSON output is supported natively via `outputSchema` (JSON Schema, or Zod through `zod-to-json-schema` with target `"openAi"`), which is exactly what the specialist/draft nodes need.

**Two integration levels, both in scope:**

1. **Codex as a LangChain chat model** (`invoke`-only, no `bindTools`) — drop-in for existing `getResearchModel({ requiresToolBinding: false })` call paths.
2. **Codex as a specialist worker node** — hand a whole subtask (with its own sandboxed tool use) to a Codex thread and treat the final structured response as the node output. This is where subscription inference pays off most, and it sets up the plan-05 verification sandbox.

**Auth model:** `codex login` (browser OAuth) on a trusted machine writes `auth.json` under `CODEX_HOME` (default `~/.codex`). Codex refreshes tokens itself during use. For the headless Proxmox worker, OpenAI documents the trusted-runner pattern: seed `auth.json` once, persist the directory so refreshed tokens survive, never re-overwrite from the original secret, never commit or log it. Note OpenAI recommends API keys for generic CI/CD; the subscription path is explicitly supported for trusted private automation, which is what this is. Usage draws against the ChatGPT plan's agentic limits — hence mandatory fallback.

---

## Environment changes

Retire: `CODEX_APP_SERVER_URL`, `CODEX_APP_SERVER_AUTH_TOKEN`, `CODEX_APP_SERVER_MODEL`.

Add to `agent/.env.example`:

```
CODEX_ENABLED=true            # feature flag for the provider
CODEX_HOME=                   # optional; defaults to ~/.codex; worker mounts a volume here
CODEX_MODEL=                  # optional model override passed via SDK config
CODEX_SANDBOX_MODE=read-only  # read-only | workspace-write (plan 05 uses workspace-write)
CODEX_WORKDIR=/tmp/codex-scratch  # scratch workingDirectory for threads
```

---

## Task 1: Spike the SDK with subscription auth

**Objective:** Prove one structured-output call works with ChatGPT login and no API key before touching the adapter.

**Files:**
- Create: `agent/scripts/spike-codex-sdk.ts`
- Delete after Task 3 lands: `agent/scripts/spike-codex-app-server.ts`

**Steps:**

- [ ] `cd agent && npm install @openai/codex-sdk zod-to-json-schema` (agent workspace stays npm-managed).
- [ ] Ensure `codex` CLI is installed and `codex login` completed on the dev machine; confirm `OPENAI_API_KEY`/`CODEX_API_KEY` are unset so the SDK reuses login state.
- [ ] Spike script: `new Codex()`, `startThread({ workingDirectory: CODEX_WORKDIR, skipGitRepoCheck: true, sandboxMode: "read-only" })`, one `thread.run` with a small Zod-derived `outputSchema`, print parsed JSON, thread id, and usage from the result. Never print tokens or `auth.json` contents.
- [ ] Record in the script header: observed latency, usage shape, and which model the plan serves by default.
- [ ] Verify: `bun scripts/spike-codex-sdk.ts` (or `npx tsx`) succeeds twice — second run via `resumeThread` to confirm session persistence in `CODEX_HOME/sessions`.

## Task 2: Replace the adapter with a Codex SDK chat model

**Objective:** A `BaseChatModel` backed by the SDK for single-shot generation.

**Files:**
- Create: `agent/src/models/codexSdk.ts`
- Delete: `agent/src/models/codexAppServer.ts`
- Modify: `agent/src/models/index.ts`

**Steps:**

- [ ] Implement `CodexSdkChatModel extends BaseChatModel`:
  - Constructor lazily creates one `Codex` client per process; each `_generate` starts a fresh thread in `CODEX_WORKDIR` (stateless-model semantics) unless a `threadId` call option is passed.
  - Flatten LangChain messages into a single prompt: system messages become a preamble block, then alternating role-labeled turns. Keep the flattener as a pure exported function with unit tests.
  - `_llmType()` → `"codex_sdk"`. `bindTools` throws `"Codex SDK provider does not support LangChain tool binding; route tool-binding calls to OpenRouter"` (preserves existing `requiresToolBinding` contract).
  - Support `withStructuredOutput(zodSchema)` by converting via `zod-to-json-schema` (target `"openAi"`) into `thread.run(prompt, { outputSchema })` and parsing `turn.finalResponse`.
  - Map `turn.usage` into `llmOutput.usage`; include `threadId` in `llmOutput` for audit events.
  - Classify errors: auth (missing/expired login), quota/limit, and transient — as typed error subclasses so the provider layer can decide fallback.
- [ ] Update `agent/src/models/index.ts`: `getConfiguredModelProvider` keys off `CODEX_ENABLED === "true"` (+ binary availability check at first use) instead of `CODEX_APP_SERVER_URL`; provider name becomes `"codex-sdk"`.
- [ ] Verify: `cd agent && bunx tsc --noEmit && bun test` (fix `tests/codex-deep-agent.test.ts` env-var assertions).

## Task 3: Fallback chain and usage audit

**Objective:** No agent run ever fails solely because Codex is down or out of quota, and every Codex call is accounted for.

**Files:**
- Create: `agent/src/models/withFallback.ts`
- Modify: `agent/src/models/index.ts`
- Modify: `agent/src/graphs/research-pipeline/nodes.ts` (audit events)

**Steps:**

- [ ] `withFallback(primary, fallback)` returns a model whose `_generate` retries once on transient Codex errors, then falls back to OpenRouter on quota/auth errors, tagging `llmOutput.provider` with whichever answered.
- [ ] `getResearchModel({ requiresToolBinding: false })` returns `withFallback(codexSdk, openRouterAnthropic)` when `CODEX_ENABLED`; tool-binding calls keep returning OpenRouter directly.
- [ ] Append an `agentRunEvents` event per model call from graph nodes: provider used, model, usage, threadId if Codex. This is the quota audit trail called for in `00-master-sequence.md`.
- [ ] Verify: temporarily point `CODEX_HOME` at an empty dir and run `smoke-research-pipeline.ts` — the run must complete via fallback and record a fallback event.

## Task 4: LangSmith tracing for Codex calls

**Objective:** Codex won't auto-instrument like `@langchain/anthropic`; wrap it so traces stay complete.

**Files:**
- Modify: `agent/src/models/codexSdk.ts`

**Steps:**

- [ ] Wrap the `thread.run` invocation in `traceable` (name `codex_sdk.run`, metadata: model, sandboxMode, threadId, structured-output flag) guarded by `LANGSMITH_TRACING`.
- [ ] Attach usage to the trace so eval experiments can compare cost/latency across providers.
- [ ] Verify: run the spike with tracing on; confirm the run appears in `resonant-projects-agent-dev`.

## Task 5: Codex specialist worker node (foundation for plan 05)

**Objective:** A reusable node that delegates a full subtask to a Codex thread rather than using Codex as a bare completion model.

**Files:**
- Create: `agent/src/subagents/codexWorker.ts`
- Modify: `agent/src/graphs/research-pipeline/nodes.ts` (optional wiring behind a flag)

**Steps:**

- [ ] `runCodexTask({ instructions, context, outputSchema, sandboxMode, workdir })`: seeds a scratch workspace with context files (e.g. the candidate extraction as JSON), runs one thread turn with `outputSchema`, returns parsed output + thread id + usage. Default `sandboxMode: "read-only"`; `workspace-write` reserved for plan 05 verification.
- [ ] Store the thread id in `agentRunEvents` so long tasks can be resumed with `resumeThread` after worker restarts.
- [ ] Wire it as an alternative implementation of the research specialist behind `CODEX_SPECIALIST=true`, producing the same `ResearchPipelineDraft` shape through `sanitizeSpecialistDraft`.
- [ ] Verify: one real dry-run comparing OpenRouter specialist vs Codex specialist on the same candidate; append both drafts to the run's events for manual comparison.

## Task 6: Headless auth for the worker (executes with plan 04)

**Objective:** Subscription auth on the Proxmox worker without violating the never-bake-secrets rule.

**Files:**
- Modify: `agent/docker-compose.yml`, `agent/Dockerfile`, `docs/proxmox-agent-deployment.md`

**Steps:**

- [ ] Dockerfile: install the `codex` CLI binary in the image (binary is fine to bake; auth is not). Set `CODEX_HOME=/data/codex-home`.
- [ ] Compose: mount a persistent named volume at `/data/codex-home`. Document the seed procedure: run `codex login` on a trusted machine, copy `auth.json` into the volume **once, only if missing**; Codex refreshes it thereafter — re-seeding on every deploy would discard refreshed tokens.
- [ ] Ensure file-backed credential storage (`cli_auth_credentials_store = "file"`) in the container's Codex config, since no OS keyring exists there.
- [ ] Add a worker healthcheck that runs a 1-token Codex probe and reports auth status to `agentRunEvents` (or logs) without printing token material.
- [ ] Verify: worker container completes a research-pipeline run using subscription auth with no `OPENAI_API_KEY` present.

## Task 7: Docs and cleanup

**Steps:**

- [ ] Update `agent/README.md`, `agent/.env.example`, `docs/langsmith-runbook.md` (provider section), and `docs/agent-tool-surface.md` if event kinds changed.
- [ ] Decision-log entry: Codex SDK adopted as primary non-tool inference provider; rationale (subscription economics, verification-sandbox synergy); revisit triggers (quota pressure, SDK protocol changes, tool-binding support appearing).
- [ ] Remove all `CODEX_APP_SERVER_*` references repo-wide.

## Definition of Done

- [ ] Non-tool agent calls run on subscription auth by default and fall back cleanly.
- [ ] Tool-binding paths unchanged on OpenRouter.
- [ ] Every Codex call is traced and usage-audited.
- [ ] Worker-ready headless auth documented and smoke-tested.
