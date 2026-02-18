import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all enabled feeds
 */
export const listEnabled = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("feeds")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

/**
 * List all feeds
 */
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("feeds").collect();
  },
});

/**
 * Get a single feed
 */
export const get = query({
  args: { id: v.id("feeds") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new feed
 */
export const create = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    type: v.union(v.literal("rss"), v.literal("podcast"), v.literal("youtube")),
    category: v.optional(v.string()),
    pollIntervalMs: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("feeds", {
      ...args,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update feed poll timestamp
 */
export const updateLastPolled = internalMutation({
  args: {
    id: v.id("feeds"),
    lastPolledAt: v.number(),
    lastItemAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastPolledAt: args.lastPolledAt,
      lastItemAt: args.lastItemAt,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Toggle feed enabled status
 */
export const setEnabled = mutation({
  args: {
    id: v.id("feeds"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a feed
 */
export const remove = mutation({
  args: { id: v.id("feeds") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ============================================================================
// SEED DATA - Initial feeds from source document
// ============================================================================

/**
 * Seed the initial feeds from the source document
 */
export const seedInitialFeeds = mutation({
  handler: async (ctx) => {
    const now = Date.now();
    const feeds = [
      // Academic Journals
      {
        name: "Quanta Magazine",
        url: "https://api.quantamagazine.org/feed/",
        type: "rss" as const,
        category: "magazine",
      },
      {
        name: "Music and the Brain Podcast",
        url: "https://www.loc.gov/podcasts/musicandthebrain/feed/", // May need verification
        type: "podcast" as const,
        category: "podcast",
      },
      // YouTube channels (will need YouTube API or RSS bridge)
      {
        name: "3Blue1Brown",
        url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw",
        type: "youtube" as const,
        category: "youtube",
      },
      {
        name: "Adam Neely",
        url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCnkp4xDOwqqJD7sSM3xdUiQ",
        type: "youtube" as const,
        category: "youtube",
      },
      {
        name: "David Bennett Piano",
        url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCz2iUx-Imr6HgDC3zAFpjOw",
        type: "youtube" as const,
        category: "youtube",
      },
    ];

    const results = [];
    for (const feed of feeds) {
      // Check if already exists
      const existing = await ctx.db
        .query("feeds")
        .filter((q) => q.eq(q.field("url"), feed.url))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("feeds", {
          ...feed,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
        results.push({ name: feed.name, id, created: true });
      } else {
        results.push({ name: feed.name, id: existing._id, created: false });
      }
    }

    return results;
  },
});
