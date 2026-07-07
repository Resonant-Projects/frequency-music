# Correspondences — Table, Lifecycle, Agent Write Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Found-state rule (wave 2026-07-07):** authored pre-arch-wave. Adapt to found state; schemas, interfaces, and gates are binding. **Prerequisites: plan 01 (claims), plan 02 (domains/relevance), arch plan 2026-07-03-05 (agent-tool registry).**

**Goal:** Land the wave's central entity. A **Correspondence** (per `CONTEXT.md`) is an asserted link between two concepts from different domains: the concept pair is its identity and dedupe key; claims cite as evidence; lifecycle `conjectured → evidenced | contradicted → retired`. Agents write correspondences directly (provenance-stamped, no review queue) — the two-doors-one-gate decision recorded 2026-07-07 in `docs/decision-log.md`.

**Tech Stack:** Bun, Convex (self-hosted), zod-first cross-seam shapes (`convex/shared/`, per arch wave), bun:test + harness.

## Global Constraints

- Bun; `bunx convex codegen` deploys live — coherent commits only.
- Cross-seam shapes (anything the agent workspace sends/receives) are zod-first in `convex/shared/`, Convex validators derived — per the 2026-07-03 decision. Internal-only shapes stay schema-canonical.
- Correspondences are never deleted: `retired` is the terminal parking status.
- **Cross-domain invariant enforced in code:** a pair whose concepts share every domain is rejected at the mutation, not left to prompt discipline. (Concepts are multi-domain; the invariant is "domain sets are not identical and the pair has at least one disjoint domain crossing.")

## Non-goals / rabbit holes

- **No** mining (plan 05) or hypothesis derivation (plan 06) — this plan is the entity and its doors only.
- **No** correspondence browsing UI — plan 07's review card and plan 08's brief are the only render surfaces this wave.
- **No** evidence-weight sophistication: the v1 status-recompute rule is count-based on purpose; the revisit trigger is recorded.
- **No** `relationshipKinds` registry expansion — use existing kinds or leave `relationship` unset.

---

### Task 1: Schema — the `correspondences` table

**Files:**
- Modify: `convex/schema.ts` (+ mirror); `convex/shared/` zod shape for the agent-facing payload

**Interfaces (binding):**

```typescript
correspondences: defineTable({
  // Identity: canonically ordered pair (lexicographic by concept _id) → stable pairKey.
  conceptAId: v.id("concepts"),
  conceptBId: v.id("concepts"),
  pairKey: v.string(),                    // `${minId}:${maxId}` — computed by one shared helper only
  // The assertion
  statement: v.string(),                  // one-sentence claim of the link
  rationaleMd: v.string(),                // why the proposer believes it (miner writes this)
  relationship: v.optional(v.string()),   // relationshipKinds registry name, when known
  // Evidence: claim citations with stance
  evidence: v.array(
    v.object({
      claimId: v.id("claims"),
      stance: v.union(v.literal("supports"), v.literal("contradicts")),
      note: v.optional(v.string()),
      addedBy: v.union(v.literal("agent"), v.literal("human")),
      addedAt: v.number(),
    }),
  ),
  // Lifecycle
  status: v.union(
    v.literal("conjectured"),
    v.literal("evidenced"),
    v.literal("contradicted"),
    v.literal("retired"),
  ),
  statusReason: v.optional(v.string()),
  // Discovery scores (plan 05 fills; kept for reproducibility/audit)
  similarityScore: v.optional(v.number()),
  noveltyScore: v.optional(v.number()),
  // Provenance
  ...agentOriginFields,                    // origin/agentRunId/agentDraftId/traceUrl (existing shared fields)
  createdBy: v.union(v.id("users"), v.literal("system")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_pairKey", ["pairKey"])
  .index("by_status_updatedAt", ["status", "updatedAt"])
  .index("by_conceptAId", ["conceptAId"])
  .index("by_conceptBId", ["conceptBId"])
```

