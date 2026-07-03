# Delete Web's Hand-Rolled Function-Name Table (Architecture C7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `web/src/integrations/convex/api.ts` (93 string-typed `makeFunctionReference` entries) and point all 21 consumer routes at the compile-checked `convex/_generated/api` instead.

**Architecture:** The Solid reactive wrappers (`createQuery`, `createQueryWithStatus`, `createMutation`, `createAction`) are a deep module and **stay untouched** — they already accept plain `FunctionReference<"query" | "mutation" | "action">` generics (web/src/integrations/convex/query.ts:31, :69; mutation.ts:4; action.ts:4), which the generated api's refs satisfy directly, so **zero type changes are needed**. Only the shallow pass-through name table dies. The migration is mechanical: `convexApi.<group>.<key>` → `api.<group>.<fn>`, identity in all but 4 aliased keys.

**Tech Stack:** SolidJS + Vite web app, Convex generated API (`convex/_generated/api`), TypeScript, Bun.

## Global Constraints

- Typegate: `bun run typecheck:web` **run from the repo root** (`/Users/kelliott/code/frequency-music`) — it expands to `cd web && bunx tsc --noEmit`. Baseline verified clean on 2026-07-03.
- Zero behaviour change intended — this is a pure seam repoint. No route logic, JSX, or styling edits.
- `web/src/routes/zodiac-3d.tsx` is performance-sensitive: import swap only, restructure nothing.
- All 21 consumers live in `web/src/routes/`, so the generated-api import path is uniform: `../../../convex/_generated/api` (same shape as the existing `../../../convex/_generated/dataModel` imports).
- `web/src/integrations/convex/index.ts` does **not** re-export `./api`, and nothing inside `web/src/integrations/` imports `./api` — no barrel updates needed.
- All 93 refs were verified (2026-07-03) to exist as **public** `query`/`mutation`/`action` exports in their convex modules. No internal-function mismatches exist. If tsc disagrees during execution, stop and surface it — do not guess a replacement name.
- macOS `sed` syntax (`sed -i ''`). Run commands from the repo root unless stated otherwise.
- Commit messages end with:

  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```

## The complete old → new mapping

Derived by reading every entry of `web/src/integrations/convex/api.ts`. The nested key equals the convex function name for **all entries except the four flagged aliases**, so `convexApi.` → `api.` is a safe global substitution **after** the four renames below are applied.

| `convexApi` key | Generated api ref | Note |
|---|---|---|
| `inbox.list`, `inbox.counts` | `api.inbox.<same>` | identity |
| `sources.listRecent`, `.createFromUrlInput`, `.createFromYouTubeInput`, `.createFromUrlAndQueue`, `.createFromYouTubeAndQueue`, `.updateStatus`, `.setVisibility` | `api.sources.<same>` | identity |
| `extract.extractSource` | `api.extract.extractSource` | identity |
| `theses.list`, `.get`, `.getByIds`, `.getDetail`, `.create`, `.update` | `api.theses.<same>` | identity |
| `campaigns.list`, `.listForSelection`, `.get`, `.getActive`, `.getRecommendedActions`, `.create`, `.update`, `.setActive`, `.attachThesis`, `.detachThesis` | `api.campaigns.<same>` | identity |
| `hypotheses.get`, `.listByStatus`, `.listByThesis`, `.listMissingWhyThisMatters`, `.create`, `.update`, `.deleteById` | `api.hypotheses.<same>` | identity |
| `recipes.get`, `.listByStatus`, `.create`, `.generateFromHypothesis` | `api.recipes.<same>` | identity |
| `weeklyBriefs.get`, `.list`, `.generate`, `.publish`, `.publishToNotion` | `api.weeklyBriefs.<same>` | identity |
| `compositions.list`, `.getLineage`, `.create`, `.update` | `api.compositions.<same>` | identity |
| `failures.listArchive`, `.getByKey`, `.getByKeys` | `api.failures.<same>` | identity |
| `agentRuns.get`, `.getPublic` | `api.agentRuns.<same>` | identity |
| **`agentRuns.listRecent`** | **`api.agentRuns.listRecentPublic`** | ALIAS — rename |
| **`agentRuns.listEvents`** | **`api.agentRuns.listEventsPublic`** | ALIAS — rename |
| **`agentRuns.statusCounts`** | **`api.agentRuns.statusCountsPublic`** | ALIAS — rename |
| `agentDrafts.listByRun`, `.listPending`, `.approve`, `.reject`, `.supersede` | `api.agentDrafts.<same>` | identity |
| **`agentDrafts.countPending`** | **`api.agentDrafts.countPendingPublic`** | ALIAS — rename |
| `listening.listRecent`, `.create` | `api.listening.<same>` | identity |
| `editorialArtifacts.list`, `.get`, `.createDraftFromWeeklyBrief`, `.createDraftFromCampaign`, `.createDraftFromThesis`, `.update`, `.submitForReview`, `.approve`, `.publish`, `.listPublicExport`, `.exportForAstro` | `api.editorialArtifacts.<same>` | identity |
| `admin.workspaceSnapshot`, `.listFeeds`, `.createFeed`, `.setFeedEnabled`, `.pollFeedsNow`, `.setSourceStatus`, `.promoteVisibility` | `api.admin.<same>` | identity |
| `dashboard.pipeline`, `.zodiacSectors`, `.editorialSignals`, `.activityFeed`, `.domainSubTopics`, `.pipelineItems`, `.itemRelations` | `api.dashboard.<same>` | identity |
| `vocabulary.reviewSummary` | `api.vocabulary.reviewSummary` | identity |
| `graph.getConceptsForDomain`, `.getConceptEdges`, `.getConceptDetail` | `api.graph.<same>` | identity |
| `workflows.startBatchExtraction`, `.startSingleSourceExtraction` | `api.workflows.<same>` | identity |

The four aliases appear in exactly two files: `web/src/routes/agent-runs.tsx` (lines 160, 166, 173, 175) and `web/src/routes/agent-run-detail.tsx` (line 211). Both are migrated by hand in Task 1; every other file is pure identity substitution.

## The per-file mechanical transform (Tasks 2–3)

For each identity-only file:

1. Replace the line `import { convexApi } from "../integrations/convex/api";` with `import { api } from "../../../convex/_generated/api";`
2. Replace every `convexApi.` with `api.`

Verified safe (2026-07-03): no file uses bare `convexApi` without a trailing dot except its own import line, so the two-substitution sed below cannot miss or double-apply:

```bash
sed -i '' \
  -e 's|^import { convexApi } from "../integrations/convex/api";$|import { api } from "../../../convex/_generated/api";|' \
  -e 's/\bconvexApi\./api./g' \
  web/src/routes/<FILE>
