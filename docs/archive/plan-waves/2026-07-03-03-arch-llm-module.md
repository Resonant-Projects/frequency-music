# Shared LLM-Call Module (Generator Core) Implementation Plan
> Landed: 83f74f7 (2026-07-09)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One deep LLM-call module behind the four generators (extraction, hypothesis, recipe, weekly brief) — provider routing, best-effort tracing, token budgets, and JSON extraction live once instead of four diverging copies.

**Architecture:** Two new files. `convex/llm.ts` is a pure module (importable from V8 files) holding model constants, token budgets, and `extractJsonObject`. `convex/llmNode.ts` is a `"use node"` helper holding `generateLlmText`/`generateJson`, which wrap provider boot + `tracedGenerate` + `generateText`. The four node entry files (`extract.ts`, `hypothesesInternal.ts`, `recipesInternal.ts`, `weeklyBriefsInternal.ts`) collapse to thin callers; V8-side parse sites in `hypotheses.ts`/`recipes.ts` switch to `extractJsonObject`. Each generator keeps its own prompt building and domain validation — depth lives behind the module's small interface.

**Tech Stack:** Bun, Convex (self-hosted), AI SDK v6 (`ai`), `@openrouter/ai-sdk-provider`, `@ai-sdk/groq`, LangSmith (`langsmith/traceable` via existing `convex/tracing.ts`).

## Global Constraints

- Runtime: Bun (`bun test`, `bunx convex codegen`). Never `node`/`npx`.
- `bunx convex codegen` is the Convex typegate **and pushes to the live self-hosted deployment**. A TypeScript error means nothing deploys (fail-safe), but never commit a state where codegen fails — run it before every commit in this plan.
- Convex runtime rule: files without `"use node"` may NOT import files with `"use node"`. `convex/tracing.ts` has `"use node"`, therefore `convex/llmNode.ts` MUST also start with `"use node"`. V8 files (`hypotheses.ts`, `recipes.ts`, `weeklyBriefs.ts`) may only import `./llm`, never `./llmNode`.
- `"use node"` files may contain actions and plain helpers, never queries/mutations (existing precedent: `tracing.ts` is a node-marked helper-only file).
- Tracing must remain best-effort (decision log 2026-05-16). `tracedGenerate` (convex/tracing.ts:9-18) already no-ops when `LANGSMITH_TRACING !== "true"` and catches trace-setup failures with a `console.warn` fallback. Do not change tracing.ts; do not add failure paths that couple generation success to tracing.
- The LangSmith trace name for weekly briefs is `"brief_v2.phase3"` (eval baselines reference it). The token-budget key is `brief_v2`. These differ by design — `traceName` overrides `task` for tracing only.
- Preserve the return validator `v.object({ text: v.string() })` on all three delegating internal actions — parse stays V8-side, exactly where it is today.
- `parseBriefResponse` (weeklyBriefs.ts:244) is NOT migrated to `extractJsonObject`: its contract is fenced-optional and non-throwing (missing JSON block → default studio prompts), and `extractJsonObject`'s bare-brace fallback would misparse markdown brief bodies. It stays as-is.
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Pure module `convex/llm.ts` (constants + `extractJsonObject`), TDD

**Files:**
- Create: `convex/llm.ts`
- Test: `convex/llm.test.ts`

**Interfaces:**
- Consumes: nothing (pure, zero imports).
- Produces (later tasks rely on these exact names):
  - `DEFAULT_MODEL: "anthropic/claude-sonnet-4-6"`
  - `MODELS` (the table currently at extract.ts:19-32, moved verbatim)
  - `TOKEN_BUDGETS: { extract_v2: 4096; hypothesis_v1: 2000; recipe_v1: 3000; brief_v2: 4000 }`
  - `type LlmTask = keyof typeof TOKEN_BUDGETS`
  - `isGroqModel(model: string): boolean`
  - `extractJsonObject(text: string): unknown`

- [ ] **Step 1: Write the failing test**

