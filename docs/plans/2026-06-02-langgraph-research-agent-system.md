# LangGraph Research Agent System Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a full LangGraph/LangChain agent system that can run the Frequency Music research-to-composition workflow outside Convex, while keeping Convex as the source-of-truth database and control plane.

**Architecture:** Keep Convex responsible for durable data, auth, user-visible state, and simple scheduling. Move exploratory orchestration, candidate selection, critique, synthesis, and long-running agent loops into `agent/` as LangGraph graphs. The first production graph should be a research pipeline graph that reads from Convex, plans work, invokes specialized deep-agent/subagent stages, and writes approved outputs back through narrow Convex mutation tools.

**Tech Stack:** Bun for repository scripts, LangGraph JS + LangChain in `agent/`, DeepAgents for planner/subagent behavior, Codex App Server or locally authenticated Codex-compatible API for the primary deep-agent model, Convex HTTP actions for tool access, LangSmith for traces/evals, and Proxmox-hosted containers for always-on graph workers.

---

## Current State Observed

- `agent/` already exists and has LangGraph JS dependencies plus `deepagents`.
- `agent/langgraph.json` exposes one graph: `weekly-brief` at `./src/agents/weekly-brief/index.ts:agent`.
- `agent/src/agents/weekly-brief/index.ts` currently creates a `createDeepAgent` using `ChatAnthropic`, routed through OpenRouter when `OPENROUTER_API_KEY` exists.
- `agent/src/tools/convexTools.ts` exposes read-only LangChain tools backed by `/agent-tools/*` HTTP routes.
- `docs/agent-tool-surface.md` explicitly says write tools are deferred until human-in-the-loop design is approved.
- `convex/workflows.ts` currently owns extraction, hypothesis, and full-pipeline orchestration via `@convex-dev/workflow`.
- `convex/crons.ts` schedules feed polling, batch extraction, and weekly brief generation.

## Target Shape

### Principle 1: Convex remains the database/control plane

Convex should keep:

- Tables and indexes.
- Source ingestion state.
- Auth and `AGENT_TOOL_SECRET` gatekeeping.
- Small deterministic mutations.
- User-facing status and audit records.
- Simple cron triggers that enqueue or wake external workers.

### Principle 2: LangGraph owns reasoning-heavy orchestration

LangGraph should own:

- Selecting promising sources/extractions.
- Deciding whether to extract, hypothesize, recipe-generate, critique, retry, or archive.
- Multi-step agent loops.
- Specialized research/contradiction/music-production/quality subagents.
- Conditional branches and recovery.
- Traceable agent runs through LangSmith.

### Principle 3: Writes must be narrow, typed, and auditable

Do not expose broad table writes to agents. Add command-style tools such as:

- `createHypothesisDraft`
- `createRecipeDraft`
- `recordAgentRun`
- `appendAgentRunEvent`
- `proposeSourceStatusChange`
- `archiveLowYieldPath`
- `requestHumanReview`

Each write should create draft/proposed rows or agent-run event rows first. Human approval can promote drafts later.

---

## Proposed Graphs

### 1. `research-pipeline`

Purpose: externalize the current Convex-heavy extract → hypothesize → recipe workflow.

Nodes:

1. `load_scope`
   - Reads active theses, recent extractions, recent hypotheses, failure archive, recommended actions.
2. `select_candidates`
   - Chooses sources/extractions worth acting on.
3. `route_candidate`
   - Decides `extract`, `hypothesize`, `recipe`, `critique`, `archive`, or `stop`.
4. `research_agent`
   - Deep-agent/subagent analysis of claims, evidence, music stake, and source fit.
5. `contradiction_agent`
   - Checks against failure archive and low-yield editorial signals.
6. `composition_agent`
   - Turns a candidate hypothesis into studio-actionable recipe parameters.
7. `quality_gate`
   - Validates schema, evidence links, source IDs, and musical usefulness.
8. `write_draft`
   - Calls narrow Convex write tool(s) to store draft outputs and audit events.
9. `finalize_run`
   - Records summary, links trace URL, and returns next recommended action.

### 2. `weekly-brief-v2`

Purpose: replace or evolve the existing `weekly-brief` deep-agent into a graph with typed state and deterministic gates.

Nodes:

1. `load_week_context`
2. `generate_candidate_cards`
3. `critique_cards`
4. `strengthen_studio_prompts`
5. `validate_output_schema`
6. `write_weekly_brief_draft`

### 3. `source-intake-triage`

Purpose: evaluate ingested/fetched sources before expensive extraction.

Nodes:

1. `load_new_sources`
2. `classify_domain`
3. `score_relevance`
4. `detect_duplicate_or_low_value`
5. `propose_status_update`

---

## Codex App Server Integration Strategy

This should be built as a model adapter, not scattered through graph code.

