# 00 — Master Sequence: Architecture Deepening Wave

> **For agentic workers:** This is the index and sequencing contract for plans 2026-07-03-01 through 07. Do not implement from this file; implement from the numbered plans, in gate order. Each numbered plan requires the superpowers:subagent-driven-development or superpowers:executing-plans sub-skill.

**Goal:** Turn the seven confirmed friction clusters from the 2026-07-02 architecture review into deep modules: one dedupe contract for source intake, single-sourced shapes, one LLM-call module behind the four generators, a validator-enforcing test harness at the ctx seam, a registry for the agent-tool surface with zod-first cross-seam contracts, a deep ingest lib with manifest scripts, and deletion of web's shallow function-name table.

**Decisions already made (do not reopen — recorded in `docs/decision-log.md` 2026-07-03):** convex-test harness (bun spike, scoped-vitest fallback) · zod-first via `convex-helpers/server/zod4` for cross-seam shapes, schema-canonical for internal shapes · archive one-shot scripts, never delete · archive-don't-delete for duplicate source rows · tracing stays best-effort (2026-05-16) · Gate G2 pure promotion builders unchanged (2026-07-01).

**Vocabulary:** architecture terms per the codebase-design glossary (module / interface / seam / adapter / depth / leverage / locality); domain terms per `CONTEXT.md` (Source Intake, Dedupe Key, Generator, Cross-Seam Contract, …).

---

## Plans

| # | Plan | Deepening | Fixes live bug |
|---|------|-----------|----------------|
| 01 | `2026-07-03-01-arch-dedupe-contract.md` | `sourceUtils` becomes the only dedupe-key producer; key backfill migration | Duplicate sources across cron vs HTTP intake |
| 02 | `2026-07-03-02-arch-single-source-shapes.md` | Status unions + sub-object validators defined once in `convex/shared/statuses.ts` / `schema.ts` | `recipes.create` rejecting generated parameters (`kind`); admin status dropdown drift |
| 03 | `2026-07-03-03-arch-llm-module.md` | `convex/llm.ts` (pure) + `convex/llmNode.ts` behind all four generators | groq/* misrouting in 3 of 4 generators |
| 04 | `2026-07-03-04-arch-convex-test-harness.md` | convex-test harness at the ctx seam + contract tests | `memory_recall` event-kind drift (task 6a) |
| 05 | `2026-07-03-05-arch-agent-tool-registry.md` | One registry for 17 tools; zod-first draft payloads; shared agent contract | Dead `claimNextPendingRun` tool; heartbeat<stale invariant unexpressed |
| 06 | `2026-07-03-06-arch-ingest-script-lib.md` | `scripts/lib/` ingestor; recurring scripts → manifests; one-shots archived | Five incompatible env-precedence variants; 3 hardcoded prod URLs |
| 07 | `2026-07-03-07-arch-delete-web-api-table.md` | Delete `web/src/integrations/convex/api.ts`; wrappers use `_generated/api` | 93 unchecked string function refs |

---

## Execution order and dependency graph

```
01 dedupe hotfix ──────────────────────────────► (first: live data-integrity bug)
02 single-source shapes ───────┬───────────────► (second: fixes recipe generation)
03 llm module                  │  (independent — may run parallel to 02)
04 harness ◄── task 2 needs 02 ┤
05 registry ◄── protected by 04's agentRuns/agentDrafts harness tests
06 ingest lib ◄── hard prereq 02 (imports SourceStatus from convex/shared/statuses)
07 delete web api table         (independent — any time)
```

Recommended serial order: **01 → 02 → 03 → 04 → 05 → 06 → 07.**
Safe to parallelize (separate sessions/worktrees): 03 and 07 at any point; 06 any time after 02.

Rationale for 04 before 05: plan 05 is the largest refactor and touches `agentRuns`/`agentDrafts`/`agentTools`; plan 04's harness tests for exactly those modules are the safety net under it.

---

## Seam handoffs (read before executing 04, 05, or 06)

Plans were authored against the 2026-07-03 codebase. Where one plan edits code another plan also touches, the later executor will find code that differs from the plan's quoted "before" state. These are the known handoffs — adapt the edit to the found state; the "after" state is what's binding:

1. **Event-kind union in `agentTools.ts` (04 → 05).** Plan 04 task 6a replaces the inline 7-value union with an import of `agentRunEventKindValidator` from `schema.ts` (the `memory_recall` fix). Plan 05 task 2 then moves the source of truth to `convex/shared/agentContract.ts`. When 05 runs after 04, its "before" quote (inline union) won't match — re-point the 04-era import instead. Both end states agree: one source of truth, 8 kinds.
2. **Recipe protocol validator (02 → 05).** Plan 02 renames `agentDraftRecipeProtocolValidator` → `recipeProtocolValidator` and unifies the 4 protocol copies onto it. Plan 05 task 4 (written against the old name) derives `recipeProtocolZ` via zod. When 05 runs after 02, set `recipeProtocolValidator = zodToConvex(recipeProtocolZ)` in `schema.ts` so 02's unification survives — do not reintroduce a second protocol copy.
3. **Heartbeat/stale contract test (05 → 04).** Plan 04 task 6b lands as `test.todo` because `convex/shared/agentContract.ts` doesn't exist yet. After 05 task 1, flip it to a real test importing `HEARTBEAT_INTERVAL_MS` and `STALE_RUN_MS`.
4. **`SourceStatus` import in `scripts/lib/ingest.ts` (02 → 06).** Hard prerequisite; 06's header declares it. Do not start 06 before 02 is merged.

---

## Gates

Every plan's tasks self-gate, but these are the wave-level checkpoints:

- **After 01:** `bunx convex run ingest:pollAllFeeds` twice produces zero new duplicate rows; `bun run scripts/find-dupes.ts` reports no key-format dupes.
- **After 02:** `bunx convex run recipes:generateBatch '{"limit": 1, ...}'` succeeds end-to-end (the `kind` fix is proven live, not just in tests).
- **After 03:** all four generators run with an explicit `groq/*` model id without misrouting; `grep -rn "createOpenRouter" convex/ --include="*.ts"` hits only `llmNode.ts`.
- **After 04:** `bun run test:harness` green (or the vitest fallback documented as taken, in the plan's NO-GO branch).
- **After 05:** the adding-a-tool drill (plan 05 task 10) — one registry row + one one-liner export, everything else derived; `cd agent && bunx tsc --noEmit` and agent tests green.
- **After 06:** `bun run scripts/ingest-manifest.ts data/example-manifest.json` dry-runs clean; archived scripts byte-identical (`git diff --stat` shows renames only).
- **After 07:** `bun run typecheck:web` green; `grep -r "integrations/convex/api" web/src` returns nothing.

Standing constraint for every plan: **`bunx convex codegen` deploys to the live self-hosted backend and is the Convex typegate** — sequence commits so no broken intermediate state is ever pushed, especially while `convex dev` may be running.

---

## Out of scope for this wave (noted in the review, not carded)

- Run-lifecycle `TERMINAL_STATUS_OWNER` deeper redesign (05 centralizes the constants; ownership model itself unchanged).
- `aggregates.ts` orphan (delete-or-wire decision not yet made).
- God-file decompositions: `scripts/synthesize-from-convex.ts` (2,020 lines), `web/src/routes/zodiac-3d.tsx` (1,326 lines).
- `researchPipelineState.ts` TS interfaces deriving from shared zod schemas (flagged in 05 as a follow-up).
- Provider-label leak (`nodes.ts:419` TODO — configured vs answering provider).
