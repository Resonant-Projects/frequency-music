# Draft Review UX — Decidable in Two Minutes, Editable Before Approve — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps track progress.
> **Found-state rule (wave 2026-07-07):** adapt to found state; interfaces and gates binding. **Prerequisite: plan 06 (payloads carry `correspondenceId`).**
> **Amended 2026-07-18** (decision-log entry of same date): scope now includes **edit-before-approve**. UI reference: visual plan `plan-6c6d455f77974bd3` on plans.rproj.art (canvas: queue → review card → edit mode → promote confirm).

## Executor brief

- Redesign the `agent-drafts` review flow so a hypothesis draft is decidable in **under two minutes** with the correspondence's full story on-screen.
- Add the WIP pressure signal (pending count, "agent blocked" state) so review debt is visible, not ambient.
- Let the reviewer **amend the draft payload before approving** (explicit edit mode, not always-editable fields): original agent payload preserved, promoted provenance records `approvedWithEdits` + `editedFields`.
- This plan is why the WIP cap won't just relocate the dead-queue problem — treat it as load-bearing, not polish.

**Why (session Q10 + Keith's addendum):** "part of this also needs to improve the interface in the web app for doing the review to make it more clear and easier to do." The queue's history (0 reviews ever) is the evidence that review friction kills the loop.

**Tech Stack:** existing `web/` app (TanStack Router per found state), Convex live queries, project design language (CLAUDE.md Design Context: void purple / gold / Cormorant Garamond / glassmorphism — gold is earned; use it for the decide actions).

## Global Constraints

- Decisions remain human-only. `approve` gains exactly one new semantic — an optional `amendedPayload` argument, validated by the **same shared payload validator the agent write path uses** (`convex/shared/`, zod-first; never hand-mirror shapes). The payload kind cannot change through amendment. No other new decision semantics.
- `vp run typecheck:web` green; wrappers use `_generated/api` (arch plan 07 deleted the string-name table — do not reintroduce it).
- Verify visually with the Interceptor skill (`interceptor open <url>`) per operating rules — screenshots in the PR.

## Non-goals / rabbit holes

- **No** correspondence-browsing UI beyond what the review card needs (a graph explorer is its own future wave).
- **No** notification system — the brief (plan 08) is the delivery vehicle.
- **No** redesign of unrelated routes; touch `agent-drafts.tsx`, `agent-draft.tsx`, and the minimal shared bits.
- **No** mobile app; responsive is enough (review from a phone browser should work — test one viewport).

---

### Task 1: Review data in one query

**Files:**
- Create/modify: Convex query `agentDrafts.getReviewContext { draftId }`

**Interfaces (binding):** one round-trip returning everything the card renders:

```typescript
{
  draft,                                  // the row + payload
  correspondence: {                       // when payload.correspondenceId present
    row,                                  // statement, status, rationale, scores
    conceptA: { displayName, domains, description },
    conceptB: { displayName, domains, description },
    evidence: Array<{ claim: { text, evidenceLevel, truthConfidence },
                      stance, sourceTitle, sourceUrl }>,
  } | null,
  related: {
    priorHypotheses: Array<{ title, status, resolution }>,   // sharing either concept
    failures: Array<{ title, reason }>,                      // failure-archive hits for the pair
  },
  runTrace: { runId, traceUrl, summary },
}
```

- [ ] **Step 1:** Harness test (null-correspondence legacy drafts still work); implement; codegen; commit.

---

### Task 2: The review card

**Files:**
- Modify: `web/src/routes/agent-drafts.tsx`, `web/src/components/agent-draft.tsx`

**Layout contract (top to bottom — the two-minute reading order):**

1. **The claim being made:** correspondence statement + the two concepts with domain chips (violet), status badge.
2. **The evidence:** claim texts with stance icons, evidence level, source links (open in new tab). Contradicting evidence visually distinct.
3. **The proposed hypothesis:** title, question, statement, why-this-matters; rationale collapsed behind a disclosure (serif body, generous measure).
4. **What already happened:** prior hypotheses on these concepts with outcomes; failure-archive hits. Empty state says "no prior work on this pair" explicitly (absence is information).
5. **Decide:** approve / reject / supersede, gold, sticky at viewport bottom; decision note field; keyboard shortcuts (a/r + note focus). Approve confirms with what will be created.

Queue list view: pending count headline ("2 drafts awaiting review — agent blocked at 3"), oldest-first, per-card one-line statement + pair so triage order is obvious.

- [ ] **Step 1:** Implement list + card against `getReviewContext`.
- [ ] **Step 2:** `vp run typecheck:web`; Interceptor visual pass (desktop + one phone viewport); screenshots in PR; commit.

---

### Task 3: Edit-before-approve (amendment added 2026-07-18)

**Files:**
- Modify: `convex/agentDrafts.ts` (`approve` mutation), `convex/schema.ts` (`agentReviewDrafts.amendedPayload`), shared payload validator import
- Modify: `web/src/routes/agent-drafts.tsx`, `web/src/components/agent-draft.tsx` (edit mode + confirm)

**Interfaces (binding):**

- `approve` args gain `amendedPayload: v.optional(<shared draft payload validator>)`. The argument is
  a **complete payload**, not a patch — the client sends the full amended object, the server
  validates it whole, and `editedFields` is derived server-side by diffing against the original
  (dot-paths for nested fields, e.g. `protocol.steps`). Promotion uses
  `amendedPayload ?? draft.payload`. Kind mismatch (hypothesis draft with recipe-shaped amendment,
  or vice versa) rejects with `INVALID_STATE`.
- Draft patch on approval stores `amendedPayload` beside the untouched original `payload`; promoted-row provenance gains `approvedWithEdits: true` + `editedFields: string[]` (top-level field diff) when edits exist.
- UI: edit is an **explicit mode** entered from the decide bar (`e`), not always-editable fields. Evidence and prior work stay visible while editing. Approve becomes "Approve with edits" and the confirm dialog lists the changed fields. Scope for this pass: text-level fields (title/question/statement/why-this-matters and recipe text fields); structured recipe-parameter editing lands with the recipe-loop-closure plan (2026-07-18-13).

- [ ] **Step 1:** Harness tests: amended payload promotes with edited provenance; **the draft row still
  carries the untouched original `payload` after approval and the promoted row reflects the
  amendment**; invalid amendment rejected; kind mismatch rejected; legacy no-amendment approve
  unchanged. Implement; codegen; commit.

> Reviewer note (2026-07-18): this pass deliberately does NOT server-enforce a text-field-only
> allowlist on `amendedPayload` — plan 2026-07-18-13 extends amendment to structured recipe
> parameters through the same argument, so a hard allowlist now would be churn. The shared schema
> validation + `editedFields` provenance is the interim guard.
- [ ] **Step 2:** Edit-mode UI + confirm dialog; `vp run typecheck:web`; Interceptor visual pass; commit.

---

### Task 4: Timed acceptance (the gate that matters)

**Files:** none (operational; results in PR)

- [ ] **Step 1:** With ≥2 real drafts pending (plan 06 output), Keith reviews both — one approve, one reject — **timed**. Gate: each decision under 2 minutes with no tab-switching to look things up. If he had to leave the page to decide, the card is missing information: record what, fix, re-test. At least one decision should exercise edit-before-approve.

---

## Done means

- One-query review context; legacy payload-less drafts don't crash it.
- Card renders the full reading order; decisions keyboard-accessible; visual pass verified with Interceptor.
- `approve` accepts an amended payload; original preserved; provenance records approved-with-edits; harness tests cover the amendment paths.
- Timed gate met and recorded (two real decisions, <2min each, no external lookups, one exercising edit-before-approve).
