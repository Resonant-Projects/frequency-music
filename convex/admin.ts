import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { visibilityValidator } from "./schema";

// Intentionally public — read-only data, personal research tool.
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

// Intentionally public — read-only data, personal research tool.
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
    status: v.union(
      v.literal("ingested"),
      v.literal("text_ready"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("review_needed"),
      v.literal("triaged"),
      v.literal("promoted_followers"),
      v.literal("promoted_public"),
      v.literal("archived"),
    ),
    blockedReason: v.optional(
      v.union(
        v.literal("no_text"),
        v.literal("copyright"),
        v.literal("needs_metadata"),
        v.literal("needs_tagging"),
        v.literal("ai_error"),
        v.literal("needs_human_review"),
        v.literal("duplicate"),
      ),
    ),
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
      status: args.status,
      blockedReason: args.blockedReason,
      blockedDetails: args.blockedDetails,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const promoteVisibility = mutation({
  args: {
    devBypassSecret: v.optional(v.string()),
    input: v.union(
      v.object({
        entityType: v.literal("sources"),
        id: v.id("sources"),
        visibility: visibilityValidator,
      }),
      v.object({
        entityType: v.literal("hypotheses"),
        id: v.id("hypotheses"),
        visibility: visibilityValidator,
      }),
      v.object({
        entityType: v.literal("recipes"),
        id: v.id("recipes"),
        visibility: visibilityValidator,
      }),
      v.object({
        entityType: v.literal("compositions"),
        id: v.id("compositions"),
        visibility: visibilityValidator,
      }),
      v.object({
        entityType: v.literal("weeklyBriefs"),
        id: v.id("weeklyBriefs"),
        visibility: visibilityValidator,
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const now = Date.now();
    const input = args.input;

    switch (input.entityType) {
      case "sources":
        {
          const statusPatch =
            input.visibility === "followers"
              ? { status: "promoted_followers" as const }
              : input.visibility === "public"
                ? { status: "promoted_public" as const }
                : {};

          await ctx.db.patch("sources", input.id, {
            visibility: input.visibility,
            ...statusPatch,
            updatedAt: now,
          });
        }
        break;
      case "hypotheses":
        await ctx.db.patch("hypotheses", input.id, {
          visibility: input.visibility,
          updatedAt: now,
        });
        break;
      case "recipes":
        await ctx.db.patch("recipes", input.id, {
          visibility: input.visibility,
          updatedAt: now,
        });
        break;
      case "compositions":
        await ctx.db.patch("compositions", input.id, {
          visibility: input.visibility,
          updatedAt: now,
        });
        break;
      case "weeklyBriefs":
        await ctx.db.patch("weeklyBriefs", input.id, {
          visibility: input.visibility,
          publishedAt: input.visibility === "public" ? now : undefined,
        });
        break;
      default:
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "Unsupported entity type",
        });
    }

    return null;
  },
});

export const pollFeedsNow = action({
  args: { devBypassSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await ctx.runAction(api.ingest.pollAllFeeds, {
      devBypassSecret: args.devBypassSecret,
    });
  },
});
