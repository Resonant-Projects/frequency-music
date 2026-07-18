# 13 — Recipe Loop Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps track progress.
> **Sequencing:** after plan 07 (amended review UX) — recipe drafts flow into the same review card and reuse its edit-before-approve machinery. Consumes plan 06's draft-door plumbing.
> **Origin:** 2026-07-18 decision-log entry (Decision Surfaces). Prerequisite operator item: golden eval datasets curated (plan `plans/008`) **before this plan starts**, so generator changes here are measured against a baseline.

## Executor brief

Two halves of one user story — when a hypothesis is approved, its recipe drafts itself; when the
recipe draft comes up for review, the reviewer can shape it:

1. **Auto-draft on approval:** approving a hypothesis (draft promotion or manual status change to an
   approved/active state per found status vocabulary) schedules recipe generation whose output enters
   the **agent-draft door** as a `recipe_draft` — same WIP cap, same review queue, same provenance
   discipline. Automation of generation, human gate on entry ("two doors, one gate" extended, not
   bypassed).
2. **Recipe review surface:** recipe drafts and promoted recipes stop being read-only in the UI —
   structured parameter editing on the review card (extending plan 07's text-level edit mode), and
   `recipes.updateStatus` (approve/deprecate) wired into `recipe-detail`.

**Why:** today `recipes:generateFromHypothesis` is a manual CLI ritual, `recipe-detail.tsx` has zero
mutations, and `recipes.updateStatus` is unreachable from the UI — the hypothesis→recipe chain is
where the pipeline stalls after review.

**Tech stack:** Convex scheduler + existing recipe generator path (`convex/recipes.ts`,
`convex/llm.ts`); agent-draft door (`convex/agentDrafts.ts`, `agentReviewDrafts` table); SolidJS
routes `recipe-detail.tsx`, `agent-drafts.tsx`.

## Global constraints

- The WIP cap (N=3 pending drafts) applies to auto-generated recipe drafts exactly as to miner
  output: at cap, generation defers and logs a status event — it never queues unbounded. **Deferral
  must not strand work:** the "approved hypothesis lacking a recipe and lacking a pending
  `recipe_draft`" condition IS the durable deferred-work record — no separate queue table. A
  capacity-recheck (on draft decision and/or a cron sweep reusing the `generateBatch` selection
  semantics) picks up deferred hypotheses when slots free, bounded to the cap each pass.
- **Cap-check + dedupe are atomic:** the WIP-cap test and the pending-draft-per-hypothesis dedupe
  happen inside the single Convex mutation that inserts the draft row (transactional), so concurrent
  approvals can neither exceed N=3 nor create duplicate drafts; a retry reuses the existing pending
  draft.
- Recipe draft payloads validate against the shared validators (`generatedRecipeValidator` in
  `convex/validators.ts`, plus the draft-payload schema under `convex/shared/` at the agent seam);
  the generator path and the review/amendment path use the same validators — never hand-mirrored
  shapes.
- One recipe draft per hypothesis approval; re-approval or regeneration must not duplicate a pending
  draft for the same hypothesis (dedupe on pending `recipe_draft` payload.hypothesisId).
- `bunx convex codegen|dev|deploy` — and equally `vpx convex codegen|dev|deploy` / `vpx convex run`
  — contact the LIVE backend; deploys operator-gated.

## Non-goals / rabbit holes

- **No** starter-kit generation on approval (plan 10 owns recipe → `.scl`/`.kbm`/MIDI artifacts).
- **No** auto-approval of anything — the draft door's human gate is the point.
- **No** composition scheduling; the chain stops at an approved recipe.
- **No** generator model/prompt knobs in the UI (generator steering is deferred by decision log).

---

### Task 1: Auto-draft trigger

**Files:** `convex/hypotheses.ts` (approval paths), `convex/agentDrafts.ts` or the internal
draft-creation helper per found state, harness tests.

- On hypothesis approval — the found status vocabulary's transition into its active/approved state;
  the executor pins the exact enum value at execution and records it in the PR — **reserve, then
  schedule**: the approval mutation itself atomically checks the WIP cap and the pending-draft
  dedupe key (`recipe_draft` × `hypothesisId`) and records the reservation in the same transaction;
  only a successful reservation enqueues generation via `ctx.scheduler`. On reservation failure,
  write the deferral status event (cap) or skip silently (dedupe). The scheduled job's draft insert
  is idempotent against its reservation, so a retry reuses it rather than duplicating.
- Generated drafts carry provenance `{ trigger: "hypothesis_approval", hypothesisId }` (shape per
  found provenance contract).

- [ ] **Step 1:** Harness tests (draft created on approval; WIP-cap deferral event; dedupe; payload
  validates). Implement; codegen; commit.

---

### Task 2: Recipe review + editing surface

**Files:** `web/src/routes/recipe-detail.tsx`, `web/src/components/agent-draft.tsx`,
`convex/recipes.ts` (only if `update`/`updateStatus` need shape work).

- Review card: structured parameter editing for `recipe_draft` payloads (name/value/unit rows,
  add/remove), extending the plan-07 edit mode; checklist and protocol as editable text. **Draft
  edits flow through `agentDrafts.approve`'s `amendedPayload` (plan 07's mutation — no new draft-edit
  mutation)**; only promoted recipes use `recipes.update`. Both paths validate against the shared
  `generatedRecipeValidator` in `convex/validators.ts` and preserve the original payload alongside
  the amendment with field-diff provenance.
- `recipe-detail`: wire `recipes.update` (parameter edits with the same field-diff provenance
  discipline) and `recipes.updateStatus` (approve/deprecate with note).
- **Server-side guards, not UI-side trust:** `recipes.update` revalidates payload shape and
  authorization; `recipes.updateStatus` enforces the legal status-transition set; both get
  mutation-level tests covering invalid payloads, unauthorized callers, and illegal transitions.

- [ ] **Step 1:** Implement; `vp run typecheck:web`; Interceptor visual pass; screenshots in PR;
  commit.

---

### Task 3: End-to-end gate

- [ ] **Step 1:** On a real hypothesis: approve it → recipe draft appears in the queue (or a
  deferral event if at cap, then appears after a slot frees) → amend one parameter in review →
  approve → promoted recipe carries both agent and approved-with-edits provenance → **edit a
  parameter on the promoted recipe from `recipe-detail`** (validation + field-diff provenance
  verified) → deprecate it from `recipe-detail`. Timed: the recipe review decision under 2 minutes.

## Done means

- Hypothesis approval auto-drafts a recipe through the draft door, WIP-capped and deduped, never
  auto-approved.
- Recipe drafts are editable at review (structured parameters); promoted recipes are editable and
  status-transitionable from `recipe-detail`.
- End-to-end gate passes with provenance verified at each hop.
