# Plan 005: Stop the dashboard queries from reading entire tables — fix the quadratic scan and N+1, move counts off the hot path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- convex/dashboard.ts convex/admin.ts convex/inbox.ts convex/schema.ts convex/crons.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the landing-page queries and adds a schema table + cron; deployment is operator-gated)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

The landing page (`/`, `web/src/routes/zodiac-3d.tsx`) and admin page load
Convex queries that `.collect()` entire tables **just to count rows** — and
`sources` rows carry full article text and video transcripts inline
(`schema.ts:337-339`: `rawText`, `transcript`), so counting sources streams
every stored article through the query. Convex enforces per-query limits
(~16k documents / ~8MiB read); as the research corpus grows these queries get
slower and will eventually throw, hard-breaking the home page. On top of that,
`computeEditorialSignals` re-filters ALL hypotheses once per concept
(O(concepts × hypotheses), also run by the Friday weekly-brief cron), and
`domainSubTopics` issues one sequential edge query per concept (N+1) on the
landing route. This plan fixes the two algorithmic problems outright and moves
the row counts to a cron-refreshed `stats` table so no user-facing query ever
pays a full-table read.

## Current state

- `convex/dashboard.ts:54` `pipeline` query: `Promise.all` of SIX
  `ctx.db.query("<table>").collect()` calls (sources, extractions, hypotheses,
  recipes, compositions, weeklyBriefs) returning only `.length` of each.
  Consumer: `web/src/routes/zodiac-3d.tsx` (landing page).
- `convex/admin.ts:~20` `workspaceSnapshot`: same pattern over sources,
  hypotheses, recipes, compositions, weeklyBriefs, feeds. Consumer:
  `web/src/routes/admin.tsx`.
- `convex/inbox.ts:~139` `counts`: `.collect()`s the full `by_status_updatedAt`
  partitions for `ingested`, `text_ready`, `review_needed`, then filters in JS
  for `visibility === "private"` and counts; `blocked` = those with a
  `blockedReason`.
- `convex/dashboard.ts:301` `export async function computeEditorialSignals(db: DbReader, limit = 24)`:
  collects concepts, hypotheses, recipes, compositions, listeningSessions in
  full; builds Maps for recipes-by-hypothesis, compositions-by-recipe,
  sessions-by-composition (`:316-335`); **but** at `:338-342` does
  `hypotheses.filter(h => (h.concepts ?? []).some(item => item.toLowerCase().trim() === concept.name))`
  inside `concepts.map(...)` — the quadratic scan. Consumers:
  `dashboard.ts:448` (`editorialSignals` query → `web/src/routes/display.tsx`)
  and `convex/weeklyBriefs.ts:356` (weekly cron).
- `convex/dashboard.ts:165-174` `domainSubTopics`: sequential
  `for (const concept of allConcepts) { const edges = await ctx.db.query("edges").withIndex("by_from", ...).filter(...).first(); ... }`
  — one round-trip per concept.
- `convex/aggregates.ts` exists (a `TableAggregate` exemplar for concepts) but
  is an orphan — NOT wired to mutations, so its counts cannot be trusted. The
  arch wave (`docs/plans/2026-07-03-00`, "Out of scope") left its
  delete-or-wire decision open. This plan does NOT use it (see Maintenance
  notes for why).
- Cron conventions: `convex/crons.ts` — e.g.
  `crons.interval("sweep-stale-agent-runs", { minutes: 15 }, internal.agentRuns.sweepStaleRuns, {});`
- Auth convention: `pipeline`, `workspaceSnapshot`, and `inbox.counts` are
  public queries today (reads are public repo-wide); keep that.
- **Standing constraint**: `bunx convex codegen` / `dev` / `deploy` contact the
  LIVE self-hosted backend — do not run them. Schema + cron changes take
  effect only when the OPERATOR deploys; your job ends at green typecheck +
  tests + review-ready code.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `bun test convex/*.test.ts` | all pass |
| Typecheck | `bunx tsc --noEmit -p tsconfig.json` | exit 0 |
| Lint (check-only) | `bunx oxlint convex/ --tsconfig tsconfig.json` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `convex/dashboard.ts`
- `convex/admin.ts`
- `convex/inbox.ts`
- `convex/schema.ts` (add ONE table: `stats`)
- `convex/crons.ts` (add ONE cron)
- `convex/dashboard.test.ts` (extend — it exists)