- [ ] **Step 1:** Table + mirror + `pairKey` helper (`convex/shared/correspondenceKey.ts`, pure, tested: symmetric — `key(a,b) === key(b,a)`).
- [ ] **Step 2:** `bunx convex codegen`; commit.

---

### Task 2: Lifecycle mutations

**Files:**
- Create: `convex/correspondences.ts`
- Test: harness tests

**Interfaces (binding):**

```typescript
// upsertConjecture — THE agent write door. Idempotent on pairKey.
args: { conceptAId, conceptBId, statement, rationaleMd, relationship?,
        similarityScore?, noveltyScore?, agentRunId?, traceUrl?, devBypassSecret? }
// New pair → insert as "conjectured" with origin:"agent" when agentRunId present.
// Existing pair → merge: append rationale as an addendum, update scores if higher,
//                 bump updatedAt. NEVER creates a second row. Returns { id, created: boolean }.
// Rejects (throws): same-domain pair (identical domain sets), either concept off-mission,
//                   either concept missing missionRelevance/domains (unclassified).

// addEvidence — agent or human attaches a claim citation.
args: { correspondenceId, claimId, stance, note?, agentRunId?, devBypassSecret? }
// Appends; recomputes status: any "supports" evidence on a conjectured row → "evidenced";
// contradicting evidence outweighing supporting (count-based v1) → "contradicted".
// Dedupes on (claimId, stance).

// setStatus — guarded transitions.
// Humans: any transition, statusReason required.
// System/agent: only conjectured→retired (auto-retire, plan 05's staleness sweep)
//               and the evidence-driven recomputes above. Agents NEVER set "evidenced" directly.

// Queries: getByPairKey, listByStatus, listForConcept (union of A/B indexes),
//          listRecentMovement { since } → rows whose status or evidence changed (plan 08 consumes).
```

**Design notes:**
- The status-recompute rule is deliberately dumb in v1 (any supporting claim ⇒ evidenced). The session's revisit trigger covers tightening it; don't gold-plate now.
- The same-domain rejection reads both concepts inside the mutation — 2 gets, cheap.

- [ ] **Step 1:** Failing harness tests: idempotent upsert (one row, merged), symmetric pairKey hit, same-domain rejection, off-mission rejection, evidence-driven status recompute, dedupe of evidence, guarded setStatus matrix.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Tests pass; codegen; commit.

---

### Task 3: Agent-tool surface registration

**Files:**
- Modify: the agent-tool registry (found-state location from arch plan 05: one registry row + one export per tool)
- Modify: `agent/src/tools/` derived tool exports if the registry doesn't fully derive them (follow found state)

**Tools to register (zod-first payloads in `convex/shared/`):**

| Tool | Wraps | Notes |
|---|---|---|
| `upsert_correspondence` | `correspondences.upsertConjecture` | write; provenance from the run context |
| `add_correspondence_evidence` | `correspondences.addEvidence` | write |
| `get_correspondence` | `getByPairKey` | read |
| `list_correspondences` | `listByStatus` | read; status + limit args |
| `list_concept_correspondences` | `listForConcept` | read |

- [ ] **Step 1:** Registry rows + exports; run the arch-05 "adding-a-tool drill" acceptance (one row + one export, everything else derived).
- [ ] **Step 2:** `cd agent && bunx tsc --noEmit` green; agent tests green; commit.

---

### Task 4: Auto-retire sweep (staleness)

**Files:**
- Modify: `convex/crons.ts`; `convex/correspondences.ts` (internal mutation)

Conjectured correspondences with no evidence and no update for 90 days → `retired`, `statusReason: "stale conjecture (auto)"`. Reversible by design (it's a status); the session ratified auto-retirement without human involvement. Weekly cron.

- [ ] **Step 1:** Harness test with injected timestamps; implement; codegen; commit.

---

## Done means

- Upserting the same pair twice (either order) yields one row with merged rationale.
- Same-domain and off-mission pairs are rejected with clear errors.
- Evidence recomputes status per the v1 rule; agents cannot set `evidenced` directly.
- All five tools pass the registry drill; agent workspace typechecks.
- Stale-sweep cron registered and harness-tested.