Create `convex/llm.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { DEFAULT_MODEL, extractJsonObject, isGroqModel, TOKEN_BUDGETS } from "./llm";

describe("llm constants", () => {
  test("default model and budgets match the values the four generators used", () => {
    expect(DEFAULT_MODEL).toBe("anthropic/claude-sonnet-4-6");
    expect(TOKEN_BUDGETS.extract_v2).toBe(4096);
    expect(TOKEN_BUDGETS.hypothesis_v1).toBe(2000);
    expect(TOKEN_BUDGETS.recipe_v1).toBe(3000);
    expect(TOKEN_BUDGETS.brief_v2).toBe(4000);
  });

  test("isGroqModel routes on the groq/ prefix", () => {
    expect(isGroqModel("groq/moonshotai/kimi-k2-instruct")).toBe(true);
    expect(isGroqModel("anthropic/claude-sonnet-4-6")).toBe(false);
  });
});

describe("extractJsonObject", () => {
  test("parses a fenced ```json block", () => {
    const text = 'Here you go:\n```json\n{ "a": 1 }\n```\nDone.';
    expect(extractJsonObject(text)).toEqual({ a: 1 });
  });

  test("parses a bare JSON object (first { to last })", () => {
    const text = 'Sure: { "a": { "b": 2 } } trailing prose without braces';
    expect(extractJsonObject(text)).toEqual({ a: { b: 2 } });
  });

  test("prefers the fenced block over surrounding braces in prose", () => {
    const text = 'Context {irrelevant} then\n```json\n{ "picked": true }\n```\nand {more}';
    expect(extractJsonObject(text)).toEqual({ picked: true });
  });

  test("throws when no JSON object is present", () => {
    expect(() => extractJsonObject("no json here at all")).toThrow(
      "No JSON object found in model response",
    );
  });

  test("throws on invalid JSON with a snippet in the message", () => {
    expect(() => extractJsonObject('```json\n{ "a": oops }\n```')).toThrow(/Invalid JSON/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test convex/llm.test.ts`
Expected: FAIL — `Cannot find module './llm'` (or equivalent resolution error).

- [ ] **Step 3: Write the implementation**

Create `convex/llm.ts`:

```typescript
// Pure LLM configuration + parsing shared by all four generators.
// No "use node" and no node-only imports — this file must stay importable
// from V8 modules (hypotheses.ts, recipes.ts, weeklyBriefs.ts).
// The node-side generation half lives in llmNode.ts.

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

// Available models for different use cases (moved verbatim from extract.ts).
export const MODELS = {
  // === GROQ (fast, cheap) ===
  fast: "groq/moonshotai/kimi-k2-instruct",
  kimi: "groq/moonshotai/kimi-k2-instruct",

  // === OpenRouter (model variety) ===
  default: "anthropic/claude-sonnet-4-6",
  quality: "anthropic/claude-sonnet-4-6",
  haiku: "anthropic/claude-3-5-haiku-20241022",
  gemini: "google/gemini-2.5-flash",
  gpt4: "openai/gpt-4o",
  deepseek: "deepseek/deepseek-chat-v3-0324",
  grok: "x-ai/grok-3-mini-beta",
} as const;

// One visible table instead of four magic numbers buried in generator bodies.
export const TOKEN_BUDGETS = {
  extract_v2: 4096,
  hypothesis_v1: 2000,
  recipe_v1: 3000,
  brief_v2: 4000,
} as const;

export type LlmTask = keyof typeof TOKEN_BUDGETS;

export function isGroqModel(model: string): boolean {
  return model.startsWith("groq/");
}

/**
 * Extract a JSON object from model output. Tries a fenced ```json block
 * first; falls back to the widest bare {...} span (first "{" to last "}",
 * matching the historical V8-side regex). Throws if neither is present or
 * the candidate is not valid JSON — callers that need lenient/defaulting
 * behaviour (parseBriefResponse) keep their own extraction.
 */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
  const candidate = fenced?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) {
    throw new Error("No JSON object found in model response");
  }
  try {
    return JSON.parse(candidate);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Invalid JSON in model response: ${message}; snippet: ${candidate.slice(0, 200)}`,
      { cause: e },
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test convex/llm.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typegate**

Run: `bunx convex codegen`
Expected: completes without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add convex/llm.ts convex/llm.test.ts
git commit -m "feat(llm): pure shared module — model table, token budgets, extractJsonObject

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Node helper `convex/llmNode.ts` (`generateLlmText` + `generateJson`)

**Files:**
- Create: `convex/llmNode.ts`

**Interfaces:**
- Consumes: `DEFAULT_MODEL`, `TOKEN_BUDGETS`, `LlmTask`, `isGroqModel`, `extractJsonObject` from `./llm`; `tracedGenerate` from `./tracing`.
- Produces (later tasks rely on these exact names):
  - `type GenerateOpts = { task: LlmTask; model?: string; system: string; prompt: string; maxOutputTokens?: number; traceName?: string; metadata?: Record<string, unknown> }`
  - `generateLlmText(opts: GenerateOpts): Promise<{ text: string }>`
  - `generateJson(opts: GenerateOpts): Promise<{ text: string; json: unknown }>`

No unit test: the file is a thin adapter over `generateText` — its behaviour is provider boot + delegation, verified by the codegen typegate here and by the live smoke check in Task 7. All branching logic it uses (`isGroqModel`, `extractJsonObject`, budget table) is already unit-tested in Task 1.

- [ ] **Step 1: Write the implementation**

Create `convex/llmNode.ts`:

```typescript
"use node";
// Node-runtime half of the shared LLM module. Must carry "use node" because
// it imports ./tracing (node-marked), and Convex forbids non-node files from
// importing node files — which also means only node entry files (extract.ts,
// *Internal.ts) may import this module. V8 files import ./llm instead.
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type LanguageModel } from "ai";
import { DEFAULT_MODEL, extractJsonObject, isGroqModel, TOKEN_BUDGETS, type LlmTask } from "./llm";
import { tracedGenerate } from "./tracing";

export type GenerateOpts = {
  task: LlmTask;
  model?: string;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  /** LangSmith trace name when it differs from the task key (briefs: "brief_v2.phase3"). */
  traceName?: string;
  metadata?: Record<string, unknown>;
};

// Routes groq/* model ids to Groq (prefix stripped), everything else to
// OpenRouter. Moved verbatim from extract.ts getModel.
function getModel(modelId: string): LanguageModel {
  if (isGroqModel(modelId)) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error("GROQ_API_KEY not configured");
    }
    const groq = createGroq({ apiKey: groqKey });
    return groq(modelId.replace("groq/", ""));
  }
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }
  const openrouter = createOpenRouter({ apiKey: openRouterKey });
  return openrouter(modelId);
}

