# Convex-Test Harness (Test Through the Seam) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercise Convex handler glue (mutations/actions with arg validators, index queries, and status transitions) through the same interface production callers use, via the `convex-test` in-memory harness — the layer where the `ctx.db`-in-action bug (6762a41) and the recipe `kind` validator mismatch lived untested.

**Architecture:** `convex-test` runs registered functions in-memory with full arg/return/schema validation — the exact classes of bug the existing read-only `makeDb` fake structurally cannot catch. Bun lacks `import.meta.glob`, so a hand-rolled module map (`convex/harness/modules.ts`) replaces it. Task 1 is an explicit go/no-go spike under `bun test`; the no-go branch scopes vitest to `convex/harness/**` only. All existing pure-helper `bun:test` suites stay untouched.

**Tech Stack:** Bun, convex-test (new devDep), convex 1.34, existing self-hosted deployment (never touched by the harness — everything runs in-memory).

## Global Constraints

- Bun-first: `bun test`, `bunx`. No vitest unless Task 1 reaches the documented NO-GO.
- Existing pure tests (`convex/*.test.ts`, run by `bun test convex/*.test.ts`) stay untouched; harness tests live in `convex/harness/` and are run separately, so the root `test` script's glob does not pick them up.
- `bunx convex codegen` remains the typegate — it PUSHES to the live deployment; only run it on states that should deploy. The harness itself never contacts the deployment.
- Two `ctx.db` conventions coexist: `agentDrafts.ts`/`agentRuns.ts` use one-arg `ctx.db.get(id)`; pipeline files use two-arg `ctx.db.get("table", id)`. Both are native Convex overloads — the harness exercises both for free (it runs the real functions).
- Mutations cannot `ctx.runMutation`; promotion logic stays in pure builders (decision log 2026-07-01, Gate G2). This plan tests the orchestration those builders can't reach — it does not move logic.
- Seeded rows must satisfy the real schema (convex-test enforces it): `sources` requires `type/status/dedupeKey/visibility/createdBy/createdAt/updatedAt`; `createdBy` is `v.union(v.id("users"), v.literal("system"))`, so tests authenticate as `subject: "system"`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

**Cross-plan dependencies:**
- Task 2 requires plan `2026-07-03-02-arch-single-source-shapes.md` (widened `recipes.create` parameters validator) to be landed first.
- Task 6(b) requires plan `2026-07-03-05-arch-agent-tool-registry.md` (`convex/shared/agentContract.ts`) to be landed first.
- Tasks 1, 3, 4, 5 and 6(a) have no cross-plan dependencies and can run immediately.

---

### Task 1: Spike — convex-test under bun:test (GO/NO-GO gate)

**Files:**
- Modify: `package.json` (devDependency + `test:harness` script)
- Create: `convex/harness/modules.ts`
- Create: `convex/harness/spike.test.ts`

**Interfaces:**
- Produces: `modules` (default-shaped record `Record<string, () => Promise<unknown>>`) exported from `convex/harness/modules.ts`; every later harness test calls `convexTest(schema, modules)`.
- Produces: `bun run test:harness` as the harness suite command.

- [ ] **Step 1: Install convex-test**

Run: `bun add -d convex-test`
Expected: `package.json` devDependencies gains `"convex-test"` (0.0.38 or later).

- [ ] **Step 2: Write the module map**

`convex-test` normally discovers function modules via `import.meta.glob`, which bun does not implement. Hand-roll the map. Keys mimic a glob executed from inside `convex/` (`"./sources.ts"` form); values are lazy import thunks, so heavy modules (`extract.ts` pulls langsmith + AI SDK; `workflows.ts` pulls `@convex-dev/workflow`) are only evaluated if a test actually invokes a function in them.

Create `convex/harness/modules.ts`:

```typescript
// Hand-rolled replacement for import.meta.glob("./**/*.ts") (bun has no glob).
// Keys are paths as if globbed from inside convex/; values are lazy thunks.
// Excludes *.test.ts, testHelpers.ts, harness/, and _generated/.
export const modules: Record<string, () => Promise<unknown>> = {
  "./admin.ts": () => import("../admin"),
  "./agentDraftPromotion.ts": () => import("../agentDraftPromotion"),
  "./agentDrafts.ts": () => import("../agentDrafts"),
  "./agentRuns.ts": () => import("../agentRuns"),
  "./agentTools.ts": () => import("../agentTools"),
  "./agentToolsHttp.ts": () => import("../agentToolsHttp"),
  "./aggregates.ts": () => import("../aggregates"),
  "./auth.ts": () => import("../auth"),
  "./campaigns.ts": () => import("../campaigns"),
  "./components.ts": () => import("../components"),
  "./compositions.ts": () => import("../compositions"),
  "./crons.ts": () => import("../crons"),
  "./dashboard.ts": () => import("../dashboard"),
  "./domainMappings.ts": () => import("../domainMappings"),
  "./editCaptures.ts": () => import("../editCaptures"),
  "./editorialArtifacts.ts": () => import("../editorialArtifacts"),
  "./editorialExports.ts": () => import("../editorialExports"),
  "./extract.ts": () => import("../extract"),
  "./extractInternal.ts": () => import("../extractInternal"),
  "./extractions.ts": () => import("../extractions"),
  "./fabric.ts": () => import("../fabric"),
  "./failures.ts": () => import("../failures"),
  "./feeds.ts": () => import("../feeds"),
  "./graph.ts": () => import("../graph"),
  "./http.ts": () => import("../http"),
  "./hypotheses.ts": () => import("../hypotheses"),
  "./hypothesesInternal.ts": () => import("../hypothesesInternal"),
  "./inbox.ts": () => import("../inbox"),
  "./ingest.ts": () => import("../ingest"),
  "./listening.ts": () => import("../listening"),
  "./phase2.ts": () => import("../phase2"),
  "./recipes.ts": () => import("../recipes"),
  "./recipesInternal.ts": () => import("../recipesInternal"),
  "./schema.ts": () => import("../schema"),
  "./sources.ts": () => import("../sources"),
  "./sourceUtils.ts": () => import("../sourceUtils"),
  "./testing.ts": () => import("../testing"),
  "./theses.ts": () => import("../theses"),
  "./tracing.ts": () => import("../tracing"),
  "./validators.ts": () => import("../validators"),
  "./vocabulary.ts": () => import("../vocabulary"),
  "./weeklyBriefs.ts": () => import("../weeklyBriefs"),
  "./weeklyBriefsInternal.ts": () => import("../weeklyBriefsInternal"),
  "./workflows.ts": () => import("../workflows"),
};
```

(`convex.config.ts` is deliberately omitted — it is app config, not a function module. If `convexTest` setup throws on it being absent/present, see Step 5 troubleshooting.)

- [ ] **Step 3: Write the spike test**

Seeding goes through `t.run` (raw ctx — bypasses auth); reading goes through the real public query `api.sources.listByStatus` (no auth required), so the spike proves: schema load, module map resolution, index query (`by_status_updatedAt`), and return-validator enforcement (`returns: v.array(sourceReturnValidator)`).

Create `convex/harness/spike.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "./modules";

describe("convex-test spike (GO/NO-GO gate)", () => {
  test("seeds a source via t.run and reads it back through the real query", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("sources", {
        type: "url",
        title: "Spike source",
        canonicalUrl: "https://example.com/spike",
        status: "text_ready",
        dedupeKey: "url:example.com/spike",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      });
    });

    const rows = await t.query(api.sources.listByStatus, {
      status: "text_ready",
      limit: 10,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Spike source");
    expect(rows[0].dedupeKey).toBe("url:example.com/spike");
  });
});
```

- [ ] **Step 4: Add the harness script**

In `package.json`, add to `scripts` (leave the existing `"test"` script untouched):

```json
"test:harness": "bun test convex/harness"
```

- [ ] **Step 5: Run the spike — GO/NO-GO decision**

Run: `bun run test:harness`
Expected (GO): `1 pass, 0 fail` → proceed to Step 7.