Create a provider module under `agent/src/models/` that exports the model used by graphs:

- `getSupervisorModel()`
- `getResearchModel()`
- `getCritiqueModel()`
- `getFastModel()`

The provider should choose, in order:

1. Codex App Server endpoint and local auth/session token when configured.
2. OpenRouter fallback for Anthropic-compatible models.
3. Anthropic direct fallback only if configured.

Expected environment variables:

- `CODEX_APP_SERVER_URL`
- `CODEX_APP_SERVER_AUTH_TOKEN` or equivalent locally authed token path
- `CODEX_APP_SERVER_MODEL`
- `OPENROUTER_API_KEY`
- `LANGSMITH_API_KEY`
- `CONVEX_SITE_URL`
- `AGENT_TOOL_SECRET`

Implementation note: confirm the Codex App Server protocol before coding the adapter. If it exposes an OpenAI-compatible `/v1/chat/completions`, use `@langchain/openai` `ChatOpenAI` with `configuration.baseURL`. If not, implement a small `BaseChatModel` wrapper in `agent/src/models/codexAppServer.ts`.

---

## Proxmox Deployment Shape

Run `agent/` as a small containerized worker stack:

- `langgraph-dev` for local graph iteration.
- `langgraph-worker` for production graph serving/execution.
- Optional `agent-runner` cron/queue consumer that polls Convex for pending agent runs.

Recommended container approach:

- Base image: `oven/bun` or a small Node image with Bun installed.
- Mount only `.env`/secrets needed by the agent container.
- Do not copy local Codex tokens into images. Mount token/session files as runtime secrets/volumes.
- Emit LangSmith traces and Convex `agentRuns` events for auditability.

---

## Data Model Additions

Add these Convex tables before exposing write tools:

### `agentRuns`

Fields:

- `graphName: string`
- `status: "queued" | "running" | "needs_review" | "completed" | "failed" | "cancelled"`
- `input: any`
- `summary?: string`
- `traceUrl?: string`
- `startedAt?: number`
- `finishedAt?: number`
- `createdAt: number`
- `updatedAt: number`

Indexes:

- `by_status_updatedAt`
- `by_graphName_updatedAt`

### `agentRunEvents`

Fields:

- `runId: Id<"agentRuns">`
- `kind: "tool_call" | "decision" | "draft_write" | "error" | "review_request"`
- `message: string`
- `payload?: any`
- `createdAt: number`

Indexes:

- `by_runId_createdAt`

### Draft/proposal rows

Prefer adding status fields to existing domain tables if they already support drafts. Otherwise add proposal tables:

- `hypothesisDrafts`
- `recipeDrafts`
- `sourceStatusProposals`

---

## Implementation Tasks

### Task 1: Add agent shared state types

**Objective:** Create a typed state contract for LangGraph research runs.

**Files:**
- Create: `agent/src/state/researchPipelineState.ts`

**Steps:**

1. Create `ResearchPipelineState` with fields for run id, active theses, extractions, hypotheses, recipes, failure archive, selected candidate, draft output, errors, and audit events.
2. Export small TypeScript types for candidate route names.
3. Keep the state serializable; no class instances in state.
4. Verify with `cd agent && bunx tsc --noEmit`.

### Task 2: Centralize model provider selection

**Objective:** Move model construction out of graph files so Codex App Server can become the primary provider cleanly.

**Files:**
- Create: `agent/src/models/index.ts`
- Create: `agent/src/models/openRouterAnthropic.ts`
- Create: `agent/src/models/codexAppServer.ts`
- Modify: `agent/src/agents/weekly-brief/index.ts`

**Steps:**

1. Extract existing OpenRouter/Anthropic normalization from `weekly-brief/index.ts` into `openRouterAnthropic.ts`.
2. Add `codexAppServer.ts` with a placeholder adapter that throws a clear error if `CODEX_APP_SERVER_URL` exists but protocol support has not been confirmed.
3. Export `getResearchModel()` from `models/index.ts`.
4. Update weekly brief to call `getResearchModel({ temperature: 0.2 })`.
5. Verify with `cd agent && bunx tsc --noEmit`.

### Task 3: Add Convex agent run tables

