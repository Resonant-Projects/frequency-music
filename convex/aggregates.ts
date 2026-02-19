/**
 * Aggregate Functions
 * 
 * Uses @convex-dev/aggregate for efficient counts
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { TableAggregate } from "@convex-dev/aggregate";

// ============================================================================
// CONCEPT MENTIONS AGGREGATE
// ============================================================================

/**
 * Aggregate for ranking concepts by mention count
 * Uses any type since DataModel isn't available at compile time
 */
export const conceptsAggregate = new TableAggregate<any, "concepts">(
  components.aggregate,
  {
    sortKey: (doc: any) => doc.mentionCount,
    sumValue: (doc: any) => doc.mentionCount,
  }
);

// ============================================================================
// AGGREGATE QUERIES
// ============================================================================

/**
 * Get total number of concepts
 */
export const getTotalConceptCount = query({
  args: {},
  handler: async (ctx) => {
    return await conceptsAggregate.count(ctx);
  },
});

/**
 * Get total mentions across all concepts
 */
export const getTotalMentions = query({
  args: {},
  handler: async (ctx) => {
    return await conceptsAggregate.sum(ctx);
  },
});

/**
 * Get top concepts by mention count (efficient O(log n) lookup)
 */
export const getTopConceptsRanked = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    const total = await conceptsAggregate.count(ctx);
    if (total === 0) return [];
    
    // Get items with highest mentionCount (from end of sorted list)
    const results = [];
    for (let i = 0; i < Math.min(limit, total); i++) {
      const item = await conceptsAggregate.at(ctx, total - 1 - i);
      if (item) results.push(item);
    }
    
    return results;
  },
});

// ============================================================================
// SOURCE STATUS AGGREGATE
// ============================================================================

/**
 * Aggregate for counting sources by status
 */
export const sourcesByStatusAggregate = new TableAggregate<any, "sources">(
  components.aggregate,
  {
    namespace: (doc: any) => doc.status,
    sortKey: (doc: any) => doc.createdAt,
  }
);

/**
 * Get source counts by status (efficient dashboard stats)
 */
export const getSourceCounts = query({
  args: {},
  handler: async (ctx) => {
    const statuses = [
      "ingested",
      "text_ready", 
      "extracting",
      "extracted",
      "triaged",
      "review_needed",
    ];
    
    const counts: Record<string, number> = {};
    
    for (const status of statuses) {
      counts[status] = await sourcesByStatusAggregate.count(ctx, {
        namespace: status,
      });
    }
    
    return counts;
  },
});

/**
 * Get total source count
 */
export const getTotalSourceCount = query({
  args: {},
  handler: async (ctx) => {
    return await sourcesByStatusAggregate.count(ctx);
  },
});

// ============================================================================
// AGGREGATE MAINTENANCE
// ============================================================================

/**
 * Rebuild concept aggregate from scratch
 * Run this if counts get out of sync
 */
export const rebuildConceptAggregate = internalMutation({
  args: {},
  handler: async (ctx) => {
    await conceptsAggregate.clear(ctx);
    
    const concepts = await ctx.db.query("concepts").collect();
    
    for (const concept of concepts) {
      await conceptsAggregate.insert(ctx, concept);
    }
    
    return { rebuilt: concepts.length };
  },
});

/**
 * Rebuild source status aggregate
 */
export const rebuildSourceAggregate = internalMutation({
  args: {},
  handler: async (ctx) => {
    await sourcesByStatusAggregate.clear(ctx);
    
    const sources = await ctx.db.query("sources").collect();
    
    for (const source of sources) {
      await sourcesByStatusAggregate.insert(ctx, source);
    }
    
    return { rebuilt: sources.length };
  },
});
