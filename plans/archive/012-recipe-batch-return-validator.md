# Plan 012: `recipes.generateBatch` return validator accepts `whyThisMatters`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 86f0751..HEAD -- convex/recipes.ts`
> If `convex/recipes.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `86f0751`, 2026-07-15

## Why this matters

`recipes.generateBatch` is a Convex `action` that generates a recipe for each
hypothesis lacking one and returns an array of per-hypothesis results. Its
success-branch return validator omits the `whyThisMatters` field — but the
objects it actually returns **carry** `whyThisMatters` (they are spread verbatim
from `generateFromHypothesis`, whose payload includes it, and the recipe prompt
explicitly requests it, so it is present on the normal path). Convex validates
action return values against the declared `returns` validator and rejects
objects with unknown fields, so a successful batch throws a return-validation
error — discarding the entire batch's results, **including recipes already
written to the database in that run**. The sibling `hypotheses.generateBatch`
validator already includes `whyThisMatters`, confirming this is a copy-paste
omission, not an intentional exclusion. One additive field fixes it.

## Current state

- `convex/recipes.ts` — recipe generation. Contains `generateFromHypothesis`
  (single) and `generateBatch` (loops over hypotheses calling the single action).

The single-recipe action's return validator **includes** the field
(`convex/recipes.ts:441-446`):

```ts
    generated: v.object({
      title: v.string(),
      whyThisMatters: v.optional(v.string()),   // <-- present here
      bodyMd: v.string(),
      parameters: v.array(recipeParameterValidator),
      dawChecklist: v.array(v.string()),
      protocol: v.optional(recipeProtocolValidator),
    }),
```

The batch action's return validator **omits** it (`convex/recipes.ts:544-550`):

```ts
        generated: v.object({
          title: v.string(),
          bodyMd: v.string(),
          parameters: v.array(recipeParameterValidator),
          dawChecklist: v.array(v.string()),
          protocol: v.optional(recipeProtocolValidator),
        }),                                       // <-- whyThisMatters MISSING
```

The batch pushes results by spreading the single-action result
(`convex/recipes.ts:601-609`), so `generated` is exactly the object the single
action returned — which has `whyThisMatters`:

```ts
        const result: GeneratedRecipeResult = await ctx.runAction(
          api.recipes.generateFromHypothesis,
          { hypothesisId: hypothesis._id, model: args.model, devBypassSecret: args.devBypassSecret },
        );
        results.push({ success: true, ...result });
```

The TypeScript type `BatchRecipeResult` (`convex/recipes.ts:47-53`) already
derives from `GeneratedRecipeResult`, so TypeScript is satisfied — this is a
**runtime-only** validator gap the compiler cannot catch.

## Commands you will need

| Purpose         | Command                        | Expected on success        |
|-----------------|--------------------------------|----------------------------|
| Convex tests    | `vp test convex`               | all pass                   |
| Harness tests   | `vp test harness`              | all pass                   |
| Typecheck       | `vp run typecheck:web`         | exit 0                     |
| Lint            | `vp run lint:check`            | exit 0                     |

Do NOT run `bunx convex ...` / `vpx convex run ...` (LIVE backend).

## Scope

**In scope**:
- `convex/recipes.ts` — add the one validator field
- `convex/recipes.test.ts` (extend if present; this file exists per the repo tree)

**Out of scope**:
- `generateFromHypothesis` and its validator — already correct.
- `hypotheses.generateBatch` — already correct; do not touch.
- The recipe prompt, `validateGeneratedRecipePayload`, and the DB write path —
  unchanged.

## Git workflow

- Branch: `advisor/012-recipe-batch-return-validator`
- Commit style: `fix(recipes): accept whyThisMatters in generateBatch return validator`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add `whyThisMatters` to the batch success validator

In `convex/recipes.ts`, in the `generateBatch` `returns` union, the success
object's `generated` validator (currently lines 544-550), add
`whyThisMatters: v.optional(v.string()),` — place it right after `title:
v.string(),` to match the ordering in `generateFromHypothesis` at line 442.

**Verify**: `vp run typecheck:web` → exit 0; `grep -n "whyThisMatters" convex/recipes.ts`
shows the field now appears in BOTH validators (the line ~442 one and the new one ~545).

### Step 2: Add/adjust a test asserting the batch return shape includes `whyThisMatters`

See Test plan. The key assertion: a batch run whose generated recipe includes
`whyThisMatters` returns successfully (does not throw a return-validation error)
and the returned `generated.whyThisMatters` is preserved.

**Verify**: `vp test convex` → all pass, including the new/updated recipe test.

## Test plan

- File: `convex/recipes.test.ts` (exists). Read it first to find how it stubs the
  LLM/model call for `generateFromHypothesis` (the batch calls that action
  internally). Model the new case on the existing recipe-generation test.
- If the existing tests already drive `generateBatch` through a stubbed model
  that yields `whyThisMatters`, they will now fail-then-pass with this fix —
  confirm there is at least one case where the stubbed payload includes
  `whyThisMatters` and the batch returns without throwing. If no such case
  exists, add one:
  - **Case**: stub the model to return a recipe payload containing a non-empty
    `whyThisMatters`; call `generateBatch` with `limit: 1` for a hypothesis with
    no recipe; assert the result array's first element is `{ success: true }`
    and `result[0].generated.whyThisMatters` equals the stubbed string.
- If harness coverage is the right layer instead (batch actions may be exercised
  in `harness/recipes.harness.test.ts`), add the case there following that
  file's existing pattern; either layer is acceptable as long as it would have
  caught the missing field.
- Verification: `vp test convex` and `vp test harness` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `vp run typecheck:web` exits 0
- [ ] `vp test convex` exits 0
- [ ] `vp test harness` exits 0
- [ ] `vp run lint:check` exits 0
- [ ] `grep -c "whyThisMatters: v.optional(v.string())" convex/recipes.ts` returns at least 4 (both batch args validators + generateFromHypothesis + the new one — confirm the count increased by 1 from the pre-change value)
- [ ] A test exists that fails without the fix and passes with it
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 012 updated

## STOP conditions

Stop and report if:

- `convex/recipes.ts` doesn't match the "Current state" excerpts (drift).
- You cannot construct a test that stubs the model without hitting the network
  (the existing recipe test is your template — if it hits a live model, STOP and
  report; do not add a network-dependent test).
- Adding the field surfaces a different validation error elsewhere in the batch
  path (would indicate the payload shape has drifted).

## Maintenance notes

- Root cause is **validator duplication** between the single and batch actions.
  If `whyThisMatters` or any generated field is ever added/renamed, both
  validators (and the `hypotheses.ts` siblings) must change in lockstep. A
  reviewer should scrutinize any change to `generateFromHypothesis`'s `generated`
  shape for a matching change in `generateBatch`.
- A longer-term fix (out of scope here) is to extract the shared `generated`
  object validator to a named `const` reused by both actions, eliminating the
  drift class entirely. Note it for a future tech-debt pass.
