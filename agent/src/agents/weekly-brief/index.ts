import { ChatAnthropic } from "@langchain/anthropic";
import { createDeepAgent } from "deepagents";
import { convexTools } from "../../tools/index.js";
import { supervisorPrompt } from "./prompts.js";
import { subagents } from "./subagents.js";

const model = new ChatAnthropic({
  model: process.env.WEEKLY_BRIEF_AGENT_MODEL ?? "claude-sonnet-4-6",
  temperature: 0.2,
});

export const agent = createDeepAgent({
  model,
  tools: convexTools,
  subagents,
  systemPrompt: supervisorPrompt,
});
