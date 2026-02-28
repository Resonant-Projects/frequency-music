import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("idea"),
        v.literal("in_progress"),
        v.literal("rendered"),
        v.literal("published"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;

    if (args.status) {
      return await ctx.db
        .query("compositions")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("compositions").order("desc").take(limit);
  },
});

export const get = query({
  args: { id: v.id("compositions") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const composition = await ctx.db.get("compositions", args.id);
    if (!composition) return null;

    const recipe = await ctx.db.get("recipes", composition.recipeId);
    const listeningSessions = await ctx.db
      .query("listeningSessions")
      .withIndex("by_compositionId_createdAt", (q) =>
        q.eq("compositionId", composition._id),
      )
      .order("desc")
      .collect();

    return {
      ...composition,
      recipe,
      listeningSessions,
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    recipeId: v.id("recipes"),
    artifactType: v.optional(
      v.union(
        v.literal("microStudy"),
        v.literal("expandedStudy"),
        v.literal("fullTrack"),
      ),
    ),
    projectNotesMd: v.optional(v.string()),
    version: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("compositions"),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const identity = await requireAuth(ctx, args);
    const recipe = await ctx.db.get("recipes", createArgs.recipeId);
    if (!recipe) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    const now = Date.now();
    return await ctx.db.insert("compositions", {
      title: createArgs.title,
      recipeId: createArgs.recipeId,
      artifactType: createArgs.artifactType ?? "microStudy",
      projectNotesMd: createArgs.projectNotesMd,
      version: createArgs.version ?? "v0.1",
      status: "idea",
      visibility: "private",
      createdBy: createArgs.createdBy ?? identity.subject,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("compositions"),
    title: v.optional(v.string()),
    artifactType: v.optional(
      v.union(
        v.literal("microStudy"),
        v.literal("expandedStudy"),
        v.literal("fullTrack"),
      ),
    ),
    projectNotesMd: v.optional(v.string()),
    links: v.optional(
      v.array(
        v.object({
          label: v.string(),
          url: v.string(),
        }),
      ),
    ),
    version: v.optional(v.string()),
    diffNote: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("idea"),
        v.literal("in_progress"),
        v.literal("rendered"),
        v.literal("published"),
      ),
    ),
    visibility: v.optional(
      v.union(v.literal("private"), v.literal("followers"), v.literal("public")),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const composition = await ctx.db.get("compositions", args.id);
    if (!composition) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Composition not found" });
    }

    const { id, devBypassSecret: _devBypassSecret, ...patch } = args;
    await ctx.db.patch("compositions", id, {
      ...patch,
      updatedAt: Date.now(),
    });

    return null;
  },
});
