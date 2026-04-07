import { v } from "convex/values";
import { query } from "./_generated/server";
import { extractionReturnValidator } from "./validators";

/**
 * Get a single extraction by ID
 */
export const get = query({
  args: { id: v.id("extractions") },
  returns: v.union(extractionReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("extractions", args.id);
  },
});

/**
 * Get extraction by input hash (for deduplication)
 */
export const getByInputHash = query({
  args: { inputHash: v.string() },
  returns: v.union(extractionReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractions")
      .withIndex("by_inputHash", (q) => q.eq("inputHash", args.inputHash))
      .first();
  },
});

/**
 * Get extractions for a source
 */
export const getBySourceId = query({
  args: { sourceId: v.id("sources") },
  returns: v.array(extractionReturnValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractions")
      .withIndex("by_sourceId_createdAt", (q) => q.eq("sourceId", args.sourceId))
      .order("desc")
      .collect();
  },
});

/**
 * List recent extractions
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(extractionReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db.query("extractions").order("desc").take(limit);
  },
});
