import { makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";

const agentToolRefs = {
  listRecentExtractions: makeFunctionReference<"action">(
    "agentTools:listRecentExtractions",
  ),
  getExtraction: makeFunctionReference<"action">("agentTools:getExtraction"),
  listRecentHypotheses: makeFunctionReference<"action">(
    "agentTools:listRecentHypotheses",
  ),
  listActiveTheses: makeFunctionReference<"action">(
    "agentTools:listActiveTheses",
  ),
  listFailureArchive: makeFunctionReference<"action">(
    "agentTools:listFailureArchive",
  ),
  getEditorialSignals: makeFunctionReference<"action">(
    "agentTools:getEditorialSignals",
  ),
  getRecentRecipes: makeFunctionReference<"action">(
    "agentTools:getRecentRecipes",
  ),
  getRecommendedActions: makeFunctionReference<"action">(
    "agentTools:getRecommendedActions",
  ),
  searchSourcesByConcept: makeFunctionReference<"action">(
    "agentTools:searchSourcesByConcept",
  ),
  createAgentRun: makeFunctionReference<"action">("agentTools:createAgentRun"),
  appendAgentRunEvent: makeFunctionReference<"action">(
    "agentTools:appendAgentRunEvent",
  ),
  markAgentRunCompleted: makeFunctionReference<"action">(
    "agentTools:markAgentRunCompleted",
  ),
  markAgentRunNeedsReview: makeFunctionReference<"action">(
    "agentTools:markAgentRunNeedsReview",
  ),
  markAgentRunFailed: makeFunctionReference<"action">(
    "agentTools:markAgentRunFailed",
  ),
};

type AgentToolName = keyof typeof agentToolRefs;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeAgentToolHttpHandler(toolName: AgentToolName) {
  return httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;
    const secret = typeof body.secret === "string" ? body.secret : undefined;
    if (!secret || secret !== process.env.AGENT_TOOL_SECRET) {
      return json({ error: "Forbidden" }, 403);
    }

    const { secret: _secret, ...args } = body;
    const result = await ctx.runAction(agentToolRefs[toolName], {
      agentSecret: secret,
      ...args,
    });
    return json(result);
  });
}

export const listRecentExtractionsHttp = makeAgentToolHttpHandler(
  "listRecentExtractions",
);
export const getExtractionHttp = makeAgentToolHttpHandler("getExtraction");
export const listRecentHypothesesHttp = makeAgentToolHttpHandler(
  "listRecentHypotheses",
);
export const listActiveThesesHttp =
  makeAgentToolHttpHandler("listActiveTheses");
export const listFailureArchiveHttp =
  makeAgentToolHttpHandler("listFailureArchive");
export const getEditorialSignalsHttp = makeAgentToolHttpHandler(
  "getEditorialSignals",
);
export const getRecentRecipesHttp =
  makeAgentToolHttpHandler("getRecentRecipes");
export const getRecommendedActionsHttp = makeAgentToolHttpHandler(
  "getRecommendedActions",
);
export const searchSourcesByConceptHttp = makeAgentToolHttpHandler(
  "searchSourcesByConcept",
);
export const createAgentRunHttp = makeAgentToolHttpHandler("createAgentRun");
export const appendAgentRunEventHttp = makeAgentToolHttpHandler(
  "appendAgentRunEvent",
);
export const markAgentRunCompletedHttp = makeAgentToolHttpHandler(
  "markAgentRunCompleted",
);
export const markAgentRunNeedsReviewHttp = makeAgentToolHttpHandler(
  "markAgentRunNeedsReview",
);
export const markAgentRunFailedHttp = makeAgentToolHttpHandler(
  "markAgentRunFailed",
);
