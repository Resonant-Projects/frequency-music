import { requireDecisionUser } from "./decisionIdentity";
import {
  listeningConditionsValidator,
  listeningIntentPayloadZ,
  subjectiveRatingsZ,
} from "./shared/decisionIntents";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { listeningSessionReturnValidator } from "./validators";

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
    conditions: v.optional(listeningConditionsValidator),
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
    const userId = await requireDecisionUser(ctx);
    const composition = await ctx.db.get("compositions", args.compositionId);
    if (!composition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Composition not found",
      });
    }
    if (args.ratings) {
      const { consonanceComputed: _computed, ...subjective } = args.ratings;
      subjectiveRatingsZ.parse(subjective);
    }

    return await ctx.db.insert("listeningSessions", {
      compositionId: args.compositionId,
      participants: args.participants,
      conditions: args.conditions,
      contextMd: args.contextMd,
      feedbackMd: args.feedbackMd,
      ratings: args.ratings ?? {},
      bodyMapNotes: args.bodyMapNotes,
      feltQualities: args.feltQualities,
      bodyMapTags: args.bodyMapTags,
      standoutMoments: args.standoutMoments,
      expandVerdict: args.expandVerdict,
      visibility: "private",
      createdBy: userId,
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
    const userId = await requireDecisionUser(ctx);
    const session = await ctx.db.get("listeningSessions", args.id);
    if (!session) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Listening session not found",
      });
    }

    if (session.createdBy !== userId) {
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

/** Shared with decision application so session and intent commit atomically. */
export async function createSignedListeningSession(
  ctx: MutationCtx,
  args: {
    compositionId: Id<"compositions">;
    payload: import("zod").infer<typeof listeningIntentPayloadZ>;
    transcript: string;
    userId: Id<"users">;
    intentId: Id<"decisionIntents">;
  },
) {
  const payload = listeningIntentPayloadZ.parse(args.payload);
  if (!(await ctx.db.get(args.compositionId)))
    throw new ConvexError("Composition not found");
  if (!(await ctx.db.get(args.userId))) throw new ConvexError("User not found");
  return await ctx.db.insert("listeningSessions", {
    compositionId: args.compositionId,
    participants: [{ userId: args.userId, role: "self" }],
    feedbackMd: args.transcript,
    conditions: payload.conditions,
    ratings: payload.ratings ?? {},
    feltQualities: payload.feltQualities,
    standoutMoments: payload.standoutMoments,
    expandVerdict: payload.expandVerdict,
    decisionIntentId: args.intentId,
    createdBy: args.userId,
    visibility: "private",
    createdAt: Date.now(),
  });
}

// This internal entry point accepts only an already verified, applied intent.
// Normal confirmation calls the shared helper in its own transaction.
export const createInternal = internalMutation({
  args: { intentId: v.id("decisionIntents") },
  returns: v.id("listeningSessions"),
  handler: async (ctx, { intentId }) => {
    const intent = await ctx.db.get(intentId);
    if (
      intent?.action !== "createListeningSession" ||
      intent.status !== "applied" ||
      !intent.signature ||
      !intent.result?.appliedRecordId
    )
      throw new ConvexError("Signed listening intent required");
    const id = ctx.db.normalizeId(
      "listeningSessions",
      intent.result.appliedRecordId,
    );
    if (!id || !(await ctx.db.get(id)))
      throw new ConvexError("Applied session not found");
    return id;
  },
});
