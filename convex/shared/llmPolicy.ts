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

// Only the current catalog uses direct adaptive-thinking inference. Persisted
// attempts with older registered IDs retain their original OpenRouter route.
export function isDirectAnthropicModel(model: string): boolean {
  return Object.values(ANTHROPIC_MODELS).some(
    (supported) => anthropicModelId(supported) === anthropicModelId(model),
  );
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
  // Hypothesis tournament: design calls on Opus, judgments on Sonnet, and
  // bounded duplicate classification on Haiku.
  tournament_generation_v1: ANTHROPIC_MODELS.opus,
  tournament_grounding_v1: ANTHROPIC_MODELS.opus,
  tournament_revision_v1: ANTHROPIC_MODELS.opus,
  tournament_scoring_v1: ANTHROPIC_MODELS.sonnet,
  tournament_finalist_v1: ANTHROPIC_MODELS.sonnet,
  tournament_self_check_v1: ANTHROPIC_MODELS.sonnet,
  tournament_duplicate_v1: ANTHROPIC_MODELS.haiku,
} as const;

// Per-call maxOutputTokens caps for tournament prompts. Kept beside the task
// models because the worker reads them; convex/llm.ts mirrors them in
// TOKEN_BUDGETS. The 300 000-token run budget lives in the graph.
export const TOURNAMENT_TOKEN_BUDGETS = {
  tournament_generation_v1: 6000,
  tournament_grounding_v1: 6000,
  tournament_revision_v1: 6000,
  tournament_scoring_v1: 3000,
  tournament_finalist_v1: 3000,
  tournament_self_check_v1: 3000,
  tournament_duplicate_v1: 1500,
} as const;
