# LangSmith Runbook

## What's wired

- **Agent runtime** (`agent/`): LangGraph dev server boots from `agent/src/agents/weekly-brief/index.ts` and traces automatically when `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` are set in `agent/.env`. Default project: `resonant-projects-agent-dev`.
- **Convex extraction**: `convex/extract.ts` wraps `generateText` in `tracedGenerate("extract_v2", ...)` from `convex/tracing.ts`. Traces emit when `LANGSMITH_TRACING=true` on the Convex deployment. Default project: `resonant-projects-prod`.
- **Convex hypothesis generation**: `convex/hypotheses.ts` `generateFromExtraction` delegates its AI call to `internal.hypothesesInternal.generateHypothesisText` (a `"use node"` internal action) wrapping `tracedGenerate("hypothesis_v1", ...)`.
- **Convex recipe generation**: `convex/recipes.ts` `generateFromHypothesis` delegates to `internal.recipesInternal.generateRecipeText` wrapping `tracedGenerate("recipe_v1", ...)`.
- **Convex weekly brief**: `convex/weeklyBriefs.ts` `generateBriefCore` reads context via the `loadBriefContext` internalQuery (actions have no `ctx.db`) and delegates the AI call to `internal.weeklyBriefsInternal.generateBriefText` wrapping `tracedGenerate("brief_v2.phase3", ...)`.
- **Codex SDK** (`agent/`): non-tool calls route through `withFallback(codex, openrouter)`; `codexSdk.ts` wraps `thread.run` in `traceable("codex_sdk.run", ...)` guarded by `LANGSMITH_TRACING`.

## What's NOT yet wired

All four Convex AI call sites (`extract_v2`, `hypothesis_v1`, `recipe_v1`, `brief_v2.phase3`) plus the Codex SDK are traced. Verify a full pipeline run shows all four trace names in `resonant-projects-prod`, and that `LANGSMITH_TRACING=false` yields clean no-trace operation.

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
vpx convex run extract:extractAllReady '{"limit": 1, "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'
```

A trace named `extract_v2` should appear in LangSmith → `resonant-projects-prod` within ~30 seconds.

### Eval experiments

```bash
# 1. Hand-curate golden rows into data/eval/*-golden.jsonl
# 2. Push them to LangSmith
vpx tsx scripts/langsmith/upload-datasets.ts
# 3. Run an experiment
vpx tsx scripts/langsmith/eval-extraction.ts --version v2
vpx tsx scripts/langsmith/eval-hypothesis.ts --version v1
```

## Decision rubric for shipping a prompt change

Run the relevant `eval-*.ts` against the candidate prompt version. Ship when it equals or beats the current version on every evaluator on ≥80% of rows. LLM-as-judge scores are noisy — re-run twice and require both to pass.

## Cost guardrail

If LangSmith spend grows, enable sampling via `LANGSMITH_SAMPLING_RATE=0.1` (one in ten traces). Set on both Convex and `agent/.env`.
