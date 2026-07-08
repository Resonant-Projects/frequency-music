# Task 2 Brief — Edit-capture hooks for extractions and weekly briefs (plan 05 Task 1 remainder)

## Where this fits

Repo: frequency-music — Convex backend (Bun workspace). Plan `docs/plans/2026-07-01-05-self-improvement-loop.md` Task 1 ("Capture human edits as dataset rows") is partially done: the `editCaptures` table exists in `convex/schema.ts` (~line 294), `convex/editCaptures.ts` provides `recordEditCapture` (with tests in `convex/editCaptures.test.ts`), the hypotheses edit mutation already hooks it (`convex/hypotheses.ts` imports `recordEditCapture`), and the export script `scripts/langsmith/export-edit-captures.ts` exists. What remains: the extraction and weekly-brief edit paths.

Plan text (verbatim): "Write a capture row inside the existing edit mutations whenever the row being edited has AI/agent origin (extraction edits via `editExtraction`, brief edits, hypothesis edits on agent-provenance rows)." Capture shape: `{ entityType, entityId, promptVersion?, model?, generated: any, edited: any, editedAt, exported?: boolean }`.

## Requirement A — extraction edit capture

`convex/extractions.ts` currently has NO edit mutation (only queries: `get`, `getByInputHash`, `getBySourceId`, `listRecent`) — the plan assumed `editExtraction` exists; it does not. Create an `editExtraction` mutation in `convex/extractions.ts`:
- Model its argument validation, auth handling, and patch behavior on the existing hypotheses edit mutation in `convex/hypotheses.ts` — read that file first and mirror its structure, including how it decides AI/agent origin and how it calls `recordEditCapture`.
- Extractions are produced by the AI pipeline (they carry model/prompt metadata) — capture on every edit of such rows, recording the pre-edit content as `generated` and the incoming content as `edited`, with `promptVersion`/`model` from the extraction row when present.
- Decide which extraction fields are human-editable by looking at what the extraction row stores (claims/parameters/topics etc. — check the schema table definition); the edit mutation should accept those content fields, not status bookkeeping.

## Requirement B — weekly-brief edit capture

`convex/weeklyBriefs.ts` has no dedicated edit mutation either. Find where human-edited brief content is persisted — inspect `publish` (~line 128) and any mutation that accepts edited markdown/content. Hook `recordEditCapture` at the point where a human saves content that differs from the AI-generated content, with `generated` = the stored AI content before the edit and `edited` = the incoming content. If no existing mutation accepts edited content (i.e., briefs are published verbatim with no edit path), create an `editBrief` mutation following the same pattern as Requirement A instead of contorting `publish`. Only capture when the row has AI/agent origin and content actually changed.

## Repo conventions (binding)

- **Two `ctx.db` conventions coexist:** `hypotheses.ts`/`recipes.ts`/`weeklyBriefs.ts` use two-arg `ctx.db.get("table", id)` / `patch("table", id, ...)`; `agentDrafts.ts`/`agentRuns.ts` use single-arg. Match the file you are editing.
- Adding a field to a table requires mirroring it in the matching `convex/validators.ts` return validator, or `returns:`-validated queries fail at runtime. (You should not need schema changes — `editCaptures` exists.)
- Mutations cannot `ctx.runMutation`; inline via shared pure helpers (that is what `recordEditCapture` is).
- No convex-test harness: `convex/*.test.ts` are plain `bun:test` over exported pure helpers. Extract decision logic (should-capture? diff detection? field selection) into pure exported functions and test those, following `convex/editCaptures.test.ts` style.
- CLI mutations use the Clerk auth bypass pattern (`devBypassSecret` arg) — mirror whatever the hypotheses edit mutation does for auth.

## Hard scope boundary

May modify: `convex/extractions.ts`, `convex/weeklyBriefs.ts`, `convex/editCaptures.ts` (only if a shared helper genuinely needs extending), `convex/validators.ts` (only if mirroring requires), and convex test files. Nothing else. No schema changes. Do not touch `agent/` or `web/`.

## Verification gates (all must pass)

1. From repo root: `bunx convex codegen` succeeds (this typechecks AND pushes to the live self-hosted dev deployment — additive changes only, never leave it broken; root `bunx tsc --noEmit` is NOT the convex gate)
2. `bun test convex scripts` — baseline 116 pass (plus Task-1's additions already on the branch), plus your new tests, 0 fail
3. New pure-helper tests cover: capture fires on AI-origin edit with content change; no capture when content unchanged; no capture on non-AI rows (if such rows exist for the entity)

The plan's live verification ("edit a generated brief in dev; capture row exists; export script emits it once") requires driving the dev app — SKIP it; it will be listed as manual follow-up for Keith.

## Process

Work in the worktree at `/Users/kelliott/code/frequency-music/.claude/worktrees/master-sequence-remainder` (branch `worktree-master-sequence-remainder`; do NOT touch main, never push). Root `.env.local` is present for codegen. Use TDD where practical. Match surrounding code style. Commit with a clear message ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
