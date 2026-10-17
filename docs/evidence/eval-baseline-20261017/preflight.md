# Plan 008 preflight — 2026-10-17

Preflight for [plan 008](../../../plans/008-eval-baseline-sweep.md) at base
`ec04c7c`. **No eval ran and no score was recorded.** No dataset was uploaded,
no paid call was made, and nothing in `scripts/langsmith/` changed. The sweep
is blocked on credentials and on the three operator decisions listed at the end.

## Results

| Step | Check | Result |
| --- | --- | --- |
| Drift | `git diff --stat a30f10c..HEAD -- docs/eval-baselines.md scripts/langsmith/` | 20 files changed; re-read both. `parseBaselinesDoc` behavior is unchanged; the runners changed (see below). |
| 1.1 Env | Load `OPENROUTER_API_KEY` and `LANGSMITH_API_KEY` through `varlock/auto-load` | **STOP 1.** The worker's 1Password service account cannot reach the vaults that `.env.schema` references, so neither key resolves. No other secret route was attempted. |
| 1.2 Tooling | `vp test scripts/langsmith/` | Pass: 7 files, 48 tests. |
| 1.3 Headers | Read `upload-datasets.ts` and the three `eval-*.ts` runners | Done; findings below. |
| 2 Datasets | Count rows in `data/eval/*-golden.jsonl` | Extractions 18; hypotheses **4**; weekly briefs **2**. **STOP 4** applies to hypothesis and weekly brief (<5 examples). The curation sheet ratified both as under target (≥15 and ≥6). Recipes: no golden file and no runner. |
| 2 Idempotency | Read `upload-datasets.ts` and `upload-datasets-lib.ts` | Re-upload skips examples whose canonical input+output key already exists (`buildMissingExamples`, unit-tested). STOP 3 does not apply. |
| Route | Public OpenRouter catalog, `GET https://openrouter.ai/api/v1/models` | `anthropic/claude-sonnet-5.5` is listed at $2/M input and $10/M output. `anthropic/claude-haiku-4.5` (judge) is listed at $1/M input and $5/M output. |
| 5 Gate | `parseBaselinesDoc` on this doc, with test placeholders and no network | Every target parses to `{}`. With sentinel numbers in each last cell, every row is read, keyed by its first cell. |

## Runner findings for a separately authorized repair

Plan 008 forbids changing `scripts/langsmith/`, so these are reported, not
fixed. The first two make a recorded baseline misleading. If they are repaired
after a baseline is recorded, the baseline must be re-recorded.

1. **Failed calls score as zero and the run still exits 0.** LangSmith's
   `evaluate` catches target errors and only logs `Error running target
   function` (`node_modules/langsmith/lib/evaluation/_runner.mjs:896`). The
   evaluators then score the missing output as 0. Unparseable model text
   becomes `{}` (`eval-helper.ts:50,58`), and a failed judge call returns
   `score: 0` and the error only in its feedback comment (`evaluators/judge.ts`).
   An auth, rate-limit or truncation fault lowers the mean instead of stopping
   the run. Until this is repaired, a mean is only acceptable after the checks
   in step 2 below.
2. **Inference config differs from production.** `eval-helper.ts:91` calls
   `MODELS.sonnet` through OpenRouter with no reasoning options. Output is
   capped at 4096 tokens for extraction, against 8000 in production. Deployed
   generation calls Anthropic directly with adaptive thinking
   (`convex/llmNode.ts:64`), and hypotheses use Opus 5.5 (`TASK_MODELS`). The
   AGENTS.md policy says current-catalog Anthropic calls use adaptive thinking.
3. **Extraction baseline default mismatch.** `eval-extraction.ts` defaults to
   `v3`, but `promote.ts:63` (and its help text) default the extraction
   baseline to `v2`. Pass `--baseline v3` explicitly until they agree.