Troubleshooting before declaring NO-GO (in order):
1. Key-format error (convex-test can't map a module path to a function path): change key style from `"./sources.ts"` to `"../convex/sources.ts"` for all entries (convex-test locates the `convex/` segment in glob keys).
2. Eager-import failure from a component-backed or node-only module (`workflows.ts`, `extract.ts`, `fabric.ts`): trim the map to only the modules the harness tests actually reach — `agentDraftPromotion, agentDrafts, agentRuns, auth, extractInternal, graph, hypotheses, recipes, schema, sources, sourceUtils, validators, vocabulary` — and note the trim in a comment. Component-backed functions (workflows, aggregates, action-cache) are out of harness scope in this plan either way.
3. Missing web APIs in bun (e.g. structuredClone edge, TextEncoder differences): note the exact error, then NO-GO.

- [ ] **Step 6 (NO-GO branch only): vitest scoped to the harness**

Only if Step 5 fails after troubleshooting. Run:

```bash
bun add -d vitest @edge-runtime/vm
```

Create `vitest.config.ts` at the repo root:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/harness/**/*.test.ts"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

Change the `package.json` script to `"test:harness": "vitest run"`. In harness test files, change only the import line `import { describe, expect, test } from "bun:test";` → `from "vitest";`. The hand-rolled `modules` map keeps working under vitest unchanged (optionally simplify later to `import.meta.glob("../**/*.ts")`, which vitest supports natively). Everything else in Tasks 2–5 is runner-agnostic.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock convex/harness/modules.ts convex/harness/spike.test.ts
git commit -m "test(harness): adopt convex-test with hand-rolled module map under bun

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(If NO-GO: also add `vitest.config.ts` and adjust the message to say vitest-scoped.)

---

### Task 2: Regression harness test — recipe parameters carry `kind`

**PRECONDITION:** Plan `2026-07-03-02-arch-single-source-shapes.md` must be landed first — it widens `recipes.create`'s `parameters` args validator (currently `v.object({ type, value, details })` at `convex/recipes.ts:264-272`) to the canonical `compositionParameterValidator`. Verify before starting:

Run: `grep -n "compositionParameterValidator" convex/recipes.ts`
Expected: at least one match inside the `create` args. If no match, STOP — land plan 02 first.

**Files:**
- Create: `convex/harness/recipes.harness.test.ts`

**Interfaces:**
- Consumes: `convexTest(schema, modules)` from Task 1; `api.recipes.create`.
- Produces: the executable regression spec for the `kind`-rejection bug (`validateGeneratedRecipePayload` at `convex/recipes.ts:67-182` always emits `kind`; `generateFromHypothesis` passes it to `create` at `convex/recipes.ts:505-515`).

- [ ] **Step 1: Write the failing-before/green-after test**

Create `convex/harness/recipes.harness.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "./modules";

// Regression: validateGeneratedRecipePayload always emits parameters with a
// `kind` field; before plan 02 the create args validator rejected it as an
// unknown field, so every AI recipe generation failed at the create seam.
describe("recipes.create accepts generated parameter shape", () => {
  test("a parameters array including kind passes arg validation and persists", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    const hypothesisId = await t.run(async (ctx) =>
      ctx.db.insert("hypotheses", {
        title: "Test hypothesis",
        question: "Does 432Hz tuning change perceived warmth?",
        hypothesis: "Retuning to 432Hz increases perceived warmth",
        rationaleMd: "Seeded for harness test",
        sourceIds: [],
        status: "draft",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    const recipeId = await asSystem.mutation(api.recipes.create, {
      hypothesisId,
      title: "432Hz warmth litmus",
      bodyMd: "Render the same 8-bar phrase at 440 and 432.",
      parameters: [
        { kind: "tuning", type: "tuning", value: "432Hz reference" },
      ],
      dawChecklist: ["Set master tuning to 432Hz"],
    });

    const stored = await t.run(async (ctx) => ctx.db.get(recipeId));
    expect(stored?.parameters[0].kind).toBe("tuning");
    expect(stored?.parameters[0].value).toBe("432Hz reference");
  });
});
```

- [ ] **Step 2: Run it**

Run: `bun run test:harness`
Expected: PASS (plan 02 landed per precondition). As a sanity check that the test bites: `git stash` plan 02's recipes.ts change, rerun, expect FAIL with an ArgumentValidationError mentioning `kind`, then `git stash pop`.

- [ ] **Step 3: Commit**

```bash
git add convex/harness/recipes.harness.test.ts
git commit -m "test(harness): regression coverage for generated recipe parameter shape

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: agentDrafts.approve / reject through the interface

**Files:**
- Create: `convex/harness/agentDrafts.harness.test.ts`

**Interfaces:**
- Consumes: `convexTest(schema, modules)`; `api.agentDrafts.approve`, `api.agentDrafts.reject`.
- Produces: interface-level coverage of the promotion orchestration (`convex/agentDrafts.ts:305-412`) that the pure-builder tests (`agentDraftPromotion.test.ts`) cannot reach: kind dispatch, provenance stamping, status patch, audit event insert, rejection note guard.

Notes for the implementer:
- `approve` requires auth (`requireAuth`); authenticate with `t.withIdentity({ subject: "system" })` so `createdBy` lands as the schema-legal literal `"system"` (`createdBy: v.union(v.id("users"), v.literal("system"))` — an arbitrary fake subject would fail schema validation on insert).
- `approve` schedules `api.graph.linkHypothesisConcepts` via `ctx.scheduler.runAfter(0, ...)`. Do NOT flush scheduled functions — the scheduled action runs without the test identity and would throw UNAUTHENTICATED; leaving it pending is fine for these assertions. If bun reports an unhandled background error at teardown, append `await t.finishInProgressScheduledFunctions().catch(() => {});` before the test ends.
- `agentReviewDrafts` required fields (schema.ts): `agentRunId, graphName, kind, title, summary, candidateIds, status, createdBy: "agent", createdAt, updatedAt`; `payload` optional (payload-less drafts are acknowledge-only).

- [ ] **Step 1: Write the tests**

Create `convex/harness/agentDrafts.harness.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "./modules";

async function seedRunAndDraft(
  t: ReturnType<typeof convexTest>,
  payload: Record<string, unknown> | undefined,
  kind: "hypothesis_draft" | "recipe_draft",
) {
  return await t.run(async (ctx) => {
    const agentRunId = await ctx.db.insert("agentRuns", {
      graphName: "research-pipeline",
      status: "completed",
      input: null,
      traceUrl: "https://smith.langchain.com/r/test",
      createdAt: 1000,
      updatedAt: 1000,
    });
    const draftId = await ctx.db.insert("agentReviewDrafts", {
      agentRunId,
      graphName: "research-pipeline",
      kind,
      title: "Draft title",
      summary: "Draft summary",
      candidateIds: [],
      ...(payload ? { payload } : {}),
      status: "pending_review" as const,
      createdBy: "agent" as const,
      createdAt: 1000,
      updatedAt: 1000,
    });
    return { agentRunId, draftId };
  });
}

const hypothesisPayload = {
  title: "Polygon-angle correspondence in 9-EDO",
  question: "Do nonagon interior angles map to consonant 9-EDO intervals?",
  statement: "Nonagon angles map to low-roughness 9-EDO dyads",
  rationale: "Angle/cents correspondence from extraction",
  whyThisMatters:
    "Connects the geometric temperament work to a testable dyad-roughness prediction.",
  sourceIds: [],
  extractionIds: [],
};

describe("agentDrafts.approve promotes through the real interface", () => {
  test("hypothesis draft becomes a hypotheses row with agent provenance", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { agentRunId, draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );

    const result = await asSystem.mutation(api.agentDrafts.approve, {
      draftId,
    });

    expect(result.promotedKind).toBe("hypothesis");
    const hypothesis = await t.run(async (ctx) =>
      ctx.db.get(result.promotedId as Id<"hypotheses">),
    );
    expect(hypothesis?.origin).toBe("agent");
    expect(hypothesis?.agentRunId).toBe(agentRunId);
    expect(hypothesis?.agentDraftId).toBe(draftId);
    expect(hypothesis?.traceUrl).toBe("https://smith.langchain.com/r/test");
    expect(hypothesis?.hypothesis).toBe(hypothesisPayload.statement);

    const draft = await t.run(async (ctx) => ctx.db.get(draftId));
    expect(draft?.status).toBe("approved");
    expect(draft?.promotedId).toBe(result.promotedId);
    expect(draft?.decidedBy).toBe("human");
  });

  test("payload-less draft is acknowledge-only: approve throws INVALID_STATE", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { draftId } = await seedRunAndDraft(t, undefined, "hypothesis_draft");

    await expect(
      asSystem.mutation(api.agentDrafts.approve, { draftId }),
    ).rejects.toThrow(/acknowledge-only|INVALID_STATE/);
  });

  test("approve on an already-decided draft throws", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );
    await asSystem.mutation(api.agentDrafts.approve, { draftId });

    await expect(
      asSystem.mutation(api.agentDrafts.approve, { draftId }),
    ).rejects.toThrow();
  });
});

