import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

export type AgentSafeExtraction = {
  id: string;
  sourceId?: string;
  summary?: string;
  claims?: unknown[];
  compositionParameters?: unknown[];
  topics?: string[];
  openQuestions?: string[];
  model?: string;
  promptVersion?: string;
  createdAt?: number;
};

type SecretValue = string | undefined;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= (bufA[i] as number) ^ (bufB[i] as number);
  }
  return result === 0;
}

export function validateAgentToolSecretValue(expected: SecretValue, provided: SecretValue): boolean {
  return Boolean(expected && provided && constantTimeEqual(expected, provided));
}

export function requireAgentToolSecret(provided: SecretValue): void {
  if (!validateAgentToolSecretValue(process.env.AGENT_TOOL_SECRET, provided)) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "Invalid agent tool secret" });
  }
}

export function sanitizeExtractionForAgent(row: Record<string, any>): AgentSafeExtraction {
  return {
    id: String(row._id ?? row.id),
    sourceId: row.sourceId ? String(row.sourceId) : undefined,
    summary: row.summary,
    claims: row.claims,
    compositionParameters: row.compositionParameters,
    topics: row.topics,
    openQuestions: row.openQuestions,
    model: row.model,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt,
  };
}

export function sanitizeSourceForAgent(row: Record<string, any>) {
  return {
    id: String(row._id ?? row.id),
    type: row.type,
    title: row.title,
    author: row.author,
    canonicalUrl: row.canonicalUrl,
    publishedAt: row.publishedAt,
    tags: row.tags,
    topics: row.topics,
    status: row.status,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function limitArg(limit: number | undefined, fallback: number, max: number) {
  return Math.min(Math.max(limit ?? fallback, 1), max);
}

export const listRecentExtractions = action({
  args: { agentSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    const rows = await ctx.runQuery(api.extractions.listRecent, {
      limit: limitArg(args.limit, 20, 50),
    });
    return rows.map((row) => sanitizeExtractionForAgent(row));
  },
});

export const getExtraction = action({
  args: { agentSecret: v.string(), extractionId: v.id("extractions") },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    const row = await ctx.runQuery(api.extractions.get, { id: args.extractionId });
    return row ? sanitizeExtractionForAgent(row) : null;
  },
});

export const listRecentHypotheses = action({
  args: { agentSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(api.hypotheses.listByStatus, {
      limit: limitArg(args.limit, 20, 50),
    });
  },
});

export const listActiveTheses = action({
  args: { agentSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(api.theses.list, {
      status: "active",
      limit: limitArg(args.limit, 20, 50),
    });
  },
});

export const listFailureArchive = action({
  args: { agentSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(api.failures.listArchive, {
      limit: limitArg(args.limit, 20, 50),
    });
  },
});

export const getEditorialSignals = action({
  args: { agentSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(api.dashboard.editorialSignals, {
      limit: limitArg(args.limit, 8, 24),
    });
  },
});

export const getRecentRecipes = action({
  args: { agentSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(api.recipes.listByStatus, {
      limit: limitArg(args.limit, 20, 50),
    });
  },
});

export const searchSourcesByConcept = action({
  args: { agentSecret: v.string(), concept: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    const rows = await ctx.runQuery(api.sources.searchByConcept, {
      concept: args.concept,
      limit: limitArg(args.limit, 10, 25),
    });
    return rows.map((row) => sanitizeSourceForAgent(row));
  },
});
