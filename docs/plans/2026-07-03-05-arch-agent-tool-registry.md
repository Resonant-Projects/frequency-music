# Agent-Tool Registry + Zod-First Cross-Seam Shapes Implementation Plan
> Landed: 9438b33 (2026-07-09)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the 5×-repeated agent-tool wiring (17 tools × {agentTools.ts, agentToolsHttp.ts, http.ts, convexTools.ts, docs}) into one declarative registry, and make zod the single source of truth for every shape that crosses the convex↔agent repo seam — killing the already-shipped `memory_recall` event-kind drift and the hand-mirrored draft-payload schemas.

**Architecture:** Three new pure modules under `convex/shared/` (importable by BOTH workspaces): `agentContract.ts` (event kinds, run statuses, heartbeat/stale timing, terminal-status ownership), `draftPayloads.ts` (zod-first draft payload schemas), `agentToolArgs.ts` + `agentToolManifest.ts` (per-tool zod args + the declarative tool list). Convex-side `convex/agentToolRegistry.ts` binds the manifest to function references and per-tool run lambdas; `agentTools.ts` actions become one-liners, `agentToolsHttp.ts`/`http.ts` become loops, agent-side `convexTools.ts` derives its LangChain `tool()` list from the manifest, and `docs/agent-tool-surface.md`'s table is generated. Convex validators for draft payloads derive via `zodToConvex` (convex-helpers `server/zod4`, verified present with `zid` support) with frozen-snapshot equality tests proving the swap is shape-identical before any hand-written validator is deleted.

**Tech Stack:** Bun, Convex 1.34 (self-hosted), zod 4.4.3, convex-helpers 0.1.114 (`server/zod4`: `zodToConvex`, `zodToConvexFields`, `zid`), LangChain `tool()`, bun:test.

## Global Constraints

- `bunx convex codegen` PUSHES to the live self-hosted deployment and is the Convex typegate. Run it only at task-end green points; never leave a task with a failing codegen. (`AUTH_BYPASS` env and deployment config already live in `.env.local`.)
- Root `bunx tsc --noEmit` is NOT a gate (pre-existing errors). Gates are: `bunx convex codegen`, `bun test convex/`, `cd agent && bun run verify` (tsc), `cd agent && bun test`.
- `convex/shared/**` purity: `agentContract.ts` and `agentToolManifest.ts` import NOTHING but zod-free constants / zod; `agentToolArgs.ts` and `draftPayloads.ts` may additionally import `zod`, `convex-helpers/server/zod4`, and `convex/values` — never `convex/server`, never `./_generated/*`. (The agent workspace gains `convex` + `convex-helpers` deps in Task 5 so it can import these.)
- Validator swaps must be proven shape-identical BEFORE deleting hand-written originals: freeze the old validator's `.json` serialization into a test, then swap, then assert the derived validator equals the frozen snapshot.
- The HTTP transport (`makeAgentToolHttpHandler`), constant-time `requireAgentToolSecret`, and `callConvex` are load-bearing — keep them; only name-wiring collapses.
- `agentDrafts.approve/reject/supersede` stay Clerk-only and NEVER enter the registry (decision log 2026-07-01).
- Convex mutations cannot `ctx.runMutation`; unchanged here (registry `run` lambdas live in actions).
- Two `ctx.db` conventions exist; `agentRuns.ts`/`agentDrafts.ts` use single-arg `db.get(id)` — match the file you edit.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Coordination note: plan 02 (single-source shapes) owns `compositionParameterValidator`'s future. This plan defines `compositionParameterZ` for draft payloads only and does NOT touch the recipes-table validator. If plan 02 has landed first, reconcile by having schema.ts keep exactly one of the two definitions and a pin test.

---

### Task 1: `convex/shared/agentContract.ts` — timing + enum constants

**Files:**
- Create: `convex/shared/agentContract.ts`
- Test: `convex/shared/agentContract.test.ts`

**Interfaces:**
- Consumes: nothing (pure constants module).
- Produces: `AGENT_RUN_EVENT_KINDS: readonly [8 strings]`, `AgentRunEventKind`, `AGENT_RUN_STATUSES: readonly [6 strings]`, `AgentRunStatus`, `HEARTBEAT_INTERVAL_MS: number`, `STALE_RUN_MS: number`, `KNOWN_GRAPH_NAMES`, `KnownGraphName`, `TERMINAL_STATUS_OWNER: Record<KnownGraphName, "graph" | "runner">`. Later tasks import these exact names.

- [ ] **Step 1: Write the failing test**

```typescript
// convex/shared/agentContract.test.ts
import { describe, expect, test } from "bun:test";
import {
  AGENT_RUN_EVENT_KINDS,
  AGENT_RUN_STATUSES,
  HEARTBEAT_INTERVAL_MS,
  KNOWN_GRAPH_NAMES,
  STALE_RUN_MS,
  TERMINAL_STATUS_OWNER,
} from "./agentContract";

describe("agentContract", () => {
  test("event kinds match the schema enum incl. memory_recall", () => {
    expect(AGENT_RUN_EVENT_KINDS).toEqual([
      "tool_call",
      "decision",
      "draft_write",
      "error",
      "review_request",
      "status",
      "node",
      "memory_recall",
    ]);
  });

  test("run statuses match the schema enum", () => {
    expect(AGENT_RUN_STATUSES).toEqual([
      "queued",
      "running",
      "needs_review",
      "completed",
      "failed",
      "cancelled",
    ]);
  });

  test("a healthy worker can never be swept: heartbeat < stale threshold", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(STALE_RUN_MS);
    // 6x margin today; fail if someone narrows it below 2x.
    expect(STALE_RUN_MS / HEARTBEAT_INTERVAL_MS).toBeGreaterThanOrEqual(2);
  });

  test("every known graph has a terminal-status owner", () => {
    for (const name of KNOWN_GRAPH_NAMES) {
      expect(["graph", "runner"]).toContain(TERMINAL_STATUS_OWNER[name]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test convex/shared/agentContract.test.ts`
Expected: FAIL — `Cannot find module './agentContract'`

- [ ] **Step 3: Write the module**

```typescript
// convex/shared/agentContract.ts
//
// Cross-workspace contract for the agent-run lifecycle. Imported by BOTH the
// Convex backend and the agent/ workspace — keep this file dependency-free
// (no zod, no convex imports) so either side can load it.

export const AGENT_RUN_EVENT_KINDS = [
  "tool_call",
  "decision",
  "draft_write",
  "error",
  "review_request",
  "status",
  "node",
  // Emitted when cross-run agent memory (LangGraph Store) changes a decision.
  "memory_recall",
] as const;
export type AgentRunEventKind = (typeof AGENT_RUN_EVENT_KINDS)[number];

export const AGENT_RUN_STATUSES = [
  "queued",
  "running",
  "needs_review",
  "completed",
  "failed",
  "cancelled",
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

// Worker heartbeat cadence and the queue's stale-run sweep threshold. Both
// sides of the seam import these; a heartbeat interval at or above the stale
// threshold would make the sweeper kill healthy in-flight runs.
export const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
export const STALE_RUN_MS = 30 * 60 * 1000;
if (HEARTBEAT_INTERVAL_MS >= STALE_RUN_MS) {
  throw new Error(
    "agentContract invariant violated: HEARTBEAT_INTERVAL_MS must be < STALE_RUN_MS",
  );
}

export const KNOWN_GRAPH_NAMES = ["research-pipeline", "weekly-brief"] as const;
export type KnownGraphName = (typeof KNOWN_GRAPH_NAMES)[number];

// Which side owns the terminal Convex status write for each graph:
// - research-pipeline: finalizeRunNode marks completed/needs_review/failed,
//   so the runner must NOT double-mark on the success path.
// - weekly-brief: the graph performs no audit writes; the runner owns it.
export const TERMINAL_STATUS_OWNER: Record<KnownGraphName, "graph" | "runner"> =
  {
    "research-pipeline": "graph",
    "weekly-brief": "runner",
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test convex/shared/agentContract.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/shared/agentContract.ts convex/shared/agentContract.test.ts
git commit -m "feat(shared): add agentContract cross-workspace constants module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Convex side consumes agentContract — kill the event-kind drift

The live bug: `convex/schema.ts:68-79` allows 8 event kinds including `memory_recall`, but `convex/agentTools.ts:206-214` re-declares an inline 7-kind union, so agents cannot write a `memory_recall` event over HTTP. Fix it here, before the registry exists, so the drift dies even if later tasks stall. **Intended behaviour change:** `memory_recall` becomes writable via `/agent-tools/appendAgentRunEvent`.

**Files:**
- Modify: `convex/schema.ts` (lines 59-78: derive `agentRunStatusValidator` + `agentRunEventKindValidator` from the contract)
- Modify: `convex/agentRuns.ts` (lines 13-22 statuses; line 45 stale constant; lines 199-206 event-kind param type)
- Modify: `convex/agentTools.ts` (lines 206-214: replace inline union)
- Test: `convex/shared/agentContract.test.ts` (extend), existing `convex/agentRuns.test.ts` must stay green

**Interfaces:**
- Consumes: `AGENT_RUN_EVENT_KINDS`, `AGENT_RUN_STATUSES`, `STALE_RUN_MS`, `AgentRunEventKind`, `AgentRunStatus` from Task 1.
- Produces: `schema.ts` still exports `agentRunStatusValidator` / `agentRunEventKindValidator` (same names, now derived). `agentRuns.ts` still exports `DEFAULT_STALE_RUN_MS` (aliased) so `agentRuns.test.ts` keeps compiling.

- [ ] **Step 1: Write the failing pin test**

Append to `convex/shared/agentContract.test.ts`:

```typescript
import { agentRunEventKindValidator, agentRunStatusValidator } from "../schema";
import { AGENT_RUN_EVENT_KINDS as KINDS, AGENT_RUN_STATUSES as STATUSES } from "./agentContract";

