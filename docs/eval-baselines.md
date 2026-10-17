# Eval Baselines

Recorded per-evaluator baseline scores for the LangSmith experiments. This file
is a **shared contract**:

- `scripts/langsmith/promote.ts` parses it (`parseBaselinesDoc`) to compare a
  candidate prompt/model against the current baseline. Within a section whose
  heading mentions the target (`hypothesis`, `recipe`, `brief`/`weekly brief`,
  `extraction`), it reads each markdown table row as `{ firstCell: lastCell }`,
  i.e. **first cell = evaluator key, last cell = numeric mean**. The key is the
  LangSmith feedback key the evaluator emits (`schema_valid`, not
  `extractionSchema`), the same key `promote.ts` reads from experiment
  `feedback_stats`. `promote.ts` prints these means for reference only; its
  PASS/FAIL rubric compares fresh baseline-vs-candidate experiments.
- Plan 04's weekly-brief comparison appends Convex-cron-vs-agent rows here.
- Plan 05's `promote.ts` PASS updates the relevant means here.

> **Status: skeleton.** Numbers are `—` placeholders until the first baseline
> sweep runs ([plan 008](../plans/008-eval-baseline-sweep.md), needs live
> Anthropic + LangSmith + uploaded golden datasets). `—` parses as non-numeric
> and is skipped, so `promote.ts` degrades gracefully — it still runs the
> head-to-head experiments and compares those. The 2026-10-17 preflight
> recorded no scores; its blockers and prepared commands are in
> [`evidence/eval-baseline-20261017/preflight.md`](evidence/eval-baseline-20261017/preflight.md).
> The runner defects it found were repaired the same day, before any
> baseline was recorded; see
> [`evidence/eval-baseline-20261017/runner-repair.md`](evidence/eval-baseline-20261017/runner-repair.md).

**How to record a baseline** (per target): run its `eval-*.ts` runner 3× against
the current prompt version, then fill the mean per evaluator below along with the
metadata line. Only record a run that exited 0 and printed its
`EVAL_RUN_COMPLETE` line. Note: the runners score the *runner's* simplified
prompt version, not the deployed Convex prompt — interpret the numbers as
relative prompt-version comparisons.

Inference matches the deployed route, not the deployed prompt. Each prompt
version names a production task, and the runner takes that task's model from
`TASK_MODELS` and its output cap from `TOKEN_BUDGETS`. It calls Anthropic
directly through `@ai-sdk/anthropic` with adaptive thinking: high effort on
Opus, medium otherwise, and no sampling parameters. Extraction uses
`extract_v3` (Sonnet 5.5, 8000 tokens), hypotheses use `hypothesis_v1` (Opus
5.5, 6000), and weekly briefs use `brief_v2` (Sonnet 5.5, 8000). Extraction
`v3` reuses the deployed prompt text, but the hypothesis and weekly-brief
prompts are simplified runner prompts, so those scores still do not describe
deployed generator quality. The weekly-brief judge is the registered
`anthropic/claude-haiku-5.5`, called the same way at medium effort with the
existing four-dimension rubric.

A run fails, exits 1 and prints no completion line when a target request
fails, a response is empty, truncated or not a JSON object, the judge call
fails or returns an unparseable verdict, an evaluator throws, or any example
lacks a score from any evaluator. Parsed output that misses the rubric still
scores 0, and those zeros count toward the mean.

---

## Extraction baseline

- Prompt version: `v3` (`extract_v3` prompt text; `eval-extraction.ts` default) · Model/provider: `anthropic/claude-sonnet-5.5` (Anthropic direct, adaptive/medium, 8000 tokens) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| schema_valid | — |
| parameter_specificity | — |

## Hypothesis baseline

- Prompt version: `v1` · Model/provider: `anthropic/claude-opus-5.5` (Anthropic direct, adaptive/high, 6000 tokens) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| why_this_matters | — |
| judge | — |

`eval-hypothesis.ts` emits no `judge` feedback today, so that row stays `—`
until a hypothesis judge evaluator exists.

### Hypothesis — provider comparison (OpenRouter vs Codex)

Added once plan 01's Codex provider is exercised by `eval-hypothesis` (same dataset, different provider) — the first hard data on whether subscription inference matches OpenRouter quality for this workload.

| Evaluator | Mean |
| --- | --- |
| why_this_matters (codex) | — |
| judge (codex) | — |

## Recipe baseline

- Prompt version: `v1` · Model/provider: — (no runner) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| parameter_specificity | — |
| judge | — |

No `eval-recipe.ts` runner exists, so this section stays `—`.

## Weekly Brief baseline

- Prompt version: `v1` · Model/provider: `anthropic/claude-sonnet-5.5` (Anthropic direct, adaptive/medium, 8000 tokens; judge `anthropic/claude-haiku-5.5`) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| brief_schema_lite | — |
| thesis_reference | — |
| contradiction_mention | — |
| judge | — |

### Weekly Brief — Convex-cron vs agent-graph comparison (plan 04)

Three Friday cycles, scored side by side. The embodied answer (which brief drove the better weekend session) outranks the eval score if they disagree.

| Cycle (weekOf) | Path | judge | briefSchemaLite | Embodied winner |
| --- | --- | --- | --- | --- |
| — | convex-cron | — | — | — |
| — | agent-graph | — | — | — |
