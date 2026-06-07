import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readBody(request: Request): Promise<Record<string, any>> {
  try {
    return (await request.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

function forbidden() {
  return json({ error: "Forbidden" }, 403);
}

function isAuthorized(body: Record<string, any>) {
  const expected = process.env.AGENT_TOOL_SECRET;
  return Boolean(expected && body.secret === expected);
}

export const listRecentExtractionsHttp = httpAction(async (ctx, request) => {
  const body = await readBody(request);
  if (!isAuthorized(body)) return forbidden();
  const result = await ctx.runAction(api.agentTools.listRecentExtractions, {
    agentSecret: body.secret,
    limit: body.limit,
  });
  return json(result);
});

export const getExtractionHttp = httpAction(async (ctx, request) => {
  const body = await readBody(request);
  if (!isAuthorized(body)) return forbidden();
  const result = await ctx.runAction(api.agentTools.getExtraction, {
    agentSecret: body.secret,
    extractionId: body.extractionId,
  });
  return json(result);
});

export const listRecentHypothesesHttp = httpAction(async (ctx, request) => {
  const body = await readBody(request);
  if (!isAuthorized(body)) return forbidden();
  const result = await ctx.runAction(api.agentTools.listRecentHypotheses, {
    agentSecret: body.secret,
    limit: body.limit,
  });
  return json(result);
});

export const listActiveThesesHttp = httpAction(async (ctx, request) => {
  const body = await readBody(request);
  if (!isAuthorized(body)) return forbidden();
  const result = await ctx.runAction(api.agentTools.listActiveTheses, {
    agentSecret: body.secret,
    limit: body.limit,
  });
  return json(result);
});

export const listFailureArchiveHttp = httpAction(async (ctx, request) => {
  const body = await readBody(request);
  if (!isAuthorized(body)) return forbidden();
  const result = await ctx.runAction(api.agentTools.listFailureArchive, {
    agentSecret: body.secret,
    limit: body.limit,
  });
  return json(result);
});

export const getEditorialSignalsHttp = httpAction(async (ctx, request) => {
  const body = await readBody(request);
  if (!isAuthorized(body)) return forbidden();
  const result = await ctx.runAction(api.agentTools.getEditorialSignals, {
    agentSecret: body.secret,
    limit: body.limit,
  });
  return json(result);
});

export const getRecentRecipesHttp = httpAction(async (ctx, request) => {
  const body = await readBody(request);
  if (!isAuthorized(body)) return forbidden();
  const result = await ctx.runAction(api.agentTools.getRecentRecipes, {
    agentSecret: body.secret,
    limit: body.limit,
  });
  return json(result);
});

export const searchSourcesByConceptHttp = httpAction(async (ctx, request) => {
  const body = await readBody(request);
  if (!isAuthorized(body)) return forbidden();
  const result = await ctx.runAction(api.agentTools.searchSourcesByConcept, {
    agentSecret: body.secret,
    concept: body.concept,
    limit: body.limit,
  });
  return json(result);
});