**Out of scope** (do NOT touch):
- `convex/aggregates.ts` — its delete-or-wire decision belongs to the arch
  wave; don't wire it, don't delete it.
- `web/src/**` — all three queries keep their exact return validators, so no
  web change is needed. If you think you need a web change, you broke a
  contract; revert.
- `convex/graph.ts` (`getConceptEdges`, `exportForVisualization` have similar
  patterns — deliberately deferred, see Maintenance notes).
- Pagination of list endpoints — audited and deferred as not-yet-needed.

## Git workflow

- Branch: `advisor/005-dashboard-query-scaling`
- Conventional commits, e.g. `perf(dashboard): precompute pipeline counts via stats table`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Kill the quadratic scan in `computeEditorialSignals`

In `convex/dashboard.ts`, next to the existing `recipesByHypothesisId` Map
build (`:316`), add one more prepass (match the existing Map-building style
exactly):

```ts
const hypothesesByConcept = new Map<string, Doc<"hypotheses">[]>();
for (const hypothesis of hypotheses) {
  for (const raw of hypothesis.concepts ?? []) {
    const key = raw.toLowerCase().trim();
    const existing = hypothesesByConcept.get(key) ?? [];
    existing.push(hypothesis);
    hypothesesByConcept.set(key, existing);
  }
}
```

Then replace the per-concept filter at `:338-342` with
`const linkedHypotheses = hypothesesByConcept.get(concept.name) ?? [];`
(concept names are already stored lowercased/trimmed — see
`graph.ts upsertConcept`'s `normalized`; the Map key normalization above keeps
the comparison identical to the old `.some()`).

**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0.
**Verify**: `bun test convex/*.test.ts` → all pass (dashboard.test.ts exists; extend it in Step 5).

### Step 2: Parallelize the N+1 in `domainSubTopics`

Replace the sequential loop at `dashboard.ts:165-174` with a `Promise.all`
that runs the same per-concept indexed query concurrently:

```ts
const parentEdges = await Promise.all(
  allConcepts.map((concept) =>
    ctx.db
      .query("edges")
      .withIndex("by_from", (q) => q.eq("fromType", "concept").eq("fromId", concept.name))
      .filter((q) =>
        q.or(q.eq(q.field("relationship"), "is_a"), q.eq(q.field("relationship"), "part_of")),
      )
      .first(),
  ),
);
const parentMap = new Map<string, string>();
allConcepts.forEach((concept, i) => {
  const edge = parentEdges[i];
  if (edge) parentMap.set(concept.name, edge.toId);
});
```

Same queries, same `parentMap` result, no serial round-trips.

**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0.

### Step 3: Add the `stats` table and its recompute machinery

1. `convex/schema.ts` — add (alongside the other defineTable entries):
   ```ts
   stats: defineTable({
     key: v.string(),
     value: v.number(),
     updatedAt: v.number(),
   }).index("by_key", ["key"]),
   ```
