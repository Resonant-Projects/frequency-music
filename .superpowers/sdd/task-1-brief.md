# Task 1 Brief — Complete plan-01 remainders in research-pipeline nodes

## Where this fits

Repo: frequency-music — research-to-composition pipeline. Convex backend (root workspace, Bun) + LangGraph agent workspace (`agent/`, npm-managed, run with bun/bunx). Plan `docs/plans/2026-07-01-01-codex-sdk-inference-provider.md` is fully implemented EXCEPT two marked TODOs in `agent/src/graphs/research-pipeline/nodes.ts`. Your job is exactly those two TODOs — nothing else from the plan.

The Codex SDK provider already exists and works:
- `agent/src/models/codexSdk.ts` — `CodexSdkChatModel` (BaseChatModel; `llmOutput` carries `usage`, `threadId`, provider info)
- `agent/src/models/withFallback.ts` — fallback wrapper tagging `llmOutput.provider` with whichever provider answered
- `agent/src/subagents/codexWorker.ts` — `runCodexTask({ instructions, context, outputSchema, sandboxMode, workdir })` returning parsed output + thread id + usage

## Requirement A (plan 01 Task 3, remaining step) — per-model-call audit events

Plan text (verbatim): "Append an `agentRunEvents` event per model call from graph nodes: provider used, model, usage, threadId if Codex. This is the quota audit trail called for in `00-master-sequence.md`."

The TODO is at `agent/src/graphs/research-pipeline/nodes.ts:419`:
```
// TODO(plan-01 T3): append a per-model-call agentRunEvents event capturing
```
Read the surrounding code — nodes already append other event kinds to the run's events (look at how existing events are appended in this file and `agent/src/tools/convexTools.ts`). Follow that existing mechanism exactly. Pull provider/model/usage/threadId from the model result's `llmOutput` (populated by codexSdk/withFallback).

IMPORTANT constraint: the Convex HTTP agent-tool surface validates event `kind` values. If you introduce a new event kind, you MUST add it to the allowed kinds everywhere they are validated on the Convex side (search `convex/` for the existing event-kind union — check `convex/agentRuns.ts`, `convex/http.ts` or `convex/agentTools*.ts`, `convex/schema.ts`, and `convex/validators.ts`). A prior wave shipped an event kind the HTTP surface rejected at runtime — do not repeat that. Convex gotchas:
- Adding a field/kind requires mirroring it in the matching `convex/validators.ts` return validator or `returns:`-validated queries fail at runtime.
- Convex type gate is `bunx convex codegen` (run from repo root; it typechecks AND pushes functions to the live self-hosted dev deployment — additive changes only, never leave it broken). Root `bunx tsc --noEmit` is NOT the convex gate.
- Convex tests are plain `bun:test` over exported pure helpers (no convex-test harness). Keep logic you want tested in pure functions.

## Requirement B (plan 01 Task 5, remaining step) — CODEX_SPECIALIST wiring

Plan text (verbatim): "Wire it [runCodexTask] as an alternative implementation of the research specialist behind `CODEX_SPECIALIST=true`, producing the same `ResearchPipelineDraft` shape through `sanitizeSpecialistDraft`." Also from the same task: "Store the thread id in `agentRunEvents` so long tasks can be resumed with `resumeThread` after worker restarts."

The TODO is at `agent/src/graphs/research-pipeline/nodes.ts:372`:
```
// TODO(plan-01 T5): behind CODEX_SPECIALIST==="true", route this specialist
```
Read the existing specialist implementation in this file and produce the Codex-path alternative: when `process.env.CODEX_SPECIALIST === "true"`, delegate the specialist subtask to `runCodexTask` from `agent/src/subagents/codexWorker.ts` (default read-only sandbox), passing the same context the OpenRouter specialist receives, with an outputSchema matching the specialist draft, and pass the parsed result through the existing `sanitizeSpecialistDraft` so the node output shape is identical. On Codex failure, fall back to the existing OpenRouter specialist path (never fail the run solely because Codex is down — that is the plan's standing rule). Record the codex thread id via the Requirement A event.

Also add `CODEX_SPECIALIST=` (default off) to `agent/.env.example` with a one-line comment.

## Environment note for verification

Root `.env.local` exists in the worktree (OPENROUTER key etc.). Local Codex CLI auth exists at `~/.codex/auth.json`. The plan's "one real dry-run comparing OpenRouter specialist vs Codex specialist" verification requires live model runs — SKIP live runs; this wave verifies via typecheck + unit tests. Instead, unit-test the routing decision (flag on → codex path chosen; codex error → fallback used) with mocked `runCodexTask`, following the existing test style in `agent/tests/` or `agent/src/**/*.test.ts`.

## Hard scope boundary

May modify: `agent/src/graphs/research-pipeline/nodes.ts`, `agent/src/subagents/codexWorker.ts` (only if a small signature addition is genuinely needed), `agent/.env.example`, agent test files, and the narrow Convex event-kind union + validators described in Requirement A. Nothing else. Do not refactor unrelated code. Do not touch `web/`.

## Verification gates (all must pass)

1. `cd agent && bunx tsc --noEmit` — clean
2. `cd agent && bun test` — baseline 61 pass, plus your new tests, 0 fail
3. If convex files touched: from repo root `bunx convex codegen` succeeds, and `bun test convex scripts` — baseline 116 pass, 0 fail
4. Both TODO comments removed (replaced by the implementations)

## Process

Work in the worktree at `/Users/kelliott/code/frequency-music/.claude/worktrees/master-sequence-remainder` (branch `worktree-master-sequence-remainder`). Use TDD where practical. Match surrounding code style; comment only what code can't say. Commit your work with a clear message (end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`). NEVER push, never merge, never touch main.
