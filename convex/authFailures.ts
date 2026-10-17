// Rejected service-identity calls (improvements ledger #20). Actions and HTTP
// actions persist hourly counters here. A rejected query or mutation rolls back
// every write, so those paths emit only the AUTH_FAILURE_LOG_MARKER log line;
// docs/service-identity-inventory.md explains how to read both.
import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import {
  AUTH_FAILURE_ALERT_THRESHOLD,
  AUTH_FAILURE_LABEL_MAX,
  AUTH_FAILURE_PRUNE_BATCH,
  AUTH_FAILURE_REASONS,
  AUTH_FAILURE_RETENTION_MS,
  AUTH_FAILURE_SURFACES,
  AUTH_FAILURE_USER_AGENT_MAX,
  AUTH_FAILURE_WINDOW_MS,
  type AuthFailureSurface,
  authFailureAlertLine,
  boundedLabel,
  windowStartFor,
} from "./shared/authFailures";

const surfaceValidator = literals(...AUTH_FAILURE_SURFACES);
const reasonValidator = literals(...AUTH_FAILURE_REASONS);

export const record = internalMutation({
  args: {
    surface: surfaceValidator,
    reason: reasonValidator,
    operation: v.string(),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({ count: v.number(), surfaceTotal: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = windowStartFor(now);
    const operation = boundedLabel(args.operation, AUTH_FAILURE_LABEL_MAX);
    const userAgent =
      args.userAgent === undefined
        ? undefined
        : boundedLabel(args.userAgent, AUTH_FAILURE_USER_AGENT_MAX);
    const existing = await ctx.db
      .query("authFailureCounters")
      .withIndex("by_key", (q) =>
        q
          .eq("windowStart", windowStart)
          .eq("surface", args.surface)
          .eq("reason", args.reason)
          .eq("operation", operation),
      )
      .unique();
    let count: number;
    if (existing) {
      count = existing.count + 1;
      await ctx.db.patch("authFailureCounters", existing._id, {
        count,
        lastAt: now,
        ...(userAgent === undefined ? {} : { lastUserAgent: userAgent }),
      });
    } else {
      count = 1;
      await ctx.db.insert("authFailureCounters", {
        windowStart,
        surface: args.surface,
        reason: args.reason,
        operation,
        count,
        firstAt: now,
        lastAt: now,
        lastUserAgent: userAgent,
      });
      const expired = await ctx.db
        .query("authFailureCounters")
        .withIndex("by_key", (q) =>
          q.lt("windowStart", now - AUTH_FAILURE_RETENTION_MS),
        )
        .take(AUTH_FAILURE_PRUNE_BATCH);
      for (const row of expired)
        await ctx.db.delete("authFailureCounters", row._id);
    }
    // Increments are serialized, so the surface-hour total reaches the
    // threshold exactly once and the alert line is not repeated.
    const surfaceRows = await ctx.db
      .query("authFailureCounters")
      .withIndex("by_key", (q) =>
        q.eq("windowStart", windowStart).eq("surface", args.surface),
      )
      .collect();
    const surfaceTotal = surfaceRows.reduce((sum, row) => sum + row.count, 0);
    if (surfaceTotal === AUTH_FAILURE_ALERT_THRESHOLD)
      console.error(
        authFailureAlertLine({
          surface: args.surface,
          windowStart,
          total: surfaceTotal,
        }),
      );
    return { count, surfaceTotal };
  },
});

const counterValidator = v.object({
  windowStart: v.number(),
  surface: surfaceValidator,
  reason: reasonValidator,
  operation: v.string(),
  count: v.number(),
  firstAt: v.number(),
  lastAt: v.number(),
  lastUserAgent: v.optional(v.string()),
});

const SUMMARY_MAX_ROWS = 200;

/** Operator view of the last 24 hours of persisted rejections. */
export const summary = query({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: v.object({
    since: v.number(),
    threshold: v.number(),
    totals: v.object({
      bypass: v.number(),
      agent_tool: v.number(),
      media_tool: v.number(),
    }),
    alertingSurfaces: v.array(surfaceValidator),
    counters: v.array(counterValidator),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const now = Date.now();
    const since = windowStartFor(now) - 23 * AUTH_FAILURE_WINDOW_MS;
    const rows = await ctx.db
      .query("authFailureCounters")
      .withIndex("by_key", (q) => q.gte("windowStart", since))
      .order("desc")
      .take(SUMMARY_MAX_ROWS);
    const totals: Record<AuthFailureSurface, number> = {
      bypass: 0,
      agent_tool: 0,
      media_tool: 0,
    };
    const hourly = new Map<string, number>();
    for (const row of rows) {
      totals[row.surface] += row.count;
      const key = `${row.surface}:${row.windowStart}`;
      hourly.set(key, (hourly.get(key) ?? 0) + row.count);
    }
    const alertingSurfaces = AUTH_FAILURE_SURFACES.filter((surface) =>
      [...hourly].some(
        ([key, total]) =>
          key.startsWith(`${surface}:`) &&
          total >= AUTH_FAILURE_ALERT_THRESHOLD,
      ),
    );
    return {
      since,
      threshold: AUTH_FAILURE_ALERT_THRESHOLD,
      totals,
      alertingSurfaces,
      counters: rows.map(({ _id, _creationTime, ...row }) => row),
    };
  },
});
