import { ChatAnthropic } from "@langchain/anthropic";
import { createDeepAgent } from "deepagents";
import { convexTools } from "../../tools/index.js";
import { supervisorPrompt } from "./prompts.js";
import { subagents } from "./subagents.js";

// Route Claude through OpenRouter's Anthropic-compatible endpoint so this
// workspace uses the same provider as the rest of the project (CLAUDE.md).
const OPENROUTER_ANTHROPIC_API_URL = "https://openrouter.ai/api";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

function normalizeOpenRouterModel(model: string) {
  const rawModel = model.trim();
  const unprefixed = rawModel.startsWith("anthropic/")
    ? rawModel.slice("anthropic/".length)
    : rawModel;
  const normalized =
    unprefixed === "claude-sonnet-4-6" ? "claude-sonnet-4.6" : unprefixed;
  return `anthropic/${normalized}`;
}

const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
const apiKey = useOpenRouter
  ? process.env.OPENROUTER_API_KEY
  : process.env.ANTHROPIC_API_KEY;
const anthropicApiUrl =
  process.env.ANTHROPIC_API_URL ??
  (useOpenRouter ? OPENROUTER_ANTHROPIC_API_URL : undefined);
const configuredModel = process.env.WEEKLY_BRIEF_AGENT_MODEL;

const model = new ChatAnthropic({
  model: useOpenRouter
    ? normalizeOpenRouterModel(configuredModel ?? DEFAULT_OPENROUTER_MODEL)
    : (configuredModel ?? DEFAULT_ANTHROPIC_MODEL),
  temperature: 0.2,
  apiKey,
  anthropicApiUrl,
});

export const agent = createDeepAgent({
  model,
  tools: convexTools,
  subagents,
  systemPrompt: supervisorPrompt,
});