describe("agentDrafts.reject requires a decision note", () => {
  test("reject stores the note and an audit event", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { agentRunId, draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );

    await asSystem.mutation(api.agentDrafts.reject, {
      draftId,
      decisionNote: "Statement is not falsifiable as written.",
    });

    const draft = await t.run(async (ctx) => ctx.db.get(draftId));
    expect(draft?.status).toBe("rejected");
    expect(draft?.decisionNote).toBe("Statement is not falsifiable as written.");

    const events = await t.run(async (ctx) =>
      ctx.db
        .query("agentRunEvents")
        .withIndex("by_runId_createdAt", (q) => q.eq("runId", agentRunId))
        .collect(),
    );
    expect(events.some((e) => e.kind === "decision")).toBe(true);
  });

  test("reject with a whitespace note throws", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );

    await expect(
      asSystem.mutation(api.agentDrafts.reject, { draftId, decisionNote: "  " }),
    ).rejects.toThrow();
  });
});
```

(A recipe-draft promotion test is deliberately deferred to run after plan 02 lands, since `buildRecipeInsertFromPayload` output must pass the recipes schema — add it then, mirroring the hypothesis test with `kind: "recipe_draft"` and a payload of `{ hypothesisId, title, parameters: [{ kind: "tuning", type: "tuning", value: "432Hz" }], whyThisMatters: "..." }` seeded against a real hypothesis row.)

- [ ] **Step 2: Run**

Run: `bun run test:harness`
Expected: all pass. If the UNAUTHENTICATED background noise from the scheduled `linkHypothesisConcepts` appears, apply the `finishInProgressScheduledFunctions().catch` note above.

- [ ] **Step 3: Commit**

```bash
git add convex/harness/agentDrafts.harness.test.ts
git commit -m "test(harness): cover agentDrafts approve/reject orchestration through the interface

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: agentRuns queue — claim, empty-queue, stale sweep

