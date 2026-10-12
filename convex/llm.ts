import { TRANSCRIPTION_MODEL } from "./shared/agentContract";
import { ANTHROPIC_MODELS, TASK_MODELS } from "./shared/llmPolicy";
export { TASK_MODELS } from "./shared/llmPolicy";
// Pure LLM configuration + parsing shared by all four generators.
// No "use node" and no node-only imports — this file must stay importable
// from V8 modules (hypotheses.ts, recipes.ts, weeklyBriefs.ts).
// The node-side generation half lives in llmNode.ts.

export const DEFAULT_MODEL = ANTHROPIC_MODELS.sonnet;

/**
 * Per-model OpenRouter reasoning effort. Only models listed here get a
 * `reasoning` block; others are called without one (sending an effort to a
 * non-reasoning model is a provider error).
 */
export const MODEL_REASONING_EFFORT: Record<string, "low" | "medium" | "high"> =
  {
    "openai/gpt-6.1-sol": "medium",
  };

// Available models for different use cases (moved verbatim from extract.ts).
export const MODELS = {
  // Bounded classification and relevance checks use Haiku.
  fast: ANTHROPIC_MODELS.haiku,
  // YouTube transcript capture (agent transcript-capture graph): Groq Whisper.
  transcription: TRANSCRIPTION_MODEL,

  // === Direct Anthropic (monthly API credits) ===
  default: DEFAULT_MODEL,
  quality: ANTHROPIC_MODELS.opus,
  sonnet: ANTHROPIC_MODELS.sonnet,
  haiku: ANTHROPIC_MODELS.haiku,
  // Extractions written by the Claude Code operator session
  // (scripts/operator-extraction.ts, extract.storeOperatorExtraction).
  opus: ANTHROPIC_MODELS.opus,
  // Essay metadata generation (scripts/generate-essay-metadata.ts) per Keith
  // 2026-08-01. Listed here rather than as a script-local literal so
  // check-model-catalog.ts verifies it against the live OpenRouter catalog.
  luna: "openai/gpt-5.6-luna",
  gemini: "google/gemini-2.5-flash",
  gpt4: "openai/gpt-4o",
  deepseek: "deepseek/deepseek-chat-v3-0324",
  grok: "x-ai/grok-4.5",
} as const;

// One visible table instead of four magic numbers buried in generator bodies.
// These are maxOutputTokens CAPS (not spend). Sized for reasoning models:
// GPT-5.6 Terra's reasoning tokens count against the output budget, and its
// recipe JSON truncated at both 3000 and 6000 in live runs on 2026-07-10
// ("Unterminated string" / cut mid-array). Recipes are the longest payload.
export const TOKEN_BUDGETS = {
  extract_v2: 8000,
  extract_v3: 8000,
  hypothesis_v1: 6000,
  recipe_v1: 16000,
  brief_v2: 8000,
  concept_classifier_v1: 5000,
  narration_v1: 6000,
} as const;

export type LlmTask = keyof typeof TOKEN_BUDGETS;

export function modelForTask(task: LlmTask): string {
  return TASK_MODELS[task];
}

export function isGroqModel(model: string): boolean {
  return model.startsWith("groq/");
}

/**
 * Preserve the extraction parser's characterized greedy-brace behavior while
 * its ownership moves out of extract.ts. Hypothesis and recipe parse sites use
 * the stricter fenced-first extractJsonObject below.
 */
export function parseExtractionJson(
  assistantMessage: string,
): Record<string, unknown> {
  const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from response");
  }
  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
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
