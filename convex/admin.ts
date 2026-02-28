import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { requireAuth } from "./auth";

export const workspaceSnapshot = query({
  args: {},
  returns: v.object({
    sources: v.number(),
    hypotheses: v.number(),
    recipes: v.number(),
    compositions: v.number(),
    weeklyBriefs: v.number(),
    feeds: v.number(),
  }),
  handler: async (ctx) => {
    const [sources, hypotheses, recipes, compositions, weeklyBriefs, feeds] =
      await Promise.all([
        ctx.db.query("sources").collect(),
        ctx.db.query("hypotheses").collect(),
        ctx.db.query("recipes").collect(),
        ctx.db.query("compositions").collect(),
        ctx.db.query("weeklyBriefs").collect(),
        ctx.db.query("feeds").collect(),
      ]);

    return {
      sources: sources.length,
      hypotheses: hypotheses.length,
      recipes: recipes.length,
      compositions: compositions.length,
      weeklyBriefs: weeklyBriefs.length,
      feeds: feeds.length,
    };
  },
});

export const listFeeds = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("feeds").order("desc").collect();
  },
});

export const createFeed = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    type: v.union(v.literal("rss"), v.literal("podcast"), v.literal("youtube")),
    category: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("feeds"),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const now = Date.now();
    return await ctx.db.insert("feeds", {
      ...createArgs,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setFeedEnabled = mutation({
  args: {
    id: v.id("feeds"),
    enabled: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const feed = await ctx.db.get("feeds", args.id);
    if (!feed) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Feed not found" });
    }

    await ctx.db.patch("feeds", args.id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const setSourceStatus = mutation({
  args: {
    id: v.id("sources"),
    status: v.string(),
    blockedReason: v.optional(v.string()),
    blockedDetails: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const source = await ctx.db.get("sources", args.id);
    if (!source) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Source not found" });
    }

    await ctx.db.patch("sources", args.id, {
      status: args.status as any,
      blockedReason: args.blockedReason as any,
      blockedDetails: args.blockedDetails,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const promoteVisibility = mutation({
  args: {
    entityType: v.union(
      v.literal("sources"),
      v.literal("hypotheses"),
      v.literal("recipes"),
      v.literal("compositions"),
      v.literal("weeklyBriefs"),
    ),
    id: v.string(),
    visibility: v.union(v.literal("private"), v.literal("followers"), v.literal("public")),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const now = Date.now();

    switch (args.entityType) {
      case "sources":
        await ctx.db.patch(args.id as any, {
          visibility: args.visibility,
          status:
            args.visibility === "followers"
              ? "promoted_followers"
              : args.visibility === "public"
                ? "promoted_public"
                : "triaged",
          updatedAt: now,
        });
        break;
      case "hypotheses":
      case "recipes":
      case "compositions":
        await ctx.db.patch(args.id as any, {
          visibility: args.visibility,
          updatedAt: now,
        });
        break;
      case "weeklyBriefs":
        await ctx.db.patch(args.id as any, {
          visibility: args.visibility,
          publishedAt: args.visibility === "public" ? now : undefined,
        });
        break;
      default:
        throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Unsupported entity type" });
    }

    return null;
  },
});

export const pollFeedsNow = action({
  args: { devBypassSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await ctx.runAction(api.ingest.pollAllFeeds, {});
  },
});
