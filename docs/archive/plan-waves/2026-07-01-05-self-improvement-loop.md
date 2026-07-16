# 05 — Self-Improvement Loop: Edits, Outcomes, Memory, Eval-Gated Promotion
> Landed: 32166aa (2026-07-09)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the system actually learn. "Self-improving" here means four concrete mechanisms, not vibes: (1) human edits become training/eval data automatically; (2) studio outcomes label the generations that produced them; (3) agents remember across runs; (4) prompts and policies only change through eval-gated promotion. Plus the conditional capstone: a Codex-powered verification sandbox that checks the math and renders audio before a recipe ships.

**Depends on:** Plan 02 (datasets/evaluators) for Tasks 1–2 and 5; Plans 01+04 for Tasks 3–4 and 6.

---

## Task 1: Capture human edits as dataset rows

**Objective:** Every time Keith edits an agent- or LLM-generated brief, hypothesis, or extraction, the (input, generated, edited) triple is preserved.

**Files:**
- Modify: `convex/schema.ts` (add `editCaptures` table), edit mutations in `convex/weeklyBriefs.ts`, `convex/hypotheses.ts`, `convex/extractions.ts`
- Create: `convex/editCaptures.ts`, `scripts/langsmith/export-edit-captures.ts`

**Steps:**

- [ ] `editCaptures`: `{ entityType, entityId, promptVersion?, model?, generated: any, edited: any, editedAt, exported?: boolean }`, index `by_exported_editedAt`. Write a capture row inside the existing edit mutations whenever the row being edited has AI/agent origin (extraction edits via `editExtraction`, brief edits, hypothesis edits on agent-provenance rows).
- [ ] Export script: unexported captures → JSONL appended to the matching `data/eval/*-golden.jsonl` **candidates** file for human curation (edits are strong signal but still get a curation pass), then flag `exported`.
- [ ] Plan-03 rejection notes join the same export: rejected drafts become negative examples with the note as the label.
- [ ] Verify: edit a generated brief in dev; capture row exists; export script emits it once.

## Task 2: Studio outcomes as eval labels

**Objective:** Listening sessions already capture embodied feedback (`expandVerdict`, expandability, body-map notes) and the failure archive derives low-yield paths. Join those outcomes back to the generations that produced them.

**Files:**
- Create: `scripts/langsmith/export-outcomes.ts`
- Modify: `docs/eval-baselines.md`

**Steps:**

- [ ] Walk lineage (composition → recipe → hypothesis → extraction) and emit outcome rows: `{ hypothesisId, recipeId, outcome: expand|repeat|no_expand|failure_archived, failureReason?, promptVersion, model/provider }`.
- [ ] Push as a LangSmith dataset (`studio-outcomes`) and add a periodic (monthly) report: outcome rates by prompt version and by provider (Codex vs OpenRouter) — the first real answer to "does the agent path produce music that expands?"
- [ ] Feed high-signal outcome rows into judge-evaluator few-shot examples so "musical actionability" scoring is anchored in what actually worked in the studio, not the judge's priors.
- [ ] Verify: one export run over historical data produces a coherent outcome table.

## Task 3: Agent memory across runs

**Objective:** The research pipeline stops re-proposing contradicted or low-yield ground without needing every run to re-read the whole archive.

