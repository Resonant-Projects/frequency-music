# Plan 024: Rotate agent targets so dead ends stop consuming every run

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report; do not
> improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat cf4a8174..HEAD -- convex/correspondenceCandidates.ts convex/agentDrafts.ts convex/schema.ts`
> If any of these changed, compare the excerpts below with the live code
> first; a mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/017-size-hook-ratchet.md (both edited files are over
  the size limit)
- **Category**: bug
- **Planned at**: commit `cf4a8174`, 2026-11-09

## Why this matters

Two scheduled agent graphs choose their work deterministically and record
nothing when the work leads nowhere, so they choose the same work again.

1. **Evidence hunter** (daily, five targets). The target query always returns
   the five conjectured Correspondences with the oldest evidence. When none of
   the available Claims is relevant to those five, the run writes nothing, the
   order does not change, and the next day picks the same five. Other
   conjectures are never hunted, and each run still pays for the judging
   calls.
2. **Hypothesis drafter** (weekly). The candidate query excludes a
   Correspondence only while it has a draft pending review or an existing
   hypothesis. After a human rejects a draft, the same Correspondence is the
   top candidate again and is redrafted the next week.

Vocabulary (from `GLOSSARY.md`): a **Correspondence** links two Concepts; its
status is `conjectured` or `evidenced`; **Claims** are attached to it as
evidence. Use these words in names and comments.

## Current state

**Evidence targets.** `convex/correspondenceCandidates.ts` (24,137 bytes),
lines 705-734:

```ts
export const listEvidenceTargets = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(evidenceTargetValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(clampLimit(args.limit, 5), 5);
    const rows = await ctx.db
      .query("correspondences")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "conjectured"))
      .order("asc")
      .take(EVIDENCE_TARGET_SCAN_LIMIT);
    const lastEvidenceAt = (row: (typeof rows)[number]) =>
      row.evidence.reduce<number | undefined>(
        (latest, entry) => Math.max(latest ?? 0, entry.addedAt),
        undefined,
      );
    const selected = rows
      .toSorted((left, right) => {
        const leftEvidence = lastEvidenceAt(left);
        const rightEvidence = lastEvidenceAt(right);
        if (leftEvidence === undefined && rightEvidence !== undefined)
          return -1;
        if (leftEvidence !== undefined && rightEvidence === undefined) return 1;
        return (
          (leftEvidence ?? 0) - (rightEvidence ?? 0) ||
          left.createdAt - right.createdAt ||
          left._id.localeCompare(right._id)
        );
      })
      .slice(0, limit);
```

The handler then maps `selected` to targets and uses `lastEvidenceAt(row)`
once more (about line 748). `EVIDENCE_TARGET_SCAN_LIMIT` is 500 (line 31).
The cron in `convex/crons.ts:136-140` runs this graph daily with `limit: 5`.
The agent node that judges claims writes nothing for a target when every
verdict is `irrelevant` or an error
(`agent/src/graphs/evidence-hunter/nodes.ts:193-215`).

**Draft candidates.** `convex/agentDrafts.ts` (35,770 bytes), lines 690-712:

```ts
export const listDraftableCorrespondences = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 20), 100));
    const pendingDrafts = await ctx.db
      .query("agentReviewDrafts")
      .withIndex("by_status_kind_updatedAt", (q) =>
        q.eq("status", "pending_review").eq("kind", "hypothesis_draft"),
      )
      .collect();
    const pendingCorrespondenceIds = new Set(
      pendingDrafts.flatMap((draft) => {
        if (
          draft.kind !== "hypothesis_draft" ||
          !draft.payload ||
          !("statement" in draft.payload) ||
          !draft.payload.correspondenceId
        ) {
          return [];
        }
        return [String(draft.payload.correspondenceId)];
      }),
    );
```

Further down, the loop skips a row with
`if (pendingCorrespondenceIds.has(String(row._id))) continue;`.

The drafts table (`convex/schema.ts`, `agentReviewDrafts`) has statuses
`pending_review`, `approved`, `rejected`, `superseded`, and the index
`.index("by_status_kind_updatedAt", ["status", "kind", "updatedAt"])` (line
437). On the agent side, `selectDraftTarget` takes the first ranked candidate
(`agent/src/graphs/hypothesis-drafter/nodes.ts:125-128`); it does not change.

**Size ratchet.** Both Convex files are listed in
`scripts/file-token-baseline.json` and a commit that makes either larger is
rejected. Each step below moves a block out into a new small module, so both
files shrink.

**New modules.** The modules this plan creates export plain functions only
(no `query`/`mutation`), so they need no entry in
`convex/_generated/api.d.ts` or `harness/modules.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `vp install` (repo root) | exit 0 |
| New tests | `vp test convex/shared/evidenceTargets.test.ts convex/draftTargetExclusions.test.ts` | all pass |
| Convex + scripts tests | `vp run test` | all pass |
| Harness tests | `vp run test:harness` | all pass |
| Agent tests | `cd agent && vp test` | all pass |
| Typecheck | `vp run typecheck` | exit 0 |
| Lint / format | `vp run lint:check` / `vp run format:check` | exit 0 |
| Size check | `git add -A && node scripts/check-file-tokens.mjs` | exit 0 |

