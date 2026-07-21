# Weekly Brief — The Loop's Delivery Vehicle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps track progress.
> **Found-state rule (wave 2026-07-07):** adapt to found state; interfaces and gates binding. **Prerequisites: plans 03, 06 (09 adds feed proposals when it lands — design the section now, populate then).**

## Executor brief

- Extend the Friday brief so it is the **single place the system asks for human judgment**: correspondence movement, pending drafts (WIP pressure), experiment debt, and (post-plan-09) proposed feeds.
- Brief generation stays a Convex generator (fixed-input transform — session Q9 seam).
- Sections render in the web brief view; data sections are deterministic (queries), narrative stays LLM.

**Why (session Q10, Q12, Q13):** split cadence needs a pulse. Review is a bounded Friday ritual; the brief names the debt ("recipes in_use awaiting a listening session") instead of letting it rot silently.

**Tech Stack:** Convex (brief generator per found state: `weeklyBriefs.ts` / `weeklyBriefsInternal.ts`), shared LLM module, `web/` brief detail route.

## Global Constraints

- Deterministic sections are computed by queries and stored as structured fields — the LLM narrates around them but cannot hallucinate the numbers.
- Schema additions optional-only (old briefs render unchanged).
- `bunx convex codegen` deploys live; `bun run typecheck:web` for the view.

## Non-goals / rabbit holes

- **No** email/notification delivery; the brief is pulled, not pushed.
- **No** redesign of existing brief sections (studio prompts, recommended actions stay as-is).
- **No** correspondence analytics dashboard — four numbers and a list per section, that's it.

---

### Task 1: Schema — structured loop sections

**Files:**
- Modify: `convex/schema.ts` (`weeklyBriefs` additions, all optional)

**Interfaces (binding):**

```typescript
loopReport: v.optional(v.object({
  correspondences: v.object({
    newConjectures: v.number(), gainedEvidence: v.number(),
    contradicted: v.number(), autoRetired: v.number(),
    topMovers: v.array(v.object({
      correspondenceId: v.id("correspondences"),
      statement: v.string(), status: v.string(),
      evidenceDelta: v.number(),
    })),                                              // ≤5
  }),
  reviewQueue: v.object({
    pendingDrafts: v.number(), cap: v.number(),
    agentBlocked: v.boolean(),                        // pending ≥ cap
    oldestPendingDays: v.optional(v.number()),
  }),
  experimentDebt: v.array(v.object({
    recipeId: v.id("recipes"), title: v.string(),
    state: v.union(v.literal("in_use_no_composition"),
                   v.literal("composed_no_listening")),
    ageDays: v.number(),
  })),                                                // ≤10, oldest first
  proposedFeeds: v.array(v.object({                   // empty until plan 09
    feedId: v.id("feeds"), name: v.string(), url: v.string(),
    rationale: v.string(),
  })),
})),
```

- [x] **Step 1:** Schema + mirror; codegen intentionally not run per operator constraint; commit.

---

### Task 2: Section queries + generator integration

**Files:**
- Modify: `convex/weeklyBriefsInternal.ts` (compute `loopReport` before the LLM call; pass a compact rendering into the prompt so the narrative can reference it; store the structured object on the row)
- Consumes: `correspondences.listRecentMovement { since }` (plan 03), `agentDrafts.countPending` + `PENDING_DRAFT_CAP` (plan 06), recipes/compositions/listeningSessions joins for debt.

**Design notes:**
- "Since" = previous brief's `createdAt` (or 7 days for the first).
- Experiment-debt rule v1: recipe `in_use` with no composition (any age) → `in_use_no_composition`; composition `rendered` with no listening session for >14 days → `composed_no_listening`. Constants next to `PENDING_DRAFT_CAP`.
- The narrative prompt gets one added instruction: *if `agentBlocked`, the brief's opening must say so* — the WIP signal is the headline, not a footnote.

- [ ] **Step 1:** Harness tests for the section queries (fixture data → exact numbers).
- [ ] **Step 2:** Implement; codegen; commit.

---

### Task 3: Brief view

**Files:**
- Modify: `web/src/routes/weekly-brief-detail.tsx`

Render `loopReport` between the narrative and studio prompts: movement stat row (monospace eyebrows), top movers with links, review-queue banner (gold when `agentBlocked` — a working agent waiting on you is the "gold is earned" moment), experiment-debt list linking to recipes, proposed feeds with an **Enable** action (wired to the existing feed mutation; appears only when non-empty). Old briefs without `loopReport` render exactly as before.

- [ ] **Step 1:** Implement; `bun run typecheck:web`; Interceptor visual pass on a real generated brief; screenshots in PR; commit.

---

### Task 4: Live gate

- [ ] **Step 1:** Generate a real brief (found-state command/cron path). Verify all sections populate from production data and every number is reproducible by running its query by hand. Paste the brief's loop section in the PR.

---

## Done means

- `loopReport` computed deterministically, stored structurally, narrated honestly (blocked = headline).
- Brief view renders new sections; legacy briefs unaffected.
- One real Friday brief generated with real movement data as the gate.
