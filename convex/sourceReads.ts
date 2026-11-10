import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { sourceStatusValidator } from "./schema";
import { publicSource, sourceReturnValidator } from "./validators";

// Internal twins of the public Source reads in sources.ts. Workflows, crons,
// scheduled functions and actions called with the service secret have no user
// identity, so they read through these instead of the gated public queries.
// Keep every export an internalQuery: none of these may be reachable from a
// client.

export const get = internalQuery({
  args: { id: v.id("sources") },
  returns: v.union(sourceReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const source = await ctx.db.get("sources", args.id);
    return source && publicSource(source);
  },
});

export const getByDedupeKey = internalQuery({
  args: { dedupeKey: v.string() },
  returns: v.union(sourceReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", args.dedupeKey))
      .first();
    return source && publicSource(source);
  },
});

/** Unclamped, unlike the public read: server callers choose their own limit. */
export const listByStatus = internalQuery({
  args: {
    status: sourceStatusValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(sourceReturnValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("sources")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status))
      .order("desc")
      .take(args.limit ?? 50);
    return rows.map(publicSource);
  },
});
