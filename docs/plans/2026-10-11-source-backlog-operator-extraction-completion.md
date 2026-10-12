# Operator source extraction completion, October 11, 2026

The approved source-extraction backlog is complete. GPT-6.1 Sol read and
extracted the sources consecutively in the existing operator thread, without
extraction delegation or external model calls. The stored producer is
`openai/gpt-6.1-sol`.

## Completion evidence

| Outcome | Count |
|---|---:|
| Sources stored and live-verified | 2,197 |
| Active first-class Claims | 1,209 |
| Skipped imports | 0 |
| Failed imports | 0 |
| Unusable captures parked as `review_needed` | 13 |
| Verbatim citation excerpts audited | 1,776 |
| Completed chunks | 89 |

The original export contained 1,955 extractable Sources in 79 chunks. A refresh
added 242 Sources in ten chunks. At `2026-10-11T22:58:36.773Z`, a second refresh
export returned zero chunks and zero extractable Sources, and the production
`sources.operatorExtractionPage` query returned zero rows with `isDone: true`.
All 13 unusable captures were independently verified as `review_needed`; no
content was invented for them.

Per-batch verification checked the stored model, input hash, extraction
content, Source status, and first-class Claims. The final audit checked unique
Source IDs, complete batch coverage, exact input hashes, citation substrings,
and per-source outcome totals. Stored objects were compared semantically.

The durable operator directory is
`~/.local/state/frequency-operator/20261011-sol/`. It retains `progress.json`,
`audit-through-089.json`, `final-backlog-evidence.json`,
`refresh-002-manifest.json`, `continuation-disabled.json`, and per-batch results,
outcomes, dry-run logs, import logs, and verification evidence in `backlog/`.
These are local operator artifacts, not repository files or credentials.

Completion was recorded at `2026-10-11T22:59:11.298364+00:00`. Only the
`frequency-sol-backlog-continuation-20261011` scheduled task was disabled, with
`enabled: false` and `nextRunAt: null` verified. The separate daily Action Queue
and production crons were untouched. Repeated continuation notices should
read the completed checkpoint rather than restart this campaign. Later intake
requires a new dated export and its own progress record.

## Selecting the actual operator model

`scripts/operator-extraction.ts` accepts `--model <id>` on both export and
import. The shared allowlist derives from the central `MODELS` catalog and
excludes the transcription model. Omitting the flag preserves the existing
Opus default. The flag records the actual producer; it does not call or switch
a model. The result file's top-level `model` must match the selected model.

For a new, authorized Sol campaign, use a fresh output directory and pass the
same model on export, dry-run, and import:

```sh
APP_ENV=ci vpx tsx scripts/operator-extraction.ts export --out <new-directory> --limit 10000 --chunk-size 25 --park-unextractable --model openai/gpt-6.1-sol
APP_ENV=test vpx tsx scripts/operator-extraction.ts import <results.json> --dry-run --model openai/gpt-6.1-sol
APP_ENV=ci vpx tsx scripts/operator-extraction.ts import <results.json> --model openai/gpt-6.1-sol
```

Before production operations, assert the target is
`https://convex.resonantprojects.art`. Varlock resolves the operator service
identity privately through 1Password. Do not print or copy credentials.
Export uses the shared worker prompts. Import makes no model call and retains
transactional changed-text, status, and duplicate guards. Parking uses the
existing hash-fenced text gate and makes no model call.

Read every exported item's full text and follow its exported prompt. Check
IDs, hashes, completeness, and verbatim quotes before dry-run and import.
Persist per-source outcomes and advance the checkpoint only after unresolved
failures are cleared and stored results are verified. A changed-text skip
needs a fresh export. Already-completed or duplicate Sources can be skipped
without double-counting prior work.

The model-selection implementation was already deployed and verified against
all 166 root module hashes during this campaign. This completion record does
not call for another deployment, publication, or media job.