describe("schema validators derive from agentContract", () => {
  test("agentRunEventKindValidator members == AGENT_RUN_EVENT_KINDS", () => {
    const members = (agentRunEventKindValidator as any).members.map(
      (m: any) => m.value,
    );
    expect(members).toEqual([...KINDS]);
  });

  test("agentRunStatusValidator members == AGENT_RUN_STATUSES", () => {
    const members = (agentRunStatusValidator as any).members.map(
      (m: any) => m.value,
    );
    expect(members).toEqual([...STATUSES]);
  });
});
```

- [ ] **Step 2: Run test — the members already match (7 vs 8 mismatch is in agentTools, not schema), so this passes trivially; verify it runs**

Run: `bun test convex/shared/agentContract.test.ts`
Expected: PASS. (This test's job is to pin schema ↔ contract equality permanently.)

- [ ] **Step 3: Derive the schema validators**

In `convex/schema.ts`, add the import at the top (schema.ts currently imports only `convex/server` + `convex/values`):

```typescript
import { AGENT_RUN_EVENT_KINDS, AGENT_RUN_STATUSES } from "./shared/agentContract";
```

Replace lines 59-66 and 68-78 (the two hand-written unions):

```typescript
export const agentRunStatusValidator = v.union(
  ...AGENT_RUN_STATUSES.map((s) => v.literal(s)),
);

export const agentRunEventKindValidator = v.union(
  ...AGENT_RUN_EVENT_KINDS.map((k) => v.literal(k)),
);
```

Fallback if `bunx convex codegen` degrades the inferred doc type (e.g. `kind` widens to `string` in `_generated/dataModel`): keep the explicit `v.union(v.literal("tool_call"), ...)` literal form in schema.ts and rely on the Step 1 pin test instead. Check by grepping `_generated/dataModel.d.ts` for `memory_recall` after codegen.

- [ ] **Step 4: Point agentRuns.ts at the contract**

In `convex/agentRuns.ts`:

Replace lines 13-22:

```typescript
import {
  AGENT_RUN_STATUSES,
  STALE_RUN_MS,
  type AgentRunEventKind,
  type AgentRunStatus,
} from "./shared/agentContract";

const agentRunStatuses = AGENT_RUN_STATUSES;
```

(Delete the local `type AgentRunStatus = (typeof agentRunStatuses)[number];` — it now comes from the import.)

Replace line 45:

```typescript
// A running run with no event (updatedAt) inside this window is presumed crashed.
export const DEFAULT_STALE_RUN_MS = STALE_RUN_MS;
```

Replace the `appendRunEvent` param type (lines 199-206), which is the 4th hand copy:

```typescript
    kind: AgentRunEventKind;
```

- [ ] **Step 5: Fix the drifted 7-kind union in agentTools.ts**

In `convex/agentTools.ts`, `appendAgentRunEvent` (lines 202-217): replace the inline `kind: v.union(...7 literals...)` with the schema validator. Add to the imports at the top:

```typescript
import { agentRunEventKindValidator } from "./schema";
```

and change the args block to:

```typescript
  args: {
    agentSecret: v.string(),
    runId: v.id("agentRuns"),
    kind: agentRunEventKindValidator,
    message: v.string(),
    payload: v.optional(v.any()),
  },
```

- [ ] **Step 6: Verify everything is green**

Run: `bun test convex/` — Expected: PASS (all existing convex tests incl. agentRuns.test.ts, which imports `DEFAULT_STALE_RUN_MS` — still exported).
Run: `bunx convex codegen` — Expected: success, no type errors. Then `grep memory_recall convex/_generated/dataModel.d.ts` — Expected: at least one hit (kind union preserved).

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/agentRuns.ts convex/agentTools.ts convex/shared/agentContract.test.ts
git commit -m "fix(agent-tools): single-source run statuses + event kinds from agentContract

memory_recall was accepted by the schema but rejected by the HTTP-exposed
appendAgentRunEvent action's stale inline union. All four copies now derive
from convex/shared/agentContract.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Agent workspace consumes agentContract (cross-workspace import gate)

First `agent/ → convex/shared` import. `agent/tsconfig.json` includes only `src/**` + `scripts/**`, but TypeScript typechecks any file reachable by import, and bun resolves relative paths at runtime — verify both here. **Known risk:** `langgraphjs build` (Docker) may refuse files outside `agent/`; the fallback is specified in Step 5.

**Files:**
- Modify: `agent/src/worker/runner.ts` (line 38 heartbeat const; imports)
- Modify: `agent/src/worker/graphInput.ts` (lines 7-27: re-export from contract)
- Modify: `agent/src/tools/convexTools.ts` (lines 203-211: zod enum from contract)
- Test: existing `agent/tests/worker-graph-input.test.ts`, `agent/tests/worker-runner.test.ts` stay green; extend `agent/tests/worker-graph-input.test.ts`

**Interfaces:**
- Consumes: `HEARTBEAT_INTERVAL_MS`, `STALE_RUN_MS`, `TERMINAL_STATUS_OWNER`, `KNOWN_GRAPH_NAMES`, `KnownGraphName`, `AGENT_RUN_EVENT_KINDS` from `../../../convex/shared/agentContract` (path from `agent/src/worker/` and `agent/src/tools/` is `../../../convex/shared/agentContract`).
- Produces: `graphInput.ts` re-exports `KNOWN_GRAPH_NAMES`, `KnownGraphName`, `TERMINAL_STATUS_OWNER` (so `runner.ts` + tests keep their import sites).

- [ ] **Step 1: Write the failing test**

Append to `agent/tests/worker-graph-input.test.ts`:

```typescript
import {
  HEARTBEAT_INTERVAL_MS,
  STALE_RUN_MS,
  TERMINAL_STATUS_OWNER as CONTRACT_OWNER,
} from "../../convex/shared/agentContract";
import { TERMINAL_STATUS_OWNER } from "../src/worker/graphInput.js";

describe("agentContract wiring", () => {
  test("graphInput re-exports the contract's terminal-status owner", () => {
    expect(TERMINAL_STATUS_OWNER).toBe(CONTRACT_OWNER);
  });

  test("worker heartbeat is faster than the queue's stale sweep", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(STALE_RUN_MS);
  });
});
```

(Path check: from `agent/tests/` the contract is at `../../convex/shared/agentContract`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && bun test tests/worker-graph-input.test.ts`
Expected: FAIL — `toBe` inequality (graphInput still exports its own object literal).

- [ ] **Step 3: Rewire graphInput.ts and runner.ts**

In `agent/src/worker/graphInput.ts`, replace lines 7-8 and 18-27 (the local `KNOWN_GRAPH_NAMES`, `KnownGraphName`, `TERMINAL_STATUS_OWNER`) with:

```typescript
export {
  KNOWN_GRAPH_NAMES,
  TERMINAL_STATUS_OWNER,
  type KnownGraphName,
} from "../../../convex/shared/agentContract";
import {
  KNOWN_GRAPH_NAMES as GRAPH_NAMES,
  type KnownGraphName as GraphName,
} from "../../../convex/shared/agentContract";
```

and update the two internal uses: `isKnownGraphName` body becomes `(GRAPH_NAMES as readonly string[]).includes(name)` with return type `name is GraphName`.

In `agent/src/worker/runner.ts`, replace line 38:

```typescript
import { HEARTBEAT_INTERVAL_MS } from "../../../convex/shared/agentContract";
```

(delete `const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;`).

In `agent/src/tools/convexTools.ts`, replace the `appendAgentRunEvent` zod enum (lines 203-211):

```typescript
import { AGENT_RUN_EVENT_KINDS } from "../../../convex/shared/agentContract";
// ... in the schema:
      kind: z.enum(AGENT_RUN_EVENT_KINDS),
```

(zod 4 accepts a readonly string tuple in `z.enum`. This also fixes the agent-side 7-kind copy — `memory_recall` now usable from LangChain tools.)

- [ ] **Step 4: Verify agent gates**

Run: `cd agent && bun run verify` — Expected: tsc clean.
Run: `cd agent && bun test` — Expected: PASS (all suites; live-network suites skip without env as they already do).

- [ ] **Step 5: Docker-bundling decision gate**

Run: `cd agent && bun run build` (requires Docker; skip if the daemon is unavailable and note it in the commit body).
- If it succeeds: done, no action.
- If it fails on out-of-tree imports (`../../../convex/...` unresolved in the build context): create `agent/scripts/sync-shared-contract.ts` that copies `convex/shared/agentContract.ts` to `agent/src/shared/agentContract.gen.ts` verbatim with a `// GENERATED — edit convex/shared/agentContract.ts` header, point all agent imports at `../shared/agentContract.gen.js`, add a bun test that reads both files and asserts byte-equality (fails when out of sync), and add `"presync": "bun scripts/sync-shared-contract.ts"` guidance to `agent/package.json` scripts. Apply the same pattern to Tasks 5/8 imports.

- [ ] **Step 6: Commit**

```bash
git add agent/src/worker/graphInput.ts agent/src/worker/runner.ts agent/src/tools/convexTools.ts agent/tests/worker-graph-input.test.ts
git commit -m "feat(agent): consume shared agentContract for timing + event kinds

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `convex/shared/draftPayloads.ts` — zod-first payload schemas + frozen-shape swap

**Files:**
- Create: `convex/shared/draftPayloads.ts`
- Modify: `convex/schema.ts` (lines 121-168: replace hand-written payload validators with derived re-exports)
- Modify: root `package.json` (`bun add zod` — make the already-resolving 4.4.3 explicit)
- Test: `convex/shared/draftPayloads.test.ts`

**Interfaces:**
- Consumes: `zid`, `zodToConvex` from `convex-helpers/server/zod4`; `zod`.
- Produces: `hypothesisDraftPayloadZ`, `recipeProtocolZ`, `recipeDraftPayloadZ`, `compositionParameterZ` (zod), and derived Convex validators `agentDraftHypothesisPayloadValidator`, `agentDraftRecipePayloadValidator`, `agentReviewDraftPayloadValidator` — re-exported from `convex/schema.ts` under their existing names so `agentDrafts.ts` / `agentDraftPromotion.ts` / `validators.ts` import sites do not change.

- [ ] **Step 1: Freeze the current validator shapes**

Dump the serialized shape of the three hand-written validators BEFORE touching anything:

```bash
bun -e 'import { agentDraftHypothesisPayloadValidator as h, agentDraftRecipePayloadValidator as r, agentReviewDraftPayloadValidator as u } from "./convex/schema";
console.log(JSON.stringify({ h: h.json, r: r.json, u: u.json }, null, 2))' > /tmp/draft-validator-freeze.json
cat /tmp/draft-validator-freeze.json
```

Expected: a JSON document with three keys; `h` is an object validator with fields `title/question/statement/rationale/whyThisMatters/concepts/sourceIds/extractionIds/thesisId/confidence`; `r` has `hypothesisId/title/parameters/protocol/whyThisMatters/bodyMd/dawChecklist/instrumentationNotes`.

- [ ] **Step 2: Write the failing freeze test**

```typescript
// convex/shared/draftPayloads.test.ts
import { describe, expect, test } from "bun:test";
import {
  agentDraftHypothesisPayloadValidator,
  agentDraftRecipePayloadValidator,
  agentReviewDraftPayloadValidator,
  hypothesisDraftPayloadZ,
  recipeDraftPayloadZ,
} from "./draftPayloads";

// Paste the EXACT contents of /tmp/draft-validator-freeze.json here:
const FROZEN = {
  h: /* paste h */ {},
  r: /* paste r */ {},
  u: /* paste u */ {},
};

