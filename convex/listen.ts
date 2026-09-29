// Queries behind the /listen page. The shootout list is a thin index over
// blind groups; everything identifying stays behind blindGroups.projection.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, type QueryCtx, query } from "./_generated/server";
import { requireAuth } from "./auth";

const SHOOTOUT_LIMIT = 50;
const EPISODE_SCAN_LIMIT = 50;

const shootoutReturn = v.array(
  v.object({
    groupId: v.id("blindGroups"),
    createdAt: v.number(),
    revealed: v.boolean(),
    memberCount: v.number(),
    episodeArtifactId: v.union(v.id("audioArtifacts"), v.null()),
  }),
);

// Ready feed episodes, newest first, from the same index the podcast feed
// reads. A shootout's takes and its episode are minted by one media job, so
// `refs.mediaJobId` is the pairing key.
async function recentFeedEpisodes(ctx: QueryCtx) {
  const rows = await ctx.db
    .query("audioArtifacts")
    .withIndex("by_access_kind_createdAt", (q) =>
      q.eq("access", "feed").eq("kind", "episode"),
    )
    .order("desc")
    .take(EPISODE_SCAN_LIMIT);
  return rows.filter(
    (row) => row.status === "ready" && row.role === "delivery",
  );
}

async function episodeFor(
  ctx: QueryCtx,
  group: Doc<"blindGroups">,
  episodes: Doc<"audioArtifacts">[],
): Promise<Id<"audioArtifacts"> | null> {
  const first = group.members[0];
  if (!first) return null;
  const member = await ctx.db.get(first.artifactId);
  const mediaJobId = member?.refs.mediaJobId;
  if (!mediaJobId) return null;
  const episode = episodes.find((row) => row.refs.mediaJobId === mediaJobId);
  return episode?._id ?? null;
}

async function listShootouts(ctx: QueryCtx) {
  const groups = await ctx.db
    .query("blindGroups")
    .order("desc")
    .take(SHOOTOUT_LIMIT);
  const shootouts = groups.filter((group) => group.purpose === "voiceShootout");
  const episodes = shootouts.length === 0 ? [] : await recentFeedEpisodes(ctx);
  const result = [];
  for (const group of shootouts) {
    result.push({
      groupId: group._id,
      createdAt: group.createdAt,
      revealed: group.revealedAt !== undefined,
      memberCount: group.members.length,
      episodeArtifactId: await episodeFor(ctx, group, episodes),
    });
  }
  return result;
}

export const shootoutsInternal = internalQuery({
  args: {},
  returns: shootoutReturn,
  handler: async (ctx) => await listShootouts(ctx),
});

export const shootouts = query({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: shootoutReturn,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await listShootouts(ctx);
  },
});