2. `convex/dashboard.ts` — add, at module scope (keeping everything in this
   existing module avoids new-module codegen):
   - `internal` import from `./_generated/api` and `internalMutation`,
     `internalAction`, `internalQuery` from `./_generated/server` (extend
     existing imports).
   - A paginated per-table counter (one bounded transaction per page):
     ```ts
     const COUNTED_TABLES = [
       "sources", "extractions", "hypotheses", "recipes",
       "compositions", "weeklyBriefs", "feeds",
     ] as const;
     type CountedTable = (typeof COUNTED_TABLES)[number];

     export const countPage = internalQuery({
       args: { table: v.string(), cursor: v.union(v.string(), v.null()) },
       returns: v.object({
         count: v.number(),
         // sources-only sub-tallies for the inbox
         inbox: v.object({
           ingested: v.number(), textReady: v.number(),
           reviewNeeded: v.number(), blocked: v.number(),
         }),
         cursor: v.union(v.string(), v.null()),
         isDone: v.boolean(),
       }),
       handler: async (ctx, args) => {
         const page = await ctx.db
           .query(args.table as CountedTable)
           .paginate({ cursor: args.cursor, numItems: 500 });
         const inbox = { ingested: 0, textReady: 0, reviewNeeded: 0, blocked: 0 };
         if (args.table === "sources") {
           for (const row of page.page as Doc<"sources">[]) {
             if (row.visibility !== "private") continue;
             if (row.status === "ingested") inbox.ingested++;
             if (row.status === "text_ready") inbox.textReady++;
             if (row.status === "review_needed") inbox.reviewNeeded++;
             if (
               (row.status === "ingested" || row.status === "text_ready" ||
                row.status === "review_needed") && Boolean(row.blockedReason)
             ) inbox.blocked++;
           }
         }
         return {
           count: page.page.length,
           inbox,
           cursor: page.continueCursor,
           isDone: page.isDone,
         };
       },
     });

     export const writeStat = internalMutation({
       args: { key: v.string(), value: v.number() },
       returns: v.null(),
       handler: async (ctx, args) => {
         const existing = await ctx.db
           .query("stats")
           .withIndex("by_key", (q) => q.eq("key", args.key))
           .first();
         if (existing) {
           await ctx.db.patch("stats", existing._id, { value: args.value, updatedAt: Date.now() });
         } else {
           await ctx.db.insert("stats", { key: args.key, value: args.value, updatedAt: Date.now() });
         }
         return null;
       },
     });

     export const recomputeStats = internalAction({
       args: {},
       returns: v.null(),
       handler: async (ctx) => {
         for (const table of COUNTED_TABLES) {
           let cursor: string | null = null;
           let total = 0;
           const inboxTotals = { ingested: 0, textReady: 0, reviewNeeded: 0, blocked: 0 };
           while (true) {
             const page = await ctx.runQuery(internal.dashboard.countPage, { table, cursor });
             total += page.count;
             inboxTotals.ingested += page.inbox.ingested;
             inboxTotals.textReady += page.inbox.textReady;
             inboxTotals.reviewNeeded += page.inbox.reviewNeeded;
             inboxTotals.blocked += page.inbox.blocked;
             if (page.isDone) break;
             cursor = page.cursor;
           }
           await ctx.runMutation(internal.dashboard.writeStat, { key: `count.${table}`, value: total });
           if (table === "sources") {
             for (const [k, v2] of Object.entries(inboxTotals)) {
               await ctx.runMutation(internal.dashboard.writeStat, { key: `inbox.${k}`, value: v2 });
             }
           }
         }
         return null;
       },
     });
     ```
   Adapt the two-arg vs one-arg `ctx.db.get/patch` form to whatever the
   surrounding file uses (this repo uses the two-arg form, e.g.
   `ctx.db.patch("concepts", args.conceptId, {...})` in `graph.ts:170`).
3. `convex/crons.ts` — add:
   ```ts
   // Refresh dashboard/inbox row counts (see plans/005) so hot queries never full-scan
   crons.interval("recompute-stats", { minutes: 30 }, internal.dashboard.recomputeStats, {});
   ```

**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0.

### Step 4: Point the three hot queries at `stats`

Add a small shared helper in `convex/dashboard.ts`:

```ts
export async function readStat(db: DbReader, key: string): Promise<number> {
  const row = await db
    .query("stats")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return row?.value ?? 0;
}
```

- `dashboard.ts pipeline`: replace the six `.collect()`s with
  `readStat(ctx.db, "count.sources")` etc. Return validator unchanged.
- `admin.ts workspaceSnapshot`: same, for its six keys (import `readStat` from
  `./dashboard`). Return validator unchanged.
- `inbox.ts counts`: replace the three `.collect()`s + JS filtering with
  `readStat(ctx.db, "inbox.ingested")`, `"inbox.textReady"`,
  `"inbox.reviewNeeded"`, `"inbox.blocked"`. Return validator unchanged.

Behavior note you must preserve and report: counts are now ≤30 min stale
(fresh after each cron tick, or after the operator manually runs
`bunx convex run --component "" dashboard:recomputeStats` — internal functions
run via CLI with the admin key on self-hosted). Before the FIRST recompute run
the stats table is empty and all counts read 0 — flag this to the operator so
they trigger one recompute right after deploying.

**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0.
**Verify**: `grep -n "\.collect()" convex/admin.ts convex/inbox.ts` → no output;
`grep -c "\.collect()" convex/dashboard.ts` → only the `computeEditorialSignals`
collects and any pre-existing ones OUTSIDE `pipeline` remain (compare against
`git show a30f10c:convex/dashboard.ts | grep -c ".collect()"` — the count must
have dropped by exactly the six `pipeline` collects).

