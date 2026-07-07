# Plan 005: Make extraction dedupe per-source and transactional, and give stuck `extracting` sources a recovery path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e07be2e..HEAD -- convex/extract.ts convex/extractInternal.ts convex/extractions.ts convex/sources.ts convex/inbox.ts convex/crons.ts`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (touches the live pipeline's status flow; all changes are narrowing/additive)
- **Depends on**: none (recommended after plan 003 so typecheck gates these files)
- **Category**: bug
- **Planned at**: commit `e07be2e`, 2026-06-12

## Why this matters

Two related defects corrupt the extraction pipeline's bookkeeping:

1. **Cross-source dedupe marks sources "extracted" with zero extraction rows.** The dedupe hash is content-only (no source identity), and the check happens in an action *before* a separate insert mutation. If another source has identical text (which the ingestion paths' divergent dedupe keys actively produce — finding CORRECTNESS-06), the current source is flipped to `extracted` and nothing is ever linked to it: the UI shows "Review extraction" with nothing to review, and hypothesis generation never sees it. Under concurrency (8-hour cron + manual batch), the check-then-act race inserts duplicates instead.
2. **A hard crash mid-extraction strands the source forever.** Status is set to `extracting` before the LLM call; the `catch` only handles thrown JS errors — an action timeout/restart leaves `extracting` set. No batch picker selects that status and the inbox's status list omits it, so the source vanishes from every operator view with no retry path.

## Current state

- `convex/extract.ts` — the extraction action (`extractSource`). Key excerpts at `e07be2e`:

  ```ts
  // extract.ts:195-200 — status set before the LLM call
  await ctx.runMutation(api.sources.updateStatus, {
    id: args.sourceId,
    status: "extracting",
    ...
  });
  ```

  ```ts
  // extract.ts:242-246 — hash is content-only (no sourceId)
  const encoder = new TextEncoder();
  const hashData = encoder.encode(`${content}extract_v2`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
  ```

  ```ts
  // extract.ts:248-257 — cross-source skip: marks THIS source extracted because ANY source has the hash
  const existingExtractions = await ctx.runQuery(api.extractions.getByInputHash, { inputHash });
  if (existingExtractions && !args.force) {
    await ctx.runMutation(api.sources.updateStatus, {
      id: args.sourceId,
      status: "extracted",
      ...
    });
    return { skipped: true as const, reason: "duplicate extraction" };
  }
  ```

  The insert happens later in a separate transaction: `extract.ts:277` → `ctx.runMutation(internal.extractInternal.storeExtraction, {...})`. Error path: `extract.ts:310-319` (`catch` → status `review_needed`, `blockedReason: "ai_error"`).

- `convex/extractions.ts:19-28` — `getByInputHash` query: `.withIndex("by_inputHash", q => q.eq("inputHash", args.inputHash)).first()` (so the schema HAS a `by_inputHash` index on `extractions`). `getBySourceId` at `extractions.ts:33-42` uses index `by_sourceId_createdAt`.

- `convex/extractInternal.ts:5+` — `storeExtraction = internalMutation({ args: { sourceId: v.id("sources"), model, promptVersion, inputHash: v.string(), summary, claims: [...], compositionParameters: [...], topics, openQuestions, confidence } })`. Mutations are transactional in Convex — this is where the dedupe check belongs.

- `convex/inbox.ts:6-12` — the status list that hides stuck sources:

  ```ts
  type InboxStatus = "ingested" | "text_ready" | "extracted" | "review_needed";
  const statusPriority: Record<InboxStatus, number> = {
    ingested: 0, text_ready: 1, extracted: 2, review_needed: 2,
  };
  ```

  plus `nextActionForSource` (`inbox.ts:15-37`) and the `statuses` array inside the `list` handler (`inbox.ts:~70`) and the counts query (~line 139-160) — find every `InboxStatus`-typed list via `grep -n 'text_ready' convex/inbox.ts`.

- `convex/sources.ts:190-202` — `updateStatus` mutation already accepts `"extracting"` in its status union. The `sources` table has index `by_status_updatedAt` (`convex/schema.ts:274`) — exactly what the sweep needs.

- `convex/crons.ts` (entire file is 23 lines) — exemplar for adding a cron:

  ```ts
  crons.interval("batch-extract", { hours: 8 }, internal.workflows.startBatchExtractionInternal, { limit: 3 });
  ```

- Batch pickers select only `text_ready`: `extract.ts:350-353`, `convex/workflows.ts:89-92` and `:218-221` — do NOT change them; the sweep returns stuck sources to `text_ready` so the existing pickers find them again.

- Convex platform fact: actions can run up to 10 minutes; a 15-minute staleness threshold can never reset a genuinely in-flight extraction.

- Test conventions: `bun test` with hand-rolled fakes — `convex/testHelpers.ts` `makeDb` is **read-only** (no insert/patch), so mutation handlers can't be tested directly; test pure helpers instead (pattern: `convex/sourceUtils.test.ts`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `bun run test` | all pass (count grows with new tests) |
| Typecheck (if plan 003 landed) | `bun run typecheck` | exit 0 |
| Scoped typecheck otherwise | `bunx tsc --noEmit 2>&1 \| grep -cE '^convex/(extract\|extractInternal\|extractions\|sources\|inbox\|crons)'` | ≤ pre-change count |

## Scope

**In scope** (the only files you should modify):
- `convex/extract.ts`
- `convex/extractInternal.ts`
- `convex/extractions.ts` (only if adding a scoped query variant; see Step 1)
- `convex/sources.ts` (add the sweep mutation + pure helper)
- `convex/sources.sweep.test.ts` (create — or fold into an existing pattern-matching test file name like `convex/sourceUtils.test.ts` style)
- `convex/inbox.ts`
- `convex/crons.ts`

**Out of scope** (do NOT touch, even though they look related):
- The dedupe-KEY schemes in `convex/ingest.ts` / `convex/sourceUtils.ts` (divergent `rss:`/`url:` keys) — that is finding CORRECTNESS-06, needs a data migration, separate plan.
- LLM response parsing in `extract.ts:234-239` (greedy regex / unvalidated JSON) — finding CORRECTNESS-08/SECURITY-07, separate plan.
- `convex/workflows.ts` batch pickers — the sweep design deliberately reuses them unchanged.
- The `inputHash` format itself — keep `SHA-256(content + "extract_v2")`; existing stored rows must stay comparable.

## Git workflow

- Branch: `advisor/005-extraction-dedupe-and-stuck-status`
- Conventional commits (e.g. `fix: scope extraction dedupe to the owning source`, `feat: sweep stuck extracting sources back to text_ready`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Scope the pre-LLM dedupe check to the current source

In `convex/extract.ts:248-257`, replace the `getByInputHash` check with a per-source check (cheap: a source has few extractions):

```ts
const existingForSource = await ctx.runQuery(api.extractions.getBySourceId, {
  sourceId: args.sourceId,
});
if (existingForSource.some((e) => e.inputHash === inputHash) && !args.force) {
  await ctx.runMutation(api.sources.updateStatus, {
    id: args.sourceId,
    status: "extracted",
    devBypassSecret: args.devBypassSecret,
  });
  return { skipped: true as const, reason: "duplicate extraction" };
}
```

Check whether `extractionReturnValidator` (used by `getBySourceId`) includes `inputHash`; if it does not, extend the validator field list in `convex/validators.ts` or add a dedicated lean query `getBySourceAndInputHash` in `convex/extractions.ts` using the `by_sourceId_createdAt` index plus an in-handler `inputHash` comparison. After this step, `getByInputHash` has no remaining callers (`grep -rn getByInputHash convex/ scripts/ web/src/` → only its definition) — leave the definition in place (public read; removing it is optional cleanup).

**Verify**: `grep -n 'getByInputHash' convex/extract.ts` → no matches; scoped typecheck not worse.

### Step 2: Make `storeExtraction` idempotent (the transactional guard)

At the top of the `storeExtraction` handler in `convex/extractInternal.ts`, before any insert:

```ts
const existing = await ctx.db
  .query("extractions")
  .withIndex("by_inputHash", (q) => q.eq("inputHash", args.inputHash))
  .collect();
const dupe = existing.find((e) => e.sourceId === args.sourceId);
if (dupe) {
  return { extractionId: dupe._id, created: false };
}
```

And make the normal path return `{ extractionId: <inserted id>, created: true }`. Check the current handler's return value first (`grep -n 'return' convex/extractInternal.ts`): if callers use it, preserve compatibility by keeping the inserted id reachable (the only caller is `extract.ts:277`, which does not capture the result — verified at `e07be2e`, but re-check).

Because mutations are serializable transactions in Convex, two racing `extractSource` actions can both pass Step 1's check, but only the first insert wins; the second returns `created: false` and inserts nothing.

**Verify**: `bun run test` green; `grep -n 'created: false' convex/extractInternal.ts` → 1 match.

### Step 3: Add the stuck-`extracting` sweep

In `convex/sources.ts`, add a pure helper + internal mutation:

```ts
export function isStuckExtracting(
  source: { status: string; updatedAt: number },
  now: number,
  timeoutMs = 15 * 60 * 1000,
): boolean {
  return source.status === "extracting" && now - source.updatedAt > timeoutMs;
}

export const sweepStuckExtracting = internalMutation({
  args: {},
  returns: v.object({ reset: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    const stuck = await ctx.db
      .query("sources")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "extracting").lt("updatedAt", cutoff))
      .collect();
    for (const source of stuck) {
      await ctx.db.patch("sources", source._id, {
        status: "text_ready",
        updatedAt: Date.now(),
      });
    }
    return { reset: stuck.length };
  },
});
```

Match the file's existing import style (`internalMutation` may need adding to the `./_generated/server` import). Confirm the `sources` schema field is `updatedAt` (it is — the index `by_status_updatedAt` at `convex/schema.ts:274` is built on it) and that `ctx.db.patch` in this codebase uses the `(table, id, fields)` call shape used elsewhere in the repo (see `convex/feeds.ts:87`) — keep whichever shape the file already uses.

**Verify**: scoped typecheck not worse; `grep -n 'sweepStuckExtracting' convex/sources.ts` → definition present.

### Step 4: Schedule the sweep

In `convex/crons.ts`, after the existing intervals:

```ts
// Reset sources stuck in `extracting` (action died before catch) back to text_ready.
crons.interval("sweep-stuck-extracting", { hours: 1 }, internal.sources.sweepStuckExtracting);
```

**Verify**: `grep -n 'sweep-stuck-extracting' convex/crons.ts` → 1 match.

### Step 5: Make `extracting` visible in the inbox

In `convex/inbox.ts`:

1. `type InboxStatus = "ingested" | "text_ready" | "extracting" | "extracted" | "review_needed";`
2. `statusPriority`: add `extracting: 1` (same urgency as `text_ready`).
3. Every `statuses` array literal in the file (the `list` handler ~line 70 and the counts query ~139-160 — locate all via `grep -n '"text_ready"' convex/inbox.ts`): insert `"extracting"` after `"text_ready"`.
4. `nextActionForSource` (`inbox.ts:15-37`): add before the final fallback:

   ```ts
   if (source.status === "extracting") return "Extraction in progress (auto-reset if stuck >15 min)";
   ```

**Verify**: `grep -c '"extracting"' convex/inbox.ts` ≥ 3; `bun run test` green.

## Test plan

The fakes are read-only, so test the pure logic (pattern: `convex/sourceUtils.test.ts`):

- New file `convex/sources.sweep.test.ts` (or extend an existing suitable file):
  - `isStuckExtracting` → true for `extracting` older than 15 min; false for `extracting` at 10 min; false for `text_ready` at any age; respects a custom `timeoutMs`.
- In whichever test file fits the repo pattern, add a pure-function test for the Step 1 predicate if you extracted one (optional — if the logic stays inline, the grep done-criteria below stand in for it).
- `bun run test` → all pass, total ≥ 43 (39 existing + ≥ 4 new assertions).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n 'getByInputHash' convex/extract.ts` → no matches
- [ ] `grep -n 'created: false' convex/extractInternal.ts` → 1 match (idempotent skip path exists)
- [ ] `grep -n 'sweep-stuck-extracting' convex/crons.ts` → 1 match
- [ ] `grep -c '"extracting"' convex/inbox.ts` ≥ 3
- [ ] `bun run test` exits 0 with ≥ 4 new passing assertions
- [ ] Scoped typecheck count ≤ pre-change (0 if plan 003 landed)
- [ ] `git status` shows no files modified outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `storeExtraction`'s current handler already returns a value that callers consume in a shape incompatible with `{ extractionId, created }`.
- The `extractions` schema turns out to lack the `by_inputHash` index (the query at `extractions.ts:19-28` says it exists — if schema drifted, report).
- `extractionReturnValidator` omits `inputHash` AND adding it would expose something sensitive through a public query (it wouldn't today — hashes are not secrets — but if validators were restructured, re-check).
- `sources.updatedAt` is not reliably bumped by `updateStatus` (the sweep's staleness math depends on it — verify `updateStatus` sets `updatedAt: Date.now()` before trusting the 15-min threshold; if it doesn't, report rather than adding the bump yourself).
- Any inbox UI e2e test (`web/tests/e2e/*.spec.ts`) hardcodes the inbox status list and would now fail — report, don't edit web tests in this plan.

## Maintenance notes

- The 15-minute threshold assumes Convex's 10-minute action cap; if extraction ever moves to longer-running infrastructure, raise the threshold with it.
- A swept source re-enters the batch pickers automatically; repeated crash loops on one source will cycle `text_ready → extracting → text_ready`. If that becomes visible (same source reset repeatedly), the follow-up is a `sweepCount` field + `review_needed` after N resets — deferred deliberately.
- Reviewer should scrutinize: that Step 1 didn't change `force` semantics, and that Step 2's early return happens before *any* write (vocabulary `ensureParameterKind` calls included — check the handler's top).
- Related but unplanned: unifying the ingestion dedupe-key schemes (CORRECTNESS-06) would reduce the duplicate-content pairs that made the old cross-source skip dangerous; until then, duplicate sources each get their own extraction (correct, slightly more LLM spend).