/**
 * One traced generateText call: provider routing, per-task token budget,
 * best-effort tracing, empty-response guard. Tracing failures never fail
 * generation (tracedGenerate no-ops / warns — decision log 2026-05-16).
 */
export async function generateLlmText(opts: GenerateOpts): Promise<{ text: string }> {
  const modelId = opts.model ?? DEFAULT_MODEL;
  const model = getModel(modelId);
  const { text } = await tracedGenerate(
    opts.traceName ?? opts.task,
    () =>
      generateText({
        model,
        system: opts.system,
        prompt: opts.prompt,
        maxOutputTokens: opts.maxOutputTokens ?? TOKEN_BUDGETS[opts.task],
      }),
    { model: modelId, ...opts.metadata },
  );
  if (!text) {
    throw new Error("No response from model");
  }
  return { text };
}

/** generateLlmText + strict JSON extraction, for callers that parse node-side (extract). */
export async function generateJson(opts: GenerateOpts): Promise<{ text: string; json: unknown }> {
  const { text } = await generateLlmText(opts);
  return { text, json: extractJsonObject(text) };
}
```

- [ ] **Step 2: Typegate**

Run: `bunx convex codegen`
Expected: completes without TypeScript errors (file compiles; nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
git add convex/llmNode.ts
git commit -m "feat(llm): node-side generateLlmText/generateJson — routing, tracing, budgets in one place

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Migrate `extract.ts` onto the module

**Files:**
- Modify: `convex/extract.ts` (lines 1-54 header/config, ~207-238 generate+parse block, ~395-411 `listModels`)

**Interfaces:**
- Consumes: `DEFAULT_MODEL`, `MODELS` from `./llm`; `generateJson` from `./llmNode`.
- Produces: no interface change — `extract:extractSource`, `extract:extractAllReady`, `extract:listModels` keep identical args/returns.

- [ ] **Step 1: Replace the config header**

In `convex/extract.ts`, delete lines 2-4 (`createGroq`, `createOpenRouter`, `generateText`/`LanguageModel` imports), line 5 (`tracedGenerate` import), the local `DEFAULT_MODEL` const (line 16), the `MODELS` table (lines 19-32), and the whole `getModel` function (lines 34-54). Add to the imports:

```typescript
import { DEFAULT_MODEL, MODELS } from "./llm";
import { generateJson } from "./llmNode";
```

Keep `"use node"` on line 1. Keep the `MODELS` re-export for external callers by adding immediately after the imports:

```typescript
export { MODELS };
```

(`listModels` at extract.ts:395-411 and scripts/langsmith reference the table; the export point moves but `api.extract.listModels` behaviour is unchanged.)

- [ ] **Step 2: Replace the generate + parse block**

Still in `extract.ts`, inside the `try` block (currently ~lines 209-238), replace this code:

```typescript
      const model = getModel(modelId);

      const { text: assistantMessage } = await tracedGenerate(
        "extract_v2",
        () =>
          generateText({
            model,
            system: EXTRACT_SYSTEM_PROMPT,
            prompt: userPrompt,
            maxOutputTokens: 4096,
          }),
        {
          sourceId: args.sourceId,
          sourceType: source.type,
          model: modelId,
          promptVersion: "extract_v2",
        },
      );

      if (!assistantMessage) {
        throw new Error("No response from model");
      }

      // Parse the JSON response
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON from response");
      }

      const extraction: ExtractionResult = JSON.parse(jsonMatch[0]);
