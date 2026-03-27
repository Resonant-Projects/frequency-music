import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { thesisDetailValidator, thesisReturnValidator } from "./validators";

const thesisStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("retired"),
);

export const list = query({
  args: {
    status: v.optional(thesisStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(thesisReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const status = args.status;

    if (status !== undefined) {
      return await ctx.db
        .query("theses")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("theses").order("desc").take(limit);
  },
});

export const get = query({
  args: { id: v.id("theses") },
  returns: v.union(thesisReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("theses", args.id);
  },
});

export const getByIds = query({
  args: { ids: v.array(v.id("theses")) },
  returns: v.array(thesisReturnValidator),
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.ids.map((id) => ctx.db.get("theses", id)),
    );
    return results.filter(
      (thesis): thesis is NonNullable<typeof thesis> => thesis !== null,
    );
  },
});

export const getDetail = query({
  args: { id: v.id("theses") },
  returns: v.union(thesisDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const thesis = await ctx.db.get("theses", args.id);
    if (!thesis) return null;

    const hypotheses = await ctx.db
      .query("hypotheses")
      .withIndex("by_thesisId_updatedAt", (q) => q.eq("thesisId", args.id))
      .order("desc")
      .collect();

    const recipeLists = await Promise.all(
      hypotheses.map((hypothesis) =>
        ctx.db
          .query("recipes")
          .withIndex("by_hypothesisId_updatedAt", (q) =>
            q.eq("hypothesisId", hypothesis._id),
          )
          .order("desc")
          .take(50),
      ),
    );
    const recipes = recipeLists.flat();

    const compositionLists = await Promise.all(
      recipes.map((recipe) =>
        ctx.db
          .query("compositions")
          .withIndex("by_recipeId_updatedAt", (q) =>
            q.eq("recipeId", recipe._id),
          )
          .order("desc")
          .take(50),
      ),
    );
    const compositions = compositionLists.flat();

    const weeklyBriefs = await ctx.db
      .query("weeklyBriefs")
      .order("desc")
      .take(20);
    const recentWeeklyBriefIds = weeklyBriefs
      .filter((brief) => brief.activeThesisIds?.includes(args.id))
      .slice(0, 5)
      .map((brief) => brief._id);
    const campaigns = (await ctx.db.query("campaigns").order("desc").collect())
      .filter((campaign) => campaign.thesisIds.includes(args.id))
      .slice(0, 10);

    return {
      thesis,
      hypotheses,
      recipes,
      compositions,
      campaigns,
      stats: {
        contradictionCount: hypotheses.filter(
          (hypothesis) => hypothesis.resolution === "contradicted",
        ).length,
        activeCount: hypotheses.filter(
          (hypothesis) => hypothesis.status === "active",
        ).length,
        evaluatedCount: hypotheses.filter(
          (hypothesis) => hypothesis.status === "evaluated",
        ).length,
        retiredCount: hypotheses.filter(
          (hypothesis) => hypothesis.status === "retired",
        ).length,
      },
      recentWeeklyBriefIds,
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    statement: v.string(),
    descriptionMd: v.optional(v.string()),
    status: v.optional(thesisStatusValidator),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("theses"),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const identity = await requireAuth(ctx, args);
    const now = Date.now();

    return await ctx.db.insert("theses", {
      ...createArgs,
      status: createArgs.status ?? "active",
      visibility: "private",
      createdBy:
        identity.subject === "system"
          ? "system"
          : (identity.subject as Id<"users">),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("theses"),
    title: v.optional(v.string()),
    statement: v.optional(v.string()),
    descriptionMd: v.optional(v.string()),
    status: v.optional(thesisStatusValidator),
    visibility: v.optional(
      v.union(
        v.literal("private"),
        v.literal("followers"),
        v.literal("public"),
      ),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const { id, devBypassSecret: _devBypassSecret, ...updates } = args;

    const thesis = await ctx.db.get("theses", id);
    if (!thesis) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Thesis not found",
      });
    }

    await ctx.db.patch("theses", id, { ...updates, updatedAt: Date.now() });
    return null;
  },
});
