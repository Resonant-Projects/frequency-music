# Eval Datasets

Golden datasets for the LangSmith experiments. Two file kinds per family:

| Kind | Filename | Produced by | Consumed by |
| --- | --- | --- | --- |
| **Candidates** | `*-candidates.jsonl` | `scripts/export-eval-datasets.ts` (`bun run eval:export`) and `scripts/langsmith/export-edit-captures.ts` (`*-golden.candidates.jsonl`) | human curation |
| **Golden** | `extractions-golden.jsonl`, `hypotheses-golden.jsonl`, `recipes-golden.jsonl`, `weekly-briefs-golden.jsonl` | **human curation** of candidates | `scripts/langsmith/upload-datasets.ts` |

## Flow

1. `bun run eval:export` (or `export-edit-captures.ts`) proposes candidate rows
   meeting the quality criteria in `docs/agent-tool-surface.md`.
2. **Human curates** candidates into the plural `*-golden.jsonl` files —
   target ≥15 extraction, ≥15 hypothesis, ≥10 recipe, ≥6 brief rows.
3. `bun scripts/langsmith/upload-datasets.ts` pushes golden files into LangSmith
   as `resonant-{extractions,hypotheses,recipes,weekly-briefs}-golden`.

## Row shape

`upload-datasets-lib.ts` reads **flat** rows (input + output keys at the top
level, per `pickKeys`), not the nested `{inputs, outputs, metadata}` shape. Keep
curated golden rows flat. See `upload-datasets.ts` for the exact input/output
keys per dataset.

## Privacy

Extraction golden rows include `rawText` (evals are meaningless without source
text), so treat this directory as **private** research data. Do not publish raw
source text if the repo becomes public.
