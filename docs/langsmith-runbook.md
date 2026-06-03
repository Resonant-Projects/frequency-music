# LangSmith Runbook

## What's wired

- **Agent runtime** (`agent/`): LangGraph dev server boots from `agent/src/agents/weekly-brief/index.ts` and traces automatically when `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` are set in `agent/.env`. Default project: `resonant-projects-agent-dev`.
- **Convex extraction**: `convex/extract.ts` wraps `generateText` in `tracedGenerate("extract_v2", ...)` from `convex/tracing.ts`. Traces emit when `LANGSMITH_TRACING=true` on the Convex deployment. Default project: `resonant-projects-prod`.

## What's NOT yet wired

- `convex/hypotheses.ts`, `convex/recipes.ts`, `convex/weeklyBriefs.ts` still call `generateText` without `tracedGenerate`. Each requires the same `internalMutation` / `query` split that `convex/extract.ts` / `convex/extractInternal.ts` already follow before adding `"use node"` and importing `./tracing`. This is `Task 2` of `planning/langchain/2026-05-14-langsmith-integration.md`.

## Files

| Path | Role |
| --- | --- |
| `convex/tracing.ts` | `tracedGenerate` wrapper. `"use node"` because `langsmith/traceable` uses `node:async_hooks`. |
| `convex/extractInternal.ts` | Holds `storeExtraction` mutation (V8 runtime). |
| `convex/extract.ts` | Actions only, runs in Node runtime. Wraps the extract `generateText` call. |
| `scripts/langsmith/upload-datasets.ts` | Pushes `data/eval/*-golden.jsonl` into LangSmith Datasets. |
| `scripts/langsmith/evaluators/*.ts` | Schema, why-this-matters, parameter-specificity. |
| `scripts/langsmith/eval-*.ts` | Experiment runners. Need golden datasets in LangSmith before they produce useful output. |

## How to run

### Agent (LangGraph dev server)

```bash
cd agent
cp .env.example .env       # then fill in keys
npm install                 # npm only inside agent/, project-wide is bun
npx @langchain/langgraph-cli dev --port 2024
```

The `agent/` workspace intentionally uses npm/npx because it maintains `agent/package-lock.json` and `agent/README.md` documents npm setup.

Open `http://localhost:2024/ok` to confirm health; open the LangSmith Studio link printed by the dev server (or hit the API directly with `curl http://localhost:2024/assistants/search -X POST -d '{}' -H 'Content-Type: application/json'`).

### Convex traces

Already on once `LANGSMITH_*` env vars are set on the deployment. Trigger:

```bash
bunx convex run extract:extractAllReady '{"limit": 1, "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'
```

A trace named `extract_v2` should appear in LangSmith → `resonant-projects-prod` within ~30 seconds.

### Eval experiments

```bash
# 1. Hand-curate golden rows into data/eval/*-golden.jsonl
# 2. Push them to LangSmith
bun scripts/langsmith/upload-datasets.ts
# 3. Run an experiment
bun scripts/langsmith/eval-extraction.ts --version v2
bun scripts/langsmith/eval-hypothesis.ts --version v1
```

## Decision rubric for shipping a prompt change

Run the relevant `eval-*.ts` against the candidate prompt version. Ship when it equals or beats the current version on every evaluator on ≥80% of rows. LLM-as-judge scores are noisy — re-run twice and require both to pass.

## Cost guardrail

If LangSmith spend grows, enable sampling via `LANGSMITH_SAMPLING_RATE=0.1` (one in ten traces). Set on both Convex and `agent/.env`.
