import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { agentRunEventKindValidator, agentRunStatusValidator } from "./schema";
import { requireAuth } from "./auth";

const agentRunStatuses = [
  "queued",
  "running",
  "needs_review",
  "completed",
  "failed",
  "cancelled",
] as const;

type AgentRunStatus = (typeof agentRunStatuses)[number];

function clampLimit(limit: number | undefined, fallback = 50, max = 200) {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(Math.floor(limit), max));
}

export function clampAgentRunLimit(limit: number | undefined) {
  return clampLimit(limit, 25, 100);
}

export function buildAgentRunStatusCounts(runs: Array<{ status: AgentRunStatus }>) {
  const counts = Object.fromEntries(agentRunStatuses.map((status) => [status, 0])) as Record<
    AgentRunStatus,
    number
  >;

  for (const run of runs) counts[run.status] += 1;
  return counts;
}

// A running run with no event (updatedAt) inside this window is presumed crashed.
export const DEFAULT_STALE_RUN_MS = 30 * 60 * 1000;

// Pure queue helpers (unit-tested; the repo has no live-DB test harness).
export function isStaleRun(
  run: { status: string; updatedAt: number },
  now: number,
  thresholdMs: number = DEFAULT_STALE_RUN_MS,
): boolean {
  return run.status === "running" && now - run.updatedAt > thresholdMs;
}

export function buildClaimPatch(workerId: string, now: number) {
  return { status: "running" as const, workerId, startedAt: now, updatedAt: now };
}

export function buildStalePatch(now: number) {
  return { status: "failed" as const, finishedAt: now, updatedAt: now };
}

export function safeTraceUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isSmokeInput(input: unknown) {
  return Boolean(input && typeof input === "object" && "smokeMode" in input && input.smokeMode);
}

const reviewDraftKinds = new Set(["dry_run_summary", "hypothesis_draft", "recipe_draft"]);

export function safeReviewDraft(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const draft = value as {
    kind?: unknown;
    title?: unknown;
    summary?: unknown;
    candidateIds?: unknown;
    needsReview?: unknown;
  };
  if (typeof draft.kind !== "string" || !reviewDraftKinds.has(draft.kind)) return undefined;
  if (typeof draft.title !== "string" || typeof draft.summary !== "string") return undefined;
  if (!Array.isArray(draft.candidateIds) || !draft.candidateIds.every((id) => typeof id === "string")) {
    return undefined;
  }
  if (typeof draft.needsReview !== "boolean") return undefined;
  return {
    kind: draft.kind as "dry_run_summary" | "hypothesis_draft" | "recipe_draft",
    title: draft.title,
    summary: draft.summary,
    candidateIds: draft.candidateIds,
    needsReview: draft.needsReview,
  };
}

export function summarizeRun(run: Doc<"agentRuns">) {
  return {
    _id: run._id,
    _creationTime: run._creationTime,
    graphName: run.graphName,
    status: run.status,
    summary: run.summary,
    traceUrl: safeTraceUrl(run.traceUrl),
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    updatedAt: run.updatedAt,
    smokeMode: isSmokeInput(run.input),
    reviewDraft: safeReviewDraft(run.reviewDraft),
  };
}

function summarizeEvent(event: Doc<"agentRunEvents">) {
  return {
    _id: event._id,
    _creationTime: event._creationTime,
    runId: event.runId,
    kind: event.kind,
    message: event.message,
    createdAt: event.createdAt,
  };
}

async function queryRecentRuns(
  ctx: { db: QueryCtx["db"] },
  args: { limit?: number; status?: AgentRunStatus; graphName?: string },
) {
  const limit = clampAgentRunLimit(args.limit);

  if (args.status && args.graphName) {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_status_graphName_updatedAt", (q) =>
        q.eq("status", args.status!).eq("graphName", args.graphName!),
      )
      .order("desc")
      .take(limit);
  }

  if (args.status) {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status!))
      .order("desc")
      .take(limit);
  }

  if (args.graphName) {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_graphName_updatedAt", (q) => q.eq("graphName", args.graphName!))
      .order("desc")
      .take(limit);
  }

  return await ctx.db.query("agentRuns").withIndex("by_updatedAt").order("desc").take(limit);
}

async function appendRunEvent(
  ctx: MutationCtx,
  args: {
    runId: Id<"agentRuns">;
    kind: "tool_call" | "decision" | "draft_write" | "error" | "review_request" | "status" | "node";
    message: string;
    payload?: unknown;
  },
  now = Date.now(),
) {
  return await ctx.db.insert("agentRunEvents", {
    runId: args.runId,
    kind: args.kind,
    message: args.message,
    ...(args.payload === undefined ? {} : { payload: args.payload }),
    createdAt: now,
  });
}

