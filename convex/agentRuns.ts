import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { agentRunEventKindValidator, agentRunStatusValidator } from "./schema";

function clampLimit(limit: number | undefined, fallback = 50, max = 200) {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(Math.floor(limit), max));
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

export const create = internalMutation({
  args: {
    graphName: v.string(),
    input: v.optional(v.any()),
    traceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: "needs_review",
      ...(args.summary === undefined ? {} : { summary: args.summary }),
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
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const listByStatus = query({
  args: {
    status: agentRunStatusValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentRunEvents")
      .withIndex("by_runId_createdAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(clampLimit(args.limit));
  },
});