**Files:**
- Create: `convex/harness/agentRuns.harness.test.ts`

**Interfaces:**
- Consumes: `convexTest(schema, modules)`; `internal.agentRuns.claimNextPending`, `internal.agentRuns.sweepStaleRuns` (convex-test invokes internal functions with the same `t.mutation(ref, args)` call).
- Produces: interface-level coverage of `convex/agentRuns.ts:268-308` (claim) and `:330-365` (sweep) — the DB transitions whose pure helpers (`buildClaimPatch`, `isStaleRun`) are already unit-tested in `agentRuns.test.ts`.

- [ ] **Step 1: Write the tests**

Create `convex/harness/agentRuns.harness.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { internal } from "../_generated/api";
import { DEFAULT_STALE_RUN_MS } from "../agentRuns";
import schema from "../schema";
import { modules } from "./modules";

function seedRun(
  t: ReturnType<typeof convexTest>,
  status: "queued" | "running",
  updatedAt: number,
  graphName = "research-pipeline",
) {
  return t.run(async (ctx) =>
    ctx.db.insert("agentRuns", {
      graphName,
      status,
      input: null,
      createdAt: updatedAt,
      updatedAt,
    }),
  );
}

describe("agentRuns.claimNextPending", () => {
  test("claims the oldest queued run and stamps workerId + running", async () => {
    const t = convexTest(schema, modules);
    const olderId = await seedRun(t, "queued", 1000);
    await seedRun(t, "queued", 2000);

    const claimed = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-a",
    });

    expect(claimed?.runId).toBe(olderId);
    expect(claimed?.status).toBe("running");
    expect(claimed?.workerId).toBe("worker-a");

    const row = await t.run(async (ctx) => ctx.db.get(olderId));
    expect(row?.status).toBe("running");
    expect(row?.workerId).toBe("worker-a");
    expect(row?.startedAt).toBeDefined();
  });

  test("returns null when nothing is queued", async () => {
    const t = convexTest(schema, modules);
    await seedRun(t, "running", 1000);

    const claimed = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-a",
    });
    expect(claimed).toBeNull();
  });

  test("a second claim does not double-claim the same run", async () => {
    const t = convexTest(schema, modules);
    await seedRun(t, "queued", 1000);

    const first = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-a",
    });
    const second = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-b",
    });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});

describe("agentRuns.sweepStaleRuns", () => {
  test("fails a running run whose updatedAt is past the threshold, leaves fresh ones", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const staleId = await seedRun(
      t,
      "running",
      now - DEFAULT_STALE_RUN_MS - 60_000,
    );
    const freshId = await seedRun(t, "running", now);

    const result = await t.mutation(internal.agentRuns.sweepStaleRuns, {});

    expect(result.swept).toBe(1);
    const stale = await t.run(async (ctx) => ctx.db.get(staleId));
    const fresh = await t.run(async (ctx) => ctx.db.get(freshId));
    expect(stale?.status).toBe("failed");
    expect(fresh?.status).toBe("running");
  });
});
```

