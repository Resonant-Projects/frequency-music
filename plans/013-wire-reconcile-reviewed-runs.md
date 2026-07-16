# Plan 013: `needs_review` agent runs can no longer wedge — reconcile cron wired

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 86f0751..HEAD -- convex/crons.ts convex/agentRuns.ts agent/src/graphs/research-pipeline/nodes.ts`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `86f0751`, 2026-07-15

## Why this matters

An agent run finishing in `needs_review` is completed either (a) inline when a
human approves/rejects/supersedes its last draft, or (b) by a backstop mutation
`reconcileReviewedRuns`, which closes `needs_review` runs that have no pending
drafts. **That backstop is defined but never scheduled** — it has no caller
anywhere in `convex/`. Meanwhile the agent finalizer writes the run status and
the review draft in two separate, non-transactional HTTP calls
(`markAgentRunNeedsReview` then `createAgentReviewDraft`). If the first succeeds
and the second fails (transient network/error), the run sits in `needs_review`
with **no draft**: there is nothing for a human to act on (so path (a) never
fires), the stale-run sweeper ignores non-`running` statuses, and the reconcile
mutation that would close it never runs. The run is wedged permanently, and it
counts against `needs_review` surfaces forever. Wiring the existing reconcile
mutation onto a cron closes the hole; a small finalizer hardening removes the
window that creates it.

## Current state

- `convex/agentRuns.ts` — agent-run lifecycle. Defines `reconcileReviewedRuns`
  (paginated backstop) but nothing calls it.
- `convex/crons.ts` — all scheduled jobs. Has `sweep-stale-agent-runs` (handles
  crashed `running` workers) but no reconcile entry.
- `agent/src/graphs/research-pipeline/nodes.ts` — the finalizer that writes run
  status + draft.

`reconcileReviewedRuns` exists and is self-contained (`convex/agentRuns.ts:524-559`):

```ts
export const reconcileReviewedRuns = internalMutation({
  args: { limit: v.optional(v.number()), cursor: v.optional(v.string()) },
  returns: v.object({
    scanned: v.number(), reconciled: v.number(), stillPending: v.number(),
    cursor: v.union(v.string(), v.null()), isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, REVIEWED_RUN_RECONCILE_LIMIT, REVIEWED_RUN_RECONCILE_LIMIT);
    const page = await ctx.db.query("agentRuns")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "needs_review"))
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
    let reconciled = 0;
    for (const run of page.page) {
      if (await completeReviewedRunIfReady(ctx, run._id)) reconciled += 1;
    }
    return { scanned: page.page.length, reconciled, stillPending: page.page.length - reconciled,
      cursor: page.isDone ? null : page.continueCursor, isDone: page.isDone };
  },
});
```

`grep -rn "reconcileReviewedRuns" convex/` returns **only** the definition above
— no caller.

The existing cron file uses `internal.*` refs and `crons.interval` (`convex/crons.ts`,
the stale-sweep entry as the pattern to copy):

```ts
crons.interval(
  "sweep-stale-agent-runs",
  { minutes: 15 },
  internal.agentRuns.sweepStaleRuns,
  {},
);
```

The finalizer's two-write sequence (`agent/src/graphs/research-pipeline/nodes.ts:636-669`):

```ts
      } else if (needsReview) {
        await callConvex("markAgentRunNeedsReview", {
          runId: state.agentRunId, summary, reviewDraft: state.draft,
        });
        const draft = state.draft;
        const reviewDraft = /* ...builds the draft payload... */;
        if (reviewDraft) {
          try {
            const persistedDraft = await callConvex("createAgentReviewDraft", {
              agentRunId: state.agentRunId, draft: reviewDraft,
            });
            // ...audit event on success...
```

The `createAgentReviewDraft` call is already wrapped in its own `try` (line
665) — on failure it currently logs and leaves the run in `needs_review` with no
draft. That is the window this plan closes.

## Commands you will need

| Purpose         | Command                        | Expected on success        |
|-----------------|--------------------------------|----------------------------|
| Convex tests    | `vp test convex`               | all pass                   |
| Harness tests   | `vp test harness`              | all pass                   |
| Agent tests     | `vp run test:agent`            | all pass                   |
| Typecheck web   | `vp run typecheck:web`         | exit 0                     |
| Typecheck agent | `vp run typecheck:agent`       | exit 0                     |
| Lint            | `vp run lint:check`            | exit 0                     |

Do NOT run `bunx convex ...` / `vpx convex run ...` (LIVE backend). Wiring the
cron does NOT deploy it — deployment is operator-gated (see STOP/maintenance).

## Scope

**In scope**:
- `convex/crons.ts` — add the reconcile interval cron
- `agent/src/graphs/research-pipeline/nodes.ts` — harden the finalizer so a
  failed draft write does not leave a wedged `needs_review` run
- `harness/agentRuns.harness.test.ts` (extend) — assert reconcile closes a
  draftless `needs_review` run (if not already covered)

**Out of scope**:
- `reconcileReviewedRuns` logic and `completeReviewedRunIfReady` — already
  correct; only wire them.
- The stale-run sweeper (`sweepStaleRuns`) — separate concern (`running` runs).
- Human approve/reject/supersede paths — unchanged.
- Do NOT change the reconcile cadence assumption: a single cron tick processes
  one page (`REVIEWED_RUN_RECONCILE_LIMIT` runs), no cursor threading —
  `needs_review` volume is low, so one page per interval converges.

## Git workflow

- Branch: `advisor/013-wire-reconcile-reviewed-runs`
- Commit style: `fix(agent-runs): wire reconcileReviewedRuns cron; fail run on draft-write error`
- Two logical commits (cron wiring; finalizer hardening) is fine.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Wire the reconcile cron

In `convex/crons.ts`, add an interval entry after the `sweep-stale-agent-runs`
block, copying its shape:

```ts
// Close needs_review runs whose drafts are all resolved (or that never got a
// draft written) so a run can't wedge in needs_review forever. See plan 013.
crons.interval(
  "reconcile-reviewed-agent-runs",
  { minutes: 15 },
  internal.agentRuns.reconcileReviewedRuns,
  {},
);
```

`internal.agentRuns.reconcileReviewedRuns` must resolve — it is an
`internalMutation` and will appear in `internal.agentRuns` after codegen. Do NOT
run codegen; the typecheck below validates the reference against the committed
`_generated` types.

**Verify**: `vp run typecheck:web` → exit 0; `grep -n "reconcile-reviewed-agent-runs" convex/crons.ts` → one match.

### Step 2: Harden the finalizer against a draftless wedge

In `agent/src/graphs/research-pipeline/nodes.ts`, the `createAgentReviewDraft`
call is wrapped in a `try` whose `catch` currently only logs. Change the `catch`
so that when the draft write fails, the run does not remain in `needs_review`
with no draft. The correct action: mark the run failed so the operator sees it
and it leaves the review queue. Call the existing `markAgentRunFailed` path used
in the `hasErrors` branch (same file, ~line 631):

```ts
} catch (draftError) {
  // A needs_review run with no persisted draft can never be closed by a human
  // and (before this) had no backstop. Fail the run so it leaves the review
  // queue instead of wedging. See plan 013.
  log("createAgentReviewDraft failed; marking run failed", draftError);
  await callConvex("markAgentRunFailed", {
    runId: state.agentRunId,
    summary,
    error: { messages: [...state.errors, String(draftError)] },
  });
}
```

Match the exact `callConvex("markAgentRunFailed", {...})` argument shape already
used in the `hasErrors` branch of this same function — read lines ~630-635 and
mirror them (field names must match: `runId`, `summary`, `error`).

Note: even with this hardening, the cron from Step 1 is still required — it is
the backstop for any wedge that predates this change or arises another way (e.g.
the *first* write partially applying). Keep both.

**Verify**: `vp run typecheck:agent` → exit 0; `vp run test:agent` → all pass.

### Step 3: Test the reconcile backstop closes a draftless run

See Test plan.

**Verify**: `vp test harness` → all pass, including the new reconcile case.

## Test plan

- **Convex/harness** (`harness/agentRuns.harness.test.ts`): read it first for the
  convex-test setup pattern. Add a case:
  - Create an `agentRuns` row in status `needs_review` with **no** associated
    pending drafts (mirror how the file constructs runs; if a helper seeds runs,
    reuse it).
  - Call `reconcileReviewedRuns` (via the harness's convex-test `t.mutation` /
    the file's existing invocation style) with default args.
  - Assert the run's status is now `completed` (or whatever
    `completeReviewedRunIfReady` sets) and the return reports `reconciled >= 1`.
  - Add the negative case: a `needs_review` run **with** a pending draft is NOT
    reconciled (`reconciled` does not count it; status stays `needs_review`).
- **Agent** (`agent/tests/`): if the finalizer has an existing unit test
  (`worker`/`nodes` test), add a case that stubs `callConvex` so
  `createAgentReviewDraft` throws and asserts `markAgentRunFailed` is then
  called. If no such seam exists, note it in your report and rely on the
  harness reconcile test plus manual reasoning — do NOT build a new test
  harness for the agent finalizer in this plan.
- Verification: `vp test harness` and `vp run test:agent` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `vp run typecheck:web` exits 0
- [ ] `vp run typecheck:agent` exits 0
- [ ] `vp test convex` exits 0
- [ ] `vp test harness` exits 0; a reconcile test for a draftless `needs_review` run exists and passes
- [ ] `vp run test:agent` exits 0
- [ ] `vp run lint:check` exits 0
- [ ] `grep -n "reconcileReviewedRuns" convex/crons.ts` → one match (the cron is wired)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 013 updated

## STOP conditions

Stop and report if:

- Any "Current state" excerpt doesn't match live code (drift). In particular, if
  `reconcileReviewedRuns` now HAS a caller, or the finalizer's two-write
  structure has changed, STOP.
- `markAgentRunFailed` in the agent's `callConvex` surface takes a different
  argument shape than the `hasErrors` branch shows — do not guess; STOP and
  report.
- The harness has no way to create a `needs_review` run without a draft — STOP
  and report the seam gap rather than mutating unrelated helpers.

## Maintenance notes

- **Deployment is operator-gated**: adding the cron to `convex/crons.ts` does
  not activate it until the operator runs a Convex deploy. The plan is complete
  when the code + tests land; note in your status row that deploy is pending
  operator action.
- The 15-minute cadence and single-page-per-tick assume low `needs_review`
  volume. If that surface ever grows large, thread the returned `cursor` across
  ticks (the mutation already returns it) or shorten the interval.
- A reviewer should confirm the finalizer change can't double-fail a run (e.g.
  `markAgentRunFailed` on a run already transitioned) — `completeReviewedRunIfReady`
  and the status machine should tolerate it, but call it out in review.
