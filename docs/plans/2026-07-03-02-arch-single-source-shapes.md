# Single-Source the Shapes Implementation Plan
> Landed: b55caeb (2026-07-09)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every shared shape (status unions, sub-objects) is defined once — arrays/types in `convex/shared/statuses.ts`, validators in `convex/schema.ts` — and every other site imports it; this also fixes the live bug where AI-generated recipes are rejected by `recipes.create`'s narrower args validator.

**Architecture:** `convex/shared/` is a new pure contract seam (no `convex/server` imports) that web and scripts can also import. `schema.ts` stays the canonical validator source (it already exports 11 status validators — this extends that pattern); `validators.ts` composes/re-exports instead of restating. Drift moves from runtime (`returns:` throw) to compile time (`bunx convex codegen`).

**Tech Stack:** Convex 1.34 validators, `convex-helpers/validators` (`literals`), bun:test, SolidJS web app.

## Global Constraints

- Bun runtime everywhere: `bun test convex/*.test.ts`, `bunx convex codegen`, `bun run typecheck:web`.
- **`bunx convex codegen` pushes to the live self-hosted deployment and is the Convex type gate.** Every commit must leave `codegen` green — never commit a schema change without updating its dependents in the same task.
- `convex/shared/*` purity rule: may import only `convex/values`, `convex-helpers/validators`, and zod. Never `convex/server`, never `./_generated/*`.
- Do NOT touch `agentDraftHypothesisPayloadValidator` / `agentDraftRecipePayloadValidator` / `agentReviewDraftPayloadValidator` internals — those move to zod-first in plan `2026-07-03-05-arch-agent-tool-registry.md`. (Renaming the protocol sub-validator they reference is in scope; the payload validators themselves are not.)
- Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Create `convex/shared/statuses.ts`

**Files:**
- Create: `convex/shared/statuses.ts`
- Test: `convex/shared/statuses.test.ts`

**Interfaces:**
- Produces (later tasks and plans 04/05/06 import these):
  - `SOURCE_STATUSES: readonly ["ingested","text_ready","extracting","extracted","review_needed","triaged","promoted_followers","promoted_public","archived"]`, `type SourceStatus`
  - `SOURCE_BLOCKED_REASONS: readonly ["no_text","copyright","needs_metadata","needs_tagging","ai_error","needs_human_review","duplicate"]`, `type SourceBlockedReason`
  - `HYPOTHESIS_STATUSES: readonly ["draft","queued","active","evaluated","revised","retired"]`, `type HypothesisStatus`
  - `RECIPE_STATUSES: readonly ["draft","in_use","archived"]`, `type RecipeStatus`

- [ ] **Step 1: Write the failing test**

Create `convex/shared/statuses.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import {
  HYPOTHESIS_STATUSES,
  RECIPE_STATUSES,
  SOURCE_BLOCKED_REASONS,
  SOURCE_STATUSES,
} from "./statuses";

describe("shared status arrays", () => {
  test("source statuses match the schema pipeline order", () => {
    expect(SOURCE_STATUSES).toEqual([
      "ingested",
      "text_ready",
      "extracting",
      "extracted",
      "review_needed",
      "triaged",
      "promoted_followers",
      "promoted_public",
      "archived",
    ]);
  });

  test("all arrays are duplicate-free", () => {
    for (const arr of [
      SOURCE_STATUSES,
      SOURCE_BLOCKED_REASONS,
      HYPOTHESIS_STATUSES,
      RECIPE_STATUSES,
    ]) {
      expect(new Set(arr).size).toBe(arr.length);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test convex/shared/statuses.test.ts`
Expected: FAIL — `Cannot find module './statuses'`

- [ ] **Step 3: Write the module**

Create `convex/shared/statuses.ts`:

