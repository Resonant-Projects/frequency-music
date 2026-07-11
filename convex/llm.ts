// Pure LLM configuration + parsing shared by all four generators.
// No "use node" and no node-only imports — this file must stay importable
// from V8 modules (hypotheses.ts, recipes.ts, weeklyBriefs.ts).
// The node-side generation half lives in llmNode.ts.

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

// Available models for different use cases (moved verbatim from extract.ts).
export const MODELS = {
  // === GROQ (fast, cheap) ===
  // Groq retired moonshotai/kimi-k2-instruct (verified 2026-07-10); gpt-oss-120b
  // is the current production-tier non-Llama option.
  fast: "groq/openai/gpt-oss-120b",

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
  // 3000 truncated Sonnet 4.6 recipe JSON mid-string (observed 2026-07-10:
  // "Unterminated string in JSON at position 5353"); recipes are the longest
  // payload we generate.
  recipe_v1: 6000,
  brief_v2: 4000,
} as const;

export type LlmTask = keyof typeof TOKEN_BUDGETS;

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
