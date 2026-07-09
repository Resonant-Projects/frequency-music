import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { createDeepAgent } from "deepagents";
import { getResearchModel } from "../../models/index.js";
import { convexTools } from "../../tools/index.js";
import { supervisorPrompt } from "./prompts.js";
import { subagents } from "./subagents.js";

const model = getResearchModel({ temperature: 0.2, requiresToolBinding: true });

const deepAgent = createDeepAgent({
  model,
  tools: convexTools,
  subagents,
  systemPrompt: supervisorPrompt,
});

async function runWeeklyBriefAgent(state: typeof MessagesAnnotation.State) {
  const result = await deepAgent.invoke({ messages: state.messages });
  return { messages: result.messages ?? [] };
}

export const agent = new StateGraph(MessagesAnnotation)
  .addNode("weekly_brief_agent", runWeeklyBriefAgent)
  .addEdge(START, "weekly_brief_agent")
  .addEdge("weekly_brief_agent", END)
  .compile();
