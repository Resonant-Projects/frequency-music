// Runtime-pure model policy shared by Convex and the worker.
export const ANTHROPIC_MODELS = {
  sonnet: "anthropic/claude-sonnet-5.5",
  haiku: "anthropic/claude-haiku-5.5",
  opus: "anthropic/claude-opus-5.5",
} as const;

export type ReasoningEffort = "medium" | "high";

export function isAnthropicModel(model: string): boolean {
  return model.startsWith("anthropic/") || model.startsWith("claude-");
}

export function anthropicModelId(model: string): string {
  return model
    .replace(/^anthropic\//, "")
    .replace(/^(claude-(?:sonnet|haiku|opus)-\d+)\.(\d+)/, "$1-$2");
}

// Opus is reserved for hypothesis/recipe design and research review drafts.
// Every other Anthropic call still explicitly requests at least medium effort.
export function anthropicReasoningEffort(model: string): ReasoningEffort {
  return anthropicModelId(model).startsWith("claude-opus-") ? "high" : "medium";
}

export const TASK_MODELS = {
  extract_v2: ANTHROPIC_MODELS.sonnet,
  extract_v3: ANTHROPIC_MODELS.sonnet,
  hypothesis_v1: ANTHROPIC_MODELS.opus,
  recipe_v1: ANTHROPIC_MODELS.opus,
  brief_v2: ANTHROPIC_MODELS.sonnet,
  concept_classifier_v1: ANTHROPIC_MODELS.haiku,
  narration_v1: ANTHROPIC_MODELS.sonnet,
} as const;
