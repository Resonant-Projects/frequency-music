import { ChatAnthropic } from "@langchain/anthropic";

export interface ChatModelOptions {
  temperature?: number;
  model?: string;
}

export const OPENROUTER_ANTHROPIC_API_URL = "https://openrouter.ai/api";
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-5.5";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";

export function normalizeOpenRouterModel(model: string) {
  const rawModel = model.trim();
  const unprefixed = rawModel.startsWith("anthropic/")
    ? rawModel.slice("anthropic/".length)
    : rawModel;
  const normalized = unprefixed.replace(
    /^claude-sonnet-(\d+)-(\d+)$/,
    "claude-sonnet-$1.$2",
  );
  return `anthropic/${normalized}`;
}

export function createOpenRouterAnthropicModel(options: ChatModelOptions = {}) {
  const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const apiKey = useOpenRouter
    ? process.env.OPENROUTER_API_KEY
    : process.env.ANTHROPIC_API_KEY;
  const anthropicApiUrl =
    process.env.ANTHROPIC_API_URL ??
    (useOpenRouter ? OPENROUTER_ANTHROPIC_API_URL : undefined);
  const configuredModel = options.model ?? process.env.WEEKLY_BRIEF_AGENT_MODEL;

  return new ChatAnthropic({
    model: useOpenRouter
      ? normalizeOpenRouterModel(configuredModel ?? DEFAULT_OPENROUTER_MODEL)
      : (configuredModel ?? DEFAULT_ANTHROPIC_MODEL),
    temperature: options.temperature ?? 0.2,
    apiKey,
    anthropicApiUrl,
  });
}
