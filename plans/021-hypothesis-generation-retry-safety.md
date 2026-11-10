# Plan 021: Make hypothesis generation safe to retry and stop regenerating linked extractions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report; do not
> improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat cf4a8174..HEAD -- convex/hypotheses.ts convex/workflows.ts`
> Plans 018 and 019 are expected to have touched `convex/hypotheses.ts` near
> line 260 only. For any other change, compare the excerpts below with the
> live code first; a mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of 017–020)
- **Category**: bug
- **Planned at**: commit `cf4a8174`, 2026-11-09

## Why this matters

Hypothesis generation calls a paid model (Opus) and has two ways to spend
twice for one result.

1. `hypotheses.generateFromExtraction` inserts the hypothesis and then returns
   the model's raw JSON through a strict `returns` validator. If the model adds
   one extra key, the return validation throws after the insert. Three workflow
   call sites run this action with `{ retry: true }` and the workflow
   component retries up to three times, so one extraction can produce three
   paid calls and three duplicate hypotheses.
2. The weekly batch decides whether an extraction already has a hypothesis by
   matching the whole `extractionIds` array against `[extractionId]`. A
   hypothesis that cites two or more extractions never matches, so each of its
   extractions reads as unlinked and gets a new hypothesis. Approving an agent
   draft now creates such hypotheses in production.

## Current state

- `convex/hypotheses.ts` — 19,231 bytes. **It must stay under 20,000 bytes**
  or the pre-commit hook rejects it. Both fixes below move code out, so the
  file shrinks.
- `convex/workflows.ts` — 12,981 bytes; the three retrying call sites.
- `convex/components.ts:26-34` — sets `maxAttempts: 3` for workflow steps.

The payload type (`convex/hypotheses.ts:19-26`):

```ts
interface GeneratedHypothesisPayload {
  title: string;
  question: string;
  hypothesis: string;
  whyThisMatters: string;
  rationaleMd: string;
  concepts?: string[];
}
```

The strict return validator (`convex/hypotheses.ts:467-477`):

```ts
  returns: v.object({
    hypothesisId: v.id("hypotheses"),
    model: v.string(),
    generated: v.object({
      title: v.string(),
      question: v.string(),
      hypothesis: v.string(),
      whyThisMatters: v.string(),
      rationaleMd: v.string(),
      concepts: v.optional(v.array(v.string())),
    }),
  }),
