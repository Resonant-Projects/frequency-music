# Correspondence-Driven Hypothesis Drafting (WIP-Capped) — Implementation Plan

> **Archived 2026-08-03:** implementation merged in PR #32 (`f3556d5`). Remaining live draft/promotion acceptance is tracked in `docs/plans/README.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps track progress.
> **Found-state rule (wave 2026-07-07):** adapt to found state; interfaces and gates binding. **Prerequisites: plans 03, 05 (there must be correspondences to draft from).**

## Executor brief

- Build the flagship LangGraph workload: derive a testable hypothesis *from a correspondence* and submit it through the existing draft-review door.
- Enforce the WIP cap: **the graph refuses to run when pending hypothesis drafts ≥ 3.**
- Thread `correspondenceId` provenance through draft payload → promotion → `hypotheses` row.

**Why (session decisions Q3, Q9, Q10):** hypotheses become the *experiment* path for resolving conjectures. Drafting is judgment work → LangGraph → draft door (the one gate). The WIP cap makes the human the bottleneck by design — "agent blocked waiting on you" replaces "queue you ignore."

**Tech Stack:** LangGraph TS, existing draft-promotion machinery (`convex/agentDrafts.ts`, `agentDraftPromotion.ts`), zod-first payloads in `convex/shared/`.

## Global Constraints

- The draft door is the ONLY write: this graph never inserts into `hypotheses`/`recipes` directly.
- Promotion remains loss-free and human-only (Gate G2 pure builders unchanged, per 2026-07-01 decision).
- WIP cap enforced server-side (Convex query the graph consults AND a guard in the draft-write mutation) — not just in graph control flow. Prompt discipline is not an invariant.

## Non-goals / rabbit holes

- **No** recipe drafting changes (existing recipe draft path untouched).
- **No** review UX (plan 07). **No** brief integration (plan 08).
- **No** cap configurability UI — `PENDING_DRAFT_CAP = 3` is a constant in `convex/shared/agentContract.ts` (or found-state equivalent). Changing it is a one-line PR; the revisit trigger is recorded.
- **No** auto-promotion of anything, ever.

---

### Task 1: Schema + payload — `correspondenceId` provenance

**Files:**
- Modify: `convex/schema.ts` — `hypotheses` gains `correspondenceId: v.optional(v.id("correspondences"))` + index `by_correspondenceId`; `agentDraftHypothesisPayloadValidator` (zod-first found state) gains the same optional field.
- Modify: promotion builder — carries the field through (loss-free contract).
- Modify: on promotion, the hypothesis's correspondence gets an `agentRunEvents`-style trace: append a `decision` event on the originating run per found-state convention (cheap lineage; no new table).

- [x] **Step 1:** Harness test: draft with `correspondenceId` promotes to a hypothesis carrying it.
- [x] **Step 2:** Implement; codegen; commit. *(Implementation and offline typecheck complete; codegen intentionally skipped per operator constraint.)*

---

### Task 2: WIP-cap contract

**Files:**
- Modify: `convex/shared/agentContract.ts` (found-state location): `export const PENDING_DRAFT_CAP = 3;`
- Modify: `convex/agentDrafts.ts`: query `countPending { kind }`; guard in the draft-create mutation: creating a `hypothesis_draft` when pending ≥ cap throws `DraftCapExceeded`.

- [x] **Step 1:** Failing harness test: 3 pending hypothesis drafts → 4th create throws; recipe drafts unaffected; approving one reopens capacity.
- [x] **Step 2:** Implement; codegen; commit. *(Implementation and offline typecheck complete; codegen intentionally skipped per operator constraint.)*

---

### Task 3: Drafting graph

**Files:**
- Create: `agent/src/graphs/hypothesis-drafter/{index,nodes,prompts,state}.ts`
- Modify: worker registration.

**Graph shape (binding):**

```
check_capacity ──► pick_target ──► gather_context ──► draft ──► self_check ──► write_draft ──► summarize
   │                  │
   │ cap reached →    │ no target →
   │ log status event │ log status event
   │ + END            │ + END
```

- **check_capacity:** `countPending` via tool. At cap → `status` event `"drafting blocked: N pending drafts await review"` → END (run completes cleanly; this event is plan 08's signal).
- **pick_target:** best correspondence by (status `evidenced` first, then strong `conjectured` by scores) that has **no** existing hypothesis (`by_correspondenceId` empty) and no pending draft targeting it. Log the choice + runner-up as a `decision` event.
- **gather_context (tools):** evidence claims' full texts; both concepts' descriptions + top sources; related prior hypotheses (search by the two concept names) **including retired/contradicted ones and failure-archive entries** — the drafter must know what already failed.
- **draft:** produce the payload (title, question, statement, rationale citing evidence claims, whyThisMatters, concepts = the pair + salient extras, sourceIds/extractionIds from evidence claims' provenance, correspondenceId).
- **self_check:** structured pass — is it testable in a micro-study? does it vary ONE thing? does rationale actually cite the evidence? Fail → one revision loop, then discard with `decision` event (do not write a bad draft to burn cap slots).
- **write_draft:** existing draft-write tool with the extended payload.

- [x] **Step 1:** Agent tests: capacity short-circuit; target dedupe (correspondence with existing hypothesis never picked); payload schema round-trip.
- [x] **Step 2:** Implement; typegate; commit.

---

### Task 4: Scheduling + live gate

**Files:**
- Modify: `convex/crons.ts` — weekly enqueue (pulsed cadence, before the Friday brief so fresh drafts appear in it; pick the exact offset from the found-state brief cron).

- [x] **Step 1:** Cron; codegen; commit. *(Cron and offline verification complete; codegen intentionally skipped per operator constraint.)*
- [ ] **Step 2: Live gate.** Seed ≥1 evidenced correspondence (plan 05 output). Run the graph: a real draft appears in `agent-drafts` with correspondence provenance. Approve it in the existing UI: hypothesis row carries `correspondenceId`. Then artificially hold 3 pending drafts and run again: clean refusal with status event. Paste both run summaries in PR. **Operator note:** intentionally not run; this gate requires live Convex mutations, which are prohibited for this implementation pass.

---

## Done means

- `PENDING_DRAFT_CAP` enforced server-side; harness matrix green.
- A promoted hypothesis carries `correspondenceId`; promotion remains loss-free.
- The graph picks sensible targets (never double-drafts a correspondence), gathers failure-aware context, self-checks, and refuses cleanly at cap.
- Weekly cadence wired; first real draft reviewed end-to-end as the gate.
