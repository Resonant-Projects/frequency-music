"use node";
// Node-runtime half of the shared LLM module. Must carry "use node" because
// it imports ./tracing (node-marked), and Convex forbids non-node files from
// importing node files — which also means only node entry files (extract.ts,
// *Internal.ts) may import this module. V8 files import ./llm instead.
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type LanguageModel } from "ai";
import {
  DEFAULT_MODEL,
  extractJsonObject,
  isGroqModel,
  TOKEN_BUDGETS,
  type LlmTask,
} from "./llm";
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
export async function generateLlmText(
  opts: GenerateOpts,
): Promise<{ text: string }> {
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
export async function generateJson(
  opts: GenerateOpts,
): Promise<{ text: string; json: unknown }> {
  const { text } = await generateLlmText(opts);
  return { text, json: extractJsonObject(text) };
}