async function insertQueuedRun(
  ctx: MutationCtx,
  args: { graphName: string; input?: unknown; traceUrl?: string },
) {
  const now = Date.now();
  const runId = await ctx.db.insert("agentRuns", {
    graphName: args.graphName,
    status: "queued",
    input: args.input ?? null,
    ...(args.traceUrl === undefined ? {} : { traceUrl: args.traceUrl }),
    createdAt: now,
    updatedAt: now,
  });
  await appendRunEvent(ctx, {
    runId,
    kind: "status",
    message: "Agent run queued",
    payload: { graphName: args.graphName },
  }, now);
  return { runId, status: "queued" as const, createdAt: now, updatedAt: now };
}

export const create = internalMutation({
  args: {
    graphName: v.string(),
    input: v.optional(v.any()),
    traceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => insertQueuedRun(ctx, args),
});

// Semantic alias used by scheduler crons to enqueue work for the worker to claim.
export const enqueue = internalMutation({
  args: {
    graphName: v.string(),
    input: v.optional(v.any()),
    traceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => insertQueuedRun(ctx, args),
});

// Atomically claim the oldest queued run (optionally for a specific graph).
// Convex mutations are serializable, so read-verify-patch here is race-safe and
// prevents a two-worker future from double-running the same run.
export const claimNextPending = internalMutation({
  args: { workerId: v.string(), graphName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const candidate = args.graphName
      ? await ctx.db
          .query("agentRuns")
          .withIndex("by_status_graphName_updatedAt", (q) =>
            q.eq("status", "queued").eq("graphName", args.graphName!),
          )
          .order("asc")
          .first()
      : await ctx.db
          .query("agentRuns")
          .withIndex("by_status_updatedAt", (q) => q.eq("status", "queued"))
          .order("asc")
          .first();
    if (!candidate || candidate.status !== "queued") return null;

    await ctx.db.patch(candidate._id, buildClaimPatch(args.workerId, now));
    await appendRunEvent(ctx, {
      runId: candidate._id,
      kind: "status",
      message: `Claimed by worker ${args.workerId}`,
      payload: { workerId: args.workerId },
    }, now);
    return {
      runId: candidate._id,
      graphName: candidate.graphName,
      input: candidate.input ?? null,
      status: "running" as const,
      workerId: args.workerId,
      startedAt: now,
    };
  },
});

// Full run doc (including raw input) for worker status polling. summarizeRun and
// the public getters strip input / require auth, hence this internal query.
export const getForWorker = internalQuery({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    return {
      runId: run._id,
      graphName: run.graphName,
      status: run.status,
      input: run.input ?? null,
      workerId: run.workerId,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
    };
  },
});

// Mark crashed workers' runs as failed so they don't wedge the queue.
export const sweepStaleRuns = internalMutation({
  args: { thresholdMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threshold = args.thresholdMs ?? DEFAULT_STALE_RUN_MS;
    const running = await ctx.db
      .query("agentRuns")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "running"))
      .collect();
    let swept = 0;
    for (const run of running) {
      if (!isStaleRun(run, now, threshold)) continue;
      await ctx.db.patch(run._id, buildStalePatch(now));
      await appendRunEvent(ctx, {
        runId: run._id,
        kind: "error",
        message: "Agent run failed: stale worker (no events within threshold)",
        payload: { reason: "stale_worker", staleForMs: now - run.updatedAt, workerId: run.workerId },
      }, now);
      swept += 1;
    }
    return { swept };
  },
});

export const markRunning = internalMutation({
  args: {
    runId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: "running",
      startedAt: now,
      updatedAt: now,
    });
    await appendRunEvent(ctx, {
      runId: args.runId,
      kind: "status",
      message: "Agent run started",
    }, now);
    return { runId: args.runId, status: "running" as const, startedAt: now, updatedAt: now };
  },
});

export const appendEvent = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    kind: agentRunEventKindValidator,
    message: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const eventId = await appendRunEvent(ctx, args, now);
    await ctx.db.patch(args.runId, { updatedAt: now });
    return { eventId, runId: args.runId, createdAt: now };
  },
});

