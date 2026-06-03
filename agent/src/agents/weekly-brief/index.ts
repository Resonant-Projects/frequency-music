import { createDeepAgent } from "deepagents";
import { getResearchModel } from "../../models/index.js";
import { convexTools } from "../../tools/index.js";
import { supervisorPrompt } from "./prompts.js";
import { subagents } from "./subagents.js";

const model = getResearchModel({ temperature: 0.2, requiresToolBinding: true });

export const agent = createDeepAgent({
  model,
  tools: convexTools,
  subagents,
  systemPrompt: supervisorPrompt,
});
