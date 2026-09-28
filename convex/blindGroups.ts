// Blindness by projection: this is the only query that serves an unrevealed
// group, and it returns nothing that identifies a member.
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";

const memberInput = v.object({
  artifactId: v.id("audioArtifacts"),
  label: v.string(),
});

const projectionReturn = v.object({
  groupId: v.id("blindGroups"),
  purpose: v.union(v.literal("voiceShootout"), v.literal("studyFamily")),
  revealed: v.boolean(),
  members: v.array(
    v.object({
      memberId: v.string(),
      label: v.string(),
      durationSecs: v.optional(v.number()),
      playbackUrl: v.string(),
    }),
  ),
  labels: v.optional(v.record(v.string(), v.id("audioArtifacts"))),
});

export const create = internalMutation({
  args: {
    purpose: v.union(v.literal("voiceShootout"), v.literal("studyFamily")),
    members: v.array(memberInput),
    xMember: v.optional(
      v.object({
        artifactId: v.id("audioArtifacts"),
        duplicatesLabel: v.string(),
      }),
    ),
  },
  returns: v.object({
    groupId: v.id("blindGroups"),
    memberIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const all = [
      ...args.members,
      ...(args.xMember
        ? [{ artifactId: args.xMember.artifactId, label: "X" }]
        : []),
    ];
    const distinct = new Set(all.map((member) => member.artifactId));
    if (distinct.size !== all.length || all.length === 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Blind group members must be distinct artifacts",
      });
    }
    for (const member of all) {
      const row = await ctx.db.get(member.artifactId);
      if (!row || row.status !== "ready") {
        throw new ConvexError({
          code: "INVALID_STATE",
          message: `Artifact ${member.artifactId} is not ready`,
        });
      }
      if (row.blindGroupId) {
        throw new ConvexError({
          code: "INVALID_STATE",
          message: `Artifact ${member.artifactId} already belongs to a blind group`,
        });
      }
    }
    const members = all.map((member) => ({
      ...member,
      memberId: crypto.randomUUID(),
    }));
    const xEntry = args.xMember ? members[members.length - 1]! : undefined;
    const ratedMembers = xEntry
      ? members.filter((member) => member.memberId !== xEntry.memberId)
      : members;
    const now = Date.now();
    const groupId = await ctx.db.insert("blindGroups", {
      purpose: args.purpose,
      members: members.map(({ memberId, artifactId, label }) => ({
        memberId,
        artifactId,
        label,
      })),
      ...(xEntry && args.xMember
        ? {
            xMember: {
              memberId: xEntry.memberId,
              duplicates: args.xMember.duplicatesLabel,
            },
          }
        : {}),
      requiredRatings: ratedMembers.map((member) => member.memberId),
      createdAt: now,
    });
    for (const member of members) {
      await ctx.db.patch(member.artifactId, {
        blindGroupId: groupId,
        updatedAt: now,
      });
    }
    return { groupId, memberIds: members.map((member) => member.memberId) };
  },
});

async function project(ctx: QueryCtx, groupId: Id<"blindGroups">) {
  const group = await ctx.db.get(groupId);
  if (!group) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Blind group not found",
    });
  }
  const revealed = group.revealedAt !== undefined;
  const members = [];
  const labels: Record<string, Id<"audioArtifacts">> = {};
  for (const member of group.members) {
    const artifact = await ctx.db.get(member.artifactId);
    if (!artifact?.storageId) continue;
    const playbackUrl = await ctx.storage.getUrl(artifact.storageId);
    if (!playbackUrl) continue;
    members.push({
      memberId: member.memberId,
      label: member.label,
      durationSecs: artifact.durationSecs,
      playbackUrl,
    });
    labels[member.memberId] = member.artifactId;
  }
  return {
    groupId: group._id,
    purpose: group.purpose,
    revealed,
    members,
    ...(revealed ? { labels } : {}),
  };
}

export const projectionInternal = internalQuery({
  args: { groupId: v.id("blindGroups") },
  returns: projectionReturn,
  handler: async (ctx, args) => await project(ctx, args.groupId),
});

export const projection = query({
  args: {
    groupId: v.id("blindGroups"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: projectionReturn,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await project(ctx, args.groupId);
  },
});

export const reveal = internalMutation({
  args: { groupId: v.id("blindGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Blind group not found",
      });
    }
    if (group.revealedAt === undefined) {
      await ctx.db.patch(args.groupId, { revealedAt: Date.now() });
    }
    return null;
  },
});
