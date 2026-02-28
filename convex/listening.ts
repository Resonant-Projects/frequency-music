import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";

export const listByComposition = query({
  args: { compositionId: v.id("compositions") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("listeningSessions")
      .withIndex("by_compositionId_createdAt", (q) =>
        q.eq("compositionId", args.compositionId),
      )
      .order("desc")
      .collect();
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("listeningSessions")
      .order("desc")
      .take(args.limit ?? 40);
  },
});

export const create = mutation({
  args: {
    compositionId: v.id("compositions"),
    participants: v.array(
      v.object({
        name: v.optional(v.string()),
        userId: v.optional(v.id("users")),
        role: v.optional(v.string()),
      }),
    ),
    contextMd: v.optional(v.string()),
    feedbackMd: v.string(),
    ratings: v.optional(
      v.object({
        bodilyPleasantness: v.optional(v.number()),
        goosebumps: v.optional(v.number()),
        perceivedConsonance: v.optional(v.number()),
        musicality: v.optional(v.number()),
        easeOfComposability: v.optional(v.number()),
        consonanceComputed: v.optional(v.number()),
      }),
    ),
    bodyMapNotes: v.optional(v.string()),
    expandVerdict: v.optional(
      v.union(v.literal("yes"), v.literal("maybe"), v.literal("no")),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("listeningSessions"),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const composition = await ctx.db.get("compositions", args.compositionId);
    if (!composition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Composition not found",
      });
    }

    return await ctx.db.insert("listeningSessions", {
      compositionId: args.compositionId,
      participants: args.participants,
      contextMd: args.contextMd,
      feedbackMd: args.feedbackMd,
      ratings: args.ratings ?? {},
      bodyMapNotes: args.bodyMapNotes,
      expandVerdict: args.expandVerdict,
      visibility: "private",
      createdBy: identity.subject,
      createdAt: Date.now(),
    });
  },
});

export const updateVisibility = mutation({
  args: {
    id: v.id("listeningSessions"),
    visibility: v.union(
      v.literal("private"),
      v.literal("followers"),
      v.literal("public"),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const session = await ctx.db.get("listeningSessions", args.id);
    if (!session) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Listening session not found",
      });
    }

    if (session.createdBy !== identity.subject) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Not authorized to update this session",
      });
    }

    await ctx.db.patch("listeningSessions", args.id, {
      visibility: args.visibility,
    });
    return null;
  },
});
