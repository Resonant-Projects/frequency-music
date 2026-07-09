import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { requireAgentToolSecret } from "./auth";
import { agentRunEventKindValidator } from "./schema";

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
const getForWorkerRef = makeFunctionReference<"query">(
  "agentRuns:getForWorker",
);
const selfImprovementStatsRef = makeFunctionReference<"query">(
  "agentTools:selfImprovementStats",
);

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
    kind: agentRunEventKindValidator,
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

// ============================================================================
// SELF-IMPROVEMENT STATS - weekly brief "what the system learned" section
// (plan 05 task 5). Read-only aggregate of edit-capture volume, human draft
// review decisions, and auditable memory-recall events over a trailing
// window. Prompt promotions are intentionally NOT included here: they have
// no queryable store yet (they live in docs/eval-baselines.md plus the
// decision log via scripts/langsmith/promote.ts). Once promotions land
// somewhere queryable, wire a fourth field here rather than building a
// parallel store.
// ============================================================================

const selfImprovementStatsReturnValidator = v.object({
  windowStart: v.number(),
  windowEnd: v.number(),
  editCaptures: v.object({ count: v.number() }),
  drafts: v.object({
    approved: v.number(),
    rejected: v.number(),
    // Rejection notes are required at reject-time (see agentDrafts:reject), so
    // every rejected draft in the window contributes a note here. Capped so a
    // busy window can't blow out the agent's context.
    rejectionNotes: v.array(v.string()),
  }),
  memoryRecalls: v.object({
    count: v.number(),
    // Raw event messages (e.g. "skipped Schumann×D-root: contradicted in run
    // ..."), capped for the same reason. The memory store itself (plan 05
    // task 3) is gated on Proxmox soak, so this is usually empty today.
    notes: v.array(v.string()),
  }),
});

const MAX_NOTES = 10;

/**
 * Pure aggregation over raw rows: window-filters and summarizes edit
 * captures, decided agent-review drafts, and memory_recall run events. Kept
 * DB-free and exported so it is unit-testable without a Convex harness.
 */
export function summarizeSelfImprovementWindow(input: {
  editCaptures: Array<{ editedAt: number }>;
  decidedDrafts: Array<{
    status: string;
    updatedAt: number;
    decisionNote?: string;
  }>;
  runEvents: Array<{ kind: string; createdAt: number; message: string }>;
  windowStart: number;
  windowEnd: number;
}) {
  const { editCaptures, decidedDrafts, runEvents, windowStart, windowEnd } =
    input;
  const inWindow = (t: number) => t >= windowStart && t <= windowEnd;

  const editCapturesCount = editCaptures.filter((row) =>
    inWindow(row.editedAt),
  ).length;

  const draftsInWindow = decidedDrafts.filter((d) => inWindow(d.updatedAt));
  const approved = draftsInWindow.filter((d) => d.status === "approved").length;
  const rejectedDrafts = draftsInWindow.filter((d) => d.status === "rejected");
  const rejectionNotes = rejectedDrafts
    .map((d) => d.decisionNote?.trim())
    .filter((note): note is string => Boolean(note))
    .slice(0, MAX_NOTES);

  const memoryRecallEvents = runEvents.filter(
    (e) => e.kind === "memory_recall" && inWindow(e.createdAt),
  );
  const memoryRecallNotes = memoryRecallEvents
    .map((e) => e.message)
    .slice(0, MAX_NOTES);

  return {
    windowStart,
    windowEnd,
    editCaptures: { count: editCapturesCount },
    drafts: {
      approved,
      rejected: rejectedDrafts.length,
      rejectionNotes,
    },
    memoryRecalls: {
      count: memoryRecallEvents.length,
      notes: memoryRecallNotes,
    },
  };
}

const MAX_DAYS_BACK = 90;
const DEFAULT_DAYS_BACK = 7;
const RECENT_ROWS_LIMIT = 500;

/**
 * Backing query for the `getSelfImprovementStats` agent tool. Fetches a
 * bounded set of recent rows from each source table (no new indexes needed:
 * editCaptures/agentRunEvents scan in creation order, agentReviewDrafts uses
 * the existing by_status_updatedAt index) and delegates all window logic to
 * the pure `summarizeSelfImprovementWindow` above.
 */
export const selfImprovementStats = query({
  args: { daysBack: v.optional(v.number()) },
  returns: selfImprovementStatsReturnValidator,
  handler: async (ctx, args) => {
    const windowEnd = Date.now();
    const daysBack = Math.max(
      1,
      Math.min(Math.floor(args.daysBack ?? DEFAULT_DAYS_BACK), MAX_DAYS_BACK),
    );
    const windowStart = windowEnd - daysBack * 24 * 60 * 60 * 1000;

    const [editCaptureRows, approvedDrafts, rejectedDrafts, runEventRows] =
      await Promise.all([
        ctx.db.query("editCaptures").order("desc").take(RECENT_ROWS_LIMIT),
        ctx.db
          .query("agentReviewDrafts")
          .withIndex("by_status_updatedAt", (q) => q.eq("status", "approved"))
          .order("desc")
          .take(RECENT_ROWS_LIMIT),
        ctx.db
          .query("agentReviewDrafts")
          .withIndex("by_status_updatedAt", (q) => q.eq("status", "rejected"))
          .order("desc")
          .take(RECENT_ROWS_LIMIT),
        ctx.db.query("agentRunEvents").order("desc").take(RECENT_ROWS_LIMIT),
      ]);

    return summarizeSelfImprovementWindow({
      editCaptures: editCaptureRows,
      decidedDrafts: [...approvedDrafts, ...rejectedDrafts],
      runEvents: runEventRows,
      windowStart,
      windowEnd,
    });
  },
});

export const getSelfImprovementStats = action({
  args: {
    agentSecret: v.string(),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.agentSecret);
    return await ctx.runQuery(selfImprovementStatsRef, {
      daysBack: args.daysBack,
    });
  },
});
