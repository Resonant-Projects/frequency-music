# LangSmith Integration: Observability and Evaluation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LangSmith tracing across the existing Convex AI pipeline (extraction, hypothesis generation, recipe generation, weekly briefs) and stand up an evaluation harness on top of it so prompt changes can be compared against a golden dataset before they ship.

**Why first:** This is the lower-risk LangChain integration. It does not change the runtime architecture. It wraps the calls already happening and starts producing data the next plan (LangGraph Deep Agents) will need to justify itself.

**Prerequisites:**

- Complete `docs/superpowers/plans/2026-05-14-langchain-integration-prep.md` first. This plan assumes `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, and `LANGSMITH_TRACING` are set in the Convex deployment, and that `data/eval/*-golden.jsonl` exist.

**Tech Stack:** Bun, Convex actions, AI SDK + OpenRouter, `langsmith` JS SDK (new), `evaluate` from `langsmith/evaluation`.

---

## Architecture summary

Three layers, added in order:

1. **Tracing layer.** Wrap every `generateText` call already in `convex/extract.ts`, `convex/hypotheses.ts`, `convex/recipes.ts`, and `convex/weeklyBriefs.ts` with `traceable()`. The Convex action keeps its current return shape. The agent runtime is unchanged. Every LLM call now produces a trace in LangSmith.

2. **Dataset layer.** Push the golden JSONL files from prep into LangSmith as Datasets. Each dataset row stores the input (e.g. source text) and a reference output (the golden extraction).

3. **Evaluation layer.** Define `langsmith/evaluation` evaluators that score each new generation against the dataset: schema validity, presence of `whyThisMatters`, parameter specificity, evidence-level distribution, and an LLM-as-judge that compares the new output to the golden reference.

Once these three are in place, every prompt change becomes an experiment: change the prompt, run `evaluate(...)` over the dataset, compare scores against the previous prompt version on the same dataset.

---

## File Structure

### frequency-music repo

| Action | Path                                          | Responsibility                                                              |
| ------ | --------------------------------------------- | --------------------------------------------------------------------------- |
| Create | `convex/tracing.ts`                           | LangSmith tracing helpers; conditional on `LANGSMITH_TRACING`               |
| Modify | `convex/extract.ts`                           | Wrap `generateText` call in `traceable`                                     |
| Modify | `convex/hypotheses.ts`                        | Same                                                                        |
| Modify | `convex/recipes.ts`                           | Same                                                                        |
| Modify | `convex/weeklyBriefs.ts`                      | Same                                                                        |
| Create | `scripts/langsmith/upload-datasets.ts`        | Push golden JSONL into LangSmith Datasets                                   |
| Create | `scripts/langsmith/eval-extraction.ts`        | Run evaluator suite over the extraction dataset                             |
| Create | `scripts/langsmith/eval-hypothesis.ts`        | Same for hypotheses                                                         |
| Create | `scripts/langsmith/eval-weekly-brief.ts`      | Same for briefs                                                             |
| Create | `scripts/langsmith/evaluators/`               | Folder of reusable evaluator definitions                                    |
| Create | `scripts/langsmith/evaluators/schema.ts`      | Code evaluator: output parses against the expected validator                |
| Create | `scripts/langsmith/evaluators/why-matters.ts` | Code evaluator: `whyThisMatters` exists and is non-trivial                  |
| Create | `scripts/langsmith/evaluators/judge.ts`       | LLM-as-judge evaluator: compares new output to golden reference             |
| Create | `docs/langsmith-runbook.md`                   | How to run evals, read results, decide whether to ship a prompt change      |
| Modify | `package.json`                                | Add `langsmith` dependency                                                  |
| Modify | `CLAUDE.md`                                   | Add a "Tracing and Evaluation" section pointing at the runbook              |

---

## Task 1: Install and Smoke-Test LangSmith Tracing

Smallest possible change that produces a trace. Confirm everything works end to end before wrapping all four files.

### Step 1: Install the SDK

- [ ] Add the dependency:

  ```bash
  bun add langsmith
  ```

  Expected: `package.json` shows `langsmith` in `dependencies`. Pin to a known version after testing.

### Step 2: Create the tracing helper

- [ ] Create `convex/tracing.ts`:

  ```typescript
  // convex/tracing.ts
  import { traceable } from "langsmith/traceable";

  /**
   * Wrap an async function with LangSmith tracing when LANGSMITH_TRACING=true.
   * If tracing is disabled or misconfigured, fall through with no overhead.
   *
   * Naming: pass a stable `name` per prompt version so traces are queryable.
   * Example: tracedGenerate("extract_v1", () => generateText({...}))
   */
  export function tracedGenerate<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    if (process.env.LANGSMITH_TRACING !== "true") {
      return fn();
    }
    try {
      const wrapped = traceable(fn, { name, metadata });
      return wrapped();
    } catch (e) {
      // Tracing must never break the underlying action. Drop on error.
      console.warn(`[langsmith] trace setup failed for ${name}:`, e);
      return fn();
    }
  }
  ```

  Reasons for this shape:

  - One choke point so every AI call gets traced the same way.
  - Guard prevents tracing from ever breaking a production extraction.
  - `metadata` lets us pass `sourceId`, `model`, `promptVersion` into the trace for filtering later.

### Step 3: Wrap one call as a proof of concept

- [ ] Modify `convex/extract.ts` to wrap the existing `generateText` call:

  ```typescript
  import { tracedGenerate } from "./tracing";

  // ... existing code ...

  const result = await tracedGenerate(
    `extract_${promptVersion}`,
    () =>
      generateText({
        model: getModel(modelId),
        system: EXTRACT_SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 3000,
      }),
    {
      sourceId: args.sourceId,
      sourceType: source.type,
      model: modelId,
      promptVersion,
    },
  );
  ```

  Do **not** touch `convex/hypotheses.ts`, `convex/recipes.ts`, or `convex/weeklyBriefs.ts` yet. We want to confirm the trace fires before duplicating the change.

### Step 4: Trigger an extraction and confirm the trace

- [ ] Run a single extraction:

  ```bash
  bunx convex run workflows:startBatchExtraction '{"limit": 1}'
  ```

- [ ] Open https://smith.langchain.com → project `resonant-projects-prod`.

  Expected: A trace named `extract_v1` (or whatever promptVersion is) appears within ~30 seconds. Drill in. Confirm:

  - System and user prompts are visible.
  - Output text is visible.
  - Metadata shows `sourceId`, `sourceType`, `model`, `promptVersion`.

### Step 5: Confirm tracing-disabled path works

- [ ] Locally set `LANGSMITH_TRACING=false`, run another extraction. Confirm it completes normally and no trace appears.

### Step 6: Commit

- [ ] Commit:

  ```bash
  git add convex/tracing.ts convex/extract.ts package.json bun.lock
  git commit -m "feat(tracing): add LangSmith tracing for extraction"
  ```

---

## Task 2: Wrap the Remaining Three Generation Sites

Now that tracing works, apply the same pattern to the other AI call sites.

### Step 1: `convex/hypotheses.ts`

- [ ] Wrap the `generateText` call in `generateFromExtraction` with `tracedGenerate("hypothesis_v1", ...)`. Pass metadata `{ extractionId, sourceId, model, promptVersion }`.

### Step 2: `convex/recipes.ts`

- [ ] Wrap the `generateText` call in `generateFromHypothesis` with `tracedGenerate("recipe_v1", ...)`. Pass metadata `{ hypothesisId, model, promptVersion }`.

### Step 3: `convex/weeklyBriefs.ts`

- [ ] Wrap the `generateText` call in `generateBriefCore` with `tracedGenerate("brief_v2.phase3", ...)`. Pass metadata `{ weekOf, model, promptVersion, numHypotheses, numRecipes, campaignId }`.

### Step 4: Run end-to-end smoke test

- [ ] Run the full pipeline against one source:

  ```bash
  bunx convex run workflows:startFullPipeline '{"extractLimit": 1, "hypothesisLimit": 1}'
  ```

- [ ] In LangSmith confirm three traces: `extract_v1`, `hypothesis_v1`, `recipe_v1`. Each should show the metadata for its layer.

### Step 5: Commit

- [ ] Commit:

  ```bash
  git add convex/hypotheses.ts convex/recipes.ts convex/weeklyBriefs.ts
  git commit -m "feat(tracing): wrap hypothesis, recipe, and brief generation"
  ```

---

## Task 3: Upload Golden Datasets to LangSmith

The golden JSONL files from the prep plan need to live in LangSmith so experiments can reference them.

### Step 1: Write the upload script

- [ ] Create `scripts/langsmith/upload-datasets.ts`:

  ```typescript
  #!/usr/bin/env bun
  /**
   * Push golden JSONL datasets into LangSmith.
   * Idempotent: skips datasets that already exist with the same example count.
   */
  import { readFile } from "node:fs/promises";
  import { Client } from "langsmith";

  const client = new Client();

  interface Dataset {
    name: string;
    description: string;
    path: string;
    inputKeys: string[];
    outputKeys: string[];
  }

  const DATASETS: Dataset[] = [
    {
      name: "resonant-extractions-golden",
      description: "Hand-curated good extractions, used to score extract_* prompts.",
      path: "data/eval/extractions-golden.jsonl",
      inputKeys: ["sourceTitle", "sourceType", "rawText"],
      outputKeys: ["summary", "claims", "compositionParameters", "topics", "openQuestions"],
    },
    {
      name: "resonant-hypotheses-golden",
      description: "Hypotheses with strong whyThisMatters, used to score hypothesis_* prompts.",
      path: "data/eval/hypotheses-golden.jsonl",
      inputKeys: ["sourceTitle", "claims", "compositionParameters", "topics"],
      outputKeys: ["title", "question", "hypothesis", "whyThisMatters", "rationaleMd"],
    },
    {
      name: "resonant-weekly-briefs-golden",
      description: "Strong weekly briefs that surface theses and contradictions.",
      path: "data/eval/weekly-briefs-golden.jsonl",
      inputKeys: ["weekOf", "hypotheses", "recipes", "theses", "failures"],
      outputKeys: ["bodyMd", "studioPrompts", "todo"],
    },
  ];

  for (const ds of DATASETS) {
    const lines = (await readFile(ds.path, "utf8")).trim().split("\n").filter(Boolean);
    const rows = lines.map((l) => JSON.parse(l));

    let dataset;
    try {
      dataset = await client.readDataset({ datasetName: ds.name });
      console.log(`Found existing dataset: ${ds.name}`);
    } catch {
      dataset = await client.createDataset(ds.name, { description: ds.description });
      console.log(`Created dataset: ${ds.name}`);
    }

    const existing = [];
    for await (const ex of client.listExamples({ datasetId: dataset.id })) {
      existing.push(ex);
    }
    if (existing.length >= rows.length) {
      console.log(`  ${ds.name}: already has ${existing.length} examples, skipping`);
      continue;
    }

    for (const row of rows) {
      const inputs = Object.fromEntries(ds.inputKeys.map((k) => [k, row[k]]));
      const outputs = Object.fromEntries(ds.outputKeys.map((k) => [k, row[k]]));
      await client.createExample(inputs, outputs, { datasetId: dataset.id });
    }
    console.log(`  ${ds.name}: uploaded ${rows.length} examples`);
  }
  ```

### Step 2: Run upload

- [ ] Run:

  ```bash
  LANGSMITH_API_KEY=$LANGSMITH_API_KEY bun scripts/langsmith/upload-datasets.ts
  ```

  Expected: three datasets exist in LangSmith with the right example counts.

### Step 3: Verify in the UI

- [ ] Visit the LangSmith UI → Datasets. Confirm:
  - All three datasets are present.
  - Each row has the expected input and reference output fields.
  - No truncation of long `rawText` fields (LangSmith does not currently limit example size for our row sizes; confirm).

### Step 4: Commit

- [ ] Commit:

  ```bash
  git add scripts/langsmith/upload-datasets.ts
  git commit -m "tools(langsmith): add script to push golden datasets"
  ```

---

## Task 4: Evaluators

The evaluators decide what "better" means. Three styles, in increasing cost:

- **Schema evaluators** (free): does the output parse against the validator?
- **Heuristic evaluators** (free): does it satisfy basic structural criteria like "whyThisMatters is non-empty and > 20 chars"?
- **LLM-as-judge evaluators** (paid): does it match the reference output on a rubric?

### Step 1: Schema evaluator

- [ ] Create `scripts/langsmith/evaluators/schema.ts`:

  ```typescript
  import type { Run, Example } from "langsmith";
  import { claimValidator, compositionParameterValidator } from "../../../convex/validators";

  export const extractionSchemaEvaluator = (run: Run, _example: Example) => {
    const output = run.outputs as any;
    if (!output) return { key: "schema_valid", score: 0, comment: "no output" };
    try {
      if (typeof output.summary !== "string") throw new Error("summary missing");
      if (!Array.isArray(output.claims)) throw new Error("claims missing");
      for (const c of output.claims) claimValidator.parse?.(c); // depending on validator export
      for (const p of output.compositionParameters)
        compositionParameterValidator.parse?.(p);
      return { key: "schema_valid", score: 1 };
    } catch (e) {
      return { key: "schema_valid", score: 0, comment: (e as Error).message };
    }
  };
  ```

  Note: Convex validators are not Zod by default. Either re-derive the shape with Zod here, or write a hand-rolled checker that mirrors the validator. Hand-rolled is fine for this scope.

### Step 2: `whyThisMatters` evaluator

- [ ] Create `scripts/langsmith/evaluators/why-matters.ts`:

  ```typescript
  import type { Run, Example } from "langsmith";

  // Tokens that suggest musical/perceptual stakes rather than meta-commentary.
  const STAKE_HINTS = [
    "sound", "listen", "perceiv", "feel", "harm", "rhythm", "tempo",
    "key", "tuning", "interval", "frequency", "timbre", "compose",
    "studio", "ear",
  ];

  export const whyThisMattersEvaluator = (run: Run, _example: Example) => {
    const w = (run.outputs as any)?.whyThisMatters;
    if (typeof w !== "string" || w.trim().length < 20) {
      return { key: "why_this_matters", score: 0, comment: "missing or too short" };
    }
    const hits = STAKE_HINTS.filter((h) => w.toLowerCase().includes(h)).length;
    return {
      key: "why_this_matters",
      score: hits >= 2 ? 1 : hits >= 1 ? 0.5 : 0,
      comment: `${hits} stake hints`,
    };
  };
  ```

  This is intentionally crude. It catches the most common failure mode: model outputs `whyThisMatters` as "This is an interesting question that deserves exploration" which contains no actual musical stake. A 0/0.5/1 score is fine — better evaluators come later if needed.

### Step 3: Parameter-specificity evaluator

- [ ] Create `scripts/langsmith/evaluators/parameter-specificity.ts`:

  ```typescript
  import type { Run, Example } from "langsmith";

  // A parameter is "specific" if its value contains digits or a unit token.
  const UNIT_TOKENS = ["hz", "bpm", "cents", "ratio", "tet", ":", "/", "°"];

  export const parameterSpecificityEvaluator = (run: Run, _example: Example) => {
    const params = (run.outputs as any)?.compositionParameters;
    if (!Array.isArray(params) || params.length === 0) {
      return { key: "parameter_specificity", score: 0, comment: "no parameters" };
    }
    const specific = params.filter((p: any) => {
      const v = String(p.value || "").toLowerCase();
      return /\d/.test(v) || UNIT_TOKENS.some((t) => v.includes(t));
    });
    const ratio = specific.length / params.length;
    return {
      key: "parameter_specificity",
      score: ratio,
      comment: `${specific.length}/${params.length} specific`,
    };
  };
  ```

### Step 4: LLM-as-judge evaluator

- [ ] Create `scripts/langsmith/evaluators/judge.ts`:

  ```typescript
  import type { Run, Example } from "langsmith";
  import { createOpenRouter } from "@openrouter/ai-sdk-provider";
  import { generateText } from "ai";

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

  const RUBRIC = `You are evaluating a hypothesis generated from a research source.

Score from 0 to 1 on:
1. CONNECTS_TO_CLAIMS: Does the hypothesis trace back to specific source claims?
2. SPECIFIC_MUSICAL_PARAMETERS: Does it propose concrete things to change (frequencies, tempos, tunings)?
3. NAMES_A_STAKE: Does whyThisMatters name a felt musical or perceptual consequence?

Respond ONLY with JSON: {"connects_to_claims": 0..1, "specific_musical_parameters": 0..1, "names_a_stake": 0..1, "comment": "..."}`;

  export const hypothesisJudgeEvaluator = async (run: Run, example: Example) => {
    const generated = run.outputs as any;
    const reference = example.outputs as any;

    const prompt = `Reference (golden) hypothesis:
${JSON.stringify(reference, null, 2)}

Generated hypothesis being evaluated:
${JSON.stringify(generated, null, 2)}

${RUBRIC}`;

    const { text } = await generateText({
      model: openrouter("anthropic/claude-3-5-haiku-20241022"),
      prompt,
      maxOutputTokens: 400,
    });

    try {
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      const avg =
        (parsed.connects_to_claims + parsed.specific_musical_parameters + parsed.names_a_stake) /
        3;
      return { key: "judge_hypothesis", score: avg, comment: parsed.comment };
    } catch {
      return { key: "judge_hypothesis", score: 0, comment: "parse failure" };
    }
  };
  ```

  Use Haiku not Sonnet to keep judge cost low. The rubric is intentionally short to keep token count down.

### Step 5: Commit

- [ ] Commit:

  ```bash
  git add scripts/langsmith/evaluators/
  git commit -m "feat(eval): add schema, heuristic, and LLM-as-judge evaluators"
  ```

---

## Task 5: Evaluation Runners

One runner per artifact type. Each runs the target function against the dataset and applies the evaluators.

### Step 1: Hypothesis runner

- [ ] Create `scripts/langsmith/eval-hypothesis.ts`:

  ```typescript
  #!/usr/bin/env bun
  /**
   * Run an experiment over the hypotheses-golden dataset.
   * Compares a candidate prompt version against the golden references.
   *
   * Usage:
   *   bun scripts/langsmith/eval-hypothesis.ts --version v1
   *   bun scripts/langsmith/eval-hypothesis.ts --version v2-experimental
   */
  import { evaluate } from "langsmith/evaluation";
  import { createOpenRouter } from "@openrouter/ai-sdk-provider";
  import { generateText } from "ai";
  import { whyThisMattersEvaluator } from "./evaluators/why-matters";
  import { parameterSpecificityEvaluator } from "./evaluators/parameter-specificity";
  import { hypothesisJudgeEvaluator } from "./evaluators/judge";

  // Read prompt versions from the same source the Convex code uses to keep them in sync.
  // For now, inline the prompt with a version flag; refactor to a shared module later.
  const PROMPTS: Record<string, { system: string; user: (input: any) => string }> = {
    v1: {
      system: `You are a research synthesis assistant...`,
      user: (input) => `Source: ${input.sourceTitle}\nClaims: ${JSON.stringify(input.claims)}\n...`,
    },
    "v2-experimental": {
      system: `... revised prompt ...`,
      user: (input) => `...`,
    },
  };

  const version = process.argv[process.argv.indexOf("--version") + 1] ?? "v1";
  const prompt = PROMPTS[version];
  if (!prompt) throw new Error(`Unknown prompt version: ${version}`);

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

  await evaluate(
    async (input) => {
      const { text } = await generateText({
        model: openrouter("anthropic/claude-sonnet-4-6"),
        system: prompt.system,
        prompt: prompt.user(input),
        maxOutputTokens: 2000,
      });
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : {};
    },
    {
      data: "resonant-hypotheses-golden",
      evaluators: [
        whyThisMattersEvaluator,
        parameterSpecificityEvaluator,
        hypothesisJudgeEvaluator,
      ],
      experimentPrefix: `hypothesis-${version}`,
      metadata: { promptVersion: version },
    },
  );
  ```

### Step 2: Extraction runner

- [ ] Create `scripts/langsmith/eval-extraction.ts` with the same shape, using extraction prompts and the extraction evaluators (schema + parameter specificity).

### Step 3: Weekly brief runner

- [ ] Create `scripts/langsmith/eval-weekly-brief.ts`. Brief evaluators are looser since briefs are markdown-heavy. Recommended initial evaluators:

  - Heuristic: contains "Active Theses", "Contradictions", and 3+ experiment cards (`### Experiment` markers).
  - LLM-as-judge: scores whether the brief surfaces stakes and recommends concrete next actions.

