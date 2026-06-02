import { ChatAnthropic } from "@langchain/anthropic";
import { createDeepAgent } from "deepagents";
import { convexTools } from "../../tools/index.js";
import { supervisorPrompt } from "./prompts.js";
import { subagents } from "./subagents.js";

// Route Claude through OpenRouter's Anthropic-compatible endpoint so this
// workspace uses the same provider as the rest of the project (CLAUDE.md).
const model = new ChatAnthropic({
  model: process.env.WEEKLY_BRIEF_AGENT_MODEL ?? "claude-sonnet-4-6",
  temperature: 0.2,
  apiKey: process.env.OPENROUTER_API_KEY ?? process.env.ANTHROPIC_API_KEY,
  anthropicApiUrl:
    process.env.ANTHROPIC_API_URL ?? "https://openrouter.ai/api",
});

export const agent = createDeepAgent({
  model,
  tools: convexTools,
  subagents,
  systemPrompt: supervisorPrompt,
});
