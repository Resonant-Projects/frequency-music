# Plan 008: Run the first eval baseline sweep so the promotion gate can actually gate

> **Executor instructions**: This is an OPERATIONAL plan, not a refactor. It
> runs existing tooling against live services and records numbers. It needs
> `ANTHROPIC_API_KEY` and `LANGSMITH_API_KEY`, which Varlock resolves from
> `.env.schema` (Step 1), and it spends real API money. The 2026-10-17
> preflight cost estimate is historical: it priced the pre-repair OpenRouter
> route and output caps. Before the first paid run, compute a new bounded
> worst-case estimate from current Anthropic prices and the runners' current
> caps, and get the operator to approve that budget. Follow the steps in
> order. On any STOP condition, stop and report. When done, update the status
> row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- docs/eval-baselines.md scripts/langsmith/`
> If `parseBaselinesDoc` in `scripts/langsmith/promote.ts` or the baselines doc
> structure changed, re-read both before proceeding. The 2026-10-17 runner
> repair below accounts for the expected drift.

## Status

- **Execution status**: BLOCKED. The 2026-10-17 preflight hit STOP 1 (the worker's 1Password service account could not resolve the eval keys) and STOP 4 (4 hypothesis and 2 weekly-brief golden rows, under the 5-row floor). STOP 4 still applies; STOP 1 cleared on one host later that day (see Readiness below). No scores are recorded. Blockers, runner findings and the historical cost estimate: [`docs/evidence/eval-baseline-20261017/preflight.md`](../docs/evidence/eval-baseline-20261017/preflight.md)
- **Runner repair, 2026-10-17**: Keith separately authorized a repair of the runner defects the preflight found (PR #152). A failed or incomplete run now exits 1 instead of scoring zeros. The runners call Anthropic directly with the production task's model and output cap. `promote.ts` defaults extraction to `v3` and spawns runners with `vpx tsx`. Details: [`docs/evidence/eval-baseline-20261017/runner-repair.md`](../docs/evidence/eval-baseline-20261017/runner-repair.md). That repair was its own task. It does not relax this plan's scope: a sweep executor still treats a broken runner as a STOP and does not edit `scripts/langsmith/`.
- **Readiness, 2026-10-17**: Credentials now resolve through Varlock on host `devbox`, and `vp test scripts/langsmith/` passes, so STOP 1 and STOP 2 are clear there. STOP 4 still applies. Three hypothesis rows from the committed 2026-07-30 export are proposed for Keith's ratification, separate from the golden file. Accepting all three would give 7 rows. Weekly briefs have no further committed records. A fresh worst-case cost estimate for extraction plus 7 hypothesis rows is $7.18, and $11 is proposed as the stage-1 budget. Still pending: ratification (applied through a materializer edit and a read-only production run, then an offline drift check), upload approval, the budget, and a weekly-brief path. Exact hashes, cost method and a resumable runbook: [`docs/evidence/eval-baseline-20261017/readiness.md`](../docs/evidence/eval-baseline-20261017/readiness.md). Curation proposal: [`data/eval/curation-2026-10-17.md`](../data/eval/curation-2026-10-17.md)
- **Priority**: P2
- **Effort**: S–M (mostly wall-clock waiting on eval runs)
- **Risk**: LOW (writes numbers into a doc; no runtime behavior changes until someone runs a promotion)
- **Depends on**: none (independent of plans 001–007)
- **Category**: direction (activation of already-built tooling)
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

The self-improvement loop shipped in the 2026-07-01 wave: judges, eval
runners, outcome exports, and a `promote.ts` gate that compares candidate
prompts/providers against recorded baselines. But `docs/eval-baselines.md` is
a self-declared skeleton — every mean is a `—` placeholder — so the gate
"degrades gracefully" into not gating. Until one baseline sweep runs, the
system cannot block a prompt regression or answer whether the Codex provider
matches OpenRouter quality. This is the cheapest way to make an
already-built system real: no code, just curation + three runs per target +
recording means.

## Current state

- `docs/eval-baselines.md` — the shared contract. Its own header documents the
  parsing rules: within a section whose heading mentions the target
  (`hypothesis`, `recipe`, `brief`/`weekly brief`, `extraction`),
  `parseBaselinesDoc` reads each markdown table row as
  `{ firstCell: lastCell }` — **first cell = evaluator key, last cell =
  numeric mean**. `—` parses as non-numeric and is skipped.
  Its status line reads "**Status: skeleton.**" until the first sweep is
  recorded, and its recording instructions are inline. A row's key is the
  LangSmith feedback key its evaluator emits. Sections and keys as of the
  2026-10-17 repair:
  - Extraction: `schema_valid`, `parameter_specificity` (runner default `v3`,
    which reuses the deployed `extract_v3` prompt text)
  - Hypothesis: `why_this_matters`, `judge` (prompt `v1`), plus a Codex
    provider-comparison subsection. `eval-hypothesis.ts` emits no `judge`
    feedback, so that row stays `—`.
  - Recipe: `parameter_specificity`, `judge` (no runner exists)
  - Weekly brief: `brief_schema_lite`, `thesis_reference`,
    `contradiction_mention`, `judge` (prompt `v1`)
- `scripts/langsmith/` tooling. Run each script with `vpx tsx`. The runners,
  `promote.ts` and `upload-datasets.ts` import `varlock/auto-load`, which
  resolves every `@required` secret in `.env.schema` or refuses to start.
  `upload-datasets.ts` (golden datasets to LangSmith), `eval-extraction.ts`,
  `eval-hypothesis.ts`, `eval-weekly-brief.ts` (runners), `eval-helper.ts`
  (`runEval`), `run-guard.ts` (full-run validation), `evaluators/`,
  `promote.ts`, `export-outcomes.ts`, `export-edit-captures.ts`. `promote.ts`
  reads `BASELINES_DOC = "docs/eval-baselines.md"`.
- Inference: each prompt version names a production task. The runner takes
  that task's model from `TASK_MODELS` and its output cap from `TOKEN_BUDGETS`,
  and calls Anthropic directly with adaptive thinking. Extraction runs Sonnet
  5.5 (8000 tokens), hypotheses Opus 5.5 at high effort (6000), weekly briefs
  Sonnet 5.5 (8000), and the weekly-brief judge Haiku 5.5 (5000).
- Caveat already documented in the baselines doc: the hypothesis and
  weekly-brief runners score the *runner's* simplified prompt, not the
  deployed Convex prompt, so their numbers are relative prompt-version
  comparisons. Preserve this caveat; do not delete it.
- `vp test scripts/langsmith/` runs the tooling's own unit tests with mocked
  network, model and Varlock calls (`promote.test.ts`, `run-guard.test.ts`,
  `eval-helper.test.ts`, `upload-datasets-lib.test.ts`, …).
- Decided tradeoff (decision log 2026-05-16): LangSmith Cloud, tracing
  best-effort. Don't re-architect anything here.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Preflight env | `vpx varlock run -- node -e 'console.log(Boolean(process.env.ANTHROPIC_API_KEY), Boolean(process.env.LANGSMITH_API_KEY))'` | `true true`. Prints booleans only. Varlock exits nonzero if any `@required` secret fails to resolve. |
| Tooling self-test | `vp test scripts/langsmith/` | all pass, with no network or secrets |
| Read runner usage | `sed -n '1,40p' scripts/langsmith/<script>.ts` | Read the source. The runners and `upload-datasets.ts` have no help or dry-run flag, so invoking one runs it live. `promote.ts --help` prints usage, but only after Varlock resolves every secret. |
| Upload datasets | `vpx tsx scripts/langsmith/upload-datasets.ts` | uploads at once; prints `Created dataset`/`Found existing dataset` and per-dataset counts |
| Run a sweep | `vpx tsx scripts/langsmith/eval-extraction.ts` (same for `eval-hypothesis.ts`, `eval-weekly-brief.ts`; optional `--version <v>`) | exit 0 and an `EVAL_RUN_COMPLETE {"experiment":…}` line |
| Gate parse check | `APP_ENV=test vpx tsx -e 'import { readFileSync } from "node:fs"; import { parseBaselinesDoc } from "./scripts/langsmith/promote.ts"; const doc = readFileSync("docs/eval-baselines.md", "utf8"); for (const t of ["extraction", "hypothesis", "brief"]) console.log(t, JSON.stringify(parseBaselinesDoc(doc, t)));'` | numeric means for each filled row; exit 0. `APP_ENV=test` loads `.env.test` placeholders, so it needs no secrets or network. |

## Scope

**In scope** (the only files you should modify):
- `docs/eval-baselines.md` (fill means + metadata lines)
- `data/eval/**` ONLY if dataset curation requires adding examples — follow
  `data/eval/README.md`'s stated contracts; record any additions in your report.

**Out of scope** (do NOT touch):
- Every file under `scripts/langsmith/` — if a runner is broken, that's a STOP,
  not a fix-in-place. The 2026-10-17 runner repair was separately authorized
  and does not widen this rule for the sweep.
- Convex prompts/functions; `agent/`.
- The provider-comparison (Codex) rows — those require the Codex provider
  exercised via `eval-hypothesis` with a provider flag; do it ONLY if the
  runner's header documents that flag and the agent workspace env is
  configured; otherwise leave `—` and note why.

## Git workflow

- Branch: `advisor/008-eval-baseline-sweep`
- Conventional commit, e.g. `docs(eval): record first baseline sweep means`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Preflight

1. Env check (table above) → `true true`; otherwise STOP 1. Do not print key
   values or try a secret route other than Varlock.
2. `vp test scripts/langsmith/` → all pass; otherwise STOP 2.
3. Read the source of `upload-datasets.ts`, the three `eval-*.ts` runners,
   `eval-helper.ts` and `run-guard.ts`. They define flags, dataset names,
   failure handling and output format. Everything below defers to the source
   where it differs from this plan.
4. Compute the bounded worst-case cost for three runs per target from current
   Anthropic prices, each runner's output cap and the golden row counts, and
   get the operator to approve it. Do not reuse the preflight's figure.

### Step 2: Ensure golden datasets exist in LangSmith

Uploading needs operator approval: the extraction rows include private source
`rawText`. Run `upload-datasets.ts` once (it has no dry-run flag). It skips
examples whose input and output already exist in the dataset
(`buildMissingExamples`), so a re-run does not duplicate them; if the output
shows duplication anyway, STOP 3. Record dataset names and sizes in your
report. If a dataset is EMPTY (no golden examples curated yet), curation is a
human judgment task: STOP 4 with a list of what's missing per target.

**Verify**: runner output lists each dataset with a non-zero example count.

### Step 3: Run each baseline 3×

For each target — extraction (`eval-extraction.ts`), hypothesis
(`eval-hypothesis.ts`), weekly brief (`eval-weekly-brief.ts`) — run the runner
three times against the CURRENT prompt version (the runner default: `v3` for
extraction, `v1` for hypothesis and weekly brief). Accept a run only if it
exits 0 and prints an `EVAL_RUN_COMPLETE {…}` line; take the experiment
name from that line. A run that prints `EVAL RUN FAILED` or exits nonzero has
no usable scores, even if LangSmith shows some: do not record it, and see
STOP 5. Low scores from a completed run, including zeros, are valid and
count. Under STOP 6, review the cost of the first extraction run before the
second. Per run, capture each evaluator's mean from the experiment's
`feedback_stats` (as `readMeansForExperiment` in `promote.ts` does).

**Verify**: 3 completed experiments per target, each with a mean for every
evaluator key in its completion line.

### Step 4: Record means in `docs/eval-baselines.md`

For each evaluator row: mean of the three runs, rounded to 2 decimals, replacing
the `—` in the LAST cell only (the parser reads first cell = key, last cell =
mean — do not add columns). Update each section's metadata line (`Date:`,
`Experiments:` — put the 3 experiment URLs or ids). Update the header: change
"**Status: skeleton.**" to "**Status: baselined <YYYY-MM-DD>.**" and KEEP the
simplified-prompt caveat paragraph.

**Verify**: `grep -c "—" docs/eval-baselines.md` → only the deliberately-blank
rows remain (Codex comparison rows if skipped); report the count and which.

### Step 5: Prove the gate parses the numbers

Do not run `promote.ts` for this step. It has no dry-run or parse-only mode,
it rejects a candidate equal to the baseline, and every `--target` run spawns
at least four paid experiments. Its PASS/FAIL compares fresh baseline and
candidate experiments; it prints the doc's means for reference only. Instead,
run the gate parse check from the table above. It calls the same
`parseBaselinesDoc` offline.

**Verify**: the parse check prints a numeric mean for every row you filled;
exit 0.
**Verify**: `vp test scripts/langsmith/` still all pass (promote.test.ts
guards the doc format you just edited).

## Test plan

The gate IS the test: Step 5 proves `parseBaselinesDoc` reads what Step 4
wrote, and `promote.test.ts` (existing) pins the format. No new test files.

## Done criteria

ALL must hold:

- [ ] Every evaluator row for extraction, hypothesis, and weekly brief has a numeric mean (Codex rows exempt if documented)
- [ ] Each section's metadata line has Date + 3 experiment references
- [ ] The skeleton status line is replaced; the simplified-prompt caveat is preserved
- [ ] Every recorded run exited 0 and printed `EVAL_RUN_COMPLETE`
- [ ] `vp test scripts/langsmith/` → 0 fail
- [ ] Step 5's parse check shows the recorded means (paste output in report)
- [ ] Only `docs/eval-baselines.md` (and possibly `data/eval/**`) modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

1. `ANTHROPIC_API_KEY` or `LANGSMITH_API_KEY` missing, or Varlock cannot
   resolve every `@required` secret. The operator must supply access.
2. `vp test scripts/langsmith/` fails at baseline — tooling is broken; fixing
   it is out of scope.
3. `upload-datasets.ts` is not idempotent and re-running would duplicate
   datasets.
4. A golden dataset is empty or a runner reports <5 examples — dataset curation
   is a research-judgment task for the operator (Keith), not an executor. Report
   exactly which target lacks examples and what format `data/eval/README.md`
   demands.
5. A runner fails twice (exits nonzero or prints `EVAL RUN FAILED`, for
   example on auth, model id or rate limit). Report its error lines; they give
   the error name, HTTP status and provider error type, not the message.
6. Any single eval run appears to cost dramatically more than expected (e.g.
   dataset unexpectedly large), or the sweep would exceed the budget approved
   in Step 1 — pause before run 2.

## Maintenance notes

- Re-baseline whenever a prompt version is PROMOTED (promote.ts's PASS output
  prints the diff to apply here — that's the designed loop; this plan just
  seeded it).
- The recipe section's baseline depends on a recipe eval runner; at `a30f10c`
  there are runners for extraction/hypothesis/weekly-brief only. If no
  `eval-recipe.ts` exists, leave the recipe section `—` and say so in the
  report — that's a tooling gap for a future plan, not an execution failure.
- The Codex provider-comparison rows are the first hard data on
  subscription-inference quality (see `docs/archive/plan-waves/2026-07-01-01-codex-sdk-inference-provider.md`); run them
  when the agent workspace has Codex auth configured.
- Watch: `docs/eval-baselines.md` is parsed positionally (first/last cell).
  Anyone "improving" the tables with extra columns breaks `promote.ts` —
  `promote.test.ts` should catch it, which is why the done criteria re-run it.
