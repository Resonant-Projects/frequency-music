# Task 3 Brief — Weekly self-improvement report section (plan 05 Task 5)

## Where this fits

Repo: frequency-music. The weekly brief has two generation paths: the deterministic Convex path (`convex/weeklyBriefs.ts` `generate`/`generateInternal`, context assembled by `loadBriefContext`) and the agent path (`agent/src/agents/weekly-brief/` — `index.ts`, `prompts.ts`, `schema.ts`, registered in `agent/langgraph.json`). This task extends the **agent path** brief.

Plan text (verbatim, `docs/plans/2026-07-01-05-self-improvement-loop.md` Task 5): "Extend the weekly brief context (agent path) with: new edit-captures count, draft approve/reject ratio with common rejection themes, memory recalls that changed decisions, and any prompt promotions — one short 'what the system learned' section in the brief."

## Requirements

1. **Data plumbing.** The agent reads Convex through the secret-guarded read-only agent-tool surface (`agent/src/tools/convexTools.ts` ↔ `convex/agentTools.ts` / `agentToolsHttp.ts` — read `docs/agent-tool-surface.md` first). Add whatever narrow read-only capability is needed to fetch, for the brief's date window:
   - count of new `editCaptures` rows (table exists in `convex/schema.ts` ~line 294, index `by_exported_editedAt`)
   - `agentReviewDrafts` approve/reject counts and the rejection notes (see `convex/agentDrafts.ts` — drafts carry status and review notes)
   - `agentRunEvents` rows of kind `memory_recall` (the memory store itself is deferred to a later gate, so this will usually be empty — the section must degrade gracefully to omitting that line, not error)
   - prompt promotions: there is no queryable store for these yet (promotions live in `docs/eval-baselines.md` + decision log via `scripts/langsmith/promote.ts`). Do NOT build one. Omit the line when there is nothing to report, and note in a code comment that promotions become reportable once they land somewhere queryable.
   Follow the existing patterns for tools/endpoints exactly (auth via `AGENT_TOOL_SECRET`, read-only, typed). Prefer extending an existing stats/list endpoint over adding many new ones.
2. **Section synthesis.** Extend the weekly-brief agent's context/prompt/schema so the generated brief includes one short "What the system learned" section: edit-captures count, approve/reject ratio with common rejection themes (themes summarized by the model from the rejection notes — that is what the LLM is for), memory recalls that changed decisions (when any), prompt promotions (when any). Keep it to one compact section consistent with the existing brief structure in `prompts.ts`/`schema.ts`.
3. **Graceful degradation.** With zero data everywhere (fresh window), the section renders a one-line "nothing new this week" style entry or is omitted — whichever the existing brief schema handles more naturally. Never a crash, never fabricated numbers: the prompt must instruct the model to use only the provided counts.

The plan's verification ("section renders from real data in one brief cycle") needs a live agent run — SKIP live runs; verify via unit tests + typecheck. It will be listed as manual follow-up.

## Repo conventions (binding)

- Convex side: adding fields requires mirroring in `convex/validators.ts` return validators; convex type gate is `bunx convex codegen` from repo root (typechecks AND pushes to the live dev deployment — additive only, never leave broken). `agentTools.ts`/`agentRuns.ts` use single-arg `ctx.db` convention — match the file you edit.
- Convex tests: plain `bun:test` over exported pure helpers (`bun test convex scripts`). Put window-filtering/aggregation logic in pure functions and test those.
- Agent side: `cd agent && bunx tsc --noEmit && bun test`. Agent tests mock tool calls via DI (see `agent/tests/` for style).

## Hard scope boundary

May modify: `agent/src/agents/weekly-brief/**`, `agent/src/tools/convexTools.ts`, `convex/agentTools.ts`, `convex/agentToolsHttp.ts` (or wherever the surface routes), `convex/validators.ts` if mirroring requires, `docs/agent-tool-surface.md` (document any new/extended endpoint — the doc is the surface's contract), and test files. Nothing else. Read-only additions to the tool surface only — no new write capabilities. Do not modify the deterministic Convex brief path (`convex/weeklyBriefs.ts`).

## Verification gates (all must pass)

1. `bunx convex codegen` succeeds (repo root)
2. `bun test convex scripts` — all pass (baseline plus prior tasks' additions), 0 fail
3. `cd agent && bunx tsc --noEmit && bun test` — all pass, 0 fail
4. New tests cover: context assembly with data present AND with all-empty data (graceful degradation)

## Process

Work in the worktree at `/Users/kelliott/code/frequency-music/.claude/worktrees/master-sequence-remainder` (branch `worktree-master-sequence-remainder`; never push, never touch main). Root `.env.local` present. TDD where practical; match surrounding style. Commit with message ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Escape hatch

If the weekly-brief agent's context assembly turns out to be structured so differently that "extend the context" requires redesigning the agent, STOP and report BLOCKED with what you found — do not redesign.