export const markNeedsReview = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    summary: v.optional(v.string()),
    reviewDraft: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const reviewDraft = safeReviewDraft(args.reviewDraft);
    await ctx.db.patch(args.runId, {
      status: "needs_review",
      ...(args.summary === undefined ? {} : { summary: args.summary }),
      ...(reviewDraft === undefined ? {} : { reviewDraft }),
      updatedAt: now,
    });
    await appendRunEvent(ctx, {
      runId: args.runId,
      kind: "review_request",
      message: "Agent run needs review",
      ...(args.summary === undefined ? {} : { payload: { summary: args.summary } }),
    }, now);
    return { runId: args.runId, status: "needs_review" as const, updatedAt: now };
  },
});

export const markCompleted = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    summary: v.optional(v.string()),
    traceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: "completed",
      ...(args.summary === undefined ? {} : { summary: args.summary }),
      ...(args.traceUrl === undefined ? {} : { traceUrl: args.traceUrl }),
      finishedAt: now,
      updatedAt: now,
    });
    await appendRunEvent(ctx, {
      runId: args.runId,
      kind: "status",
      message: "Agent run completed",
      payload: {
        ...(args.summary === undefined ? {} : { summary: args.summary }),
        ...(args.traceUrl === undefined ? {} : { traceUrl: args.traceUrl }),
      },
    }, now);
    return { runId: args.runId, status: "completed" as const, finishedAt: now, updatedAt: now };
  },
});

export const markFailed = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    summary: v.optional(v.string()),
    error: v.optional(v.any()),
    traceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: "failed",
      ...(args.summary === undefined ? {} : { summary: args.summary }),
      ...(args.traceUrl === undefined ? {} : { traceUrl: args.traceUrl }),
      finishedAt: now,
      updatedAt: now,
    });
    await appendRunEvent(ctx, {
      runId: args.runId,
      kind: "error",
      message: args.summary ?? "Agent run failed",
      payload: {
        ...(args.error === undefined ? {} : { error: args.error }),
        ...(args.traceUrl === undefined ? {} : { traceUrl: args.traceUrl }),
      },
    }, now);
    return { runId: args.runId, status: "failed" as const, finishedAt: now, updatedAt: now };
  },
});

export const get = query({
  args: { runId: v.id("agentRuns"), devBypassSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    return { ...run, traceUrl: safeTraceUrl(run.traceUrl) };
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(agentRunStatusValidator),
    graphName: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const runs = await queryRecentRuns(ctx, args);
    return runs.map(summarizeRun);
  },
});

export const listRecentPublic = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(agentRunStatusValidator),
    graphName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const runs = await queryRecentRuns(ctx, args);
    return runs.map(summarizeRun);
  },
});

export const getPublic = query({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    return run ? summarizeRun(run) : null;
  },
});

export const statusCountsPublic = query({
  args: { limit: v.optional(v.number()), graphName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const limit = clampAgentRunLimit(args.limit);
    const runs = args.graphName
      ? await ctx.db
          .query("agentRuns")
          .withIndex("by_graphName_updatedAt", (q) => q.eq("graphName", args.graphName!))
          .order("desc")
          .take(limit)
      : await ctx.db.query("agentRuns").withIndex("by_updatedAt").order("desc").take(limit);

    return buildAgentRunStatusCounts(runs);
  },
});

export const listEventsPublic = query({
  args: {
    runId: v.id("agentRuns"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return (
      await ctx.db
        .query("agentRunEvents")
        .withIndex("by_runId_createdAt", (q) => q.eq("runId", args.runId))
        .order("desc")
        .take(clampLimit(args.limit))
    ).map(summarizeEvent);
  },
});

export const statusCounts = query({
  args: {
    limit: v.optional(v.number()),
    graphName: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const limit = clampAgentRunLimit(args.limit);
    const runs = args.graphName
      ? await ctx.db
          .query("agentRuns")
          .withIndex("by_graphName_updatedAt", (q) => q.eq("graphName", args.graphName!))
          .order("desc")
          .take(limit)
      : await ctx.db.query("agentRuns").withIndex("by_updatedAt").order("desc").take(limit);

    return buildAgentRunStatusCounts(runs);
  },
});

export const listByStatus = query({
  args: {
    status: agentRunStatusValidator,
    limit: v.optional(v.number()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status))
      .order("desc")
      .take(clampLimit(args.limit));
  },
});

export const listEvents = query({
  args: {
    runId: v.id("agentRuns"),
    limit: v.optional(v.number()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await ctx.db
      .query("agentRunEvents")
      .withIndex("by_runId_createdAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(clampLimit(args.limit));
  },
});