```

---

### Task 1: Migrate the three alias-bearing agent routes (hand-edited exemplars)

**Files:**
- Modify: `web/src/routes/agent-runs.tsx` (lines 15, 160, 166, 173, 175)
- Modify: `web/src/routes/agent-run-detail.tsx` (lines 23, 117, 118, 208, 211, 216)
- Modify: `web/src/routes/agent-drafts.tsx` (lines 22, 58, 105, 106, 256)

**Interfaces:**
- Consumes: `api` from `convex/_generated/api` (exists today; no earlier task).
- Produces: nothing later tasks depend on — Tasks 2–4 are independent of this one's edits, but the commit pattern here is the exemplar.

- [ ] **Step 1: Edit `web/src/routes/agent-runs.tsx`**

Line 15 — replace the import:

```tsx
// OLD (line 15):
import { convexApi } from "../integrations/convex/api";
// NEW:
import { api } from "../../../convex/_generated/api";
```

Then the four call sites, applying the alias renames:

```tsx
// line 160 OLD:
  const runs = createQueryWithStatus(convexApi.agentRuns.listRecent, () => ({
// line 160 NEW:
  const runs = createQueryWithStatus(api.agentRuns.listRecentPublic, () => ({

// line 166 OLD:
    convexApi.agentRuns.statusCounts,
// line 166 NEW:
    api.agentRuns.statusCountsPublic,

// line 173 OLD:
    convexApi.agentDrafts.countPending,
// line 173 NEW:
    api.agentDrafts.countPendingPublic,

// line 175 OLD:
  const events = createQueryWithStatus(convexApi.agentRuns.listEvents, () => {
// line 175 NEW:
  const events = createQueryWithStatus(api.agentRuns.listEventsPublic, () => {
```

- [ ] **Step 2: Edit `web/src/routes/agent-run-detail.tsx`**

```tsx
// line 23 OLD:
import { convexApi } from "../integrations/convex/api";
// line 23 NEW:
import { api } from "../../../convex/_generated/api";

// line 117 OLD:
  const approve = createMutation(convexApi.agentDrafts.approve);
// line 117 NEW:
  const approve = createMutation(api.agentDrafts.approve);

// line 118 OLD:
  const reject = createMutation(convexApi.agentDrafts.reject);
// line 118 NEW:
  const reject = createMutation(api.agentDrafts.reject);

// line 208 OLD:
  const run = createQueryWithStatus(convexApi.agentRuns.getPublic, () => ({
// line 208 NEW:
  const run = createQueryWithStatus(api.agentRuns.getPublic, () => ({

// line 211 OLD (ALIAS):
  const events = createQueryWithStatus(convexApi.agentRuns.listEvents, () => ({
// line 211 NEW:
  const events = createQueryWithStatus(api.agentRuns.listEventsPublic, () => ({

// line 216 OLD:
    convexApi.agentDrafts.listByRun,
// line 216 NEW:
    api.agentDrafts.listByRun,
```

- [ ] **Step 3: Edit `web/src/routes/agent-drafts.tsx`** (identity-only — no aliases)

```tsx
// line 22 OLD:
import { convexApi } from "../integrations/convex/api";
// line 22 NEW:
import { api } from "../../../convex/_generated/api";

// line 58 OLD:
  const run = createQueryWithStatus(convexApi.agentRuns.getPublic, () => ({
// line 58 NEW:
  const run = createQueryWithStatus(api.agentRuns.getPublic, () => ({

// line 105 OLD:
  const approve = createMutation(convexApi.agentDrafts.approve);
// line 105 NEW:
  const approve = createMutation(api.agentDrafts.approve);

// line 106 OLD:
  const reject = createMutation(convexApi.agentDrafts.reject);
// line 106 NEW:
  const reject = createMutation(api.agentDrafts.reject);

// line 256 OLD:
    convexApi.agentDrafts.listPending,
// line 256 NEW:
    api.agentDrafts.listPending,
```

- [ ] **Step 4: Verify no stragglers in the three files**

Run: `grep -n "convexApi" web/src/routes/agent-runs.tsx web/src/routes/agent-run-detail.tsx web/src/routes/agent-drafts.tsx`
Expected: no output (exit code 1).

- [ ] **Step 5: Typecheck**

Run (from repo root): `bun run typecheck:web`
Expected: exits 0 with no error output. This proves the generated refs satisfy the wrappers' `FunctionReference` generics and that the four alias renames are correct.

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/agent-runs.tsx web/src/routes/agent-run-detail.tsx web/src/routes/agent-drafts.tsx
git commit -m "refactor(web): point agent routes at generated convex api

The hand-rolled convexApi table aliased four names
(listRecent/listEvents/statusCounts -> *Public, countPending ->
countPendingPublic); call sites now use the real generated names.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Migrate the nine pipeline routes (identity substitution)

**Files:**
- Modify: `web/src/routes/admin.tsx`
- Modify: `web/src/routes/display.tsx`
- Modify: `web/src/routes/ingest.tsx`
- Modify: `web/src/routes/hypotheses.tsx`
- Modify: `web/src/routes/hypothesis-detail.tsx`
- Modify: `web/src/routes/recipes.tsx`
- Modify: `web/src/routes/recipe-detail.tsx`
- Modify: `web/src/routes/compositions.tsx`
- Modify: `web/src/routes/composition-detail.tsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing later tasks consume.

None of these nine files touch the four aliased keys (verified 2026-07-03: aliases exist only in agent-runs.tsx and agent-run-detail.tsx, both migrated in Task 1), so the two-substitution sed is exact.

- [ ] **Step 1: Apply the mechanical transform**

```bash
for f in admin display ingest hypotheses hypothesis-detail recipes recipe-detail compositions composition-detail; do
  sed -i '' \
    -e 's|^import { convexApi } from "../integrations/convex/api";$|import { api } from "../../../convex/_generated/api";|' \
    -e 's/\bconvexApi\./api./g' \
    "web/src/routes/$f.tsx"
done
```

- [ ] **Step 2: Verify the import landed in all nine files and no stragglers remain**

Run: `grep -l '_generated/api' web/src/routes/{admin,display,ingest,hypotheses,hypothesis-detail,recipes,recipe-detail,compositions,composition-detail}.tsx | wc -l`
Expected: `9`

Run: `grep -n "convexApi" web/src/routes/{admin,display,ingest,hypotheses,hypothesis-detail,recipes,recipe-detail,compositions,composition-detail}.tsx`
Expected: no output (exit code 1).

- [ ] **Step 3: Typecheck**

Run (from repo root): `bun run typecheck:web`
Expected: exits 0 with no error output. A failure here means a call site passed args that the real function's validator types reject — the string table was hiding a genuine arg mismatch. Surface it; do not paper over it.

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/admin.tsx web/src/routes/display.tsx web/src/routes/ingest.tsx \
  web/src/routes/hypotheses.tsx web/src/routes/hypothesis-detail.tsx \
  web/src/routes/recipes.tsx web/src/routes/recipe-detail.tsx \
  web/src/routes/compositions.tsx web/src/routes/composition-detail.tsx
git commit -m "refactor(web): point pipeline routes at generated convex api

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Migrate the nine editorial/synthesis routes (identity substitution)

**Files:**
- Modify: `web/src/routes/editorial.tsx`
- Modify: `web/src/routes/editorial-detail.tsx`
- Modify: `web/src/routes/failures.tsx`
- Modify: `web/src/routes/feedback.tsx`
- Modify: `web/src/routes/theses.tsx`
- Modify: `web/src/routes/thesis-detail.tsx`
- Modify: `web/src/routes/weekly-brief-detail.tsx`
- Modify: `web/src/routes/weekly-turns.tsx`
- Modify: `web/src/routes/zodiac-3d.tsx` — **import swap only; this route is performance-sensitive, change nothing else**

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: after this task, zero consumers of `integrations/convex/api` remain — the precondition Task 4 verifies.

- [ ] **Step 1: Apply the mechanical transform**

```bash
for f in editorial editorial-detail failures feedback theses thesis-detail weekly-brief-detail weekly-turns zodiac-3d; do
  sed -i '' \
    -e 's|^import { convexApi } from "../integrations/convex/api";$|import { api } from "../../../convex/_generated/api";|' \
    -e 's/\bconvexApi\./api./g' \
    "web/src/routes/$f.tsx"
done
```

- [ ] **Step 2: Verify**

Run: `grep -l '_generated/api' web/src/routes/{editorial,editorial-detail,failures,feedback,theses,thesis-detail,weekly-brief-detail,weekly-turns,zodiac-3d}.tsx | wc -l`
Expected: `9`

Run: `grep -rn "convexApi" web/src/routes/`
Expected: no output (exit code 1) — all 21 routes are now migrated.

- [ ] **Step 3: Typecheck**

Run (from repo root): `bun run typecheck:web`
Expected: exits 0 with no error output.

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/editorial.tsx web/src/routes/editorial-detail.tsx \
  web/src/routes/failures.tsx web/src/routes/feedback.tsx \
  web/src/routes/theses.tsx web/src/routes/thesis-detail.tsx \
  web/src/routes/weekly-brief-detail.tsx web/src/routes/weekly-turns.tsx \
  web/src/routes/zodiac-3d.tsx
git commit -m "refactor(web): point editorial and synthesis routes at generated convex api

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Delete the name table

**Files:**
- Delete: `web/src/integrations/convex/api.ts`

**Interfaces:**
- Consumes: Tasks 1–3 complete (zero remaining importers).
- Produces: the deletion test passes — 147 lines gone, nothing reappears anywhere.

- [ ] **Step 1: Confirm zero importers remain (deletion-test precondition)**

Run: `grep -rn "integrations/convex/api" web/src`
Expected: no output (exit code 1). If anything appears, a consumer was missed — go back and migrate it before deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm web/src/integrations/convex/api.ts
```

- [ ] **Step 3: Typecheck**

Run (from repo root): `bun run typecheck:web`
Expected: exits 0 with no error output.

- [ ] **Step 4: Final straggler sweep**

Run: `grep -rn "convexApi\|makeFunctionReference" web/src`
Expected: no output (exit code 1). Every function name web calls is now compile-checked against `convex/_generated/api`; a typo'd name can no longer build.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(web): delete hand-rolled convex function-name table

93 string-typed makeFunctionReference entries duplicated
convex/_generated/api and silently drifted (four aliased names).
All routes now import the generated, compile-checked api directly.
The deep Solid wrappers (createQuery/createMutation/createAction)
are unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review

1. **Spec coverage:** delete the shallow name table (Task 4), repoint all 21 consumers (Tasks 1–3: 3 + 9 + 9 = 21), keep the deep wrappers untouched (no task edits query.ts/mutation.ts/action.ts), zero type tweaks needed (verified against the wrappers' `FunctionReference` generics), alias mismatches handled explicitly (Task 1), internal-ref risk pre-cleared (all 93 refs verified public). ✓
2. **Placeholder scan:** no TBDs; every edit shows exact old/new lines or an exact sed transform whose safety precondition (no bare `convexApi` uses) was verified against the codebase. ✓
3. **Type consistency:** the only identifier introduced is `api` from `../../../convex/_generated/api`, used identically in all tasks; alias renames appear only in Task 1 and match the mapping table. ✓
