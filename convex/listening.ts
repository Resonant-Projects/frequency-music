import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { listeningSessionReturnValidator } from "./validators";

function assertOptionalZeroToFive(
  value: number | undefined,
  field: string,
): void {
  if (value === undefined) return;
  if (value < 0 || value > 5) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${field} must be between 0 and 5`,
      field,
    });
  }
}

export const listByComposition = query({
  args: { compositionId: v.id("compositions") },
  returns: v.array(listeningSessionReturnValidator),
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
  returns: v.array(listeningSessionReturnValidator),
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
        expandability: v.optional(v.number()),
      }),
    ),
    bodyMapNotes: v.optional(v.string()),
    feltQualities: v.optional(v.array(v.string())),
    bodyMapTags: v.optional(v.array(v.string())),
    standoutMoments: v.optional(v.array(v.string())),
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
    assertOptionalZeroToFive(
      args.ratings?.expandability,
      "ratings.expandability",
    );

    return await ctx.db.insert("listeningSessions", {
      compositionId: args.compositionId,
      participants: args.participants,
      contextMd: args.contextMd,
      feedbackMd: args.feedbackMd,
      ratings: args.ratings ?? {},
      bodyMapNotes: args.bodyMapNotes,
      feltQualities: args.feltQualities,
      bodyMapTags: args.bodyMapTags,
      standoutMoments: args.standoutMoments,
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

/**
 * Delete a listening session by ID
 */
export const deleteById = mutation({
  args: {
    id: v.id("listeningSessions"),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.delete(args.id);
  },
});
