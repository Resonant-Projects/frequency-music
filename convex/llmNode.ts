"use node";
// Node-runtime half of the shared LLM module. Must carry "use node" because
// it imports ./tracing (node-marked), and Convex forbids non-node files from
// importing node files — which also means only node entry files (extract.ts,
// *Internal.ts) may import this module. V8 files import ./llm instead.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText, type LanguageModel } from "ai";
import type { z } from "zod";
import {
  modelForTask,
  isGroqModel,
  MODEL_REASONING_EFFORT,
  parseExtractionJson,
  TOKEN_BUDGETS,
  type LlmTask,
} from "./llm";
import { tracedGenerate } from "./tracing";
import {
  anthropicModelId,
  anthropicReasoningEffort,
  isDirectAnthropicModel,
} from "./shared/llmPolicy";

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

// Anthropic goes directly to its API so calls consume Anthropic credits.
// Explicit Groq and other provider overrides retain their existing routes.
function getModel(modelId: string): LanguageModel {
  if (isDirectAnthropicModel(modelId)) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    return createAnthropic({ apiKey })(anthropicModelId(modelId));
  }
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
  const effort = MODEL_REASONING_EFFORT[modelId];
  return effort
    ? openrouter(modelId, { reasoning: { effort } })
    : openrouter(modelId);
}

function providerOptions(modelId: string) {
  return isDirectAnthropicModel(modelId)
    ? {
        anthropic: {
          thinking: { type: "adaptive" as const },
          effort: anthropicReasoningEffort(modelId),
          structuredOutputMode: "outputFormat" as const,
        },
      }
    : undefined;
}

/**
 * One traced generateText call: provider routing, per-task token budget,
 * best-effort tracing, empty-response guard. Tracing failures never fail
 * generation (tracedGenerate no-ops / warns — decision log 2026-05-16).
 */
export async function generateLlmText(
  opts: GenerateOpts,
): Promise<{ text: string }> {
  const modelId = opts.model ?? modelForTask(opts.task);
  const model = getModel(modelId);
  const { text } = await tracedGenerate(
    opts.traceName ?? opts.task,
    () =>
      generateText({
        model,
        system: opts.system,
        prompt: opts.prompt,
        maxOutputTokens: opts.maxOutputTokens ?? TOKEN_BUDGETS[opts.task],
        providerOptions: providerOptions(modelId),
      }),
    { model: modelId, ...opts.metadata },
  );
  if (!text) {
    throw new Error("No response from model");
  }
  return { text };
}

/**
 * generateLlmText + the extraction parser's characterized greedy-brace
 * behavior. Other generators use extractJsonObject on the V8 side.
 */
export async function generateJson(
  opts: GenerateOpts,
): Promise<{ text: string; json: unknown }> {
  const { text } = await generateLlmText(opts);
  return { text, json: parseExtractionJson(text) };
}

export async function generateLlmObject<Output>(
  opts: GenerateOpts & {
    schema: z.ZodType<Output>;
    schemaName: string;
    schemaDescription: string;
  },
): Promise<{ object: Output; inputTokens: number; outputTokens: number }> {
  const modelId = opts.model ?? modelForTask(opts.task);
  const model = getModel(modelId);
  const result = await tracedGenerate(
    opts.traceName ?? opts.task,
    () =>
      generateObject({
        model,
        system: opts.system,
        prompt: opts.prompt,
        schema: opts.schema,
        schemaName: opts.schemaName,
        schemaDescription: opts.schemaDescription,
        maxOutputTokens: opts.maxOutputTokens ?? TOKEN_BUDGETS[opts.task],
        providerOptions: providerOptions(modelId),
      }),
    { model: modelId, ...opts.metadata },
  );
  return {
    object: result.object,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  };
}
