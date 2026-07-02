# 02 — LangSmith Completion: Full Tracing, Golden Datasets, Baselines

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Finish what `planning/langchain/2026-05-14-langsmith-integration.md` started. Every AI call site traced; golden datasets curated and uploaded; judge and weekly-brief evaluators added; baseline experiments recorded so plans 04 (comparison period) and 05 (eval-gated promotion) have something to measure against.

**Already done (do not redo):** `convex/tracing.ts`, `extract.ts` wrapped as `extract_v2` with the `extractInternal.ts` runtime split, agent-side auto-tracing, `scripts/langsmith/upload-datasets.ts` (+ lib/tests), `eval-extraction.ts`, `eval-hypothesis.ts`, evaluators `schema.ts` / `why-matters.ts` / `parameter-specificity.ts`, and `docs/langsmith-runbook.md` with the decision rubric.

---

## Task 1: Trace the remaining three Convex call sites

**Objective:** `hypothesis_v1`, `recipe_v1`, and `brief_v2.phase3` traces appear alongside `extract_v2`.

**Files:**
- Modify: `convex/hypotheses.ts`, `convex/recipes.ts`, `convex/weeklyBriefs.ts`
- Create (as needed): `convex/hypothesesInternal.ts`, `convex/recipesInternal.ts`, `convex/weeklyBriefsInternal.ts`

**Steps:**

- [ ] For each file, apply the established pattern from `extract.ts`/`extractInternal.ts`: move V8-runtime mutations/queries into the `*Internal.ts` sibling, add `"use node"` to the action file, import `tracedGenerate` from `./tracing`.
- [ ] Wrap: `generateFromExtraction` → `tracedGenerate("hypothesis_v1", ..., { extractionId, sourceId, model, promptVersion })`; `generateFromHypothesis` → `tracedGenerate("recipe_v1", ..., { hypothesisId, model, promptVersion })`; `generateBriefCore` → `tracedGenerate("brief_v2.phase3", ..., { weekOf, model, promptVersion, numHypotheses, numRecipes, campaignId })`.
- [ ] Watch for cron/workflow references: `internal.weeklyBriefs.generateInternal` is called from `convex/crons.ts` and workflows call `api.hypotheses.generateFromExtraction` — keep function names and namespaces stable or update every call site in `convex/workflows.ts` and `convex/crons.ts`.
- [ ] Verify: `bunx convex run workflows:...` full pipeline against one source; confirm all four trace names in LangSmith `resonant-projects-prod`. Then set `LANGSMITH_TRACING=false` and confirm clean no-trace operation.
- [ ] Update `docs/langsmith-runbook.md` "What's NOT yet wired" section to empty.

## Task 2: Curate golden datasets

**Objective:** `data/eval/` exists with hand-curated JSONL the upload script can push.

**Files:**
- Create: `data/eval/extraction-golden.jsonl`, `data/eval/hypothesis-golden.jsonl`, `data/eval/weekly-brief-golden.jsonl`
- Create: `scripts/langsmith/export-candidates.ts`

**Steps:**

- [ ] Write `export-candidates.ts`: query Convex for real rows meeting the quality criteria already documented in `docs/agent-tool-surface.md` (good extraction: ≥3 claims, mixed evidence levels, ≥1 composition parameter; good hypothesis: non-empty musical `whyThisMatters`, traceable to claims, not failure-archived; good brief: ≥3 experiment cards, references an active thesis, names a contradiction/weak path). Emit candidate JSONL for human review — the script proposes, the human curates.
- [ ] Hand-curate: target ≥15 extraction rows, ≥15 hypothesis rows, ≥6 brief rows. Each row: `{ inputs: {…exact prompt inputs…}, outputs: {…golden output…}, metadata: { sourceId/…, promptVersion, curatedAt } }` matching what `upload-datasets-lib.ts` expects.
- [ ] `bun scripts/langsmith/upload-datasets.ts`; confirm three datasets in the LangSmith UI.
- [ ] Commit the JSONL (these are private research artifacts; confirm nothing in them is disallowed for the public repo — if the repo is public, keep raw source text out and reference by ID).

## Task 3: Add the judge evaluator and brief runner

**Objective:** Complete the evaluator set from the May plan.

**Files:**
- Create: `scripts/langsmith/evaluators/judge.ts`
- Create: `scripts/langsmith/eval-weekly-brief.ts`

**Steps:**

- [ ] `judge.ts`: LLM-as-judge on **Claude Haiku via OpenRouter** (standing cost decision — do not route judging through Codex; keep evaluation independent of the provider being evaluated). Rubric dimensions: grounding in cited claims, musical actionability, stake clarity, non-repetition of failure-archived ground. Return 0–1 per dimension plus a one-line rationale.
- [ ] `eval-weekly-brief.ts`: same runner shape as `eval-hypothesis.ts`; evaluators = schema-lite (required sections present), thesis-reference check, contradiction-mention check, judge.
- [ ] Unit-test the judge's response parsing (mirror `why-matters.test.ts`).
- [ ] Verify: run all three runners against current prompt versions; experiments visible in LangSmith.

## Task 4: Record baselines

**Objective:** Numbers the comparison period (plan 04) and promotion runbook (plan 05) can diff against.

**Steps:**

- [ ] Run each experiment 3× against current prompts/models; record mean scores per evaluator in a new `docs/eval-baselines.md` table: dataset, prompt version, model/provider, date, scores, experiment URLs.
- [ ] Add a second run of `eval-hypothesis` with the Codex provider (once plan 01 Task 2 lands) to get a same-dataset provider comparison — this is the first hard data on whether subscription inference matches OpenRouter quality for this workload.
- [ ] Decision-log entry: baselines recorded; the runbook rubric in `docs/langsmith-runbook.md` is now enforceable (no prompt/model change ships without a non-regressing experiment).

## Definition of Done

- [ ] Four traced call sites, verified on and off.
- [ ] Three golden datasets uploaded, ≥36 total curated rows.
- [ ] Judge + brief evaluators running.
- [ ] `docs/eval-baselines.md` exists with at least one full baseline sweep and one provider comparison.
