# Plan 008 stage 1 sweep — 2026-10-17

This is the paid stage 1 of [plan 008](../../../plans/008-eval-baseline-sweep.md),
run with the [readiness runbook](readiness.md#runbook) on host `devbox` from
base `16ed5881`. Keith approved it on 2026-10-17. He approved the upload by
the three hashes in [Upload content](readiness.md#upload-content) and stage 1
(extraction 18 rows and hypothesis 6 rows, three runs each) at the proposed
$11. That figure is an estimate, not a cap. Stage 2 (weekly briefs) was not
approved, and `eval-weekly-brief.ts` did not run.

**Verdict: stage 1 baselined.** Six runs completed. The extraction and
hypothesis means are recorded in `docs/eval-baselines.md`. Stage 1 cost
**$3.48**: extraction run 1 at its $1.52 bound, plus $1.96 measured across the
other five runs.

The sweep paused twice, and Keith decided both pauses the same day:

1. **STOP 6.** Run 1's cost could not be measured. Keith accepted run 1 at its
   $1.52 bound, and authorized an opt-in usage log so that every later run is
   measured ([Cost](#cost)).
2. **Stale LangSmith rows.** The hypothesis and brief datasets held leftover
   examples from an upload on 2026-07-24. Keith had those four examples
   deleted ([Datasets in LangSmith](#datasets-in-langsmith)).

Nothing was written to Convex, and no Convex `run`, `dev`, `codegen` or
`deploy` command ran. The only paid calls were the six runs. Logs, usage logs
and the read-only helper scripts are outside the repository, in
`~/.local/state/frequency-eval/plan008-20261017/` (mode 700).

## Checks

| Gate | Check | Result |
| --- | --- | --- |
| Drift | `git diff --stat 57f7c90 HEAD -- scripts/langsmith/ docs/eval-baselines.md` | The 300 s target deadline (`eval-helper.ts` and its test), the materializer's `--dataset` selector and its test, and 2 lines in the baselines doc. All are covered in [runner-repair](runner-repair.md#follow-up-target-deadline) and [readiness](readiness.md#materialized-hypotheses-2026-10-17). `parseBaselinesDoc` is unchanged. |
| Hashes | `sha256sum data/eval/*-golden.jsonl` | All three equal the approved values: extractions `006f9498…3c3a` (18 rows), hypotheses `1090976e…aaaa` (6), weekly briefs `9f836cd4…a5f6` (2). |
| STOP 1 | Varlock boolean check, 16:08Z | Exit 0, `true true`. Only booleans were printed. |
| STOP 2 | `vp test scripts/langsmith/` | 13 files, 144 tests, all passing (151 after the usage hook). |
| Upload 1 | `upload-datasets.ts`, 16:09Z | Exit 0. Extractions: found existing, `already has all 18 local examples`. Hypotheses: found existing, `uploaded 4 examples`. Weekly briefs: found existing, `uploaded 2 examples`. |
| STOP 3 | Upload 2, immediately after | Exit 0. `already has all 18`, `all 6` and `all 2 local examples`. Idempotent; clear. |
| STOP 4 | LangSmith example counts after cleanup | Extractions 18, hypotheses 6 and briefs 2. Every example matches a ratified row. Briefs stay under the floor, so stage 2 stays blocked. |
| STOP 5 | Every run | No run failed. |
| STOP 6 | Run 1 cost | Accepted at the $1.52 bound on Keith's decision. Runs 2–6 were measured ([Cost](#cost)). |

## Datasets in LangSmith

All three datasets already existed. They were created on 2026-07-24 at about
02:05Z, and examples were added at 02:45Z. That is before the 2026-07-30
ratification commit `d2487c10`, the first commit of the current golden files.
So the private extraction `rawText` has been in LangSmith since then. The
"nothing uploaded" statements in the preflight and readiness packages
described only their own sessions.

After the upload, a read-only inventory compared each example's upload keys
with the local rows, using `canonicalExampleKey` from
`upload-datasets-lib.ts`:

| Dataset | Examples | Match a local row | Stale |
| --- | --- | --- | --- |
| `resonant-extractions-golden` (`2b1ebba9-…`) | 18 | 18 (all from 2026-07-24) | 0 |
| `resonant-hypotheses-golden` (`921914ca-…`) | 8 | 6: H1 and H3 from 2026-07-24, and H2, H5, H6 and H7 from this upload | 2 |
| `resonant-weekly-briefs-golden` (`671451bf-…`) | 4 | 2, both from this upload | 2 |

Every runner loads its whole dataset by name. A hypothesis run would
therefore have scored 8 examples, including the dropped H4, and the runbook's
means reader would have rejected it (`8 examples, expected 6`).

### Deleted on Keith's decision

Before deleting anything, a check-only pass re-read each example. All four
were in the expected dataset, created at 2026-07-24T02:45Z, and matched no
ratified row on the upload keys. Together they were exactly the set of
non-matching examples in each dataset, and the closest-row comparison was
unchanged. The script deletes only when every check passes and deletion is
explicitly enabled. It then deleted these four examples, and nothing else:

| Dataset | Example id | Created (UTC) | Why it is stale |
| --- | --- | --- | --- |
| `resonant-hypotheses-golden` | `e71b0af7-d12a-4f0c-98d3-8c6ea8283d5a` | 2026-07-24T02:45:39.92Z | H2 (`jh72zwgdmb…`) built from its extraction before the repoint. It differs from the ratified H2 in `claims`, `topics` and `compositionParameters` |
| `resonant-hypotheses-golden` | `8c9c62ff-1189-45e2-a8ec-ba8b338640ee` | 2026-07-24T02:45:40.28Z | H4 (`jh7d82hc6s…`), which Keith dropped. It also differs from the July H4 in `claims` and `compositionParameters` |
| `resonant-weekly-briefs-golden` | `dba20cd4-7dd0-4e08-ad05-77e7c4f55ca2` | 2026-07-24T02:45:40.77Z | Pre-ratification brief `k57dmdzgv0…`. It differs from the ratified row in `recipes`, `hypotheses` and `studioPrompts` |
| `resonant-weekly-briefs-golden` | `e40f6085-17e3-4e3a-9fd3-c4a302e5391f` | 2026-07-24T02:45:40.98Z | Pre-ratification brief `k57atxwnwd…`, with the same three fields changed |

The inventory afterwards: extractions 18 of 18, hypotheses 6 of 6 and briefs
2 of 2, each matching a ratified row, with no stale example left.

## Cost

**Run 1, by bound.** No measured usage exists for run 1. There was no console
access, LangSmith recorded only the 18 `chain` target runs and no `llm` run,
and every token and cost field was 0 or absent. The runner printed no usage.
Keith accepted run 1 at its readiness single-attempt worst case, $1.52
(37,829 input and 144,000 output tokens at their caps). After that decision,
`stop6-ok` was created.

**Runs 2–6, measured.** Keith authorized an opt-in hook. When
`EVAL_USAGE_LOG=<path>` is set, `generateModelText` in `eval-helper.ts`
appends one JSON line per model response. The line holds the model id and the
AI SDK's token counts, and every count is a finite number or null. It carries
no prompt, output or key text. Truncated and empty responses are logged too,
because they are billed. Prompts, parameters, caps and scoring are unchanged.
The runbook's `run_eval` set the variable to a per-run file.

Each run was priced as its log totals multiplied by the
[Cost estimate](readiness.md#cost-estimate) prices: Sonnet 5.5 at $2/$10 and
Opus 5.5 at $4/$20 per million input/output tokens. No log showed cache
tokens. The log line count equalled the example count every time, so no AI
SDK retry was logged. A retried error attempt returns no usage, and nothing
here suggests one was billed.

| # | Run | Experiment | Calls | Input tok | Output tok | Cost | Cumulative |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Extraction 1 | `extraction-v3-7b345c01` | 18 | not measured | not measured | $1.52 (bound) | $1.52 |
| 2 | Extraction 2 | `extraction-v3-fdbaee62` | 18 | 37,499 | 32,091 | $0.3959 | $1.92 |
| 3 | Extraction 3 | `extraction-v3-dfbaf6de` | 18 | 37,499 | 32,542 | $0.4004 | $2.32 |
| 4 | Hypothesis 1 | `hypothesis-v1-511b69df` | 6 | 8,377 | 18,303 | $0.3996 | $2.72 |
| 5 | Hypothesis 2 | `hypothesis-v1-819866f8` | 6 | 8,377 | 16,585 | $0.3652 | $3.08 |
| 6 | Hypothesis 3 | `hypothesis-v1-390c9c87` | 6 | 8,377 | 18,355 | $0.4006 | **$3.48** |

Before each run, the projected total was checked: cumulative spend plus the
worst case of every remaining run ($1.52 per extraction run, about $0.75 per
hypothesis run). It peaked at $6.81, when only run 1 had happened, and fell
after every run. It never approached $11.

Observations on the estimate:

- Extraction input matched the offline estimate (37,499 against 37,829
  tokens). Output was about 22% of the cap.
- Hypothesis input was 8,377 tokens, about 12% above the 7,490 estimate, even
  though the estimate assumed 3 characters per token. Output was about half
  the cap. The per-run worst case therefore rises from $0.75 to about $0.754.
- The AI SDK reported `reasoningTokens` 0 for every Sonnet call, and 4,282 to
  4,830 per hypothesis run on Opus. `outputTokens` includes thinking either
  way, so the cost figures do not depend on that split.
- Runs 2 and 3 suggest that run 1, which used the same prompts and data, cost
  about $0.40. The recorded total still counts it at the $1.52 bound, as Keith
  decided.

LangSmith is not priced. Stage 1 created 72 traced target runs and their
feedback.

## Scores

Read with the runbook's step 3 reader, which uses `readMeansForExperiment`
from `promote.ts`. Each run passed its log guards: `exit=0`, a completion
marker, the expected example count, and no `EVAL RUN FAILED`.

| Target | Evaluator | Run 1 | Run 2 | Run 3 | Three-run mean (recorded) |
| --- | --- | --- | --- | --- | --- |
| Extraction | `schema_valid` | 1 | 1 | 1 | **1.00** |
| Extraction | `parameter_specificity` | 0.8241 | 0.8426 | 0.8056 | **0.82** |
| Hypothesis | `why_this_matters` | 0.5833 | 0.5833 | 0.8333 | **0.67** |

The hypothesis means move in steps of 1/6, because the dataset has 6 rows,
and the evaluator varies between runs. A future candidate's comparison should
allow for that.

**LangSmith stats lag.** `feedback_stats` lagged behind the stored feedback
by about 8 minutes for both targets. For run 1 it showed 17 of 18 scores per
key. A read-only probe found 18 runs, 18 distinct examples, no run errors and
exactly one finite score per key on each run, with raw means equal to the
recorded ones. For the hypothesis runs it showed 5 of 6. Its built-in polling
lasts about 15 s (6 reads, 2.5 s apart), so `readMeansForExperiment` refused
each read until the stats caught up. Retrying once a minute succeeded in
about 8 minutes. `promote.ts` uses the same reader, so a promotion run right
after its experiments can fail closed in the same way. This is reported, not
fixed.

## Still `—`

- Hypothesis `judge`: `eval-hypothesis.ts` emits no judge feedback.
- The Codex provider-comparison rows: no runner has a provider flag.
- Recipe: no runner exists.
- Weekly brief, and the plan 04 comparison: stage 2 is not approved, and
  STOP 4 applies (2 rows, and production has no thesis rows).

## Usage hook review

The hook (commit `aee240f7`) adds 7 focused tests to `eval-helper.test.ts`.
They cover one line per call with only the model and numeric fields, a
mode-600 file, logging before a truncation failure, null for non-numeric
fields, an unset variable writing nothing and leaving the request unchanged,
a failed write failing the call with a safe message, and `runEval` logging
every target call. With the hook call removed, 6 of the 7 fail. `vp test
scripts/langsmith/` passes 151 tests, and `tsc` passes. An independent Codex
autoreview (`gpt-6.1-sol`, high reasoning, branch mode against `e9b04ebe`,
with the judge, run-guard and runner sources as context) returned
`scoped-clean`, with no findings at P0–P3, before any measured run used the
hook.