Never run `vpx convex dev|codegen|deploy|run` or `bunx convex ...`.

## Scope

**In scope**:
- `convex/shared/evidenceTargets.ts`, `convex/shared/evidenceTargets.test.ts`
  (create)
- `convex/draftTargetExclusions.ts`, `convex/draftTargetExclusions.test.ts`
  (create)
- `convex/correspondenceCandidates.ts` — `listEvidenceTargets` only
- `convex/agentDrafts.ts` — the excerpt above only

**Out of scope**:
- `convex/schema.ts` — no new field or index. This design needs none.
- `agent/src/**` — the agent graphs do not change.
- `convex/crons.ts` — cadence and limits stay.
- `harness/agentDrafts.harness.test.ts` and
  `harness/correspondences.harness.test.ts` — both are over the size limit;
  add new tests in the new files instead.
- The drafter's self-check discard path (see Maintenance notes).

## Git workflow

- Branch: `fix/agent-target-rotation`
- Conventional commits, e.g. `fix(correspondences): rotate evidence targets
  across runs`, `fix(agent-drafts): rest a correspondence after a rejected
  draft`.
- Never `git commit --no-verify`. Do not push or open a PR unless asked.

## Steps

### Step 1: Pure ordering and rotation for evidence targets

Create `convex/shared/evidenceTargets.ts` with three exports:

```ts
type EvidenceRow = {
  _id: string;
  createdAt: number;
  evidence: readonly { addedAt: number }[];
};

/** When evidence was last attached, or undefined when there is none. */
export function lastEvidenceAt(row: EvidenceRow): number | undefined

/** No-evidence rows first, then oldest evidence, then oldest row, then id. */
export function orderEvidenceTargets<T extends EvidenceRow>(rows: readonly T[]): T[]

/** The `turn`-th window of `size` rows, cycling through the whole list. */
export function rotateWindow<T>(rows: readonly T[], size: number, turn: number): T[]
```

- `lastEvidenceAt` and `orderEvidenceTargets` reproduce the logic in the
  excerpt exactly, including the three tie-breakers.
- `rotateWindow`: when `rows` is empty or `size < 1`, return `[]`. Otherwise
  let `windows = Math.ceil(rows.length / size)` and
  `index = ((turn % windows) + windows) % windows`, and return
  `rows.slice(index * size, index * size + size)`. The last window may be
  shorter than `size`.

**Verify**: `vp run typecheck:scripts` → exit 0.

### Step 2: Use them in `listEvidenceTargets`

In `convex/correspondenceCandidates.ts`:
- Delete the local `lastEvidenceAt` closure and the inline comparator.
- Compute the selection as:

```ts
    // One window per UTC day, so a run that adds nothing does not pick the
    // same Correspondences tomorrow.
    const selected = rotateWindow(
      orderEvidenceTargets(rows),
      limit,
      Math.floor(Date.now() / 86_400_000),
    );
```

- Import the three functions from `./shared/evidenceTargets` and keep using
  `lastEvidenceAt(row)` where the handler builds each target.

**Verify**:
- `vp run typecheck:scripts` → exit 0.
- `wc -c convex/correspondenceCandidates.ts` → less than 24137.

### Step 3: Rest a Correspondence after a rejected draft

Create `convex/draftTargetExclusions.ts`:

```ts
/** A rejected hypothesis draft rests its Correspondence for four weekly runs. */
export const REJECTED_DRAFT_REST_MS = 28 * 24 * 60 * 60 * 1000;

/** Correspondences the drafter must skip: one with a draft awaiting review,
 * or one whose draft a human rejected within the rest period. */
export async function restingCorrespondenceIds(
  ctx: QueryCtx,
  now: number,
): Promise<Set<string>>
```

Implementation:
- Read pending drafts exactly as the excerpt does.
- Read rejected drafts with the same index:
  `q.eq("status", "rejected").eq("kind", "hypothesis_draft").gte("updatedAt", now - REJECTED_DRAFT_REST_MS)`,
  then `.collect()`.
- Move the `flatMap` from the excerpt into a small local function and apply it
  to both lists. Return one `Set<string>` of correspondence ids.

