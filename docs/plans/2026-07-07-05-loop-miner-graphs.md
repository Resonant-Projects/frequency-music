# Candidate Generator + Miner & Evidence-Hunter Graphs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps track progress.
> **Found-state rule (wave 2026-07-07):** adapt to found state; interfaces and gates binding. **Prerequisites: plans 03 (correspondences) and 04 (embeddings).**

## Executor brief

- Build a deterministic Convex candidate generator: pairs that are *semantically near, structurally distant, domain-crossing*.
- Build two LangGraph graphs in `agent/`: **miner** (judge candidates → write correspondences) and **evidence-hunter** (strengthen/contradict existing conjectures).
- Both run under the existing worker/leasing machinery; every write is provenance-stamped and reproducible from its candidate list.

**Why (session decisions Q8, Q9, Q10):** embeddings propose (cheap, exhaustive, reproducible) → symbolic features score novelty (co-mention *penalizes*) → LLM judges a shortlist. Judgment-over-alternatives work lives in LangGraph; mining is continuous graph enrichment with no review queue.

**Tech Stack:** Bun, Convex actions (`ctx.vectorSearch`), LangGraph TS in `agent/`, LangSmith tracing (best-effort), existing worker (`agent/src/worker/runner.ts`).

## Global Constraints

- `bunx convex codegen` deploys live. `cd agent && bunx tsc --noEmit` is the agent typegate.
- Agents write only through the plan-03 tool surface. The miner never touches `hypotheses`/`recipes`/`agentReviewDrafts`.
- Every miner/hunter run is an `agentRuns` row with `agentRunEvents` (`node`, `decision`, `tool_call`) — the existing audit contract.
- Model doctrine: Sonnet-class for judging. Never Llama.

## Non-goals / rabbit holes

- **No** hypothesis drafting here (plan 06). The miner stops at correspondence rows.
- **No** tuning of the status-recompute rule (plan 03 owns it; revisit trigger recorded).
- **No** re-ranking research beyond the v1 novelty formula below — ship dumb, measure, iterate.
- **No** new scheduling infrastructure — reuse the worker; cron cadence is one line in `convex/crons.ts`.

---

### Task 1: Candidate generator (Convex internal action)

**Files:**
- Create: `convex/correspondenceCandidates.ts`

**Interfaces (binding):**

```typescript
// internal action generateCandidates
args: { limit?: number /* default 25 */, seedConceptId?: Id<"concepts"> }
returns: Array<{
  conceptAId: Id<"concepts">, conceptBId: Id<"concepts">,
  pairKey: string,
  similarityScore: number,       // max cosine sim among cross-concept claim pairs sampled
  noveltyScore: number,          // 1 / (1 + coMentions + existingEdges); 0 if correspondence exists
  domainsA: string[], domainsB: string[],
  sampleClaimIds: { a: Id<"claims">[], b: Id<"claims">[] },  // top-3 each side, for the judge
}>
```

**Algorithm (v1, deliberately simple):**
1. Pick probe concepts: on-mission, embedded; `seedConceptId` if given, else round-robin by least-recently-probed (store `lastProbedAt` on concepts — add optional field).
2. For each probe: `ctx.vectorSearch` its embedding against **claims** index (top-32); map hits → their sources' on-mission concepts.
3. Form pairs (probe, hitConcept) where domain sets aren't identical; drop pairs with an existing correspondence (`by_pairKey` check); drop same-concept.
4. Score: `similarityScore` from the vector hit; `noveltyScore` penalized by co-mention/edge count (`edges` `by_from`/`by_to` counts).
5. Return top-`limit` by `similarityScore × noveltyScore` with sample claims attached.

- [x] **Step 1:** Harness-test the pure scoring/pairing helpers (extract them pure; the vector search itself is action-only).
- [x] **Step 2:** Implement; expose via agent-tool registry as `list_correspondence_candidates` (read).
- [ ] **Step 3:** Codegen; run once manually via `bunx convex run` and eyeball the top-10 pairs (paste in PR); commit.
  - Operator-gated: generated declarations were updated by hand in generated style; live codegen and the manual Convex run were intentionally not executed.

---

### Task 2: Miner graph

**Files:**
- Create: `agent/src/graphs/correspondence-miner/{index,nodes,prompts,state}.ts`
- Modify: worker graph registration (`agent/src/worker/graphInput.ts` per found state)

**Graph shape (binding):**

```
fetch_candidates ──► judge_loop (per candidate, ≤ limit) ──► write_or_discard ──► summarize
     │                     │
     │                     ├─ gather: sample claims (get texts via claims tools), concept
     │                     │          descriptions, existing correspondence check (freshness)
     │                     └─ judge: structured verdict
     └─ empty → summarize("no candidates") → END
```

**Judge output (zod, binding):** `{ accept: boolean, statement: string, rationaleMd: string, relationship?: string, confidenceNote: string }`. Judge prompt frames the mission (frequency across disciplines), demands the statement be falsifiable-ish and the rationale cite the sample claims, and instructs *reject when the link is generic* ("both involve sound").

**Per accepted candidate:** `upsert_correspondence` with scores + provenance, then `add_correspondence_evidence` for sample claims the judge cited as directly supporting (stance `supports`). Discards log a `decision` event with the reason — discard reasons are eval data.

- [x] **Step 1:** Agent tests: judge-output schema round-trip; write-node calls tools with provenance (mock the tool layer per found-state test conventions).
- [x] **Step 2:** Implement graph + register with worker.
- [x] **Step 3:** `vpx tsc --noEmit` + agent tests green; commit.

---

### Task 3: Evidence-hunter graph

**Files:**
- Create: `agent/src/graphs/evidence-hunter/{index,nodes,prompts,state}.ts`

**Graph shape (binding):**

```
pick_targets (conjectured, oldest-evidence-first, ≤5) ──► per target:
  search_claims (vector-search both concepts' text via a new read tool
                 `search_claims_semantic` — add to registry: text → top-k claims)
  ──► judge_stance (per claim: supports / contradicts / irrelevant, with note)
  ──► add_evidence (tool; irrelevant → skip)
──► summarize (evidence added per target; status changes observed)
```

- [x] **Step 1:** Register `search_claims_semantic` (Convex action wrapping `ctx.vectorSearch` on claims by embedded query text; read-only).
- [x] **Step 2:** Implement graph; tests; typegate; commit.

---

### Task 4: Scheduling + first live runs

**Files:**
- Modify: `convex/crons.ts` (enqueue miner daily, hunter daily offset; enqueue = insert queued `agentRuns` row per found-state worker contract)

- [ ] **Step 1:** Cron registration; codegen; commit.
- [ ] **Step 2: Live gate.** Trigger one miner run via the worker. Verify: ≥1 and ≤20 correspondences written; each has statement, rationale, scores, run id, trace URL; run events tell a readable story. Paste run summary in PR.
- [ ] **Step 3:** Trigger a second identical run: zero duplicate pairs (upsert merges). Trigger one hunter run: evidence appended to ≥1 conjecture, statuses recomputed correctly.

---

## Done means

- Candidate generator returns scored, sampled, domain-crossing pairs; helpers harness-tested.
- Miner and hunter run end-to-end under the worker with full audit trails; reruns don't duplicate.
- `search_claims_semantic` and `list_correspondence_candidates` pass the registry drill.
- First real correspondences exist in production with rationale a human can evaluate (PR includes 3 examples, good or bad — honesty over curation).