**Files:**
- Modify: `agent/langgraph.json` (store config), `agent/src/graphs/research-pipeline/nodes.ts`, `agent/docker-compose.yml` (Postgres for the worker's store/checkpoints)

**Steps:**

- [ ] Enable the LangGraph Store (Postgres-backed on the worker; in-memory in dev). Namespaces: `contradictions`, `low_yield_concepts`, `run_summaries`.
- [ ] `finalize_run` writes: candidate considered, decision, contradiction hits, draft outcome. `load_scope` reads store memories **in addition to** the `listFailureArchive` tool — Convex remains truth; the store is recall, and any conflict resolves in Convex's favor.
- [ ] Add a `memory_recall` event kind to `agentRunEvents` so recalls are auditable ("skipped Schumann×D-root: contradicted in run …").
- [ ] Verify: two consecutive runs over the same candidates — the second visibly skips or re-frames based on the first's memory, shown in events.

## Task 4: Eval-gated prompt/policy promotion

**Objective:** Automate the runbook rubric: a prompt or model-routing change ships only if experiments don't regress.

**Files:**
- Create: `scripts/langsmith/promote.ts`
- Modify: `docs/langsmith-runbook.md`, `prompts/` or `convex` prompt modules as versioning requires

**Steps:**

- [ ] Ensure every prompt has an explicit version constant and that candidate versions can run side-by-side in experiments (`--version` flags already exist on the runners).
- [ ] `promote.ts --target hypothesis --candidate v2`: runs the relevant experiments for baseline and candidate, compares per-evaluator means against `docs/eval-baselines.md`, and prints PASS/FAIL against the rubric (no evaluator regresses beyond threshold; judge score improves or holds). On PASS it updates the baseline doc and prints the diff to apply; the human still commits the version flip and writes the decision-log line.
- [ ] Apply the same gate to provider routing changes (e.g. moving a node from OpenRouter to Codex) — provider is metadata on experiments from plan 01 Task 4.
- [ ] Verify: run a deliberate bad candidate (e.g. stripped rubric prompt) and confirm FAIL; run a no-op candidate and confirm PASS.

## Task 5: Weekly self-improvement report

**Objective:** Make the learning legible on the weekly cadence.

**Steps:**

- [ ] Extend the weekly brief context (agent path) with: new edit-captures count, draft approve/reject ratio with common rejection themes, memory recalls that changed decisions, and any prompt promotions — one short "what the system learned" section in the brief.
- [ ] Verify: section renders from real data in one brief cycle.

## Task 6: Verification sandbox (conditional capstone)

**Objective:** Recipes get machine-verified before human review: tuning math checked, and a short audio demonstration rendered. This is the June plan's Task 8, now natural on the Codex SDK — Codex is an execution agent, so it writes and runs the verification code itself in a sandboxed workspace.

**Condition:** proceed only after Gate G3 and after the plan-04 comparison resolved in the agent's favor.

**Files:**
- Create: `agent/src/subagents/verifier.ts`
- Modify: `agent/src/graphs/research-pipeline/nodes.ts`, `convex/schema.ts` (recipe `verification` field), `agent/Dockerfile` (Python + numpy/scipy/librosa in the worker image)

**Steps:**

- [ ] `verifier.ts` uses plan-01's `runCodexTask` with `sandboxMode: "workspace-write"` in a throwaway workdir seeded with the recipe payload (and, once next-wave export lands, the generated `.scl`/`.kbm`/`recipe.json`). Instructions: verify cents/ratio math for the tuning, check parameter ranges for playability, render a ≤10s audio sketch demonstrating the interval/rhythm claim, return `{ passed, checks[], notes, artifacts[] }` via `outputSchema`.
- [ ] Quality gate consumes the result: failed verification sets `verification: { passed: false, … }` on the draft and routes it to the failure-aware review view instead of silently shipping; passed verification attaches artifact references.
- [ ] Upload rendered audio through the existing UploadThing path so the review UI can play the sketch next to the draft.
- [ ] Treat this task as a mini research project: timebox a spike, record findings in the decision log before generalizing.

## Definition of Done (Gate G4)

- [ ] Edits and outcomes flow into datasets without manual bookkeeping.
- [ ] Memory demonstrably changes a run's behavior, auditable in events.
- [ ] At least one prompt promotion/rejection executed purely through `promote.ts` + decision log.
- [ ] (If Task 6 ran) at least one recipe draft shipped with a passing verification artifact — the system checked its own physics before asking for your weekend.