### Step 5: Tests

Extend `convex/dashboard.test.ts` (it exists — follow its style):

1. `computeEditorialSignals` takes a `DbReader` — pass a stub object whose
   `query(table)` returns `{ collect: async () => fixtures[table] }`. Fixtures:
   2 concepts, 3 hypotheses (one shared concept, one with mixed-case/whitespace
   concept strings like `" Cymatics "`), linked recipes/compositions/sessions.
   Assert: the concept↔hypothesis linkage in the output matches what the OLD
   `.some()` comparison would produce (this is the characterization that the
   Map refactor is behavior-identical, including normalization).
2. Same stub, empty tables → returns empty/zeroed output, no throw.

**Verify**: `bun test convex/dashboard.test.ts` → all pass.

## Test plan

See Step 5. Pattern: existing `convex/dashboard.test.ts`. The `countPage` /
`recomputeStats` machinery is NOT unit-testable without the ctx-seam harness
(`docs/plans/2026-07-03-04`) — when that harness lands, add: recompute over a
seeded dataset produces stats rows matching direct counts (note this in your
report as deferred coverage). Manual post-deploy verification for the operator:
run `recomputeStats` once, then compare `pipeline` output against
`bunx convex run dashboard:pipeline` pre-change numbers.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bunx tsc --noEmit -p tsconfig.json` → exit 0
- [ ] `bun test convex/*.test.ts` → 0 fail, including the new dashboard tests
- [ ] `grep -n "hypotheses.filter" convex/dashboard.ts` → no output (quadratic gone)
- [ ] The `for (const concept of allConcepts)` await-in-loop at the old `:165` is gone (`grep -A2 "for (const concept of allConcepts)" convex/dashboard.ts` shows no `await ctx.db` inside)
- [ ] `pipeline`, `workspaceSnapshot`, `inbox.counts` contain no `.collect()`
- [ ] Return validators of all three queries are byte-identical to `a30f10c` (`git diff` shows no `returns:` changes)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated, with a note that the operator must deploy + run the first `recomputeStats`

## STOP conditions

Stop and report back (do not improvise) if:

1. Any of the three queries' return validators would have to change — the web
   contract must stay fixed.
2. `.paginate()` is rejected by the deployed Convex version's types
   (`convex ^1.34` supports it; if typecheck disagrees, the local types are
   drifted — report rather than fighting it).
3. `dashboard.test.ts`'s existing tests constrain `computeEditorialSignals` in
   a way that contradicts the Map refactor (i.e. a test encodes the quadratic
   path's behavior on unnormalized concept names differently than the Map
   produces) — that's a real behavior difference; report it.
4. You are tempted to wire `convex/aggregates.ts` instead — that decision is
   reserved to the arch wave; stop and flag if the stats approach seems wrong.

## Maintenance notes

- **Why not `@convex-dev/aggregate`?** Correct aggregates require every
  source/extraction/etc. mutation to update them (via convex-helpers Triggers
  or manual calls) — invasive across modules the 2026-07-03 arch wave is
  actively refactoring, and the wave explicitly parked the `aggregates.ts`
  orphan decision. The stats-cron approach touches nothing on the write path.
  Revisit aggregates AFTER the arch wave; the migration path is: wire
  TableAggregate + Triggers, backfill, then delete `countPage`/`recomputeStats`
  and read aggregates in `readStat`.
- Staleness: counts lag up to 30 min. If that ever bites (e.g. inbox badge
  after a big manual ingest), schedule `recomputeStats` at the end of
  `ingest.pollAllFeedsInternal` and the manifest scripts — one
  `ctx.scheduler.runAfter(0, internal.dashboard.recomputeStats, {})` each.
- `computeEditorialSignals` still `.collect()`s five tables (its output needs
  the actual rows, not counts). That's the next scaling ceiling — when
  hypotheses/concepts cross a few thousand rows, denormalize editorial signals
  into their own cron-built table the way stats were done here.
- Deferred (audited, real, smaller): `graph.ts getConceptEdges` N+1 and
  `exportForVisualization`'s load-everything-then-BFS — same `Promise.all` /
  seed-from-center treatments when the constellation view grows.
- Reviewer should scrutinize: Step 4's key strings (`count.sources` vs table
  names) — a typo reads 0 forever and no type catches it.
