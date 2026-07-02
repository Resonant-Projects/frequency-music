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
const createAgentRunRef = makeFunctionReference<"mutation">("agentRuns:create");
const markAgentRunRunningRef = makeFunctionReference<"mutation">(
  "agentRuns:markRunning",
);
const appendAgentRunEventRef = makeFunctionReference<"mutation">(
  "agentRuns:appendEvent",
);
const markAgentRunCompletedRef = makeFunctionReference<"mutation">(
  "agentRuns:markCompleted",
);
const markAgentRunNeedsReviewRef = makeFunctionReference<"mutation">(
  "agentRuns:markNeedsReview",
);
const markAgentRunFailedRef = makeFunctionReference<"mutation">(
  "agentRuns:markFailed",
);
const createAgentReviewDraftRef = makeFunctionReference<"mutation">(
  "agentDrafts:createFromAgentRun",
);
const claimNextPendingRef = makeFunctionReference<"mutation">(
  "agentRuns:claimNextPending",
);
const getForWorkerRef = makeFunctionReference<"query">("agentRuns:getForWorker");

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined),
  ) as T;
}

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

export const createAgentRun = action({
  args: {
    agentSecret: v.string(),
    graphName: v.string(),
    input: v.optional(v.any()),
    traceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    const created = await ctx.runMutation(
      createAgentRunRef,
      omitUndefined({
        graphName: args.graphName,
        input: args.input,
        traceUrl: args.traceUrl,
      }),
    );
    const running = await ctx.runMutation(markAgentRunRunningRef, {
      runId: created.runId,
    });
    return {
      runId: created.runId,
      status: running.status,
      createdAt: created.createdAt,
      startedAt: running.startedAt,
      updatedAt: running.updatedAt,
    };
  },
});

export const appendAgentRunEvent = action({
  args: {
    agentSecret: v.string(),
    runId: v.id("agentRuns"),
    kind: v.union(
      v.literal("tool_call"),
      v.literal("decision"),
      v.literal("draft_write"),
      v.literal("error"),
      v.literal("review_request"),
      v.literal("status"),
      v.literal("node"),
    ),
    message: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runMutation(
      appendAgentRunEventRef,
      omitUndefined({
        runId: args.runId,
        kind: args.kind,
        message: args.message,
        payload: args.payload,
      }),
    );
  },
});

export const markAgentRunCompleted = action({
  args: {
    agentSecret: v.string(),
    runId: v.id("agentRuns"),
    summary: v.optional(v.string()),
    traceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runMutation(
      markAgentRunCompletedRef,
      omitUndefined({
        runId: args.runId,
        summary: args.summary,
        traceUrl: args.traceUrl,
      }),
    );
  },
});

export const markAgentRunNeedsReview = action({
  args: {
    agentSecret: v.string(),
    runId: v.id("agentRuns"),
    summary: v.optional(v.string()),
    reviewDraft: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runMutation(
      markAgentRunNeedsReviewRef,
      omitUndefined({
        runId: args.runId,
        summary: args.summary,
        reviewDraft: args.reviewDraft,
      }),
    );
  },
});

export const createAgentReviewDraft = action({
  args: {
    agentSecret: v.string(),
    agentRunId: v.id("agentRuns"),
    draft: v.any(),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runMutation(createAgentReviewDraftRef, {
      agentRunId: args.agentRunId,
      draft: args.draft,
    });
  },
});

export const markAgentRunFailed = action({
  args: {
    agentSecret: v.string(),
    runId: v.id("agentRuns"),
    summary: v.optional(v.string()),
    error: v.optional(v.any()),
    traceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runMutation(
      markAgentRunFailedRef,
      omitUndefined({
        runId: args.runId,
        summary: args.summary,
        error: args.error,
        traceUrl: args.traceUrl,
      }),
    );
  },
});

// Production-worker queue surface. Claiming is a lifecycle write (queued ->
// running), consistent with the audit-write policy: secret-gated, never a
// research-data write.
export const claimNextPendingRun = action({
  args: {
    agentSecret: v.string(),
    workerId: v.string(),
    graphName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runMutation(
      claimNextPendingRef,
      omitUndefined({ workerId: args.workerId, graphName: args.graphName }),
    );
  },
});

export const getAgentRun = action({
  args: {
    agentSecret: v.string(),
    runId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(getForWorkerRef, { runId: args.runId });
  },
});