4. **The judge model is unregistered.** `evaluators/judge.ts:13` hard-codes
   `anthropic/claude-haiku-4.5`, which is not in `MODELS`, so
   `check-model-catalog.ts` never verifies it. Its comment says it matches
   `MODELS.haiku`, which is now `anthropic/claude-haiku-5.5`.
5. **Smaller gaps.** `eval-hypothesis.ts` has no judge evaluator, so the
   hypothesis `judge` row cannot be filled. No runner has a Codex/provider
   flag. The extraction golden rows have no `sourceUrl`, so the `v3` prompt
   always renders an empty URL. Both weekly-brief golden rows have empty
   `failures`. `promote.ts:363` spawns `bun` rather than `vpx tsx`.

`docs/eval-baselines.md` previously keyed its rows in camelCase
(`extractionSchema`). The evaluators emit snake_case feedback keys
(`schema_valid`), which `promote.test.ts` also uses. That doc is in scope, so
its keys now match the emitted ones.

## Cost estimate

This is an offline estimate from the golden rows at 4 characters per token,
with every output at its token cap. It is the worst case for three runs per
target.

| Target | Examples | Input tok/run | Max output tok/run | Worst case, 3 runs |
| --- | --- | --- | --- | --- |
| Extraction (`v3`, Sonnet 5.5) | 18 | 28,380 | 73,728 | $2.38 |
| Hypothesis (`v1`, Sonnet 5.5) | 4 | 3,959 | 8,000 | $0.26 |
| Weekly brief (`v1`, Sonnet 5.5) | 2 | 19,576 | 8,000 | $0.36 |
| Weekly-brief judge (Haiku 4.5) | 2 | 15,420 | 1,000 | $0.06 |
| **Total** | | | | **$3.06** (≈ $4.60 with 1.5× margin) |

LangSmith usage is about 72 target runs plus feedback.

## Prepared live steps (not run)

Run these from the repository root on a host where Varlock can resolve every
required `.env.schema` secret. `varlock/auto-load` refuses to start if any
required secret fails, not only these two keys.

1. **Upload datasets** (needs approval). The script uploads all three golden
   files to LangSmith Cloud: 18 extraction rows, including private source
   `rawText`; 4 hypothesis rows; and 2 weekly-brief rows, including their
   hypotheses, recipes and theses. Run
   `vpx tsx scripts/langsmith/upload-datasets.ts`.
2. **Run each target three times**, in order, keeping the full output of every run:
   `vpx tsx scripts/langsmith/eval-extraction.ts`,
   `vpx tsx scripts/langsmith/eval-hypothesis.ts`,
   `vpx tsx scripts/langsmith/eval-weekly-brief.ts`.
   Record each `Starting evaluation of experiment:` name. Before accepting a
   run, check three things. Search stdout and stderr for
   `Error running target function` or `Error running evaluator`. In LangSmith,
   check that no run in the experiment has an error. Then read every feedback
   comment: `judge call failed` marks a failed judge call, and `no output`,
   `missing bodyMd`, `missing or too short` or a schema comment such as
   `summary missing` can mark an unparseable response. Exit status and `feedback_stats` show none of these.
   Treat any hit as a failed run, not as a score. Under STOP 6, review the cost
   of the first extraction run before the second.
3. **Record means.** Read each experiment's `feedback_stats` (as
   `readMeansForExperiment` in `promote.ts` does). Fill the mean of three runs
   to two decimals in the last cell. Fill the metadata line with the date and
   three experiment names, and change the status line.
4. **Check the gate.** `promote.ts` has no parse-only mode, and every
   `--target` invocation spawns paid experiments. Check the parse with
   `parseBaselinesDoc` under `APP_ENV=test`, then run
   `vp test scripts/langsmith/`.

## Decisions needed before spend

1. Supply credentials: a session or service account that can read the
   referenced 1Password vaults.
2. Approve uploading all three golden datasets, including private extraction
   `rawText`, to LangSmith Cloud.
3. Choose whether to run hypothesis (4) and weekly brief (2) under STOP 4, or
   curate more rows first.
4. Choose whether to repair findings 1–2 before recording any baseline.
