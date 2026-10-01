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
  const model = useOpenRouter
    ? normalizeOpenRouterModel(configuredModel ?? DEFAULT_OPENROUTER_MODEL)
    : (configuredModel ?? DEFAULT_ANTHROPIC_MODEL);
  // Sonnet 5.5 rejects non-default sampling parameters and requires
  // reasoning. The installed ChatAnthropic sends temperature and
  // `thinking: { type: "disabled" }` by default, so both are overridden here;
  // adaptive thinking works with plain calls, tools, and JSON-schema output.
  const isSonnet55 = /(?:^|\/)claude-sonnet-5[.-]5(?:$|-)/.test(model);

  return new ChatAnthropic({
    model,
    ...(isSonnet55
      ? { thinking: { type: "adaptive" } }
      : { temperature: options.temperature ?? 0.2 }),
    apiKey,
    anthropicApiUrl,
  });
}
