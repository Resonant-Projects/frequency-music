# Eval Baselines

Recorded per-evaluator baseline scores for the LangSmith experiments. This file
is a **shared contract**:

- `scripts/langsmith/promote.ts` parses it (`parseBaselinesDoc`) to compare a
  candidate prompt/model against the current baseline. Within a section whose
  heading mentions the target (`hypothesis`, `recipe`, `brief`/`weekly brief`,
  `extraction`), it reads each markdown table row as `{ firstCell: lastCell }`,
  i.e. **first cell = evaluator key, last cell = numeric mean**.
- Plan 04's weekly-brief comparison appends Convex-cron-vs-agent rows here.
- Plan 05's `promote.ts` PASS updates the relevant means here.

> **Status: skeleton.** Numbers are `—` placeholders until the first baseline
> sweep runs (plan 02 task 4, needs live OpenRouter + LangSmith + uploaded golden
> datasets). `—` parses as non-numeric and is skipped, so `promote.ts` degrades
> gracefully — it still runs the head-to-head experiments and compares those.

**How to record a baseline** (per target): run its `eval-*.ts` runner 3× against
the current prompt version, then fill the mean per evaluator below along with the
metadata line. Note: the runners score the *runner's* simplified prompt version
via `anthropic/claude-sonnet-4.6`, not the deployed Convex prompt — interpret the
numbers as relative prompt-version comparisons.

---

## Extraction baseline

- Prompt version: `extract_v2` · Model/provider: `anthropic/claude-sonnet-4.6` (OpenRouter) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| extractionSchema | — |
| parameterSpecificity | — |

## Hypothesis baseline

- Prompt version: `v1` · Model/provider: `anthropic/claude-sonnet-4.6` (OpenRouter) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| whyThisMatters | — |
| judge | — |

### Hypothesis — provider comparison (OpenRouter vs Codex)

Added once plan 01's Codex provider is exercised by `eval-hypothesis` (same dataset, different provider) — the first hard data on whether subscription inference matches OpenRouter quality for this workload.

| Evaluator | Mean |
| --- | --- |
| whyThisMatters (codex) | — |
| judge (codex) | — |

## Recipe baseline

- Prompt version: `v1` · Model/provider: `anthropic/claude-sonnet-4.6` (OpenRouter) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| parameterSpecificity | — |
| judge | — |

## Weekly Brief baseline

- Prompt version: `v1` · Model/provider: `anthropic/claude-sonnet-4.6` (OpenRouter) · Date: — · Experiments: —

| Evaluator | Mean |
| --- | --- |
| briefSchemaLite | — |
| thesisReference | — |
| contradictionMention | — |
| judge | — |

### Weekly Brief — Convex-cron vs agent-graph comparison (plan 04)

Three Friday cycles, scored side by side. The embodied answer (which brief drove the better weekend session) outranks the eval score if they disagree.

| Cycle (weekOf) | Path | judge | briefSchemaLite | Embodied winner |
| --- | --- | --- | --- | --- |
| — | convex-cron | — | — | — |
| — | agent-graph | — | — | — |