```

The unvalidated parse and the raw return (`convex/hypotheses.ts:541-574`):

```ts
    // Parse response
    let parsed: GeneratedHypothesisPayload;
    try {
      parsed = extractJsonObject(text) as GeneratedHypothesisPayload;
      parsed.whyThisMatters = assertWhyThisMatters(
        parsed.whyThisMatters,
        "generated.whyThisMatters",
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`, { cause: e });
    }
    // ... ctx.runMutation(api.hypotheses.create, { ... }) ...
    return {
      hypothesisId,
      model: modelId,
      generated: parsed,
    };
```

The linked check (`convex/hypotheses.ts:577-596`):

```ts
export const listUnlinkedBatchCandidates = internalQuery({
  args: { limit: v.number(), minClaims: v.number() },
  returns: v.array(extractionReturnValidator),
  handler: async (ctx, args) => {
    const extractions = await listCurrentExtractions(ctx.db, 50);
    return await selectUnlinkedExtractionCandidates(extractions, {
      ...args,
      isLinked: async (extractionId) =>
        Boolean(
          await ctx.db
            .query("hypotheses")
            .withIndex("by_extractionIds", (q) =>
              q.eq("extractionIds", [extractionId]),
            )
            .first(),
        ),
    });
  },
});
```

The retrying call sites in `convex/workflows.ts` — lines 145-149, 185-189 and
254-258 all have this shape:

```ts
        const result = await ctx.runAction(
          api.hypotheses.generateFromExtraction,
          { extractionId: extraction._id, model: args.model, devBypassSecret },
          { retry: true },
        );
```

The extraction workflow in the same file already declines retries for the
same reason (`convex/workflows.ts:67-72`):

```ts
    // Operational recovery owns generation retries for this snapshot
    await ctx.runAction(
      api.extract.extractSource,
      { sourceId: args.sourceId, model: args.model, devBypassSecret },
      { retry: false },
    );
```

The recipe path already normalizes model output with a validating function,
`validateGeneratedRecipePayload` (`convex/recipes.ts:75`, used at `:483`).
Follow that pattern.

Scale: the `hypotheses` table is small (tens to low hundreds of rows) and its
embeddings live in a separate table, so reading every hypothesis in one query
is cheap today.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `vp install` (repo root) | exit 0 |
| New tests | `vp test convex/hypothesisPayload.test.ts convex/hypothesisLinks.test.ts` | all pass |
| Existing tests | `vp test convex/hypotheses.test.ts` | all pass |
| Convex + scripts tests | `vp run test` | all pass |
| Harness tests | `vp run test:harness` | all pass |
| Typecheck | `vp run typecheck:scripts` | exit 0 |
| Lint / format | `vp run lint:check` / `vp run format:check` | exit 0 |

Never run `vpx convex dev|codegen|deploy|run` or `bunx convex ...`; they
contact the live production backend. The new modules below export plain
functions only, so they need no registration in `convex/_generated/`.

## Scope

**In scope**:
- `convex/hypothesisPayload.ts` (create), `convex/hypothesisPayload.test.ts`
  (create)
- `convex/hypothesisLinks.ts` (create), `convex/hypothesisLinks.test.ts`
  (create)
- `convex/hypotheses.ts` — the three excerpts above only
- `convex/workflows.ts` — the three `retry: true` values after
  `api.hypotheses.generateFromExtraction`

**Out of scope**:
- `convex/schema.ts` — no new table or index. The `by_extractionIds` index
  stays; other code may use it.
- The `{ retry: true }` on `api.recipes.generateFromHypothesis`
  (`convex/workflows.ts:262-270`) — not verified as unsafe; leave it.
- The hypothesis prompt and model selection.
- `convex/agentDraftPromotion.ts`, `convex/hypothesisTournament.ts`.

## Git workflow

- Branch: `fix/hypothesis-generation-retry`
- Conventional commits, e.g. `fix(hypotheses): project generated payloads and
  stop retrying a paid insert`.
- Never `git commit --no-verify`. Do not push or open a PR unless asked.

## Steps

### Step 1: Project the model's JSON to the known fields

Create `convex/hypothesisPayload.ts`. Move the `GeneratedHypothesisPayload`
interface there and export it. Add:

```ts
/** Keep only the fields a hypothesis uses; throw on a missing or non-string one. */
export function projectGeneratedHypothesis(
  raw: unknown,
): GeneratedHypothesisPayload
```

Rules:
- `raw` must be a non-null, non-array object, else throw
  `new Error("generated payload is not an object")`.
- `title`, `question`, `hypothesis`, `rationaleMd` must be non-empty strings
  after `trim()`, else throw `new Error("generated.<field> is missing")`.
- `whyThisMatters` is passed through the existing `assertWhyThisMatters(value,
  "generated.whyThisMatters")`. Find where `convex/hypotheses.ts` imports it
  from and import it from the same place.
- `concepts`: if it is an array, keep only its string entries; otherwise leave
  the key out.
- Return an object with exactly those keys. Unknown keys are dropped.

In `convex/hypotheses.ts`: delete the local interface and import the type and
the function from `./hypothesisPayload`. Replace the body of the `try` block
with `parsed = projectGeneratedHypothesis(extractJsonObject(text));`. Keep the
surrounding `try`/`catch` and its error message.

**Verify**: `vp run typecheck:scripts` → exit 0.

### Step 2: Stop retrying the paid insert

In `convex/workflows.ts`, change `{ retry: true }` to `{ retry: false }` at
the three call sites of `api.hypotheses.generateFromExtraction`. Above the
first one add the comment:

```ts
    // No step retry: the action inserts before it returns. The batch cron
    // re-selects an extraction that still has no hypothesis.
```

**Verify**:
`grep -n -A3 'api.hypotheses.generateFromExtraction' convex/workflows.ts | grep -c 'retry: true'`
→ prints `0`.

### Step 3: Check membership, not whole-array equality

Create `convex/hypothesisLinks.ts`:

```ts
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/** Every extraction id cited by any hypothesis. The table is small; see the
 * maintenance note in plans/021 before this grows past a few thousand rows. */
export async function linkedExtractionIds(
  db: QueryCtx["db"],
): Promise<Set<Id<"extractions">>> {
  const linked = new Set<Id<"extractions">>();
  for await (const hypothesis of db.query("hypotheses"))
    for (const id of hypothesis.extractionIds ?? []) linked.add(id);
  return linked;
}
```

Check the `hypotheses` table in `convex/schema.ts` for whether `extractionIds`
is optional and adjust the `?? []` accordingly.

In `listUnlinkedBatchCandidates`, compute `const linked = await
linkedExtractionIds(ctx.db);` before the call and replace the `isLinked`
callback with `isLinked: async (extractionId) => linked.has(extractionId),`.

**Verify**:
- `vp run typecheck:scripts` → exit 0.
- `wc -c convex/hypotheses.ts` → less than 19231.

## Test plan

`convex/hypothesisPayload.test.ts` — pure unit tests (import `describe`,
`expect`, `test` from `vite-plus/test`; no Convex runtime needed):

1. A valid payload is returned unchanged.
2. A payload with an extra key (`{ ...valid, confidence: 0.9 }`) is returned
   without that key. This is the regression case.
3. A missing `title` throws `generated.title is missing`.
4. A whitespace-only `hypothesis` throws.
5. `concepts: "a, b"` (not an array) → the result has no `concepts` key.
6. `concepts: ["a", 3, "b"]` → `["a", "b"]`.
7. `null`, an array, and a string each throw "not an object".

`convex/hypothesisLinks.test.ts` — convex-test, modelled on
`convex/settings.test.ts`. To insert valid `extractions` and `hypotheses`
rows, copy the smallest fixture you can find with
`grep -rn 'insert("extractions"' convex/*.test.ts harness/*.ts | head`.

8. A hypothesis with `extractionIds: [a, b]` → `linkedExtractionIds` contains
   both `a` and `b`.
9. `internal.hypotheses.listUnlinkedBatchCandidates` does not return
   extraction `a` when it is cited only inside that two-extraction hypothesis,
   and does return an unrelated extraction `c` that meets `minClaims`.

**Verify**: both new test files pass; `vp test convex/hypotheses.test.ts`
still passes.

## Done criteria

- [ ] `grep -n 'as GeneratedHypothesisPayload' convex/hypotheses.ts` returns
      nothing.
- [ ] `grep -n 'q.eq("extractionIds"' convex/hypotheses.ts` returns nothing.
- [ ] The step 2 grep prints `0`.
- [ ] `wc -c convex/hypotheses.ts` is under 20000.
- [ ] `vp run test`, `vp run test:harness`, `vp run typecheck:scripts`,
      `vp run lint:check`, `vp run format:check` exit 0.
- [ ] `git status --short` lists only in-scope files.
- [ ] `plans/README.md` row for 021 updated.

## STOP conditions

- The excerpts do not match the live code.
- `selectUnlinkedExtractionCandidates` awaits `isLinked` in a way that makes a
  precomputed set incorrect (for example it mutates state between calls).
- A test in `convex/hypotheses.test.ts` or the harness depends on
  `{ retry: true }` for hypothesis generation.
- `convex/hypotheses.ts` would reach 20,000 bytes.

## Maintenance notes

- With `retry: false`, a transient model failure skips that extraction until
  the next `generate-hypotheses` cron run, which selects it again because it
  is still unlinked. That is the intended recovery path.
- `linkedExtractionIds` reads the whole `hypotheses` table. Revisit it with a
  join table when the table passes a few thousand rows. A join table needs a
  schema change and a backfill, which is why this plan avoids it.
- The hypothesis tournament (gated off) also writes multi-extraction
  hypotheses; this fix covers it.
- A reviewer should confirm the return validator in `generateFromExtraction`
  was not loosened; the fix is the projection, not a wider validator.