### Step 4: Smoke-test all three runners

- [ ] Run each runner against the current prompt version `v1`:

  ```bash
  bun scripts/langsmith/eval-extraction.ts --version v1
  bun scripts/langsmith/eval-hypothesis.ts --version v1
  bun scripts/langsmith/eval-weekly-brief.ts --version v2.phase3
  ```

  Expected: three experiments visible in LangSmith → Experiments. Each row shows the dataset input, the new generation, and a score per evaluator.

### Step 5: Commit

- [ ] Commit:

  ```bash
  git add scripts/langsmith/eval-extraction.ts scripts/langsmith/eval-hypothesis.ts scripts/langsmith/eval-weekly-brief.ts
  git commit -m "feat(eval): add experiment runners for extraction, hypothesis, weekly brief"
  ```

---

## Task 6: Runbook

Capture the workflow so future-Keith (or a collaborator) knows what to do.

### Step 1: Write `docs/langsmith-runbook.md`

- [ ] Create `docs/langsmith-runbook.md` covering:

  - **How to view production traces.** Filter by metadata fields (`sourceId`, `promptVersion`). Save common filters as Views.
  - **How to add a new evaluator.** Step-by-step from a new `.ts` file in `evaluators/` to passing it in the runner.
  - **How to test a prompt change.** Add a new entry in the `PROMPTS` map of the relevant runner, run with `--version newName`, compare experiments in the LangSmith UI side-by-side.
  - **When to ship a new prompt.** Decision rubric: experiment must equal or beat the current version on every evaluator on at least 80% of dataset rows. Note that LLM-as-judge scores have noise — re-run twice and require both to pass.
  - **Cost guardrails.** What to do if the LangSmith monthly cost grows out of band; how to throttle traces with sampling (`langsmith` supports per-trace sampling rates).