```typescript
// Pure cross-runtime contract module: imported by convex functions, web, and
// scripts. May import only convex/values, convex-helpers/validators, or zod —
// never convex/server or ./_generated/*.

// Order matches the pipeline flow in convex/schema.ts (sources.status).
export const SOURCE_STATUSES = [
  "ingested",
  "text_ready",
  "extracting",
  "extracted",
  "review_needed",
  "triaged",
  "promoted_followers",
  "promoted_public",
  "archived",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SOURCE_BLOCKED_REASONS = [
  "no_text",
  "copyright",
  "needs_metadata",
  "needs_tagging",
  "ai_error",
  "needs_human_review",
  "duplicate",
] as const;
export type SourceBlockedReason = (typeof SOURCE_BLOCKED_REASONS)[number];

export const HYPOTHESIS_STATUSES = [
  "draft",
  "queued",
  "active",
  "evaluated",
  "revised",
  "retired",
] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

export const RECIPE_STATUSES = ["draft", "in_use", "archived"] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test convex/shared/statuses.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/shared/statuses.ts convex/shared/statuses.test.ts
git commit -m "feat(shared): add pure status contract module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: schema.ts builds and exports the canonical validators

**Files:**
- Modify: `convex/schema.ts` (imports at top; `claimValidator` at :107; `agentDraftRecipeProtocolValidator` at :141; sources table status/blockedReason at :347-368; hypotheses status at :491-498; recipes table protocol at :536-547 and status at :553-557; weeklyBriefs `studioPrompts`/`recommendedActions` at :679-710)

**Interfaces:**
- Consumes: Task 1's arrays.
- Produces (exports other tasks import from `./schema`): `sourceStatusValidator`, `sourceBlockedReasonValidator`, `hypothesisStatusValidator`, `recipeStatusValidator`, `claimValidator`, `recipeProtocolValidator`, `studioPromptVariantsValidator`, `recommendedActionValidator`. (`compositionParameterValidator` already exported.)

- [ ] **Step 1: Verify the `literals` helper exists in the installed convex-helpers**

Run: `grep -n "declare const literals\|declare function literals" node_modules/convex-helpers/validators.d.ts`
Expected: one match (it exists in 0.1.114). If it ever vanishes, fall back to `v.union(...SOURCE_STATUSES.map((s) => v.literal(s)))` everywhere `literals` appears below.

- [ ] **Step 2: Add imports and canonical validators to schema.ts**

At the top of `convex/schema.ts` add:

```typescript
import { literals } from "convex-helpers/validators";
import {
  HYPOTHESIS_STATUSES,
  RECIPE_STATUSES,
  SOURCE_BLOCKED_REASONS,
  SOURCE_STATUSES,
} from "./shared/statuses";
```

Below the existing exported validators block (after `agentRunEventKindValidator`, before `compositionParameterValidator`), add:

```typescript
export const sourceStatusValidator = literals(...SOURCE_STATUSES);
export const sourceBlockedReasonValidator = literals(...SOURCE_BLOCKED_REASONS);
export const hypothesisStatusValidator = literals(...HYPOTHESIS_STATUSES);
export const recipeStatusValidator = literals(...RECIPE_STATUSES);
```

- [ ] **Step 3: Export the existing private sub-validators**

In `convex/schema.ts`:

1. Line 107: change `const claimValidator = v.object({` → `export const claimValidator = v.object({`
2. Line 141: rename and export the protocol validator:
   `const agentDraftRecipeProtocolValidator = v.object({` → `export const recipeProtocolValidator = v.object({`
   Then update its one in-file reference (line 156, inside `agentDraftRecipePayloadValidator`): `protocol: v.optional(agentDraftRecipeProtocolValidator),` → `protocol: v.optional(recipeProtocolValidator),`
3. Add the two weekly-brief sub-validators (place next to `compositionParameterValidator`):

```typescript
export const studioPromptVariantsValidator = v.object({
  tenMinuteMd: v.string(),
  thirtyMinuteMd: v.string(),
  ninetyMinuteMd: v.string(),
});

export const recommendedActionValidator = v.object({
  kind: v.union(
    v.literal("advance_recipe"),
    v.literal("revive_recipe"),
    v.literal("expand_composition"),
    v.literal("compare_branch"),
    v.literal("prototype_hypothesis"),
  ),
  targetType: v.union(v.literal("hypothesis"), v.literal("recipe"), v.literal("composition")),
  targetId: v.string(),
  durationBucket: v.union(
    v.literal("10-minute"),
    v.literal("30-minute"),
    v.literal("90-minute"),
  ),
  reason: v.string(),
});
```

- [ ] **Step 4: Point the table definitions at the canonical validators**

Still in `convex/schema.ts`:

1. Sources table (:347-368): replace the inline `status: v.union(... 9 literals ...)` with `status: sourceStatusValidator,` and `blockedReason: v.optional(v.union(... 7 literals ...))` with `blockedReason: v.optional(sourceBlockedReasonValidator),`
2. Hypotheses table (:491-498): replace the inline 6-literal union with `status: hypothesisStatusValidator,`
3. Recipes table: replace the inline protocol object (:536-547) with `protocol: v.optional(recipeProtocolValidator),` and the inline status (:553-557) with `status: recipeStatusValidator,`
4. WeeklyBriefs table (:679-710): replace the inline `studioPrompts` object with `studioPrompts: v.optional(studioPromptVariantsValidator),` and the inline `recommendedActions` array with `recommendedActions: v.optional(v.array(recommendedActionValidator)),`

These are value-identical swaps — the pushed schema JSON must not change shape.

- [ ] **Step 5: Type-gate and push**

Run: `bunx convex codegen`
Expected: completes with no TypeScript errors (this pushes to the live deployment; the swap is shape-identical so it is safe).

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts
git commit -m "refactor(schema): export canonical status + sub-object validators

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: validators.ts composes from schema

**Files:**
- Modify: `convex/validators.ts` (:1-13 imports; delete local `claimValidator` :29-41, `sourceStatusValidator` :58-68, inline blockedReason :90-100, `hypothesisStatusValidator` :188-195; replace defs of `recipeProtocolValidator` :241-250, `studioPromptVariantsValidator` :340-344, `recommendedActionValidator` :346-358; recipe status inline at :251)

**Interfaces:**
- Consumes: Task 2's schema exports.
- Produces: `validators.ts` keeps exporting `recipeParameterValidator`, `recipeProtocolValidator`, `studioPromptVariantsValidator`, `recommendedActionValidator` (now re-exports) so existing importers (`recipes.ts`, `weeklyBriefs.ts`, others) don't break.

- [ ] **Step 1: Rewrite the imports and delete the local copies**

In `convex/validators.ts`:

1. Extend the import from `./schema` (lines 2-12) to:

```typescript
import {
  agentOriginFields,
  campaignStatusValidator,
  claimValidator,
  compositionParameterValidator,
  editorialArtifactKindValidator,
  editorialArtifactStatusValidator,
  editorialEvidenceStatusValidator,
  hypothesisStatusValidator,
  recipeProtocolValidator,
  recipeStatusValidator,
  recipeVerificationValidator,
  registryStatusValidator,
  sourceBlockedReasonValidator,
  sourceStatusValidator,
  studioPromptVariantsValidator,
  recommendedActionValidator,
  visibilityValidator,
} from "./schema";
```

2. Delete the local `claimValidator` (:29-41), local `sourceStatusValidator` (:58-68), and local `hypothesisStatusValidator` (:188-195) definitions.
3. In `sourceReturnValidator` (:90-100): replace the inline blockedReason union with `blockedReason: v.optional(sourceBlockedReasonValidator),`
4. Replace the definitions of `recipeProtocolValidator`, `studioPromptVariantsValidator`, `recommendedActionValidator` with re-exports so downstream imports keep working:

```typescript
export { recipeProtocolValidator, studioPromptVariantsValidator, recommendedActionValidator };
```

5. In `recipeReturnValidator`: replace `status: v.union(v.literal("draft"), v.literal("in_use"), v.literal("archived")),` with `status: recipeStatusValidator,`

- [ ] **Step 2: Type-gate**

Run: `bunx convex codegen`
Expected: no errors. If any other file imported the deleted locals, the compiler lists it — fix by importing from `./schema`.

- [ ] **Step 3: Run the existing test suite**

Run: `bun test convex/*.test.ts convex/shared/*.test.ts`
Expected: all pass (no behavior change).

- [ ] **Step 4: Commit**

```bash
git add convex/validators.ts
git commit -m "refactor(validators): compose return validators from schema exports

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Fix the recipe-create rejection bug (test-first)

**Files:**
- Modify: `convex/recipes.ts` (status union :12-16; `validateGeneratedRecipePayload` export at :67; `create` args :265-284)
- Test: `convex/recipes.test.ts` (new)

**Interfaces:**
- Consumes: `recipeParameterValidator`, `recipeProtocolValidator` from `./validators`; `recipeStatusValidator` from `./schema`.
- Produces: `validateGeneratedRecipePayload(raw: unknown): ParsedRecipePayload` becomes exported (plan 04's harness tests reuse it).

**Context:** `validateGeneratedRecipePayload` always emits parameters shaped `{kind, type, value, details}` (recipes.ts:129-135), and `generateFromHypothesis` passes them to `ctx.runMutation(api.recipes.create, ...)` (:511). But `create`'s args validator (:265-271) only allows `{type, value, details}` — Convex object validators reject unknown fields, so every AI-generated recipe dies at the create seam. The recipes *table* already accepts `kind` (`parameters: v.array(compositionParameterValidator)`), so only the args validator is wrong.

- [ ] **Step 1: Write the failing test**

Create `convex/recipes.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { recipeParameterValidator } from "./validators";
import { validateGeneratedRecipePayload } from "./recipes";

const generatedPayload = {
  title: "Test 432Hz drone bed",
  bodyMd: "Layer a drone at 432Hz.",
  parameters: [{ kind: "frequency", type: "frequency", value: "432Hz" }],
  dawChecklist: ["Set project tuning"],
};

describe("generated recipe payload vs create args validator", () => {
  test("validated parameters always carry kind", () => {
    const parsed = validateGeneratedRecipePayload(generatedPayload);
    for (const param of parsed.parameters) {
      expect(param.kind).toBeDefined();
    }
  });

  test("every produced parameter key is accepted by the canonical parameter validator", () => {
    const parsed = validateGeneratedRecipePayload(generatedPayload);
    const allowed = new Set(Object.keys(recipeParameterValidator.fields));
    for (const param of parsed.parameters) {
      for (const key of Object.keys(param)) {
        expect(allowed.has(key)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test convex/recipes.test.ts`
Expected: FAIL — `validateGeneratedRecipePayload` is not exported (SyntaxError/undefined import).

- [ ] **Step 3: Export the payload validator and widen the create args**

In `convex/recipes.ts`:

1. Line 67: `function validateGeneratedRecipePayload(` → `export function validateGeneratedRecipePayload(`
2. Replace the local status union (:12-16) with an import — add `recipeStatusValidator` to the existing `./schema` imports if one exists, otherwise add `import { recipeStatusValidator } from "./schema";` and delete the local `recipeStatusValidator` const. Update any in-file uses to the imported name (same name, so deleting the local is enough).
3. Add `recipeParameterValidator, recipeProtocolValidator` to the existing `from "./validators"` import (line ~10).
4. In `create`'s args (:265-284): replace the inline parameters object with the canonical validator and the inline protocol with the shared one:

```typescript
    parameters: v.array(recipeParameterValidator),
    dawChecklist: v.array(v.string()),
    protocol: v.optional(recipeProtocolValidator),
```

(The canonical parameter validator makes `type` optional and admits `kind`/`registryStatus`/`canonicalKind` — a strict widening; existing human callers that send `{type, value}` still validate, and the handler's `ctx.db.insert("recipes", ...)` already matches the table shape.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test convex/recipes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-gate**

Run: `bunx convex codegen`
Expected: no errors.

- [ ] **Step 6 (optional live check): generate one recipe end-to-end**

Run: `bunx convex run recipes:generateBatch '{"limit": 1, "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'`
Expected: completes without an `ArgumentValidationError` mentioning `parameters[0].kind` (pre-fix it fails exactly there). Skip if no draft hypotheses exist.

- [ ] **Step 7: Commit**

```bash
git add convex/recipes.ts convex/recipes.test.ts
git commit -m "fix(recipes): accept generated parameter kind at the create seam

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Point the remaining convex modules at the canonical validators

**Files:**
- Modify: `convex/sources.ts` (:9-20 local status validator; :190-214 `updateStatus` inline unions)
- Modify: `convex/admin.ts` (:94-115 `setSourceStatus` inline unions)
- Modify: `convex/hypotheses.ts` (:14-21 local status validator)
- Modify: `convex/extractInternal.ts` (:12-45 inline claim + parameter objects)
- Modify: `convex/weeklyBriefs.ts` (:92-115 `create` inline studioPrompts/recommendedActions)

**Interfaces:**
- Consumes: Task 2's schema exports only. No new exports.

- [ ] **Step 1: sources.ts**

1. Delete the local `sourceStatusValidator` (:10-20) and add to imports: `import { sourceBlockedReasonValidator, sourceStatusValidator } from "./schema";`
2. In `updateStatus` args (:193-214): replace the inline 9-literal status union with `status: sourceStatusValidator,` and the inline blockedReason union with `blockedReason: v.optional(sourceBlockedReasonValidator),`

Note: the deleted local listed `triaged` before `review_needed` — order inside a union has no runtime meaning in Convex, so unifying on schema order is safe.

- [ ] **Step 2: admin.ts**

In `setSourceStatus` args (:97-115): same two replacements; add `import { sourceBlockedReasonValidator, sourceStatusValidator } from "./schema";`

- [ ] **Step 3: hypotheses.ts**

Delete the local `hypothesisStatusValidator` (:14-21); add `hypothesisStatusValidator` to the file's existing `./schema` import (or add `import { hypothesisStatusValidator } from "./schema";`).

- [ ] **Step 4: extractInternal.ts**

Replace the inline claims/parameters validators in `storeExtraction` args:

```typescript
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { claimValidator, compositionParameterValidator } from "./schema";

export const storeExtraction = internalMutation({
  args: {
    sourceId: v.id("sources"),
    model: v.string(),
    promptVersion: v.string(),
    inputHash: v.string(),
    summary: v.string(),
    claims: v.array(claimValidator),
    compositionParameters: v.array(compositionParameterValidator),
    topics: v.array(v.string()),
    openQuestions: v.array(v.string()),
    confidence: v.number(),
  },
```

(Behavior note: this narrows `registryStatus` from `v.string()` to the 4-literal `registryStatusValidator`. `convex/extract.ts` never sets `registryStatus` — verified by grep — so nothing breaks; the narrowing is the point.)

- [ ] **Step 5: weeklyBriefs.ts**

In `create` args (:92-115): add `import { recommendedActionValidator, studioPromptVariantsValidator } from "./schema";` and replace:

```typescript
    studioPrompts: studioPromptVariantsValidator,
    recommendedActions: v.array(recommendedActionValidator),
```

(Keep `studioPrompts` required here — the table is optional but `create` intentionally demands it.)

- [ ] **Step 6: Type-gate and tests**

Run: `bunx convex codegen && bun test convex/*.test.ts convex/shared/*.test.ts`
Expected: both green.

- [ ] **Step 7: Commit**

```bash
git add convex/sources.ts convex/admin.ts convex/hypotheses.ts convex/extractInternal.ts convex/weeklyBriefs.ts
git commit -m "refactor(convex): import canonical validators instead of restating unions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Web imports the contract (fixes the admin dropdown drift)

**Files:**
- Modify: `web/src/routes/admin.tsx` (:277-282 hardcoded `<option>` list)
- Modify: `web/src/lib/zodiac-data.ts` (:181-195 `STATUS_COLORS`)

**Interfaces:**
- Consumes: `SOURCE_STATUSES`, `SourceStatus`, `HypothesisStatus`, `RecipeStatus` from `convex/shared/statuses` (import path from `web/src/routes/` and `web/src/lib/` is `../../../convex/shared/statuses` — same depth as the existing `../../../convex/_generated/dataModel` imports).

- [ ] **Step 1: admin.tsx — generate the options**

Add imports at the top of `web/src/routes/admin.tsx`:

```typescript
import { For } from "solid-js";
import { SOURCE_STATUSES } from "../../../convex/shared/statuses";
```

(Skip the `For` import if the file already imports it — check the existing import block.)

Replace the six hardcoded `<option>` lines (:277-282) with:

```tsx
          <For each={SOURCE_STATUSES}>
            {(status) => <option value={status}>{status}</option>}
          </For>
```

This restores the missing `extracted`, `promoted_followers`, `promoted_public` options and tracks the schema forever.

- [ ] **Step 2: zodiac-data.ts — compile-check the color map**

Replace the `STATUS_COLORS` block (:181-195) with:

```typescript
import type {
  HypothesisStatus,
  RecipeStatus,
  SourceStatus,
} from "../../../convex/shared/statuses";

type PipelineStatus = SourceStatus | HypothesisStatus | RecipeStatus;

// Compile-checked against the contract: an unknown key here is now a type error.
const STATUS_COLOR_MAP = {
  ingested: "#4a5568",
  text_ready: "#2b6cb0",
  extracting: "#c8a84b",
  extracted: "#38a169",
  review_needed: "#d69e2e",
  triaged: "#805ad5",
  promoted_followers: "#b7791f",
  promoted_public: "#c8a84b",
  draft: "#718096",
  queued: "#2b6cb0",
  active: "#38a169",
  evaluated: "#805ad5",
  in_use: "#38a169",
  archived: "#4a5568",
} satisfies Partial<Record<PipelineStatus, string>>;

// Loose lookup surface for callers indexing with runtime strings.
export const STATUS_COLORS: Record<string, string> = STATUS_COLOR_MAP;
```

(The `import type` lines go to the top of the file with the other imports. The two `promoted_*` colors are new — gold-family per the design system since promotion is an emphasis state.)

- [ ] **Step 3: Type-gate the web app**

Run: `bun run typecheck:web`
Expected: no errors. If tsc complains about importing outside `web/src`, check that the existing `../../../convex/_generated/dataModel` imports still typecheck (they do today — same mechanism); any failure here means a tsconfig `include` fix, not a code change: add `"../convex/shared/**/*.ts"` to `web/tsconfig.json` `include`.

- [ ] **Step 4: Visual sanity check**

Run: `cd web && bun run dev` — open the admin route, confirm the status dropdown now lists all 9 statuses.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/admin.tsx web/src/lib/zodiac-data.ts
git commit -m "fix(web): derive status options and colors from the shared contract

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Scripts import the contract

**Files:**
- Modify: `scripts/build-bibliography.ts` (:105)
- Modify: `scripts/find-dupes.ts` (:40)
- Modify: `scripts/fetch-full-articles.ts` (:77)

**Interfaces:**
- Consumes: `SourceStatus` type from `convex/shared/statuses` (import path from `scripts/`: `../convex/shared/statuses`).

- [ ] **Step 1: Replace the literal arrays**

In each file add `import type { SourceStatus } from "../convex/shared/statuses";` and retype the array:

`scripts/build-bibliography.ts:105`:
```typescript
  const statuses: readonly SourceStatus[] = ["extracted", "text_ready", "ingested"];
```

`scripts/find-dupes.ts:40`:
```typescript
  const statuses: readonly SourceStatus[] = ["ingested", "text_ready", "extracted"];
```

`scripts/fetch-full-articles.ts:77`:
```typescript
  const statuses: readonly SourceStatus[] = ["extracted", "text_ready"];
```

Where the loop passes `status as any` to `api.sources.listByStatus` (find-dupes.ts does), drop the `as any` — the typed value now matches.

- [ ] **Step 2: Smoke-run one script read-only**

Run: `bun run scripts/find-dupes.ts` (no `--archive` flag = report-only)
Expected: prints "Checking N sources for duplicates..." and exits 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/build-bibliography.ts scripts/find-dupes.ts scripts/fetch-full-articles.ts
git commit -m "refactor(scripts): type status filters against the shared contract

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Done criteria

- `grep -rn 'v.literal("ingested")' convex/ web/ scripts/` returns zero hits — the only remaining spelling of a source status is the `SOURCE_STATUSES` array in `convex/shared/statuses.ts`.
- `bunx convex codegen`, `bun test convex/*.test.ts convex/shared/*.test.ts`, and `bun run typecheck:web` all green.
- `recipes:generateBatch` no longer fails arg validation on `parameters[*].kind`.