```

with:

```typescript
      const { json } = await generateJson({
        task: "extract_v2",
        model: modelId,
        system: EXTRACT_SYSTEM_PROMPT,
        prompt: userPrompt,
        metadata: {
          sourceId: args.sourceId,
          sourceType: source.type,
          promptVersion: "extract_v2",
        },
      });

      const extraction = json as ExtractionResult;
```

Notes: `modelId` (`args.model || DEFAULT_MODEL`) is unchanged above this block; `model` metadata is now stamped by `generateLlmText`; the empty-response guard moved into `generateLlmText`; the unparseable-JSON error message changes from `"Could not parse JSON from response"` to `extractJsonObject`'s `"No JSON object found in model response"` — same failure path, caught by the same surrounding `catch`.

- [ ] **Step 3: Typegate + tests**

Run: `bunx convex codegen && bun test convex/llm.test.ts`
Expected: codegen clean; tests PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/extract.ts
git commit -m "refactor(extract): generate via shared llm module; MODELS/DEFAULT_MODEL move to llm.ts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Migrate hypothesis generation

**Files:**
- Modify: `convex/hypothesesInternal.ts` (whole file, 47 lines)
- Modify: `convex/hypotheses.ts` (line ~496 model literal; lines ~510-523 parse block; imports)

**Interfaces:**
- Consumes: `generateLlmText` from `./llmNode` (node side); `DEFAULT_MODEL`, `extractJsonObject` from `./llm` (V8 side).
- Produces: `internal.hypothesesInternal.generateHypothesisText` keeps identical args and `returns: v.object({ text: v.string() })`.

- [ ] **Step 1: Rewrite `convex/hypothesesInternal.ts`**

Replace the entire file with:

```typescript
"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { generateLlmText } from "./llmNode";

// V8-runtime queries/mutations stay in hypotheses.ts; only the traced AI call is
// split out here so hypotheses.ts can remain a mixed (query+mutation+action)
// module while the generateText call runs in the Node runtime tracedGenerate
// needs. hypotheses.generateFromExtraction delegates to this via ctx.runAction,
// keeping the api.hypotheses.* namespace stable for all existing call sites.
export const generateHypothesisText = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    extractionId: v.id("extractions"),
    sourceId: v.id("sources"),
    promptVersion: v.string(),
  },
  returns: v.object({ text: v.string() }),
  handler: (_ctx, args) =>
    generateLlmText({
      task: "hypothesis_v1",
      model: args.model,
      system: args.system,
      prompt: args.prompt,
      metadata: {
        extractionId: args.extractionId,
        sourceId: args.sourceId,
        promptVersion: args.promptVersion,
      },
    }),
});
```

(Token budget 2000 now comes from `TOKEN_BUDGETS.hypothesis_v1`; trace name is the task key `"hypothesis_v1"`, unchanged.)

- [ ] **Step 2: Update the V8 side in `convex/hypotheses.ts`**

Add to the imports at the top of the file:

```typescript
import { DEFAULT_MODEL, extractJsonObject } from "./llm";
```

Replace line ~496:

```typescript
    const modelId = args.model || "anthropic/claude-sonnet-4-6";
```

with:

```typescript
    const modelId = args.model || DEFAULT_MODEL;
```

Replace the parse block at ~510-523:

```typescript
    // Parse response
    let parsed: GeneratedHypothesisPayload;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]) as GeneratedHypothesisPayload;
      parsed.whyThisMatters = assertWhyThisMatters(
        parsed.whyThisMatters,
        "generated.whyThisMatters",
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`, { cause: e });
    }
```

with:

```typescript
    // Parse response
    let parsed: GeneratedHypothesisPayload;
    try {
      parsed = extractJsonObject(text) as GeneratedHypothesisPayload;
      parsed.whyThisMatters = assertWhyThisMatters(
        parsed.whyThisMatters,
        "generated.whyThisMatters",
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`, { cause: e });
    }