**Objective:** Add durable run/event tracking before agent write tools exist.

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/agentRuns.ts`
- Add tests if existing Convex tests show a schema/mutation pattern.

**Steps:**

1. Add `agentRuns` and `agentRunEvents` table definitions.
2. Implement mutations: `create`, `markRunning`, `appendEvent`, `markNeedsReview`, `markCompleted`, `markFailed`.
3. Require normal auth or dev bypass for mutations.
4. Add query helpers: `get`, `listByStatus`, `listEvents`.
5. Verify with `bun test convex/*.test.ts`.

### Task 4: Add read tools for graph context completeness

**Objective:** Give LangGraph enough state to avoid making broad assumptions.

**Files:**
- Modify: `convex/agentTools.ts`
- Modify: `convex/agentToolsHttp.ts`
- Modify: `convex/http.ts` if route registration requires additions
- Modify: `agent/src/tools/convexTools.ts`
- Modify: `docs/agent-tool-surface.md`

**Candidate tools:**

- `listSourcesByStatus(status, limit)`
- `getSource(id)` without raw text by default
- `listPendingAgentRuns(limit)`
- `getAgentRun(id)`

**Steps:**

1. Add one tool at a time.
2. Keep raw text omitted unless the graph explicitly asks for a single source body.
3. Update docs immediately for every tool.
4. Verify with `bun test convex/*.test.ts` and `cd agent && bunx tsc --noEmit`.

### Task 5: Add narrow write tools for run events only

**Objective:** Let external graphs record their own audit trail without mutating research data yet.

**Files:**
- Modify: `convex/agentTools.ts`
- Modify: `convex/agentToolsHttp.ts`
- Modify: `agent/src/tools/convexTools.ts`
- Modify: `docs/agent-tool-surface.md`

**Tools:**

- `createAgentRun`
- `appendAgentRunEvent`
- `markAgentRunCompleted`
- `markAgentRunFailed`

**Steps:**

1. Gate all tools with `AGENT_TOOL_SECRET`.
2. Validate graph names against an allowlist.
3. Require event kind and message.
4. Return IDs and timestamps only.
5. Verify with tests and a local HTTP call against Convex dev/prod as appropriate.

### Task 6: Build `research-pipeline` graph skeleton

**Objective:** Add a LangGraph that can load context, select a candidate, route it, and produce a dry-run summary.

**Files:**
- Create: `agent/src/graphs/research-pipeline/index.ts`
- Create: `agent/src/graphs/research-pipeline/nodes.ts`
- Create: `agent/src/graphs/research-pipeline/prompts.ts`
- Modify: `agent/langgraph.json`

**Steps:**

1. Define graph nodes: `load_scope`, `select_candidates`, `route_candidate`, `finalize_run`.
2. Use existing read-only Convex tools.
3. Make first version dry-run only; no research data writes.
4. Register graph as `research-pipeline` in `agent/langgraph.json`.
5. Verify with `cd agent && bun run build`.

### Task 7: Add deep-agent specialist nodes

**Objective:** Move weekly-brief-style subagent behavior into reusable specialist modules.

**Files:**
- Create: `agent/src/subagents/research.ts`
- Create: `agent/src/subagents/contradiction.ts`
- Create: `agent/src/subagents/composition.ts`
- Create: `agent/src/subagents/qualityGate.ts`
- Modify: `agent/src/graphs/research-pipeline/nodes.ts`

**Steps:**

1. Reuse existing prompts where appropriate.
2. Make every specialist return structured JSON compatible with Zod schemas.
3. Add quality gate checks for source IDs, evidence levels, failure archive overlap, and concrete studio actionability.
4. Verify with `cd agent && bunx tsc --noEmit` and a sample graph run.

### Task 8: Add draft-write tools after review design

**Objective:** Let graph output become Convex drafts without directly publishing final research artifacts.

**Files:**
- Modify/add Convex draft table files based on schema choice.
- Modify: `convex/agentTools.ts`
- Modify: `agent/src/tools/convexTools.ts`
- Modify: `docs/agent-tool-surface.md`

**Tools:**

- `createHypothesisDraft`
- `createRecipeDraft`
- `requestHumanReview`

**Steps:**

1. Require `agentRunId` for every draft write.
2. Require source/extraction/hypothesis IDs where relevant.
3. Store raw agent rationale and normalized structured fields.
4. Mark run as `needs_review`, not `completed`, when drafts are created.
5. Verify drafts are visible in Convex queries/UI before adding automation.

### Task 9: Containerize the agent

**Objective:** Prepare the LangGraph worker for Proxmox-hosted deployment.

**Files:**
- Create: `agent/Dockerfile`
- Create: `agent/docker-compose.yml` or root-level deployment file
- Create: `agent/.env.example`
- Modify: docs as needed

**Steps:**

1. Use Bun-compatible image.
2. Install dependencies from `agent/package.json`.
3. Run `bun run build` during image build.
4. Runtime command should start LangGraph server/worker according to LangGraph JS deployment mode.
5. Mount secrets at runtime, not image build time.
6. Verify locally before Proxmox deployment.

### Task 10: Shift one Convex workflow responsibility to LangGraph

**Objective:** Prove the migration safely with one low-risk workflow.

**Recommended first migration:** weekly brief draft generation.

**Steps:**

1. Keep existing Convex weekly brief cron disabled only after the new graph produces comparable drafts.
2. Run both systems in parallel for one or two cycles.
3. Compare output quality with LangSmith evals and manual review.
4. Only then remove or reduce Convex-side generation logic.

---

## First Spike Before Implementation

Before writing the Codex App Server adapter, confirm:

1. The exact local endpoint URL.
2. Whether it is OpenAI-compatible.
3. How local auth/session token should be passed.
4. Whether streaming is supported.
5. Whether tool calls are native, OpenAI-style, or unsupported.

A minimal spike script should live at:

- `agent/scripts/spike-codex-app-server.ts`

It should:

- Read endpoint/token from env.
- Send one small chat request.
- Print model response and raw metadata.
- Never print the token.

---

## Verification Commands

Run these after implementation tasks:

```bash
bun test convex/*.test.ts
cd agent && bunx tsc --noEmit
cd agent && bun run build
```

If a graph has a local dev runner available:

```bash
cd agent && bun run dev
```

Then invoke `research-pipeline` with a dry-run input through LangGraph Studio/API.

---

## Implementation Progress

Completed initial implementation pass:

- Added `agent/src/state/researchPipelineState.ts` with typed serializable graph state.
- Added centralized model provider modules under `agent/src/models/`.
- Updated `weekly-brief` to use `getResearchModel({ requiresToolBinding: true })`.
- Added `agent/scripts/spike-codex-app-server.ts` for a secret-safe OpenAI-compatible Codex App Server connectivity test.
- Added dry-run `research-pipeline` graph under `agent/src/graphs/research-pipeline/`.
- Registered `research-pipeline` in `agent/langgraph.json`.
- Added `agent/.env.example`, `agent/README.md`, and `docs/proxmox-agent-deployment.md`.

Still intentionally deferred before this next phase:

- Convex `agentRuns` / `agentRunEvents` tables.
- Agent write tools.
- Draft hypothesis/recipe writes.
- Proxmox container deployment.

## Current Parallel Implementation Phase

OrbStack is now installed and `cd agent && bun run build` succeeds locally, producing `resonant-projects-agent:local`. The next phase should proceed on two parallel paths that converge before draft writes are enabled.

### Path A: Audit/control plane first

Objective: make every LangGraph execution durable, inspectable, and safe before agents can mutate research data.

Immediate work:

1. Add Convex `agentRuns` and `agentRunEvents` tables.
2. Add narrow Convex mutations/queries for run lifecycle and events.
3. Expose only audit write tools through `/agent-tools/*`:
   - `createAgentRun`
   - `appendAgentRunEvent`
   - `markAgentRunCompleted`
   - `markAgentRunFailed`
4. Wire `research-pipeline` graph nodes to record run lifecycle events.
5. Update `docs/agent-tool-surface.md` with the new audit-only write surface.

Non-goals for this path:

- Do not create hypothesis/recipe/source mutation tools yet.
- Do not let the graph publish or promote research artifacts.
- Do not expose generic Convex writes.

Verification:

```bash
cd agent && bunx tsc --noEmit
cd agent && bun run build
```

Run Convex tests/codegen when the local Convex test pattern is confirmed.

### Path B: Build/smoke/deploy automation

Objective: turn the now-working local Docker build into a repeatable, secret-safe automation path.

Immediate work:

1. Add a local automation script, e.g. `agent/scripts/build-and-smoke.ts`, that runs:
   - TypeScript check.
   - LangGraph Docker build.
   - Optional Proxmox API smoke test when enabled.
2. Add package scripts for repeatable commands:
   - `verify`
   - `build`
   - `smoke:proxmox`
   - `automation:local`
3. Keep Proxmox token values in environment/runtime secrets only. Never print them.
4. Document the local automation flow in `agent/README.md` and `docs/proxmox-agent-deployment.md`.

Non-goals for this path until Path A lands:

- Do not auto-deploy a continuously running Proxmox worker yet.
- Do not wire unattended production cron triggers yet.
- Do not copy Codex local session tokens into images.

Verification:

```bash
cd agent && bun run automation:local
```

### Convergence gate

Before draft-producing tools are implemented, both paths must be true:

- A graph run can create/update an `agentRun` and append node/event decisions.
- The local build/smoke automation succeeds without printing secrets.
- Documentation describes exactly which tools are audit-only and which research-data writes remain deferred.

Only after this gate should the project implement:

1. `createHypothesisDraft`
2. `createRecipeDraft`
3. `requestHumanReview`
4. Proxmox-hosted always-on worker deployment

## Recommended Starting Point

Continue from the committed skeleton by implementing the two paths above in parallel. The safest production sequence remains:

1. Agent run audit tables.
2. Audit-only run/event tools.
3. Graph lifecycle event wiring.
4. Local verify/build/smoke automation.
5. Draft write tools.
6. Proxmox-hosted always-on deployment.

This gives you a working LangGraph system quickly without prematurely letting an autonomous agent mutate research data.