### Step 2: Update CLAUDE.md

- [ ] Add a short "Tracing and Evaluation" section pointing at the runbook.

### Step 3: Commit

- [ ] Commit:

  ```bash
  git add docs/langsmith-runbook.md CLAUDE.md
  git commit -m "docs: add LangSmith runbook"
  ```

---

## Task 7: Monitoring and Alerts (Optional, Low-Effort)

Worth doing while the LangSmith data is fresh.

### Step 1: Set up cost dashboard

- [ ] In LangSmith → Monitor → Dashboards: pin a dashboard showing daily token spend, broken down by `promptVersion` metadata.

### Step 2: Add an error-rate alert

- [ ] LangSmith → Alerts: create an alert that fires when extraction trace error rate exceeds 10% over 1 hour. Wire it to email (the project does not yet have a Slack channel for this).

### Step 3: Trace sampling for cost control (deferred unless needed)

- [ ] If trace volume becomes expensive, the `langsmith` SDK supports `LANGSMITH_SAMPLING_RATE`. Document the threshold for enabling this in the runbook but do not enable yet.

---

## Definition of Done

- [ ] All four AI call sites in Convex are wrapped with `tracedGenerate`.
- [ ] Three golden datasets exist in LangSmith with > 15, > 10, and > 3 examples respectively.
- [ ] Three runner scripts produce experiments in LangSmith.
- [ ] Three evaluator types (schema, heuristic, LLM-as-judge) are implemented and used by at least one runner each.
- [ ] `docs/langsmith-runbook.md` exists and is referenced from `CLAUDE.md`.
- [ ] A cost dashboard and an error-rate alert exist in LangSmith.
- [ ] At least one prompt-version comparison has been run end to end (even if both versions are identical for sanity).

---

## Notes for Reviewers

- The PROMPTS map in each runner is duplicated from Convex source. This is the single hand-maintained piece that links the runner to the production prompt. Plan to factor out into a shared `prompts/` module once two runners agree on the right abstraction — not before, to avoid premature abstraction.
- LLM-as-judge evaluators add real cost. Disable them in PR-time checks; reserve them for explicit "should we ship this prompt" evaluations.
- Tracing failures must never break user-facing actions. The `tracedGenerate` helper enforces this with a try/catch around the wrapping. If you discover a path that violates it, fix the helper, not the call site.
- The eval scripts use `process.env.OPENROUTER_API_KEY` directly. They are intended to run from a dev machine, not from Convex. Do not promote them to Convex actions — that would mix production data flow with experiment runs.
