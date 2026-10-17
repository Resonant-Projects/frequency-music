# Eval Datasets

Golden datasets for the LangSmith experiments. Two file kinds per family:

| Kind | Filename | Produced by | Consumed by |
| --- | --- | --- | --- |
| **Candidates** | `*-candidates.jsonl` | `scripts/export-eval-datasets.ts` (`vp run eval:export`) and `scripts/langsmith/export-edit-captures.ts` (`*-golden.candidates.jsonl`) | human curation |
| **Golden** | `extractions-golden.jsonl`, `hypotheses-golden.jsonl`, `recipes-golden.jsonl`, `weekly-briefs-golden.jsonl` | **human curation** of candidates | `scripts/langsmith/upload-datasets.ts` |
| **Proposed** | `proposed/*.proposed-<date>.jsonl` | candidate rows copied for a curation sheet (`curation-<date>.md`) | Keith's ratification; once ratified, the drift check's approved snapshot. Nothing uploads them |

## Flow

1. `vp run eval:export` (or `vpx tsx scripts/langsmith/export-edit-captures.ts`)
   proposes candidate rows meeting the quality criteria in
   `docs/agent-tool-surface.md`.
2. **Human curates** candidates into the plural `*-golden.jsonl` files —
   target ≥15 extraction, ≥15 hypothesis, ≥10 recipe, ≥6 brief rows. The
   ratified ids live in `scripts/langsmith/materialize-curation-2026-07-18.ts`,
   which regenerates the files from production with read-only queries. Pass
   `--dataset <name>` to regenerate only the file a decision changes; without
   it, all three are rewritten.
3. `vpx tsx scripts/langsmith/upload-datasets.ts` pushes golden files into
   LangSmith as `resonant-{extractions,hypotheses,recipes,weekly-briefs}-golden`.
   It loads `LANGSMITH_API_KEY` through Varlock and uploads as soon as it runs,
   so run it only with operator approval. It always sends all three of the
   extraction, hypothesis and weekly-brief files. Extraction rows carry
   private `rawText`, and each weekly-brief row's embedded hypotheses carry
   their sources' `rawText`. Re-running skips examples already in each
   dataset.

## Row shape

`upload-datasets-lib.ts` reads **flat** rows (input + output keys at the top
level, per `pickKeys`), not the nested `{inputs, outputs, metadata}` shape. Keep
curated golden rows flat. See `upload-datasets.ts` for the exact input/output
keys per dataset.

## Privacy

Extraction golden rows include `rawText` (evals are meaningless without source
text), so treat this directory as **private** research data. Do not publish raw
source text if the repo becomes public.
