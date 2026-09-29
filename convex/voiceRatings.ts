// Shootout ratings. The last required rating reveals the group in the same
// mutation. Choosing the house voice is a separate explicit act (settings).
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";

const ratingsValidator = v.object({
  naturalness: v.number(),
  prosody: v.number(),
  clean: v.number(),
  clarity: v.number(),
  overall: v.number(),
});
const RATING_KEYS = [
  "naturalness",
  "prosody",
  "clean",
  "clarity",
  "overall",
] as const;
type Ratings = Record<(typeof RATING_KEYS)[number], number>;
const submitReturn = v.object({ revealed: v.boolean(), remaining: v.number() });

function assertRatings(ratings: Ratings): void {
  for (const key of RATING_KEYS) {
    const value = ratings[key];
    if (!Number.isFinite(value) || value < 0 || value > 5) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `${key} must be between 0 and 5`,
        field: key,
      });
    }
  }
}

async function submitCore(
  ctx: MutationCtx,
  args: {
    groupId: Id<"blindGroups">;
    memberId: string;
    ratings: Ratings;
    notes?: string;
    createdBy: string;
  },
) {
  assertRatings(args.ratings);
  const group = await ctx.db.get(args.groupId);
  if (!group) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Blind group not found",
    });
  }
  // Voice ratings and their reveal belong to voice shootouts only; a study
  // comparison is revealed through its own workflow.
  if (group.purpose !== "voiceShootout") {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "Voice ratings apply only to voice shootout groups",
    });
  }
  const member = group.members.find((row) => row.memberId === args.memberId);
  if (!member || !group.requiredRatings.includes(args.memberId)) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "Unknown member for this group",
    });
  }
  const existing = await ctx.db
    .query("voiceRatings")
    .withIndex("by_groupId_memberId", (q) =>
      q.eq("groupId", args.groupId).eq("memberId", args.memberId),
    )
    .first();
  // A repeat submission for the same member is idempotent: the first rating
  // stands and no duplicate row is written.
  if (!existing) {
    await ctx.db.insert("voiceRatings", {
      groupId: args.groupId,
      memberId: args.memberId,
      artifactId: member.artifactId,
      ratings: args.ratings,
      notes: args.notes,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  }
  const rated = await ctx.db
    .query("voiceRatings")
    .withIndex("by_groupId_memberId", (q) => q.eq("groupId", args.groupId))
    .collect();
  const ratedIds = new Set(rated.map((row) => row.memberId));
  const remaining = group.requiredRatings.filter(
    (id) => !ratedIds.has(id),
  ).length;
  // Same transaction as the final rating: the group is never observable as
  // "fully rated but unrevealed".
  if (remaining === 0) {
    await ctx.runMutation(internal.blindGroups.reveal, {
      groupId: args.groupId,
    });
  }
  return { revealed: remaining === 0, remaining };
}

export const submitInternal = internalMutation({
  args: {
    groupId: v.id("blindGroups"),
    memberId: v.string(),
    ratings: ratingsValidator,
    notes: v.optional(v.string()),
    createdBy: v.string(),
  },
  returns: submitReturn,
  handler: async (ctx, args) => await submitCore(ctx, args),
});

export const submit = mutation({
  args: {
    groupId: v.id("blindGroups"),
    memberId: v.string(),
    ratings: ratingsValidator,
    notes: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: submitReturn,
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    return await submitCore(ctx, { ...args, createdBy: identity.subject });
  },
});

async function forGroupCore(ctx: QueryCtx, groupId: Id<"blindGroups">) {
  const group = await ctx.db.get(groupId);
  if (!group) return [];
  const revealed = group.revealedAt !== undefined;
  const rows = await ctx.db
    .query("voiceRatings")
    .withIndex("by_groupId_memberId", (q) => q.eq("groupId", groupId))
    .collect();
  const result = [];
  for (const row of rows) {
    // voiceId is the only identifying field and exists only after reveal.
    const artifact = revealed ? await ctx.db.get(row.artifactId) : null;
    result.push({
      memberId: row.memberId,
      ratings: row.ratings,
      notes: row.notes,
      createdAt: row.createdAt,
      ...(artifact?.voice ? { voiceId: artifact.voice.catalogId } : {}),
    });
  }
  return result;
}

export const forGroupInternal = internalQuery({
  args: { groupId: v.id("blindGroups") },
  handler: async (ctx, args) => await forGroupCore(ctx, args.groupId),
});

export const forGroup = query({
  args: {
    groupId: v.id("blindGroups"),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await forGroupCore(ctx, args.groupId);
  },
});
