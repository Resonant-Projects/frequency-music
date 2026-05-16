import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireAgentToolSecret } from "./auth";

const listRecentExtractionsRef = makeFunctionReference<"query">(
  "extractions:listRecent",
);
const getExtractionRef = makeFunctionReference<"query">("extractions:get");
const listRecentHypothesesRef = makeFunctionReference<"query">(
  "hypotheses:listByStatus",
);
const listActiveThesesRef = makeFunctionReference<"query">("theses:list");
const listFailureArchiveRef = makeFunctionReference<"query">(
  "failures:listArchive",
);
const getEditorialSignalsRef = makeFunctionReference<"query">(
  "dashboard:editorialSignals",
);
const getRecentRecipesRef = makeFunctionReference<"query">(
  "recipes:listByStatus",
);
const getRecommendedActionsRef = makeFunctionReference<"query">(
  "campaigns:getRecommendedActions",
);
const searchSourcesByConceptRef = makeFunctionReference<"query">(
  "graph:searchSourcesByConcept",
);

export const listRecentExtractions = action({
  args: {
    agentSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(listRecentExtractionsRef, {
      limit: args.limit ?? 20,
    });
  },
});

export const getExtraction = action({
  args: {
    agentSecret: v.string(),
    id: v.id("extractions"),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(getExtractionRef, { id: args.id });
  },
});

export const listRecentHypotheses = action({
  args: {
    agentSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(listRecentHypothesesRef, {
      limit: args.limit ?? 20,
    });
  },
});

export const listActiveTheses = action({
  args: {
    agentSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(listActiveThesesRef, {
      status: "active",
      limit: args.limit ?? 20,
    });
  },
});

export const listFailureArchive = action({
  args: {
    agentSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(listFailureArchiveRef, {
      limit: args.limit ?? 20,
    });
  },
});

export const getEditorialSignals = action({
  args: {
    agentSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(getEditorialSignalsRef, {
      limit: args.limit ?? 24,
    });
  },
});

export const getRecentRecipes = action({
  args: {
    agentSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(getRecentRecipesRef, { limit: args.limit ?? 20 });
  },
});

export const getRecommendedActions = action({
  args: {
    agentSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(getRecommendedActionsRef, {});
  },
});

export const searchSourcesByConcept = action({
  args: {
    agentSecret: v.string(),
    conceptName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(searchSourcesByConceptRef, {
      conceptName: args.conceptName,
      limit: args.limit ?? 20,
    });
  },
});
