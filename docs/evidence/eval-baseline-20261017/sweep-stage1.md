# Plan 008 stage 1 sweep — 2026-10-17

This is the first paid step of [plan 008](../../../plans/008-eval-baseline-sweep.md),
run with the [readiness runbook](readiness.md#runbook) on host `devbox` at
base `16ed5881`. Keith approved it on 2026-10-17. He approved the upload by
the three hashes in [Upload content](readiness.md#upload-content) and stage 1
(extraction 18 rows and hypothesis 6 rows, three runs each) at the proposed
$11. That figure is an estimate, not a cap. Stage 2 (weekly briefs) was not
approved, and `eval-weekly-brief.ts` did not run.

**Verdict: stopped at STOP 6, after extraction run 1.** Run 1 completed. Its
Anthropic cost could not be measured: there is no console access here,
LangSmith recorded no token usage, and the runner prints none. So `stop6-ok`
was not created and run 2 did not start. **No baseline is recorded.**
`docs/eval-baselines.md` keeps every `—`.

A second blocker affects the hypothesis stage, and resuming does not clear
it. The LangSmith hypothesis dataset holds 8 examples, not 6. Two of them are
stale rows from an upload on 2026-07-24, and one is the H4 that Keith dropped
(see [Datasets in LangSmith](#datasets-in-langsmith)).

Nothing was written to Convex, and no Convex `run`, `dev`, `codegen` or
`deploy` command ran. The only paid call was extraction run 1. Logs and the
read-only helper scripts are outside the repository, in
`~/.local/state/frequency-eval/plan008-20261017/` (mode 700).

## Checks

| Gate | Check | Result |
| --- | --- | --- |
| Drift | `git diff --stat 57f7c90 HEAD -- scripts/langsmith/ docs/eval-baselines.md` | The 300 s target deadline (`eval-helper.ts` and its test), the materializer's `--dataset` selector and its test, and 2 lines in the baselines doc. All are covered in [runner-repair](runner-repair.md#follow-up-target-deadline) and [readiness](readiness.md#materialized-hypotheses-2026-10-17). `parseBaselinesDoc` is unchanged. |
| Hashes | `sha256sum data/eval/*-golden.jsonl` | All three equal the approved values: extractions `006f9498…3c3a` (18 rows), hypotheses `1090976e…aaaa` (6), weekly briefs `9f836cd4…a5f6` (2). |
| STOP 1 | Varlock boolean check, 16:08Z | Exit 0, `true true`. Only booleans were printed. |
| STOP 2 | `vp test scripts/langsmith/` | 13 files, 144 tests, all passing. |
| Upload 1 | `upload-datasets.ts`, 16:09Z | Exit 0. Extractions: found existing, `already has all 18 local examples`. Hypotheses: found existing, `uploaded 4 examples`. Weekly briefs: found existing, `uploaded 2 examples`. |
| STOP 3 | Upload 2, immediately after | Exit 0. `already has all 18`, `all 6` and `all 2 local examples`. Idempotent; clear. |
| Extraction run 1 | `run_eval extraction eval-extraction.ts 1`, 16:11:36Z–16:15:02Z | Exit 0. `EVAL_RUN_COMPLETE {"experiment":"extraction-v3-7b345c01","examples":18,"evaluatorKeys":["parameter_specificity","schema_valid"]}` |
| STOP 6 | Run 1 cost | **Not measurable; stopped.** See [STOP 6](#stop-6). |

## Datasets in LangSmith

All three datasets already existed. They were created on 2026-07-24 at about
02:05Z, and examples were added at 02:45Z. That is before the 2026-07-30
ratification commit `d2487c10`, the first commit of the current golden files.
So the private extraction `rawText` has been in LangSmith since then. The
"nothing uploaded" statements in the preflight and readiness packages
described only their own sessions.

A read-only inventory compared each example's upload keys with the local
rows, using `canonicalExampleKey` from `upload-datasets-lib.ts`:

| Dataset | Examples | Match a local row | Stale |
| --- | --- | --- | --- |
| `resonant-extractions-golden` | 18 | 18 (all from 2026-07-24) | 0 |
| `resonant-hypotheses-golden` | **8** | 6: H1 and H3 from 2026-07-24, and H2, H5, H6 and H7 from this upload | **2** |
| `resonant-weekly-briefs-golden` | **4** | 2, both from this upload | **2** |

Each stale example was matched to its closest historical row, comparing
fields only:

| Example id | Closest row | Fields that differ |
| --- | --- | --- |
| `e71b0af7-d12a-4f0c-98d3-8c6ea8283d5a` (hypotheses) | H2 `jh72zwgdmb…` | `claims`, `topics`, `compositionParameters`: built from H2's extraction before the repoint |
| `8c9c62ff-1189-45e2-a8ec-ba8b338640ee` (hypotheses) | H4 `jh7d82hc6s…` (dropped) | `claims`, `compositionParameters` |
| `dba20cd4-7dd0-4e08-ad05-77e7c4f55ca2` (briefs) | `k57dmdzgv0…` | `recipes`, `hypotheses`, `studioPrompts` |
| `e40f6085-17e3-4e3a-9fd3-c4a302e5391f` (briefs) | `k57atxwnwd…` | `recipes`, `hypotheses`, `studioPrompts` |

The upload never deletes, so these stay. Every runner loads its whole dataset
by name, so `eval-hypothesis.ts` would score 8 examples, including the
dropped H4. The runbook's means reader then rejects every hypothesis run
(`8 examples, expected 6; dataset drifted, STOP`). Each such run would also be
billed for 8 Opus calls, up to $1.00 worst case instead of $0.75. Removing
the two stale examples deletes LangSmith data, which no one has approved, so
nothing was removed. The two stale brief examples matter only for stage 2.

## STOP 6

The runbook asks for the Anthropic console cost of extraction run 1. With no
console access, Keith's instruction allowed one substitute: the run's recorded
token usage, from LangSmith run usage metadata or the runner's own output,
priced from the [Cost estimate](readiness.md#cost-estimate) table. Neither
source exists:

- **LangSmith.** A read-only `listRuns` on `extraction-v3-7b345c01` returned
  18 runs, all `chain` (the `evaluate()` target), and no `llm` child run.
  `prompt_tokens`, `completion_tokens`, `total_tokens` and `total_cost` are 0
  or absent on every run, and no `usage_metadata` exists. `eval-helper.ts`
  calls `generateText` without a LangSmith AI SDK wrapper or telemetry, so
  model calls are not traced.
- **Runner output.** The log holds only the start line, the results URL and
  the completion marker.

Without measured usage the run's cost is only bounded, not known. Under the
readiness method, run 1 costs at most **$1.52** (37,829 input tokens and
144,000 output tokens at their caps). If every call were billed three times,
the ceiling is $4.55. A completed run cannot reach the output bound, because
a call that hits its cap fails the run. Measured that way, cumulative stage 1
spend is **at most $1.52**, and the projected stage 1 total stays within the
$6.80 worst case. That is a bound, not a measurement. The STOP 6 rule needs a
measured figure, so the gate stays closed.

## Extraction run 1 scores (provisional, not a baseline)

A baseline needs three runs, so these figures are recorded only as evidence.
They are not in `docs/eval-baselines.md`.

| Evaluator | Run 1 mean (`readMeansForExperiment`) |
| --- | --- |
| `schema_valid` | 1.00 (1 exactly) |
| `parameter_specificity` | 0.82 (0.8240777…) |

**LangSmith stats lag.** `readMeansForExperiment` first refused this
experiment: `feedback is incomplete after 6 reads (parameter_specificity:
17/18 scores; schema_valid: 17/18 scores)`. A read-only probe found 18 root
runs, 18 distinct examples, no run errors, and exactly one finite score per
key on each run. The raw feedback means equal the figures above. The project's
`feedback_stats` stayed at `n=17` until about 16:23Z, about 8 minutes after
the run finished. Then the same call returned all 18. Its built-in polling
lasts about 15 s (6 reads, 2.5 s apart). So the runbook's step 3 reader, and
`promote.ts`, can fail closed on a sound run if they read too soon. Retrying
later is enough. This is reported, not fixed: plan 008 keeps
`scripts/langsmith/` out of scope.

## To resume

1. **STOP 6 (Keith).** In the Anthropic console, check the usage for the
   `ANTHROPIC_API_KEY` that Varlock resolves on `devbox`. The window is
   2026-10-17 16:11:36Z–16:15:02Z: 18 Sonnet 5.5 requests. If the cost is at
   or under about $1.52, run
   `touch ~/.local/state/frequency-eval/plan008-20261017/stop6-ok`.
   Alternatively, approve a way to measure usage on later runs. For example,
   a local fetch hook could log only each response's `usage` field. It would
   need no change to `scripts/langsmith/`, but it is not in the runbook.
2. **Hypothesis dataset (Keith).** Choose one: (a) delete the stale examples
   `e71b0af7-…` and `8c9c62ff-…` from `resonant-hypotheses-golden`; (b)
   accept an 8-example dataset that includes the dropped H4, which needs a new
   curation decision and cost line; or (c) keep hypotheses blocked. Until he
   decides, run only the extraction part of the runbook chain. The full chain
   would spend on hypothesis runs whose scores cannot be recorded.
3. **Extraction runs 2 and 3.** These use the same `run_eval` steps, in the
   same `RUN_DIR`. Run 1's log passes and is skipped. To read the means, run
   the step 3 reader with `EXPECTED_EXAMPLES=18` a few minutes after run 3, so
   that `feedback_stats` has caught up.
