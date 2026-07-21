import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { MAX_FEED_ENABLE_STATE_IDS } from "./shared/agentContract";
import { feedReturnValidator } from "./validators";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all enabled feeds
 */
export const listEnabled = query({
  args: {},
  returns: v.array(feedReturnValidator),
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
  args: {},
  returns: v.array(feedReturnValidator),
  handler: async (ctx) => {
    return await ctx.db.query("feeds").collect();
  },
});

/**
 * Get a single feed
 */
export const get = query({
  args: { id: v.id("feeds") },
  returns: v.union(feedReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("feeds", args.id);
  },
});

/**
 * Get the live enable state for a bounded set of feeds.
 */
export const getByIds = query({
  args: { ids: v.array(v.id("feeds")) },
  returns: v.array(
    v.object({
      id: v.id("feeds"),
      enabled: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.ids.length > MAX_FEED_ENABLE_STATE_IDS) {
      throw new ConvexError(
        `Feed enable-state lookup accepts at most ${MAX_FEED_ENABLE_STATE_IDS} ids`,
      );
    }
    const feeds = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return feeds.flatMap((feed) =>
      feed === null ? [] : [{ id: feed._id, enabled: feed.enabled }],
    );
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
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("feeds"),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    await requireAuth(ctx, args);
    const now = Date.now();
    return await ctx.db.insert("feeds", {
      ...createArgs,
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
    await ctx.db.patch("feeds", args.id, {
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
    disabledReason: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const feed = await ctx.db.get("feeds", args.id);
    if (!feed) return null;
    const metadata =
      typeof feed.metadata === "object" && feed.metadata !== null
        ? feed.metadata
        : {};
    await ctx.db.patch("feeds", args.id, {
      enabled: args.enabled,
      metadata:
        !args.enabled && args.disabledReason
          ? { ...metadata, disabledReason: args.disabledReason }
          : feed.metadata,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Delete a feed
 */
export const remove = mutation({
  args: { id: v.id("feeds"), devBypassSecret: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.delete("feeds", args.id);
    return null;
  },
});

// ============================================================================
// SEED DATA - Initial feeds from source document
// ============================================================================

/**
 * Seed the initial feeds from the source document
 */
export const seedInitialFeeds = internalMutation({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      id: v.id("feeds"),
      created: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const now = Date.now();
    const feeds = [
      // === Magazines ===
      {
        name: "Quanta Magazine",
        url: "https://api.quantamagazine.org/feed/",
        type: "rss" as const,
        category: "magazine",
      },
      {
        name: "Nautilus",
        url: "https://nautil.us/feed/",
        type: "rss" as const,
        category: "magazine",
      },

      // === Podcasts ===
      {
        name: "Music and the Brain Podcast",
        url: "https://www.loc.gov/podcasts/musicandthebrain/feed/",
        type: "podcast" as const,
        category: "podcast",
      },

      // === YouTube Channels ===
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
      {
        name: "CymaScope",
        url: "https://www.youtube.com/feeds/videos.xml?channel_id=UChfmWGYc-CA1KwFRqVL9-9w",
        type: "youtube" as const,
        category: "youtube",
      },
      {
        name: "Andrew Huang",
        url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCdcemy56JtVTrsFIOoqvV8g",
        type: "youtube" as const,
        category: "youtube",
      },

      // === Academic/Research (RSS where available) ===
      {
        name: "BRAMS News",
        url: "https://brams.org/feed/",
        type: "rss" as const,
        category: "lab",
      },
    ];

    const results = [];
    for (const feed of feeds) {
      // Check if already exists
      const existing = await ctx.db
        .query("feeds")
        .withIndex("by_url", (q) => q.eq("url", feed.url))
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
