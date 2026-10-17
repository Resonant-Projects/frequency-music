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
> OpenRouter + LangSmith + uploaded golden datasets). `—` parses as non-numeric
> and is skipped, so `promote.ts` degrades gracefully — it still runs the
> head-to-head experiments and compares those. The 2026-10-17 preflight
> recorded no scores; its blockers and prepared commands are in
> [`evidence/eval-baseline-20261017/preflight.md`](evidence/eval-baseline-20261017/preflight.md).

**How to record a baseline** (per target): run its `eval-*.ts` runner 3× against
the current prompt version, then fill the mean per evaluator below along with the
metadata line. Note: the runners score the *runner's* simplified prompt version
via `anthropic/claude-sonnet-5.5`, not the deployed Convex prompt — interpret the
numbers as relative prompt-version comparisons.

The inference configuration differs from production as well. The runners call
`anthropic/claude-sonnet-5.5` through OpenRouter with no thinking or reasoning
options, while the deployed generators call Anthropic directly with adaptive
thinking, and hypothesis generation uses Opus 5.5. Extraction `v3` reuses the
deployed prompt text, but its score still describes this runner configuration
rather than deployed extraction quality. The weekly-brief judge is
`anthropic/claude-haiku-4.5` through OpenRouter at temperature 0.

---

## Extraction baseline

- Prompt version: `v3` (`extract_v3` prompt text; `eval-extraction.ts` default) · Model/provider: `anthropic/claude-sonnet-5.5` (OpenRouter) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| schema_valid | — |
| parameter_specificity | — |

## Hypothesis baseline

- Prompt version: `v1` · Model/provider: `anthropic/claude-sonnet-5.5` (OpenRouter) · Date: — · Experiments: —

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

- Prompt version: `v1` · Model/provider: `anthropic/claude-sonnet-5.5` (OpenRouter) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| parameter_specificity | — |
| judge | — |

No `eval-recipe.ts` runner exists, so this section stays `—`.

## Weekly Brief baseline

- Prompt version: `v1` · Model/provider: `anthropic/claude-sonnet-5.5` (OpenRouter) · Date: — · Experiments: —

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
