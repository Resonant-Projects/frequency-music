# Plan 008: Run the first eval baseline sweep so the promotion gate can actually gate

> **Executor instructions**: This is an OPERATIONAL plan, not a refactor — it
> runs existing tooling against live services and records numbers. It requires
> live credentials (`OPENROUTER_API_KEY`, `LANGSMITH_API_KEY` in `.env.local`)
> and spends real API money (budget estimate: 3 runs × 3 targets over small
> golden datasets — modest, but confirm with the operator if datasets exceed
> ~50 examples each). Follow the steps in order; on any STOP condition, stop
> and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- docs/eval-baselines.md scripts/langsmith/`
> If `parseBaselinesDoc` in `scripts/langsmith/promote.ts` or the baselines doc
> structure changed, re-read both before proceeding.

## Status

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
  Status line: "**Status: skeleton.** Numbers are `—` placeholders until the
  first baseline sweep runs (plan 02 task 4, needs live OpenRouter + LangSmith
  + uploaded golden datasets)."
  Recording instructions are inline: "run its `eval-*.ts` runner 3× against
  the current prompt version, then fill the mean per evaluator below along
  with the metadata line." Known sections/evaluators at `a30f10c`:
  - Extraction: `extractionSchema`, `parameterSpecificity` (prompt `extract_v2`)
  - Hypothesis: `whyThisMatters`, `judge` (prompt `v1`) + a provider-comparison
    subsection for Codex
  - Recipe: `parameterSpecificity`, … (prompt `v1`)
- `scripts/langsmith/` tooling (all Bun scripts, env from `.env.local`):
  `upload-datasets.ts` (golden datasets → LangSmith), `eval-extraction.ts`,
  `eval-hypothesis.ts`, `eval-weekly-brief.ts` (runners), `evaluators/`,
  `promote.ts` (+ `promote.test.ts`), `export-outcomes.ts`,
  `export-edit-captures.ts`. `promote.ts:86` — `BASELINES_DOC = "docs/eval-baselines.md"`.
- Caveat already documented in the baselines doc: runners score the *runner's*
  simplified prompt version via `anthropic/claude-sonnet-4.6`, not the deployed
  Convex prompt — numbers are relative prompt-version comparisons. Preserve
  this caveat; do not delete it.
- `bun test scripts/langsmith/` runs the tooling's own unit tests
  (`promote.test.ts`, `eval-helper.test.ts`, `upload-datasets-lib.test.ts`, …).
- Decided tradeoff (decision log 2026-05-16): LangSmith Cloud, tracing
  best-effort. Don't re-architect anything here.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Preflight env | `bun -e "console.log(Boolean(process.env.OPENROUTER_API_KEY), Boolean(process.env.LANGSMITH_API_KEY))"` | `true true` |
| Tooling self-test | `bun test scripts/langsmith/` | all pass |
| Read runner usage | `head -60 scripts/langsmith/eval-extraction.ts` (and the other two) | usage/flags comment |
| Upload datasets | `bun scripts/langsmith/upload-datasets.ts` (check its `--help`/header first) | dataset ids/URLs printed |
| Run a sweep | `bun scripts/langsmith/eval-extraction.ts ...` per its header | experiment URL + per-evaluator scores |
| Gate self-check | `bun scripts/langsmith/promote.ts --help` (or read header for invocation) | parses baselines without error |

## Scope

**In scope** (the only files you should modify):
- `docs/eval-baselines.md` (fill means + metadata lines)
- `data/eval/**` ONLY if dataset curation requires adding examples — follow
  `data/eval/README.md`'s stated contracts; record any additions in your report.

**Out of scope** (do NOT touch):
- Every file under `scripts/langsmith/` — if a runner is broken, that's a STOP,
  not a fix-in-place.
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

1. Env check (table above) → `true true`; otherwise STOP 1.
2. `bun test scripts/langsmith/` → all pass; otherwise STOP 2.
3. Read the header comments of `upload-datasets.ts` and the three `eval-*.ts`
   runners — they define flags, dataset names, and output format. Everything
   below defers to those headers where they differ from this plan.

### Step 2: Ensure golden datasets exist in LangSmith

Run `upload-datasets.ts` per its header (it should be idempotent — verify the
header says so; if unclear, run once and check the LangSmith UI/output for
duplicates → STOP 3 on duplication). Record dataset names/sizes in your report.
If a dataset is EMPTY (no golden examples curated yet), curation is a human
judgment task: STOP 4 with a list of what's missing per target.

**Verify**: runner output lists each dataset with a non-zero example count.

### Step 3: Run each baseline 3×

For each target — extraction (`eval-extraction.ts`), hypothesis
(`eval-hypothesis.ts`), weekly brief (`eval-weekly-brief.ts`) — run the runner
three times against the CURRENT prompt version (the default; per the baselines
doc: `extract_v2` for extraction, `v1` for hypothesis/recipe). Capture, per
run, each evaluator's score and the experiment URL.

**Verify**: 3 experiment URLs per target, each with per-evaluator scores.

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

Run `promote.ts` in whatever non-destructive mode its header offers (a dry-run
/ parse-only flag, or a head-to-head with the same version as baseline and
candidate). Confirm it now reads numeric baselines for the filled sections
(its output should show baseline means rather than the no-baseline fallback).

**Verify**: promote.ts output references the recorded means; exit 0.
**Verify**: `bun test scripts/langsmith/` still all pass (promote.test.ts
guards the doc format you just edited).

## Test plan

The gate IS the test: Step 5 proves `parseBaselinesDoc` reads what Step 4
wrote, and `promote.test.ts` (existing) pins the format. No new test files.

## Done criteria

ALL must hold:

- [ ] Every evaluator row for extraction, hypothesis, and weekly brief has a numeric mean (Codex rows exempt if documented)
- [ ] Each section's metadata line has Date + 3 experiment references
- [ ] The skeleton status line is replaced; the simplified-prompt caveat is preserved
- [ ] `bun test scripts/langsmith/` → 0 fail
- [ ] Step 5's promote.ts run shows baselines being read (paste output snippet in report)
- [ ] Only `docs/eval-baselines.md` (and possibly `data/eval/**`) modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

1. `OPENROUTER_API_KEY` or `LANGSMITH_API_KEY` missing — operator must supply.
2. `bun test scripts/langsmith/` fails at baseline — tooling is broken; fixing
   it is out of scope.
3. `upload-datasets.ts` is not idempotent and re-running would duplicate
   datasets.
4. A golden dataset is empty or a runner reports <5 examples — dataset curation
   is a research-judgment task for the operator (Keith), not an executor. Report
   exactly which target lacks examples and what format `data/eval/README.md`
   demands.
5. A runner errors on the live API twice (auth, model id, rate limit) — report
   the exact error.
6. Any single eval run appears to cost dramatically more than expected (e.g.
   dataset unexpectedly large) — pause before run 2.

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
