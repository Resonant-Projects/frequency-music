# 03 — Structured Draft Writes and Human Review Promotion

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Close the gap between "agent proposes" and "research data exists." Today `agentReviewDrafts` rows carry only title/summary/candidateIds and nothing can transition their status. After this plan: drafts carry full structured payloads, a human approves or rejects them in the app, and approval promotes them into real `hypotheses`/`recipes` rows that pass every existing enforcement rule.

**Design stance (carries over the June decision):** one `agentReviewDrafts` table, extended — not new per-type draft tables. Promotion reuses the existing domain creation paths so agent-originated rows are indistinguishable in rigor (and `whyThisMatters` enforcement) from human-created ones, differing only in provenance fields.

---

## Task 1: Extend the draft schema with structured payloads

**Files:**
- Modify: `convex/schema.ts`, `convex/agentDrafts.ts`, `convex/validators.ts`

**Steps:**

- [ ] Add optional `payload` to `agentReviewDrafts`, a discriminated union on `kind`:
  - `hypothesis_draft`: `{ statement, rationale, whyThisMatters, sourceIds, extractionIds, thesisId?, confidence? }` — mirror the fields `hypotheses.create`/`generateFromExtraction` require.
  - `recipe_draft`: `{ hypothesisId?, title, parameters[], protocol, whyThisMatters, instrumentationNotes? }` — mirror the recipe creation shape.
- [ ] Add `decidedAt?`, `decidedBy?` ("human"), `decisionNote?`, and `promotedId?` (string id of the created row) to the table.
- [ ] Keep `payload` optional for backward compatibility with existing dry-run drafts; drafts without payloads are approvable only as "acknowledged," never promotable.
- [ ] Validate payloads with shared validators (reuse `assertWhyThisMatters` so a blank stake is rejected at draft-creation time, not just at promotion).
- [ ] Verify: `bun test convex/*.test.ts` extended with payload validation cases in `convex/agentDrafts.test.ts`.

## Task 2: Agent side — emit full payloads

**Files:**
- Modify: `agent/src/agents/research-pipeline/deepAgent.ts`, `agent/src/state/researchPipelineState.ts`, `agent/src/tools/convexTools.ts`, `agent/src/graphs/research-pipeline/prompts.ts`

**Steps:**

- [ ] Extend `ResearchPipelineDraft` and `sanitizeSpecialistDraft` to carry the structured payload; enforce with a Zod schema (this is where plan 01's `withStructuredOutput` / Codex `outputSchema` earns its keep).
- [ ] Quality-gate before draft write: every referenced `sourceId`/`extractionId`/`hypothesisId` must have been read via a tool in this run — hallucinated IDs fail the run loudly (June-plan reviewer note, now enforced in code).
- [ ] Update `create_agent_review_draft` tool + `/agent-tools/createAgentReviewDraft` HTTP route to accept the payload; update `docs/agent-tool-surface.md`.
- [ ] Verify: `run:research-pipeline` real run produces a payload-bearing `pending_review` draft.

## Task 3: Decision mutations — approve, reject, supersede, promote

**Files:**
- Modify: `convex/agentDrafts.ts`
- Create: `convex/agentDraftPromotion.ts`

**Steps:**

- [ ] `approve(draftId, decisionNote?)`: requires auth; only `pending_review` → runs promotion in the same mutation path:
  - `hypothesis_draft` → create hypothesis via the existing creation logic (full `whyThisMatters` enforcement, concept linking via `graph.linkHypothesisConcepts` scheduled as today's workflows do).
  - `recipe_draft` → create recipe via existing recipe creation logic.
  - Stamp provenance on the created row: `origin: "agent"`, `agentRunId`, `agentDraftId`, `traceUrl?` (add these optional fields to `hypotheses`/`recipes` schemas).
  - Set draft `status: "approved"`, `promotedId`, `decidedAt/By/Note`; append an `agentRunEvents` `draft_write`-kind event.
- [ ] `reject(draftId, decisionNote)`: `pending_review` → `rejected`; note required (rejections are learning signal for plan 05 — never silent).
- [ ] `supersede(draftId, byDraftId)`: for re-runs that replace a stale pending draft.
- [ ] These are human-facing `mutation`s (Clerk auth), **not** exposed through `/agent-tools/*` — agents must never approve their own work. State this explicitly in `docs/agent-tool-surface.md`.
- [ ] Verify: unit tests for each transition, including the illegal ones (approve twice, promote payload-less draft, reject approved draft).

## Task 4: Review UI

**Files:**
- Modify: `web/src/routes/agent-run-detail.tsx`, `web/src/routes/agent-runs.tsx`
- Create: `web/src/routes/agent-drafts.tsx` (pending-review queue)

**Steps:**

- [ ] Drafts queue route: list `pending_review` drafts (`by_status_updatedAt`), grouped by graph, with payload preview, linked candidate entities, and the run's trace URL.
- [ ] Approve/reject actions with a decision-note field; optimistic status update; link to the promoted hypothesis/recipe after approval.
- [ ] Run detail: show the draft's decision state inline.
- [ ] Surface a pending-review count on the dashboard/inbox so drafts don't rot (weekly cadence rule: review drafts before the Friday brief generates, so approved material can inform it).
- [ ] Verify: full cycle in the dev app — agent run → pending draft → approve → hypothesis visible in normal hypothesis views with agent provenance shown.

## Task 5: Docs and decision log

**Steps:**

- [ ] Update `docs/agent-tool-surface.md`: research-data writes are now allowed **only** through the draft→human-approval path; enumerate the promotion invariants.
- [ ] Update `docs/cadence-and-operating-rules.md`: add "review pending agent drafts" to the weekday/pre-brief cadence.
- [ ] Decision-log entry: draft promotion design (single table + payload union + human-only decision mutations), alternatives considered (per-type draft tables; agent-callable approval), revisit trigger (draft volume exceeding weekly review capacity → batch tooling or auto-approve tiers gated by eval scores).

## Definition of Done (Gate G2)

- [ ] ≥3 real drafts through the full cycle: created by an agent run, human-decided in the UI, approved ones live as enforceable hypotheses/recipes with provenance.
- [ ] Agents cannot transition draft status; verified by test.
- [ ] Rejections always carry notes.