describe("zod-first draft payload validators", () => {
  test("derived hypothesis validator is shape-identical to the frozen hand-written one", () => {
    expect(agentDraftHypothesisPayloadValidator.json).toEqual(FROZEN.h);
  });
  test("derived recipe validator is shape-identical", () => {
    expect(agentDraftRecipePayloadValidator.json).toEqual(FROZEN.r);
  });
  test("derived union validator is shape-identical", () => {
    expect(agentReviewDraftPayloadValidator.json).toEqual(FROZEN.u);
  });

  test("zod side keeps the agent-facing refinements", () => {
    expect(
      hypothesisDraftPayloadZ.safeParse({
        title: "",
        question: "q",
        statement: "s",
        rationale: "r",
        whyThisMatters: "w",
        sourceIds: [],
        extractionIds: [],
      }).success,
    ).toBe(false); // min(1) on title still enforced in zod even though the derived validator is loose
  });

  test("recipe payload accepts the full compositionParameter shape", () => {
    const parsed = recipeDraftPayloadZ.safeParse({
      title: "t",
      whyThisMatters: "w",
      parameters: [
        {
          kind: "tempo",
          type: "tempo",
          value: "96bpm",
          details: { curve: "linear" },
          registryStatus: "provisional",
          canonicalKind: "tempo",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
```

(The `/* paste */` markers are filled from Step 1's actual output during execution — they are real values, not placeholders left in the committed test.)

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test convex/shared/draftPayloads.test.ts`
Expected: FAIL — `Cannot find module './draftPayloads'`

- [ ] **Step 4: Write the module**

```bash
bun add zod   # root: make zod explicit (4.4.3 already resolves via the tree)
```

```typescript
// convex/shared/draftPayloads.ts
//
// ZOD-FIRST source of truth for the agent draft payload shapes that cross the
// convex <-> agent seam (decision: grilling 2026-07-03). The zod schemas carry
// agent-facing refinements (min lengths, ranges); the Convex validators are
// DERIVED via zodToConvex and therefore structurally loose but shape-identical
// to the previous hand-written validators (pinned by draftPayloads.test.ts).
import { z } from "zod";
import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { v } from "convex/values";

// Mirrors schema.ts registryStatusValidator (plan 02 owns unifying that).
const registryStatusZ = z.union([
  z.literal("known"),
  z.literal("provisional"),
  z.literal("experimental"),
  z.literal("deprecated"),
]);

// Draft-payload view of a composition parameter. Field set matches
// schema.ts compositionParameterValidator exactly.
export const compositionParameterZ = z.object({
  kind: z.string().optional(),
  type: z.string().optional(),
  value: z.string(),
  details: z.unknown().optional(),
  registryStatus: registryStatusZ.optional(),
  canonicalKind: z.string().optional(),
});

export const hypothesisDraftPayloadZ = z.object({
  title: z.string().min(1),
  question: z.string().min(1),
  statement: z.string().min(1), // becomes hypotheses.hypothesis
  rationale: z.string().min(1), // becomes hypotheses.rationaleMd
  whyThisMatters: z.string().min(1),
  concepts: z.array(z.string()).optional(),
  sourceIds: z.array(zid("sources")),
  extractionIds: z.array(zid("extractions")),
  thesisId: zid("theses").optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const recipeProtocolZ = z.object({
  studyType: z.union([z.literal("litmus"), z.literal("comparison")]),
  durationSecs: z.number().positive(),
  panelPlanned: z.array(z.string()),
  listeningContext: z.string().optional(),
  listeningMethod: z.string().optional(),
  baselineArtifactId: zid("compositions").optional(),
  whatVaries: z.array(z.string()),
  whatStaysConstant: z.array(z.string()),
});

export const recipeDraftPayloadZ = z.object({
  hypothesisId: zid("hypotheses").optional(),
  title: z.string().min(1),
  parameters: z.array(compositionParameterZ),
  protocol: recipeProtocolZ.optional(),
  whyThisMatters: z.string().min(1),
  // Promotion synthesizes these when absent (agentDraftPromotion.ts).
  bodyMd: z.string().optional(),
  dawChecklist: z.array(z.string()).optional(),
  instrumentationNotes: z.string().optional(),
});

export type HypothesisDraftPayload = z.infer<typeof hypothesisDraftPayloadZ>;
export type RecipeDraftPayload = z.infer<typeof recipeDraftPayloadZ>;

// Derived Convex validators — consumed by schema.ts (table definition) and
// re-exported there under these same names for all existing import sites.
export const agentDraftHypothesisPayloadValidator = zodToConvex(
  hypothesisDraftPayloadZ,
);
export const agentDraftRecipePayloadValidator = zodToConvex(recipeDraftPayloadZ);
export const agentReviewDraftPayloadValidator = v.union(
  agentDraftHypothesisPayloadValidator,
  agentDraftRecipePayloadValidator,
);
```

- [ ] **Step 5: Iterate until the freeze test passes**

Run: `bun test convex/shared/draftPayloads.test.ts`
Expected: PASS. Likely first-run diffs and their fixes:
- `details`: hand-written is `v.optional(v.any())`; if `z.unknown().optional()` derives to a different serialization than `v.optional(v.any())`, switch to `z.any().optional()` and re-run.
- `zid(...).optional()` must serialize as `{"type":"id","tableName":"theses"}` with `"optional":true` context — if the nesting differs, compare against `FROZEN` member-by-member and adjust (the freeze test is the arbiter; do NOT edit the frozen values to make it pass).

- [ ] **Step 6: Swap schema.ts to the derived validators**

In `convex/schema.ts`, delete lines 128-168 (`agentDraftHypothesisPayloadValidator`, `agentDraftRecipeProtocolValidator`, `agentDraftRecipePayloadValidator`, `agentReviewDraftPayloadValidator` definitions — keep the banner comment) and add:

```typescript
export {
  agentDraftHypothesisPayloadValidator,
  agentDraftRecipePayloadValidator,
  agentReviewDraftPayloadValidator,
} from "./shared/draftPayloads";
import { agentReviewDraftPayloadValidator } from "./shared/draftPayloads";
```

(The `import` line is needed because `defineTable` for `agentReviewDrafts` uses it later in the file; a bare re-export does not bind a local name.)

- [ ] **Step 7: Full green gate**

Run: `bun test convex/` — Expected: PASS.
Run: `bunx convex codegen` — Expected: success. The deployed schema is unchanged byte-for-byte (freeze test proved it), so this push is a no-op for data.
Run: `grep -n "agentDraftRecipeProtocolValidator" convex/` — Expected: no hits (dead name gone).

- [ ] **Step 8: Commit**

```bash
git add convex/shared/draftPayloads.ts convex/shared/draftPayloads.test.ts convex/schema.ts package.json bun.lock
git commit -m "feat(shared): zod-first draft payload schemas; derive Convex validators via zodToConvex

Shape-identity with the previous hand-written validators is pinned by a
frozen-snapshot test taken before the swap.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `convex/shared/agentToolArgs.ts` + `agentToolManifest.ts` — the declarative tool list

**Files:**
- Create: `convex/shared/agentToolArgs.ts`
- Create: `convex/shared/agentToolManifest.ts`
- Modify: `agent/package.json` (`cd agent && bun add convex convex-helpers` — needed because `agentToolArgs` imports `zid`)
- Test: `convex/shared/agentToolManifest.test.ts`

**Interfaces:**
- Consumes: `zid` from `convex-helpers/server/zod4`, zod.
- Produces:
  - `agentToolArgs: Record<AgentToolName, z.ZodObject<any>>` — args EXCLUDING `agentSecret` (transport-owned).
  - `AgentToolManifestEntry = { name: AgentToolName; description: string; args: z.ZodObject<any>; langchain: boolean; kind: "read" | "audit_write" }`
  - `AGENT_TOOL_MANIFEST: readonly AgentToolManifestEntry[]` (17 entries, ordered as the docs table).
  - `AGENT_TOOL_NAMES: readonly AgentToolName[]`.
- `langchain: false` ONLY for `claimNextPendingRun` — it is the one tool defined in `convexTools.ts` today (line 170) but deliberately absent from the exported 16-entry `convexTools` array (line 296): the worker calls it via raw `callConvex`, and exposing a queue-claim to the LLM would let a graph steal queued runs. `getAgentRun` IS in today's array, so it stays `langchain: true`.

- [ ] **Step 1: Write the failing test**

```typescript
// convex/shared/agentToolManifest.test.ts
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { AGENT_TOOL_MANIFEST, AGENT_TOOL_NAMES } from "./agentToolManifest";
import { agentToolArgs } from "./agentToolArgs";

describe("agent tool manifest", () => {
  test("17 tools, unique names, every one has args + description", () => {
    expect(AGENT_TOOL_MANIFEST.length).toBe(17);
    expect(new Set(AGENT_TOOL_NAMES).size).toBe(17);
    for (const entry of AGENT_TOOL_MANIFEST) {
      expect(entry.description.length).toBeGreaterThan(10);
      expect(entry.args).toBeInstanceOf(z.ZodObject);
      expect(entry.args).toBe(agentToolArgs[entry.name]);
    }
  });

  test("no manifest args object contains agentSecret (transport-owned)", () => {
    for (const entry of AGENT_TOOL_MANIFEST) {
      expect(Object.keys(entry.args.shape)).not.toContain("agentSecret");
    }
  });

  test("only claimNextPendingRun is hidden from LangChain", () => {
    const hidden = AGENT_TOOL_MANIFEST.filter((t) => !t.langchain).map(
      (t) => t.name,
    );
    expect(hidden).toEqual(["claimNextPendingRun"]);
  });

  test("decision mutations are never on the surface", () => {
    for (const forbidden of ["approve", "reject", "supersede"]) {
      expect(AGENT_TOOL_NAMES.some((n) => n.toLowerCase().includes(forbidden))).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test convex/shared/agentToolManifest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `agentToolArgs.ts`**

Transcribed from the CURRENT action arg validators in `convex/agentTools.ts` (minus `agentSecret`), with `zid` for every `v.id` field:

```typescript
// convex/shared/agentToolArgs.ts
//
// Per-tool argument schemas for the agent-tool surface, zod-first. The Convex
// action arg validators derive from these (agentToolRegistry.ts adds the
// transport-owned agentSecret); the agent workspace uses them directly as
// LangChain tool schemas. agentSecret NEVER appears here.
import { z } from "zod";
import { zid } from "convex-helpers/server/zod4";

const limit = z.number().int().positive().max(100).optional();

export const agentToolArgs = {
  listRecentExtractions: z.object({ limit }),
  getExtraction: z.object({ id: zid("extractions") }),
  listRecentHypotheses: z.object({ limit }),
  listActiveTheses: z.object({ limit }),
  listFailureArchive: z.object({ limit }),
  getEditorialSignals: z.object({ limit }),
  getRecentRecipes: z.object({ limit }),
  getRecommendedActions: z.object({}),
  searchSourcesByConcept: z.object({
    conceptName: z.string().min(1),
    limit,
  }),
  createAgentRun: z.object({
    graphName: z.string().min(1),
    input: z.any().optional(),
    traceUrl: z.string().optional(),
  }),
  appendAgentRunEvent: z.object({
    runId: zid("agentRuns"),
    kind: z.enum([
      "tool_call",
      "decision",
      "draft_write",
      "error",
      "review_request",
      "status",
      "node",
      "memory_recall",
    ]),
    message: z.string().min(1),
    payload: z.any().optional(),
  }),
  markAgentRunCompleted: z.object({
    runId: zid("agentRuns"),
    summary: z.string().optional(),
    traceUrl: z.string().optional(),
  }),
  markAgentRunNeedsReview: z.object({
    runId: zid("agentRuns"),
    summary: z.string().optional(),
    reviewDraft: z.any().optional(),
  }),
  createAgentReviewDraft: z.object({
    agentRunId: zid("agentRuns"),
    draft: z.any(),
  }),
  markAgentRunFailed: z.object({
    runId: zid("agentRuns"),
    summary: z.string().optional(),
    error: z.any().optional(),
    traceUrl: z.string().optional(),
  }),
  claimNextPendingRun: z.object({
    workerId: z.string().min(1),
    graphName: z.string().min(1).optional(),
  }),
  getAgentRun: z.object({ runId: zid("agentRuns") }),
} as const;

export type AgentToolName = keyof typeof agentToolArgs;
```

Note the deliberate deltas from today's `convexTools.ts` zod schemas, which were LOOSER than the Convex validators (plain `z.string()` where the action demands `v.id(...)`): `zid` closes that gap, and the `appendAgentRunEvent` kind enum carries all 8 kinds. `z.enum([...8 literals])` is used here rather than importing `AGENT_RUN_EVENT_KINDS` because `zodToConvex` needs a zod type; a pin test in Step 5 keeps it aligned with the contract.

- [ ] **Step 4: Write `agentToolManifest.ts`**

Descriptions carry over verbatim from today's `convexTools.ts` `tool()` definitions (read tools) and `docs/agent-tool-surface.md` (worker tools):

```typescript
// convex/shared/agentToolManifest.ts
//
// THE single declarative list of agent tools. Everything else derives:
// - convex/agentToolRegistry.ts binds each entry to function refs + a run lambda
// - convex/agentTools.ts exports one action per entry
// - convex/agentToolsHttp.ts + convex/http.ts loop over entries for routes
// - agent/src/tools/convexTools.ts builds LangChain tool() adapters (langchain: true)
// - docs/agent-tool-surface.md's tool table is generated from entries
// Adding a tool = one entry here + one arg schema + one registry binding.
import type { z } from "zod";
import { agentToolArgs, type AgentToolName } from "./agentToolArgs";

export type AgentToolManifestEntry = {
  name: AgentToolName;
  description: string;
  args: z.ZodObject<any>;
  langchain: boolean;
  kind: "read" | "audit_write";
};

function entry(
  name: AgentToolName,
  kind: "read" | "audit_write",
  description: string,
  opts: { langchain?: boolean } = {},
): AgentToolManifestEntry {
  return {
    name,
    kind,
    description,
    args: agentToolArgs[name],
    langchain: opts.langchain ?? true,
  };
}

export const AGENT_TOOL_MANIFEST: readonly AgentToolManifestEntry[] = [
  entry("listRecentExtractions", "read",
    "Fetch recent structured source extractions with claims, topics, open questions, and composition parameters."),
  entry("getExtraction", "read", "Fetch one extraction by Convex extraction id."),
  entry("listRecentHypotheses", "read",
    "Fetch recent hypotheses with rationale and whyThisMatters."),
  entry("listActiveTheses", "read",
    "Fetch active research theses that should anchor weekly brief recommendations."),
  entry("listFailureArchive", "read",
    "Fetch recent failed, retired, contradicted, archived, or low-yield research paths to avoid repeating them."),
  entry("getEditorialSignals", "read",
    "Fetch high-yield and low-yield concept clusters from the editorial graph."),
  entry("getRecentRecipes", "read",
    "Fetch recent composition recipes with parameters, DAW checklists, and protocols."),
  entry("getRecommendedActions", "read",
    "Fetch deterministic recommended action candidates from the current campaign scope."),
  entry("searchSourcesByConcept", "read",
    "Find source metadata linked to a concept name. Raw text is intentionally omitted."),
  entry("createAgentRun", "audit_write",
    "Create an audit-only Convex agent run record and mark it running. Does not mutate research data."),
  entry("appendAgentRunEvent", "audit_write",
    "Append an audit-only lifecycle event to a Convex agent run. Does not mutate research data."),
  entry("markAgentRunCompleted", "audit_write",
    "Mark an audit-only Convex agent run completed. Does not mutate research data."),
  entry("markAgentRunNeedsReview", "audit_write",
    "Mark an audit-only Convex agent run as needs_review after producing a human-review draft. Does not mutate research data."),
  entry("createAgentReviewDraft", "audit_write",
    "Persist a sanitized human-review draft linked to an agent run. Creates an agentReviewDraft row and audit event; does not publish research artifacts."),
  entry("markAgentRunFailed", "audit_write",
    "Mark an audit-only Convex agent run failed and optionally record sanitized error details. Does not mutate research data."),
  entry("claimNextPendingRun", "audit_write",
    "Atomically claim the oldest queued Convex agent run for a worker, flipping it to running. Production worker only.",
    { langchain: false }),
  entry("getAgentRun", "audit_write",
    "Fetch the full Convex agent run document (including raw input) by id for status polling. Audit-only read."),
];

export const AGENT_TOOL_NAMES = AGENT_TOOL_MANIFEST.map((t) => t.name);
```

- [ ] **Step 5: Add the event-kind pin test**

Append to `convex/shared/agentToolManifest.test.ts`:

```typescript
import { AGENT_RUN_EVENT_KINDS } from "./agentContract";

test("appendAgentRunEvent kind enum matches the contract", () => {
  const kindSchema = agentToolArgs.appendAgentRunEvent.shape.kind;
  expect(kindSchema.options).toEqual([...AGENT_RUN_EVENT_KINDS]);
});
```

- [ ] **Step 6: Install agent deps and run gates**

```bash
cd agent && bun add convex convex-helpers && cd ..
bun test convex/shared/
cd agent && bun run verify && bun test
```

Expected: all PASS. (Agent gains `convex` + `convex-helpers` so `agentToolArgs`'s `zid` import resolves when Task 8 pulls the manifest across the seam.)

- [ ] **Step 7: Commit**

```bash
git add convex/shared/agentToolArgs.ts convex/shared/agentToolManifest.ts convex/shared/agentToolManifest.test.ts agent/package.json agent/bun.lock
git commit -m "feat(shared): declarative agent-tool manifest with zod-first arg schemas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `convex/agentToolRegistry.ts` + one-liner actions in `agentTools.ts`

**Files:**
- Create: `convex/agentToolRegistry.ts`
- Modify: `convex/agentTools.ts` (full rewrite to one-liners; freeze arg shapes first)
- Test: `convex/agentToolRegistry.test.ts`

**Interfaces:**
- Consumes: `AGENT_TOOL_MANIFEST`, `agentToolArgs` (Task 5); `zodToConvexFields` from `convex-helpers/server/zod4`; `makeFunctionReference` from `convex/server`; `ActionCtx` from `./_generated/server`.
- Produces: `AGENT_TOOL_REGISTRY: readonly AgentToolDef[]` and `agentToolByName: Record<AgentToolName, AgentToolDef>` where `AgentToolDef = AgentToolManifestEntry & { run: (ctx: ActionCtx, args: Record<string, unknown>) => Promise<unknown> }`; `makeAgentToolAction(name)` used by `agentTools.ts`.

- [ ] **Step 1: Freeze current action arg validator shapes**

```bash
bun -e 'import * as tools from "./convex/agentTools";
const names = ["listRecentExtractions","getExtraction","listRecentHypotheses","listActiveTheses","listFailureArchive","getEditorialSignals","getRecentRecipes","getRecommendedActions","searchSourcesByConcept","createAgentRun","appendAgentRunEvent","markAgentRunCompleted","markAgentRunNeedsReview","createAgentReviewDraft","markAgentRunFailed","claimNextPendingRun","getAgentRun"];
const out = {};
for (const n of names) out[n] = (tools[n] as any).exportArgs();
console.log(JSON.stringify(out, null, 2))' > /tmp/agent-tool-args-freeze.json
```

Expected: 17 keys, each a serialized object validator whose first field is `agentSecret`. (If `exportArgs` is not present on registered actions in this Convex version, fall back to reading each action's `args` via the same `.json` property used in Task 4 — adjust the accessor, keep the freeze.)

- [ ] **Step 2: Write the failing test**

```typescript
// convex/agentToolRegistry.test.ts
import { describe, expect, test } from "bun:test";
import { AGENT_TOOL_MANIFEST } from "./shared/agentToolManifest";
import { AGENT_TOOL_REGISTRY, agentToolByName } from "./agentToolRegistry";
import * as agentTools from "./agentTools";

// Paste the EXACT contents of /tmp/agent-tool-args-freeze.json here:
const FROZEN_ARGS: Record<string, unknown> = {};

describe("agent tool registry", () => {
  test("registry covers the manifest 1:1", () => {
    expect(AGENT_TOOL_REGISTRY.map((t) => t.name)).toEqual(
      AGENT_TOOL_MANIFEST.map((t) => t.name),
    );
    for (const def of AGENT_TOOL_REGISTRY) {
      expect(typeof def.run).toBe("function");
      expect(agentToolByName[def.name]).toBe(def);
    }
  });

  test("every manifest tool is exported as an action from agentTools.ts", () => {
    for (const def of AGENT_TOOL_MANIFEST) {
      expect(agentTools[def.name as keyof typeof agentTools]).toBeDefined();
    }
  });

  test("derived action args are shape-identical to the frozen hand-written ones", () => {
    for (const def of AGENT_TOOL_REGISTRY) {
      const action = agentTools[def.name as keyof typeof agentTools] as any;
      expect(action.exportArgs()).toEqual(FROZEN_ARGS[def.name]);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test convex/agentToolRegistry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the registry**

```typescript
// convex/agentToolRegistry.ts
//
// Binds the pure manifest (convex/shared/agentToolManifest.ts) to Convex
// function references and per-tool behaviour. This file is CONVEX-ONLY (it
// imports _generated types); the agent workspace imports the manifest instead.
import { makeFunctionReference } from "convex/server";
import type { ActionCtx } from "./_generated/server";
import {
  AGENT_TOOL_MANIFEST,
  type AgentToolManifestEntry,
} from "./shared/agentToolManifest";
import type { AgentToolName } from "./shared/agentToolArgs";

export type AgentToolDef = AgentToolManifestEntry & {
  run: (ctx: ActionCtx, args: Record<string, unknown>) => Promise<unknown>;
};

const q = (name: string) => makeFunctionReference<"query">(name);
const m = (name: string) => makeFunctionReference<"mutation">(name);

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined),
  ) as T;
}

// Per-tool behaviour: backing function + defaults + composites. This is the
// ONLY place tool behaviour lives; everything else is generated wiring.
const runs: Record<
  AgentToolName,
  (ctx: ActionCtx, a: Record<string, unknown>) => Promise<unknown>
> = {
  listRecentExtractions: (ctx, a) =>
    ctx.runQuery(q("extractions:listRecent"), { limit: (a.limit as number) ?? 20 }),
  getExtraction: (ctx, a) => ctx.runQuery(q("extractions:get"), { id: a.id }),
  listRecentHypotheses: (ctx, a) =>
    ctx.runQuery(q("hypotheses:listByStatus"), { limit: (a.limit as number) ?? 20 }),
  listActiveTheses: (ctx, a) =>
    ctx.runQuery(q("theses:list"), { status: "active", limit: (a.limit as number) ?? 20 }),
  listFailureArchive: (ctx, a) =>
    ctx.runQuery(q("failures:listArchive"), { limit: (a.limit as number) ?? 20 }),
  getEditorialSignals: (ctx, a) =>
    ctx.runQuery(q("dashboard:editorialSignals"), { limit: (a.limit as number) ?? 24 }),
  getRecentRecipes: (ctx, a) =>
    ctx.runQuery(q("recipes:listByStatus"), { limit: (a.limit as number) ?? 20 }),
  getRecommendedActions: (ctx) =>
    ctx.runQuery(q("campaigns:getRecommendedActions"), {}),
  searchSourcesByConcept: (ctx, a) =>
    ctx.runQuery(q("graph:searchSourcesByConcept"), {
      conceptName: a.conceptName,
      limit: (a.limit as number) ?? 20,
    }),
  createAgentRun: async (ctx, a) => {
    const created = (await ctx.runMutation(
      m("agentRuns:create"),
      omitUndefined({ graphName: a.graphName, input: a.input, traceUrl: a.traceUrl }),
    )) as { runId: string; createdAt: number };
    const running = (await ctx.runMutation(m("agentRuns:markRunning"), {
      runId: created.runId,
    })) as { status: string; startedAt: number; updatedAt: number };
    return {
      runId: created.runId,
      status: running.status,
      createdAt: created.createdAt,
      startedAt: running.startedAt,
      updatedAt: running.updatedAt,
    };
  },
  appendAgentRunEvent: (ctx, a) =>
    ctx.runMutation(
      m("agentRuns:appendEvent"),
      omitUndefined({ runId: a.runId, kind: a.kind, message: a.message, payload: a.payload }),
    ),
  markAgentRunCompleted: (ctx, a) =>
    ctx.runMutation(
      m("agentRuns:markCompleted"),
      omitUndefined({ runId: a.runId, summary: a.summary, traceUrl: a.traceUrl }),
    ),
  markAgentRunNeedsReview: (ctx, a) =>
    ctx.runMutation(
      m("agentRuns:markNeedsReview"),
      omitUndefined({ runId: a.runId, summary: a.summary, reviewDraft: a.reviewDraft }),
    ),
  createAgentReviewDraft: (ctx, a) =>
    ctx.runMutation(m("agentDrafts:createFromAgentRun"), {
      agentRunId: a.agentRunId,
      draft: a.draft,
    }),
  markAgentRunFailed: (ctx, a) =>
    ctx.runMutation(
      m("agentRuns:markFailed"),
      omitUndefined({ runId: a.runId, summary: a.summary, error: a.error, traceUrl: a.traceUrl }),
    ),
  claimNextPendingRun: (ctx, a) =>
    ctx.runMutation(
      m("agentRuns:claimNextPending"),
      omitUndefined({ workerId: a.workerId, graphName: a.graphName }),
    ),
  getAgentRun: (ctx, a) =>
    ctx.runQuery(q("agentRuns:getForWorker"), { runId: a.runId }),
};

export const AGENT_TOOL_REGISTRY: readonly AgentToolDef[] =
  AGENT_TOOL_MANIFEST.map((entry) => ({ ...entry, run: runs[entry.name] }));

export const agentToolByName = Object.fromEntries(
  AGENT_TOOL_REGISTRY.map((def) => [def.name, def]),
) as Record<AgentToolName, AgentToolDef>;
```

- [ ] **Step 5: Rewrite `convex/agentTools.ts` as one-liners**

Replace the entire file body (the 17 ref consts, `omitUndefined`, and 17 hand-written actions) with:

```typescript
// convex/agentTools.ts
//
// Secret-auth bridge for the agent-tool surface: each export wraps one
// AGENT_TOOL_REGISTRY entry as a Convex action, deriving its arg validator
// from the shared zod schema and swapping Clerk auth for AGENT_TOOL_SECRET.
// Convex requires static named exports, so this stays one line per tool; the
// registry owns everything else. See docs/agent-tool-surface.md.
import { v } from "convex/values";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { action } from "./_generated/server";
import { requireAgentToolSecret } from "./auth";
import { agentToolByName } from "./agentToolRegistry";
import type { AgentToolName } from "./shared/agentToolArgs";

function makeAgentToolAction(name: AgentToolName) {
  const def = agentToolByName[name];
  return action({
    args: {
      agentSecret: v.string(),
      ...zodToConvexFields(def.args.shape),
    },
    handler: async (ctx, args) => {
      const { agentSecret, ...rest } = args as Record<string, unknown> & {
        agentSecret: string;
      };
      requireAgentToolSecret(agentSecret);
      return await def.run(ctx, rest);
    },
  });
}

export const listRecentExtractions = makeAgentToolAction("listRecentExtractions");
export const getExtraction = makeAgentToolAction("getExtraction");
export const listRecentHypotheses = makeAgentToolAction("listRecentHypotheses");
export const listActiveTheses = makeAgentToolAction("listActiveTheses");
export const listFailureArchive = makeAgentToolAction("listFailureArchive");
export const getEditorialSignals = makeAgentToolAction("getEditorialSignals");
export const getRecentRecipes = makeAgentToolAction("getRecentRecipes");
export const getRecommendedActions = makeAgentToolAction("getRecommendedActions");
export const searchSourcesByConcept = makeAgentToolAction("searchSourcesByConcept");
export const createAgentRun = makeAgentToolAction("createAgentRun");
export const appendAgentRunEvent = makeAgentToolAction("appendAgentRunEvent");
export const markAgentRunCompleted = makeAgentToolAction("markAgentRunCompleted");
export const markAgentRunNeedsReview = makeAgentToolAction("markAgentRunNeedsReview");
export const createAgentReviewDraft = makeAgentToolAction("createAgentReviewDraft");
export const markAgentRunFailed = makeAgentToolAction("markAgentRunFailed");
export const claimNextPendingRun = makeAgentToolAction("claimNextPendingRun");
export const getAgentRun = makeAgentToolAction("getAgentRun");
```

- [ ] **Step 6: Reconcile freeze-test diffs deliberately**

Run: `bun test convex/agentToolRegistry.test.ts`
Two EXPECTED, intended diffs against the frozen shapes — update `FROZEN_ARGS` for exactly these and no others, noting each in the commit body:
1. `appendAgentRunEvent.kind` now has 8 members (`memory_recall` added — that is the Task 2 fix carried through).
2. `createAgentRun.traceUrl` / `markAgentRunCompleted.traceUrl` / `markAgentRunFailed.traceUrl`: unchanged `v.optional(v.string())` (zod `.optional()` string) — no diff expected; listed here so an unexpected diff on them is investigated, not accepted.
Any OTHER diff (a missing field, an `id` that derived as `string`, an optionality flip) is a transcription bug in Task 5's `agentToolArgs` — fix the zod schema, never the frozen snapshot.

- [ ] **Step 7: Green gate**

Run: `bun test convex/` — Expected: PASS.
Run: `bunx convex codegen` — Expected: success.

- [ ] **Step 8: Commit**

```bash
git add convex/agentToolRegistry.ts convex/agentToolRegistry.test.ts convex/agentTools.ts
git commit -m "feat(agent-tools): declarative registry; agentTools actions become one-liners

Arg validators now derive from the shared zod schemas (frozen-snapshot
verified; only intended diff: appendAgentRunEvent gains memory_recall).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Loop the HTTP wiring — `agentToolsHttp.ts` + `http.ts`

**Files:**
- Modify: `convex/agentToolsHttp.ts` (replace the 17-entry `agentToolRefs` map + 17 named handler exports with a registry-derived record)
- Modify: `convex/http.ts` (replace lines 4-22 import block + lines 77-177 route blocks with a loop)

**Interfaces:**
- Consumes: `AGENT_TOOL_NAMES` from `convex/shared/agentToolManifest`.
- Produces: `agentToolsHttp.ts` exports `agentToolHttpHandlers: Record<AgentToolName, ReturnType<typeof httpAction>>` (replaces the 17 `xHttp` named exports).

- [ ] **Step 1: Rewrite `agentToolsHttp.ts`**

Keep `json()` and the transport logic of `makeAgentToolHttpHandler` byte-for-byte (it is load-bearing: body parse, early secret check, `secret`-strip, `runAction`); only the name table changes:

```typescript
// convex/agentToolsHttp.ts
import { makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import {
  AGENT_TOOL_NAMES,
} from "./shared/agentToolManifest";
import type { AgentToolName } from "./shared/agentToolArgs";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeAgentToolHttpHandler(toolName: AgentToolName) {
  const ref = makeFunctionReference<"action">(`agentTools:${toolName}`);
  return httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;
    const secret = typeof body.secret === "string" ? body.secret : undefined;
    if (!secret || secret !== process.env.AGENT_TOOL_SECRET) {
      return json({ error: "Forbidden" }, 403);
    }

    const { secret: _secret, ...args } = body;
    const result = await ctx.runAction(ref, { agentSecret: secret, ...args });
    return json(result);
  });
}

export const agentToolHttpHandlers = Object.fromEntries(
  AGENT_TOOL_NAMES.map((name) => [name, makeAgentToolHttpHandler(name)]),
) as Record<AgentToolName, ReturnType<typeof httpAction>>;
```

- [ ] **Step 2: Rewrite the route registration in `http.ts`**

Replace the 17-name import (lines 4-22) with:

```typescript
import { agentToolHttpHandlers } from "./agentToolsHttp";
import { AGENT_TOOL_NAMES } from "./shared/agentToolManifest";
```

Replace the 17 `http.route({ path: "/agent-tools/...", ... })` blocks (lines 77-177) with:

```typescript
for (const name of AGENT_TOOL_NAMES) {
  http.route({
    path: `/agent-tools/${name}`,
    method: "POST",
    handler: agentToolHttpHandlers[name],
  });
}
```

(`http.route` is plain imperative registration on the router object; a loop is legal. The `/health` route and `/ingest/*` routes are untouched.)

- [ ] **Step 3: Typegate + deploy**

Run: `bunx convex codegen`
Expected: success (this deploys the looped routes to the live self-hosted backend).

- [ ] **Step 4: Live smoke against the deployed surface**

```bash
source .env.local 2>/dev/null || true
curl -s -X POST "$CONVEX_SITE_URL/agent-tools/listRecentExtractions" \
  -H 'Content-Type: application/json' \
  -d "{\"secret\": \"$AGENT_TOOL_SECRET\", \"limit\": 1}" | head -c 400
echo
curl -s -X POST "$CONVEX_SITE_URL/agent-tools/listRecentExtractions" \
  -H 'Content-Type: application/json' -d '{"secret": "wrong"}'
```

Expected: first call returns a JSON array (or `[]`); second returns `{"error":"Forbidden"}` with HTTP 403. (If `CONVEX_SITE_URL` is not in `.env.local`, derive it the same way `agent/src/worker/config.ts` `normalizeConvexSiteUrlEnv` does.)

- [ ] **Step 5: Run all convex tests**

Run: `bun test convex/` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/agentToolsHttp.ts convex/http.ts
git commit -m "refactor(agent-tools): derive HTTP handlers and routes from the tool manifest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Agent side derives LangChain tools from the manifest; deepAgent imports shared payload schemas

**Files:**
- Modify: `agent/src/tools/convexTools.ts` (delete 17 hand wrappers + the 16-entry array; derive from manifest; keep `callConvex` + `stripLargeTextFields` byte-identical)
- Modify: `agent/src/agents/research-pipeline/deepAgent.ts` (lines 14-61: delete local zod schemas; import shared)
- Test: `agent/tests/draft-payload-sanitizer.test.ts` (imports update), new `agent/tests/convex-tools-manifest.test.ts`

**Interfaces:**
- Consumes: `AGENT_TOOL_MANIFEST` from `../../../convex/shared/agentToolManifest`; `hypothesisDraftPayloadZ`, `recipeDraftPayloadZ` from `../../../convex/shared/draftPayloads` (path from `agent/src/agents/research-pipeline/` is `../../../../convex/shared/draftPayloads` — four levels; verify with tsc).
- Produces: `convexTools.ts` still exports `callConvex`, `stripLargeTextFields`, and `convexTools` (the LangChain tool array — now derived, snake_case names preserved); `deepAgent.ts` re-exports `hypothesisDraftPayloadSchema = hypothesisDraftPayloadZ` and `recipeDraftPayloadSchema = recipeDraftPayloadZ` as aliases so `sanitizeDraftPayload` and its test keep working.

- [ ] **Step 1: Write the failing test**

```typescript
// agent/tests/convex-tools-manifest.test.ts
import { describe, expect, test } from "bun:test";
import { AGENT_TOOL_MANIFEST } from "../../convex/shared/agentToolManifest";
import { convexTools } from "../src/tools/convexTools.js";

function toSnake(name: string) {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

describe("convexTools derive from the manifest", () => {
  test("exactly the langchain:true tools are exposed, snake_case named", () => {
    const expected = AGENT_TOOL_MANIFEST.filter((t) => t.langchain).map((t) =>
      toSnake(t.name),
    );
    expect(convexTools.map((t) => t.name)).toEqual(expected);
  });

  test("claimNextPendingRun is NOT a LangChain tool (worker-only)", () => {
    expect(convexTools.some((t) => t.name === "claim_next_pending_run")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && bun test tests/convex-tools-manifest.test.ts`
Expected: FAIL — today's array is hand-built (it passes the name check only if order happens to match; the derived import does not exist yet, so the test fails on `AGENT_TOOL_MANIFEST` shape or ordering — confirm it fails before proceeding).

- [ ] **Step 3: Rewrite the wrapper section of `convexTools.ts`**

Keep lines 1-49 (`stripLargeTextFields`, `callConvex`) EXACTLY as they are. Replace everything from line 51 to the end with:

```typescript
import { AGENT_TOOL_MANIFEST } from "../../../convex/shared/agentToolManifest";

function toSnake(name: string) {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

// LangChain adapters for every manifest tool with langchain: true. Tool names
// stay snake_case (prompt-visible contract); args/descriptions come from the
// shared manifest so they cannot drift from the Convex action validators.
export const convexTools = AGENT_TOOL_MANIFEST.filter((t) => t.langchain).map(
  (def) =>
    tool((args) => callConvex(def.name, args as Record<string, unknown>), {
      name: toSnake(def.name),
      description: def.description,
      schema: def.args,
    }),
);

export { stripLargeTextFields };
```

Then fix `agent/src/graphs/research-pipeline/nodes.ts` (lines 1-15) and any other importer of the deleted named exports: they import 13 individual tools by name. Replace that import block with:

```typescript
import { callConvex, convexTools } from "../../tools/convexTools.js";
```

and where nodes.ts passed individual tools to a model/agent, pass the filtered list instead: `const tools = convexTools.filter((t) => t.name !== "get_agent_run");` — CHECK the actual usage first with `grep -n "listRecentExtractions\|createAgentRun\|markAgentRun" agent/src/graphs/research-pipeline/nodes.ts`: where a node calls a tool DIRECTLY (e.g. `await createAgentRun.invoke({...})`), replace with `await callConvex("createAgentRun", {...})` — the raw client is the right seam for programmatic calls; the LangChain `tool()` wrappers are for LLM tool-binding only. Apply the same treatment to `agent/src/agents/weekly-brief/` if it imports named tools (`grep -rn "from \"../../tools/convexTools" agent/src`).

- [ ] **Step 4: Point deepAgent.ts at the shared payload schemas**

In `agent/src/agents/research-pipeline/deepAgent.ts`, delete lines 14-61 (the `MUST mirror` comment block and the four local schemas) and add:

```typescript
import {
  hypothesisDraftPayloadZ,
  recipeDraftPayloadZ,
} from "../../../../convex/shared/draftPayloads";

// Aliases preserved for existing imports/tests; the schemas now live at the
// seam in convex/shared/draftPayloads.ts (zod-first, Convex validators derive).
export const hypothesisDraftPayloadSchema = hypothesisDraftPayloadZ;
export const recipeDraftPayloadSchema = recipeDraftPayloadZ;
```

`sanitizeDraftPayload` (lines 67-81) is unchanged — it references the two aliases. Note: the shared recipe parameter schema is WIDER than the deleted local one (adds `registryStatus`, `canonicalKind`, structured `details`) — that is the intended fix: the agent may now emit every field the Convex validator accepts.

- [ ] **Step 5: Green gates**

Run: `cd agent && bun run verify` — Expected: tsc clean (this validates the 4-level relative path).
Run: `cd agent && bun test` — Expected: PASS, including `draft-payload-sanitizer.test.ts` (aliases keep it compiling) and the new manifest test.
If Task 3 Step 5 chose the sync-file fallback, extend `sync-shared-contract.ts` to also sync `agentToolManifest.ts`, `agentToolArgs.ts`, `draftPayloads.ts` and re-point these imports at the `.gen` copies.

- [ ] **Step 6: Commit**

```bash
git add agent/src/tools/convexTools.ts agent/src/agents/research-pipeline/deepAgent.ts agent/src/graphs/research-pipeline/nodes.ts agent/tests/convex-tools-manifest.test.ts agent/tests/draft-payload-sanitizer.test.ts
git commit -m "refactor(agent): derive LangChain tools + draft payload schemas from convex/shared

Deletes the hand-mirrored zod copies (17 tool wrappers, 2 payload schemas,
1 dead claim tool). memory_recall + full parameter shape now usable.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Generate the docs table from the registry

**Files:**
- Create: `scripts/generate-agent-tool-docs.ts`
- Modify: `docs/agent-tool-surface.md` (wrap the two tool tables in markers; regenerate)
- Test: `convex/agentToolRegistry.test.ts` (add freshness test)

**Interfaces:**
- Consumes: `AGENT_TOOL_REGISTRY` (for names/descriptions/kind) — the script also needs HTTP path (`/agent-tools/<name>`) and backing function names. Backing functions are inside `run` lambdas; expose them declaratively by ADDING a `backing: string` field to each entry in `convex/shared/agentToolManifest.ts` (e.g. `"extractions:listRecent"`, or `"agentRuns:create + agentRuns:markRunning"` for the composite) — display metadata only, no behaviour.
- Produces: `docs/agent-tool-surface.md` with `<!-- AGENT_TOOLS:BEGIN -->` / `<!-- AGENT_TOOLS:END -->` sections; `bun scripts/generate-agent-tool-docs.ts --check` exits 1 when stale.

- [ ] **Step 1: Add `backing` to the manifest**

In `convex/shared/agentToolManifest.ts`, extend the type and the `entry()` helper:

```typescript
export type AgentToolManifestEntry = {
  name: AgentToolName;
  description: string;
  args: z.ZodObject<any>;
  langchain: boolean;
  kind: "read" | "audit_write";
  backing: string; // display-only: "module:function" of the backing Convex fn(s)
};
```

`entry(name, kind, backing, description, opts)` — update all 17 call sites with the backing strings from the current docs table: `extractions:listRecent`, `extractions:get`, `hypotheses:listByStatus`, `theses:list`, `failures:listArchive`, `dashboard:editorialSignals`, `recipes:listByStatus`, `campaigns:getRecommendedActions`, `graph:searchSourcesByConcept`, `agentRuns:create + agentRuns:markRunning`, `agentRuns:appendEvent`, `agentRuns:markCompleted`, `agentRuns:markNeedsReview`, `agentDrafts:createFromAgentRun`, `agentRuns:markFailed`, `agentRuns:claimNextPending`, `agentRuns:getForWorker`.

- [ ] **Step 2: Write the generator**

```typescript
// scripts/generate-agent-tool-docs.ts
//
// Renders the tool tables in docs/agent-tool-surface.md from the manifest.
// Usage: bun scripts/generate-agent-tool-docs.ts [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { AGENT_TOOL_MANIFEST } from "../convex/shared/agentToolManifest";

const DOC = "docs/agent-tool-surface.md";
const BEGIN = "<!-- AGENT_TOOLS:BEGIN -->";
const END = "<!-- AGENT_TOOLS:END -->";

function table(kind: "read" | "audit_write") {
  const rows = AGENT_TOOL_MANIFEST.filter((t) => t.kind === kind).map(
    (t) =>
      `| \`${t.name}\` | \`/agent-tools/${t.name}\` | \`${t.backing}\` | ${t.description} |`,
  );
  return [
    "| Tool | HTTP path | Backing function | Purpose |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const generated = [
  BEGIN,
  "",
  "### Read-only research tools",
  "",
  table("read"),
  "",
  "### Audit-only write tools",
  "",
  "These write only to `agentRuns` and `agentRunEvents` for observability/review. They must not be used as a substitute for approved research-data writes.",
  "",
  table("audit_write"),
  "",
  END,
].join("\n");

const current = readFileSync(DOC, "utf8");
const pattern = new RegExp(`${BEGIN}[\\s\\S]*${END}`);
if (!pattern.test(current)) {
  console.error(`Markers not found in ${DOC}; add ${BEGIN} / ${END} first.`);
  process.exit(2);
}
const next = current.replace(pattern, generated);

if (process.argv.includes("--check")) {
  if (next !== current) {
    console.error(`${DOC} is stale. Run: bun scripts/generate-agent-tool-docs.ts`);
    process.exit(1);
  }
  console.log(`${DOC} is up to date.`);
} else {
  writeFileSync(DOC, next);
  console.log(`${DOC} regenerated.`);
}
```

- [ ] **Step 3: Add markers and regenerate**

In `docs/agent-tool-surface.md`: insert `<!-- AGENT_TOOLS:BEGIN -->` on the line above `### Read-only research tools` (line 17) and `<!-- AGENT_TOOLS:END -->` after the audit-write table (after line 44, before `### Human-only decision mutations`). The `Context notes` column content that only lives in prose moves into the `### Human-only decision mutations` intro or is folded into descriptions — review the diff so no guidance is silently lost.

Run: `bun scripts/generate-agent-tool-docs.ts`
Expected: `docs/agent-tool-surface.md regenerated.` — then `git diff docs/agent-tool-surface.md` shows only the tables re-rendered (same 17 tools).

- [ ] **Step 4: Add the freshness test**

Append to `convex/agentToolRegistry.test.ts`:

```typescript
import { spawnSync } from "node:child_process";

test("docs/agent-tool-surface.md is generated and fresh", () => {
  const result = spawnSync("bun", ["scripts/generate-agent-tool-docs.ts", "--check"], {
    cwd: `${import.meta.dir}/..`,
  });
  expect(result.status).toBe(0);
});
```

Run: `bun test convex/agentToolRegistry.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-agent-tool-docs.ts docs/agent-tool-surface.md convex/shared/agentToolManifest.ts convex/agentToolRegistry.test.ts
git commit -m "feat(docs): generate agent-tool-surface tables from the manifest, with freshness test

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end verification + cleanup sweep

**Files:**
- Verify only (no planned edits; fix anything the sweep finds)

- [ ] **Step 1: Dead-name sweep**

```bash
grep -rn "agentToolRefs\|makeAgentToolHttpHandler\|listRecentExtractionsHttp" convex/ --include="*.ts" | grep -v _generated
grep -rn "hypothesisDraftPayloadSchema\s*=\s*z.object\|MUST mirror" agent/src
grep -rn "kind: v.union" convex/agentTools.ts
```

Expected: first grep hits only `agentToolsHttp.ts`'s own definition; second and third: no hits.

- [ ] **Step 2: Full gates, all workspaces**

```bash
bun test convex/
bunx convex codegen
cd agent && bun run verify && bun test && cd ..
```

Expected: all PASS/clean.

- [ ] **Step 3: Live worker smoke (proves the seam end-to-end)**

```bash
cd agent && timeout 30 bun src/worker/runner.ts; cd ..
```

Expected: `[worker] started workerId=...` then poll loops (empty queue) — no crash, no auth errors; exit via timeout is fine.

- [ ] **Step 4: Adding-a-tool drill (paper check, no commit)**

Confirm the new locality story in a scratch diff, then discard: adding a hypothetical tool now touches exactly (1) backing fn, (2) one `agentToolArgs` entry, (3) one manifest `entry(...)`, (4) one `runs` lambda, (5) one `export const` line in agentTools.ts — the registry/manifest tests fail loudly if any of 2-5 is missed, and HTTP routes + LangChain tools + docs need NO edits. Record this in the final commit message.

- [ ] **Step 5: Final commit (if the sweep fixed anything) and summary**

```bash
git add -A
git commit -m "chore(agent-tools): registry migration cleanup sweep

Adding a tool now touches 5 co-located places (was 6+ scattered), with
completeness tests covering all derived wiring: HTTP routes, LangChain
tools, docs table, arg validators.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** registry (Tasks 5-7), zod-first payloads (Task 4), event-kind drift fix (Task 2, carried through 5/6/8), timing contract + TERMINAL_STATUS_OWNER (Tasks 1/3), dead `claimNextPendingRun` tool resolution (Task 5 `langchain:false` + Task 8), docs generation (Task 9), root zod dep (Task 4), completeness/freshness tests (Tasks 5/6/9). Directive's "convexTools imports agentToolRegistry" was refined to "imports agentToolManifest" — the registry needs `ActionCtx` from `_generated`, which must not cross the seam; the manifest split preserves the intent (single declarative source) with a clean dependency direction.
- **Type consistency check:** `AgentToolName` originates in `agentToolArgs.ts`; manifest/registry/agentTools/convexTools all import it. `AGENT_TOOL_MANIFEST` / `AGENT_TOOL_NAMES` / `AGENT_TOOL_REGISTRY` / `agentToolByName` names are used consistently across Tasks 5-9. `hypothesisDraftPayloadZ`/`recipeDraftPayloadZ`/`recipeProtocolZ` (Task 4) are the names deepAgent imports (Task 8).
- **Known risks, mitigated in-plan:** langgraphjs Docker bundling of out-of-tree imports (Task 3 Step 5 fallback, extended in Task 8 Step 5); `zodToConvex` serialization mismatches (freeze tests in Tasks 4/6 with explicit do-not-edit-the-snapshot rules); codegen literal-union inference (Task 2 Step 3 fallback).