In `convex/agentDrafts.ts`, replace the whole excerpt after the `limit` line
(the `pendingDrafts` query and the `pendingCorrespondenceIds` set) with:

```ts
    const pendingCorrespondenceIds = await restingCorrespondenceIds(
      ctx,
      Date.now(),
    );
```

Keep the variable name so the later `.has(...)` line is untouched. Import
`restingCorrespondenceIds` from `./draftTargetExclusions`.

**Verify**:
- `vp run typecheck:scripts` → exit 0.
- `wc -c convex/agentDrafts.ts` → less than 35770.
- `git add -A && node scripts/check-file-tokens.mjs` → exit 0.

## Test plan

`convex/shared/evidenceTargets.test.ts` — pure unit tests (import `describe`,
`expect`, `test` from `vite-plus/test`):

1. `lastEvidenceAt` is `undefined` for no evidence and the maximum `addedAt`
   otherwise.
2. `orderEvidenceTargets` puts a no-evidence row before one with evidence.
3. Among rows with evidence, the older `lastEvidenceAt` comes first.
4. Ties fall back to `createdAt`, then `_id`.
5. `rotateWindow` over 12 rows with size 5: turn 0 → rows 0-4, turn 1 → rows
   5-9, turn 2 → rows 10-11, turn 3 → rows 0-4 again.
6. Over turns 0..2 every row appears exactly once (the regression case: no
   row is starved).
7. Fewer rows than `size` → the same full list on every turn.
8. Empty input → `[]`; `size` 0 → `[]`; a negative `turn` does not throw.

`convex/draftTargetExclusions.test.ts` — convex-test, modelled on
`convex/settings.test.ts`. To insert valid `correspondences` and
`agentReviewDrafts` rows, copy the smallest seeding you can find in
`harness/agentDrafts.harness.test.ts` (read it; do not edit it). Call the
helper with `await t.run((ctx) => restingCorrespondenceIds(ctx, now))`.

9. A `pending_review` hypothesis draft → its correspondence id is in the set.
10. A `rejected` draft updated one day ago → in the set.
11. A `rejected` draft updated 29 days ago → not in the set.
12. An `approved` draft → not in the set (the existing-hypothesis check
    handles that case separately).
13. A `recipe_draft` → never in the set.

**Verify**: both new files pass; `vp run test:harness` still passes, in
particular `harness/agentDrafts.harness.test.ts` and
`harness/correspondences.harness.test.ts`.

## Done criteria

- [ ] `vp test convex/shared/evidenceTargets.test.ts convex/draftTargetExclusions.test.ts`
      passes with 13 tests.
- [ ] `grep -n "toSorted((left, right)" convex/correspondenceCandidates.ts`
      shows no match inside `listEvidenceTargets`.
- [ ] `grep -n "rotateWindow" convex/correspondenceCandidates.ts` matches.
- [ ] `grep -n "restingCorrespondenceIds" convex/agentDrafts.ts` matches.
- [ ] `vp run test`, `vp run test:harness`, `cd agent && vp test`,
      `vp run typecheck`, `vp run lint:check`, `vp run format:check` exit 0.
- [ ] `node scripts/check-file-tokens.mjs --all` exits 0.
- [ ] `git status --short` lists only in-scope files.
- [ ] `plans/README.md` row for 024 updated.

## STOP conditions

- The excerpts do not match the live code.
- A harness test asserts that `listEvidenceTargets` returns the first five
  rows on every call. If so, the test encodes the old behaviour; report it
  with the test name instead of editing an over-limit harness file. (Stubbing
  the clock with `vi.setSystemTime` in a new test is fine.)
- `agentReviewDrafts.updatedAt` is not set when a draft is rejected (check the
  reject mutation in `convex/agentDrafts.ts`). Then use the field the decision
  does set, and report the change.
- Either Convex file would grow past its baseline size.

## Maintenance notes

- Rotation changes which five conjectures a given day hunts, not the priority
  order. With 500 scanned rows a full cycle takes up to 100 days; raise the
  cron's `limit` or cadence if that proves too slow, not the window logic.
- Not covered here: when the drafter's own self-check discards a draft, no
  draft row is written, so nothing rests that Correspondence and the next
  weekly run may pick it again. Fixing that needs a recorded discard (a new
  agent tool or a schema field), which is a design decision for the
  maintainer. The agent-side lines are
  `agent/src/graphs/hypothesis-drafter/nodes.ts:327-333` and `:433-452`.
- `REJECTED_DRAFT_REST_MS` is a product choice (four weekly runs). Change the
  constant, not the query.
- A reviewer should confirm `orderEvidenceTargets` matches the removed
  comparator line for line; test 2-4 cover it.
