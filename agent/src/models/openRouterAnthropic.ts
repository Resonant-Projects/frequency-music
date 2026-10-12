import { ChatAnthropic } from "@langchain/anthropic";
import {
  ANTHROPIC_MODELS,
  anthropicModelId,
  anthropicReasoningEffort,
} from "../../../convex/shared/llmPolicy.js";

export interface ChatModelOptions {
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  model?: string;
  /** Stop on missing direct credentials rather than using a legacy provider. */
  requireDirectAnthropic?: boolean;
}

export const OPENROUTER_ANTHROPIC_API_URL = "https://openrouter.ai/api";
export const DEFAULT_OPENROUTER_MODEL = ANTHROPIC_MODELS.sonnet;
export const DEFAULT_ANTHROPIC_MODEL = anthropicModelId(
  ANTHROPIC_MODELS.sonnet,
);

export function normalizeOpenRouterModel(model: string) {
  const rawModel = model.trim();
  const unprefixed = rawModel.startsWith("anthropic/")
    ? rawModel.slice("anthropic/".length)
    : rawModel;
  const normalized = unprefixed.replace(
    /^(claude-(?:sonnet|haiku|opus)-\d+)-(\d+)$/,
    "$1.$2",
  );
  return `anthropic/${normalized}`;
}

export function createOpenRouterAnthropicModel(options: ChatModelOptions = {}) {
  const useOpenRouter =
    !options.requireDirectAnthropic &&
    !process.env.ANTHROPIC_API_KEY &&
    Boolean(process.env.OPENROUTER_API_KEY);
  const apiKey = useOpenRouter
    ? process.env.OPENROUTER_API_KEY
    : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  // Pin the direct URL: the SDK otherwise reads legacy ANTHROPIC_API_URL itself.
  const anthropicApiUrl = useOpenRouter
    ? OPENROUTER_ANTHROPIC_API_URL
    : "https://api.anthropic.com";
  const configuredModel = options.model ?? process.env.WEEKLY_BRIEF_AGENT_MODEL;
  const model = useOpenRouter
    ? normalizeOpenRouterModel(configuredModel ?? DEFAULT_OPENROUTER_MODEL)
    : anthropicModelId(configuredModel ?? DEFAULT_ANTHROPIC_MODEL);
  if (
    !Object.values(ANTHROPIC_MODELS).some(
      (supported) => anthropicModelId(supported) === anthropicModelId(model),
    )
  ) {
    throw new Error(
      `Unsupported worker model ${model}: use Sonnet, Haiku, or Opus 5.5 with adaptive thinking`,
    );
  }

  return new ChatAnthropic({
    model,
    ...(options.maxTokens === undefined
      ? {}
      : { maxTokens: options.maxTokens }),
    ...(options.maxRetries === undefined
      ? {}
      : { maxRetries: options.maxRetries }),
    thinking: { type: "adaptive" },
    outputConfig: { effort: anthropicReasoningEffort(model) },
    apiKey,
    anthropicApiUrl,
  });
}