```

(`hypotheses.ts` is a V8 file: it imports `./llm` only — never `./llmNode`.)

- [ ] **Step 3: Typegate + tests**

Run: `bunx convex codegen && bun test convex/`
Expected: codegen clean; all existing convex tests PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/hypothesesInternal.ts convex/hypotheses.ts
git commit -m "refactor(hypotheses): generation + parse via shared llm module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Migrate recipe generation

**Files:**
- Modify: `convex/recipesInternal.ts` (whole file, 43 lines)
- Modify: `convex/recipes.ts` (line ~469 model literal; lines ~479-488 parse block; imports)

**Interfaces:**
- Consumes: `generateLlmText` from `./llmNode`; `DEFAULT_MODEL`, `extractJsonObject` from `./llm`.
- Produces: `internal.recipesInternal.generateRecipeText` keeps identical args and `returns: v.object({ text: v.string() })`.

- [ ] **Step 1: Rewrite `convex/recipesInternal.ts`**

Replace the entire file with:

```typescript
"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { generateLlmText } from "./llmNode";

// See hypothesesInternal.ts for the split rationale. recipes.generateFromHypothesis
// delegates its traced AI call here so recipes.ts stays a mixed V8 module.
export const generateRecipeText = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    hypothesisId: v.id("hypotheses"),
    promptVersion: v.string(),
  },
  returns: v.object({ text: v.string() }),
  handler: (_ctx, args) =>
    generateLlmText({
      task: "recipe_v1",
      model: args.model,
      system: args.system,
      prompt: args.prompt,
      metadata: {
        hypothesisId: args.hypothesisId,
        promptVersion: args.promptVersion,
      },
    }),
});
```

(The `// Fixed from the dead maxTokens param` comment disappears with the copy it annotated; budget 3000 now comes from `TOKEN_BUDGETS.recipe_v1`.)

- [ ] **Step 2: Update the V8 side in `convex/recipes.ts`**

Add to the imports at the top of the file:

```typescript
import { DEFAULT_MODEL, extractJsonObject } from "./llm";
```

Replace line ~469:

```typescript
    const modelId = args.model || "anthropic/claude-sonnet-4-6";
```

with:

```typescript
    const modelId = args.model || DEFAULT_MODEL;
```

Replace the parse block at ~479-488:

```typescript
    // Parse response
    let parsed: ParsedRecipePayload;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = validateGeneratedRecipePayload(JSON.parse(jsonMatch[0]));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`, { cause: e });
    }