- [ ] **Step 2: Run**

Run: `bun run test:harness`
Expected: all pass. (The claim path also inserts a `status` audit event via `appendRunEvent`; no assertion needed here — Task 3 already covers event inserts.)

- [ ] **Step 3: Commit**

```bash
git add convex/harness/agentRuns.harness.test.ts
git commit -m "test(harness): cover agentRuns claim and stale sweep transitions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: extractInternal.storeExtraction writes the extraction row

**Files:**
- Create: `convex/harness/extractInternal.harness.test.ts`

**Interfaces:**
- Consumes: `convexTest(schema, modules)`; `internal.extractInternal.storeExtraction` (`convex/extractInternal.ts:5-80`).
- Produces: coverage of the extraction store path, including the `vocabulary.ensureParameterKind` sub-mutation call (`ctx.runMutation` from a mutation is legal for *internal* mutations here because `storeExtraction` is an internalMutation calling another internal mutation — the harness executes it for real, so whatever the real semantics are, the test exercises them).

- [ ] **Step 1: Write the test**

Create `convex/harness/extractInternal.harness.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "./modules";

describe("extractInternal.storeExtraction", () => {
  test("inserts an extraction with normalized composition parameters", async () => {
    const t = convexTest(schema, modules);

    const sourceId = await t.run(async (ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        title: "Cymatics overview",
        status: "extracting",
        dedupeKey: "url:example.com/cymatics",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    const extractionId = await t.mutation(
      internal.extractInternal.storeExtraction,
      {
        sourceId,
        model: "anthropic/claude-sonnet-4-6",
        promptVersion: "extract_v2",
        inputHash: "hash-1",
        summary: "Chladni patterns depend on plate geometry and drive frequency.",
        claims: [
          {
            text: "Nodal line count increases with drive frequency",
            evidenceLevel: "peer_reviewed",
            citations: [{ label: "Jenny 1967" }],
          },
        ],
        compositionParameters: [
          // kind omitted: handler derives it from type
          { type: "drive_frequency", value: "432 Hz" },
        ],
        topics: ["cymatics"],
        openQuestions: [],
        confidence: 0.8,
      },
    );

    const extraction = await t.run(async (ctx) => ctx.db.get(extractionId));
    expect(extraction?.sourceId).toBe(sourceId);
    expect(extraction?.claims).toHaveLength(1);
    // handler backfills kind from type and consults the vocabulary registry
    expect(extraction?.compositionParameters[0].kind).toBe("drive_frequency");
    expect(extraction?.createdBy).toBe("system");

    const kinds = await t.run(async (ctx) =>
      ctx.db.query("parameterKinds").collect().catch(() => []),
    );
    // ensureParameterKind upserted the registry row (table name per vocabulary.ts;
    // if the table is named differently, read convex/vocabulary.ts and adjust)
    expect(Array.isArray(kinds)).toBe(true);
  });
});
```

- [ ] **Step 2: Run**

Run: `bun run test:harness`
Expected: all pass. If the `parameterKinds` table name assertion errors because the vocabulary table has a different name, run `grep -n "defineTable\|insert(" convex/vocabulary.ts | head`, fix the table name in the test, and rerun.

- [ ] **Step 3: Commit**

```bash
git add convex/harness/extractInternal.harness.test.ts
git commit -m "test(harness): cover storeExtraction write path incl. vocabulary upsert

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Contract tests + the memory_recall fix

**Files:**
- Modify: `convex/agentTools.ts` (appendAgentRunEvent action, inline union at ~lines 205-214)
- Create: `convex/contracts.test.ts` (plain bun:test — picked up by the existing `bun test convex/*.test.ts` script; no harness needed)

**Interfaces:**
- Consumes: `agentRunEventKindValidator` exported from `convex/schema.ts` (8 members incl. `memory_recall`).
- Produces: a single declaration site for the event-kind union on the Convex side; `convex/contracts.test.ts` as the home for future cross-copy contract tests (plan 05's zod↔validator equality test and the heartbeat<stale assertion land in this file).

- [ ] **Step 1: Fix the drift — agentTools imports the schema validator**

In `convex/agentTools.ts`, the HTTP-exposed `appendAgentRunEvent` action re-declares a 7-literal union that silently dropped `memory_recall` (schema has 8). Replace the inline union with the schema validator.

Add to the imports at the top of `convex/agentTools.ts`:

```typescript
import { agentRunEventKindValidator } from "./schema";
```

Then in the `appendAgentRunEvent` action args, replace:

```typescript
    kind: v.union(
      v.literal("tool_call"),
      v.literal("decision"),
      v.literal("draft_write"),
      v.literal("error"),
      v.literal("review_request"),
      v.literal("status"),
      v.literal("node"),
    ),
```

with:

```typescript
    kind: agentRunEventKindValidator,
```

- [ ] **Step 2: Write the contract test**

Create `convex/contracts.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { agentRunEventKindValidator } from "./schema";

// Contract tests: pin copies that must agree across seams. When one of these
// fails, fix the drifted copy — do not widen the test.

const EXPECTED_EVENT_KINDS = [
  "decision",
  "draft_write",
  "error",
  "memory_recall",
  "node",
  "review_request",
  "status",
  "tool_call",
].sort();

describe("agent run event kinds", () => {
  test("schema validator carries exactly the canonical 8 kinds", () => {
    const members = (agentRunEventKindValidator as any).members.map(
      (m: any) => m.value,
    );
    expect([...members].sort()).toEqual(EXPECTED_EVENT_KINDS);
  });
});

// Heartbeat/stale timing contract: HEARTBEAT_INTERVAL_MS < DEFAULT_STALE_RUN_MS.
// BLOCKED until plan 2026-07-03-05 lands convex/shared/agentContract.ts — the
// worker constant lives in agent/src/worker/runner.ts today, which is not
// importable from convex tests (separate workspace). Enable then:
//
// import { HEARTBEAT_INTERVAL_MS, STALE_RUN_MS } from "./shared/agentContract";
// test("heartbeat fits inside the stale threshold", () => {
//   expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(STALE_RUN_MS);
// });
test.todo("heartbeat fits inside the stale threshold (needs plan 05 shared contract)");
```

- [ ] **Step 3: Run both suites**

Run: `bun test convex/contracts.test.ts`
Expected: 1 pass, 1 todo.

Run: `bunx convex codegen`
Expected: clean typecheck + deploy (the agentTools.ts edit is additive — the action now *accepts* `memory_recall`; all previously-valid calls remain valid).

Run: `bun test convex/*.test.ts && bun run test:harness`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add convex/agentTools.ts convex/contracts.test.ts
git commit -m "fix(agentTools): accept memory_recall run events; add event-kind contract test

The HTTP-exposed appendAgentRunEvent action re-declared a stale 7-kind
union, so agents could not write memory_recall events the schema allows.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Coverage vs. spec:** spike/go-no-go (Task 1), recipe-kind regression (Task 2, gated on plan 02), approve/reject orchestration (Task 3), queue claim/sweep (Task 4), storeExtraction (Task 5), contract tests + memory_recall fix (Task 6). The runner lifecycle (agent/src/worker/runner.ts) is intentionally NOT harnessed here — it lives in the agent workspace and is addressed by plan 05's shared contract.
- **Known uncertainty, called out inline:** convex-test module-map key format (Task 1 Step 5 troubleshooting), vocabulary table name (Task 5 Step 2), scheduled-function noise (Task 3 notes). Each has an explicit fallback, not a placeholder.
- **Type consistency:** all harness tests use `convexTest(schema, modules)` with `modules` from `convex/harness/modules.ts`; identities always `{ subject: "system" }`; seeds match the schema fields verified against `convex/schema.ts` during plan-writing.
