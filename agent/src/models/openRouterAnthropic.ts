import { ChatAnthropic } from "@langchain/anthropic";
import {
  ANTHROPIC_MODELS,
  anthropicModelId,
  anthropicReasoningEffort,
} from "../../../convex/shared/llmPolicy.js";

export interface ChatModelOptions {
  temperature?: number;
  model?: string;
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
    !process.env.ANTHROPIC_API_KEY && Boolean(process.env.OPENROUTER_API_KEY);
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
  // The 5.5 family rejects sampling controls. Adaptive thinking and explicit
  // effort survive tool binding and native JSON-schema output.
  const isClaude55 = /(?:^|\/)claude-(?:sonnet|haiku|opus)-5[.-]5(?:$|-)/.test(
    model,
  );

  return new ChatAnthropic({
    model,
    ...(isClaude55
      ? {
          thinking: { type: "adaptive" },
          outputConfig: { effort: anthropicReasoningEffort(model) },
        }
      : { temperature: options.temperature ?? 0.2 }),
    apiKey,
    anthropicApiUrl,
  });
}