```

with:

```typescript
    // Parse response
    let parsed: ParsedRecipePayload;
    try {
      parsed = validateGeneratedRecipePayload(extractJsonObject(text));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`, { cause: e });
    }
```

- [ ] **Step 3: Typegate + tests**

Run: `bunx convex codegen && bun test convex/`
Expected: codegen clean; all convex tests PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/recipesInternal.ts convex/recipes.ts
git commit -m "refactor(recipes): generation + parse via shared llm module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Migrate weekly-brief generation (internal action only)

**Files:**
- Modify: `convex/weeklyBriefsInternal.ts` (whole file, 49 lines)
- Modify: `convex/weeklyBriefs.ts` (line ~501 model literal; imports). `parseBriefResponse` is deliberately untouched.

**Interfaces:**
- Consumes: `generateLlmText` from `./llmNode`; `DEFAULT_MODEL` from `./llm`.
- Produces: `internal.weeklyBriefsInternal.generateBriefText` keeps identical args and `returns: v.object({ text: v.string() })`; LangSmith trace name stays `"brief_v2.phase3"` via `traceName`.

- [ ] **Step 1: Rewrite `convex/weeklyBriefsInternal.ts`**

Replace the entire file with:

```typescript
"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { generateLlmText } from "./llmNode";

// See hypothesesInternal.ts for the split rationale. weeklyBriefs.generateBriefCore
// delegates its traced AI call here so weeklyBriefs.ts stays a mixed V8 module
// (its DB reads run in the loadBriefContext internalQuery).
export const generateBriefText = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    weekOf: v.string(),
    promptVersion: v.string(),
    numHypotheses: v.number(),
    numRecipes: v.number(),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({ text: v.string() }),
  handler: (_ctx, args) =>
    generateLlmText({
      task: "brief_v2",
      // Eval baselines reference this exact LangSmith run name; the budget
      // key (brief_v2) and the trace name differ by design.
      traceName: "brief_v2.phase3",
      model: args.model,
      system: args.system,
      prompt: args.prompt,
      metadata: {
        weekOf: args.weekOf,
        promptVersion: args.promptVersion,
        numHypotheses: args.numHypotheses,
        numRecipes: args.numRecipes,
        ...(args.campaignId ? { campaignId: args.campaignId } : {}),
      },
    }),
});
```

- [ ] **Step 2: Update the V8 side in `convex/weeklyBriefs.ts`**

Add to the imports at the top of the file:

```typescript
import { DEFAULT_MODEL } from "./llm";
```

Replace line ~501:

```typescript
  const modelId = args.model || "anthropic/claude-sonnet-4-6";
```

with:

```typescript
  const modelId = args.model || DEFAULT_MODEL;
```

Do NOT touch `parseBriefResponse` (weeklyBriefs.ts:244-~290): its extraction is fenced-optional and non-throwing (no JSON block → default `todo`/`studioPrompts`), which `extractJsonObject` cannot express — the strict bare-brace fallback would also misfire on brace-bearing markdown brief bodies.

- [ ] **Step 3: Typegate + tests (brief parsing must stay green)**

Run: `bunx convex codegen && bun test convex/weeklyBriefs.test.ts`
Expected: codegen clean; the three existing tests PASS unchanged:
- "extracts todo items and prompt variants while stripping the JSON block"
- "filters hypotheses, recipes, and source ids to the recency window"
- "fails brief generation when the scoped hypotheses are all stale"

- [ ] **Step 4: Commit**

```bash
git add convex/weeklyBriefsInternal.ts convex/weeklyBriefs.ts
git commit -m "refactor(weeklyBriefs): brief generation via shared llm module, trace name preserved

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Sweep — prove the duplication is gone

**Files:**
- Modify: none expected (greps + live smoke only; fix stragglers if any grep disagrees)

**Interfaces:**
- Consumes: everything produced by Tasks 1-6.
- Produces: verified end state; no code change unless a grep finds a straggler.

- [ ] **Step 1: Provider boot exists only in llmNode.ts**

Run: `grep -rn "createOpenRouter\|createGroq" convex/ --include="*.ts" | grep -v _generated`
Expected output — exactly two lines, both in `convex/llmNode.ts` (the import and the two call sites appear on import + usage lines within that file only):

```
convex/llmNode.ts:…:import { createGroq } from "@ai-sdk/groq";
convex/llmNode.ts:…:import { createOpenRouter } from "@openrouter/ai-sdk-provider";
```

(plus the in-function `createGroq(`/`createOpenRouter(` usage lines from the same file — no other file may appear).

- [ ] **Step 2: The default-model literal exists only in llm.ts**

Run: `grep -rn "anthropic/claude-sonnet-4-6" convex/ --include="*.ts" | grep -v _generated`
Expected: matches only in `convex/llm.ts` (DEFAULT_MODEL + MODELS table). If `hypotheses.ts:496`, `recipes.ts:469`, or `weeklyBriefs.ts:501` still match, Tasks 4-6 missed a literal — fix and amend.

- [ ] **Step 3: No stray bare-brace parses in the generator paths**

Run: `grep -rn 'match(/\\{\[' convex/hypotheses.ts convex/recipes.ts convex/extract.ts`
Expected: no output. (`weeklyBriefs.ts:248` keeps its fenced match by design — not part of this grep.)

- [ ] **Step 4: Full test suite + typegate**

Run: `bunx convex codegen && bun test convex/`
Expected: codegen clean, all tests PASS.

- [ ] **Step 5: Live smoke (read-only)**

Run: `bunx convex run extract:listModels`
Expected: the MODELS table JSON (fast/kimi/default/quality/haiku/gemini/gpt4/deepseek/grok) — proves extract.ts deployed and serves the table from its new home in llm.ts.

- [ ] **Step 6: Commit (only if stragglers were fixed)**

```bash
git add -A convex/
git commit -m "chore(llm): sweep stragglers after generator-core consolidation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Deferred (explicitly out of scope)

- **Groq-model use in hypothesis/recipe/brief generation now works** (routing is centralized) but no call site is switched to `MODELS.fast` here — model choice per generator is a product decision, not part of this refactor.
- **Retry/backoff:** no generator retries today; the deep module is the obvious future home, but adding retry changes failure semantics — separate change.
- **parseBriefResponse unification:** would need a lenient variant of `extractJsonObject` (nullable return, fenced-only). Only worth it if a second lenient caller appears (one adapter = hypothetical seam).
