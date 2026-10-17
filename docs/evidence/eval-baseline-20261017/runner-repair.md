# Eval runner repair — 2026-10-17

This repair follows the [plan 008 preflight](preflight.md) on the same day.
Keith approved it as a task separate from the sweep, starting from the
preflight head `cf4041e`. **No eval ran, no score was recorded, no dataset was
uploaded and no paid call was made.** Every check below ran with mocked
network, Varlock and model calls. The sweep stays stopped behind the
preflight's credential and dataset decisions.

## What changed

| Preflight finding | Repair |
| --- | --- |
| 1. Failed calls scored 0 and exited 0 | `runEval` returns an exit code, and each runner sets `process.exitCode` from it. A target throws on a transport error, an empty response, a `length` (truncated) or other non-`stop` finish, or text with no JSON object. Evaluators are wrapped (`run-guard.ts`): a failed target run is never scored, and an evaluator exception or a score outside 0..1 is recorded before the SDK swallows it. After `evaluate()` returns, every row is checked: one row per dataset example, no `run.error`, and one finite score from each evaluator. Any gap prints `EVAL RUN FAILED` and exits 1. Only a complete run prints `EVAL_RUN_COMPLETE {experiment, examples, evaluatorKeys}`. An empty dataset fails. |
| 1. Judge failures scored 0 | The judge throws on a failed or truncated call, a response with no JSON object, or a missing or non-numeric dimension. Explicit zeros remain valid scores. Numeric strings are still coerced and out-of-range numbers clamped. |
| 2. Inference differed from production | Each prompt version names a production task. The model comes from `TASK_MODELS` and the cap from `TOKEN_BUDGETS`. The call goes directly to Anthropic through `@ai-sdk/anthropic` with `thinking: { type: "adaptive" }` and the effort from `anthropicReasoningEffort`, and sends no sampling parameters. Extraction runs on `extract_v3`: Sonnet 5.5, medium effort, 8000 tokens, previously 4096. Hypotheses run on `hypothesis_v1`: Opus 5.5, high effort, 6000 tokens, previously Sonnet with 2000. Briefs run on `brief_v2`: Sonnet 5.5, medium effort, 8000 tokens, previously 4000. Experiment metadata records the task, model, provider, effort and cap. |
| 3. `promote.ts` extraction default `v2` | Now `v3`, matching the runner, in the code and the help text. |
| 4. Unregistered judge model | `JUDGE_MODEL = MODELS.haiku` (`anthropic/claude-haiku-5.5`), called directly at medium effort with no `temperature`. Thinking tokens count against the output cap, so the cap rose from 500 to the bounded Haiku budget (`TOKEN_BUDGETS.concept_classifier_v1`, 5000). The timeout rose from 30 s to 120 s. The rubric and prompt are unchanged. |
| 5. `promote.ts` spawned `bun` | Runs `vpx tsx <runner> --version <v>`. A trial counts only if the child exits 0 and prints the completion marker. LangSmith must then report one score per example for every key in that marker, polled until complete; otherwise promotion throws instead of using partial means. A rubric key present on only one side now fails instead of being skipped. |
| 5. `upload-datasets.ts` lacked Varlock | Its first import is `varlock/auto-load`. It still uploads only when an operator runs it. |

Errors are logged without the prompt, the source text or the response text.
Exception messages are withheld entirely, because any message can quote
private text. A failure is described only by its error name, HTTP status,
provider error type (such as `overloaded_error`) and, for a retried call, the
same fields for the last attempt. The SDK prints these safe descriptions in its
own `Error running target function` and `Error running evaluator` lines.

Unchanged: production generators, prompts, persisted routing and
`convex/shared/llmPolicy.ts`. The simplified hypothesis and weekly-brief
prompts still apply. Golden data, the hypothesis judge, a provider flag and a
recipe runner are still missing, and the extraction rows still have no
`sourceUrl`.

## Checks

All checks ran in the repair worktree with no network access.

| Check | Result |
| --- | --- |
| `vp test scripts/langsmith/` | 12 files, 123 tests, all passing. Mutation check: with the final validation disabled, 11 full-run failure tests fail. |
| Full-run tests (`eval-helper.test.ts`) | These use a stand-in for `evaluate()` that swallows errors the way `_forward` and `_runEvaluators` do in langsmith 0.10.11. Each of these exits 1 with no completion line: a failed target request, a malformed, truncated or empty response, one failed example among successes, an evaluator exception, a non-finite score, a dropped feedback write, an empty dataset, a judge transport failure, an unparseable verdict and a prompt renderer exception. A completed run, valid zero scores and a judge awarding zeros all exit 0. No error output contains the source text or a key, including the evaluator-exception path. |
| Routing tests | Model ids `claude-sonnet-5-5`, `claude-opus-5-5` and `claude-haiku-5-5`. Adaptive thinking, with high effort only on Opus. Caps 8000, 6000, 8000 and 5000. No `temperature`, `topP` or `topK`. |
| Promotion tests | The child runs as `vpx tsx … --version`. A nonzero exit, a signal, a spawn error or a missing marker all throw, tested with both mocked spawn and a real `vpx tsx` child under `APP_ENV=test`. Through `main()`, a failed child or partial candidate feedback never reaches PASS. |
| Upload test | Varlock is the first import and loads before the client is built. With mocked I/O, nothing is uploaded. |

## Before the sweep

The preflight's decisions still apply: credentials for the referenced vaults,
approval to upload all three golden datasets, and the STOP 4 choice for 4
hypothesis and 2 weekly-brief rows. Two inputs changed.

- **Keys.** The runners and the judge now read `ANTHROPIC_API_KEY`, not
  `OPENROUTER_API_KEY`. `promote.ts` and the upload read `LANGSMITH_API_KEY`.
  Varlock still requires every `@required` secret.
- **Cost.** The preflight estimate assumed the old route and caps, so it no
  longer applies. Recompute it from current Anthropic prices before spending.
  Worst-case output per run: extraction 18 × 8000 = 144,000 tokens (Sonnet
  5.5); hypothesis 4 × 6000 = 24,000 (Opus 5.5, high effort); weekly brief
  2 × 8000 = 16,000 (Sonnet 5.5); judge 2 × 5000 = 10,000 (Haiku 5.5). Input
  per run is unchanged from the preflight table.

Commands, all gated on the decisions above:

1. Upload: `vpx tsx scripts/langsmith/upload-datasets.ts`.
2. Three runs each: `vpx tsx scripts/langsmith/eval-extraction.ts`,
   `vpx tsx scripts/langsmith/eval-hypothesis.ts`,
   `vpx tsx scripts/langsmith/eval-weekly-brief.ts`. Accept a run only if it
   exits 0 and prints `EVAL_RUN_COMPLETE`. Take the experiment name from that
   line. Read the feedback comments to understand low scores; they are no
   longer needed to catch failures. Under STOP 6, review the cost of the first
   extraction run before the second.
3. Record the three-run means as `docs/eval-baselines.md` describes, then
   check the parse and run `vp test scripts/langsmith/`.

## Index reconciliation for the coordinator

This repair does not edit `plans/` or `docs/plans/README.md`. Plan 008's
header still names `OPENROUTER_API_KEY`, and its status row and the
`plans/README.md` entry still describe the pre-repair runner. Their owner
should point them here and change the key to `ANTHROPIC_API_KEY`.
`data/eval/README.md` still shows a `bun` upload command.
