// Queries behind the /listen page. The shootout list is a thin index over
// blind groups; everything identifying stays behind blindGroups.projection.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, type QueryCtx, query } from "./_generated/server";
import { requireAuth } from "./auth";

const SHOOTOUT_LIMIT = 50;

const shootoutReturn = v.array(
  v.object({
    groupId: v.id("blindGroups"),
    createdAt: v.number(),
    revealed: v.boolean(),
    memberCount: v.number(),
    episodeArtifactId: v.union(v.id("audioArtifacts"), v.null()),
  }),
);

// A shootout's takes and its episode are minted by one media job, so the
// pairing is exact: first member → its `refs.mediaJobId` → that job's
// `resultArtifactIds` → the ready feed delivery among them. No window of
// recent episodes is scanned, so unrelated newer episodes cannot hide it.
async function episodeFor(
  ctx: QueryCtx,
  group: Doc<"blindGroups">,
): Promise<Id<"audioArtifacts"> | null> {
  const first = group.members[0];
  if (!first) return null;
  const member = await ctx.db.get(first.artifactId);
  const mediaJobId = member?.refs.mediaJobId;
  if (!mediaJobId) return null;
  const job = await ctx.db.get(mediaJobId);
  for (const artifactId of job?.resultArtifactIds ?? []) {
    const row = await ctx.db.get(artifactId);
    if (
      row?.kind === "episode" &&
      row.role === "delivery" &&
      row.status === "ready" &&
      row.access === "feed"
    ) {
      return row._id;
    }
  }
  return null;
}

async function listShootouts(ctx: QueryCtx) {
  // Filter by purpose before the limit: newer studyFamily groups must never
  // push a shootout out of the window.
  const groups = await ctx.db
    .query("blindGroups")
    .order("desc")
    .filter((q) => q.eq(q.field("purpose"), "voiceShootout"))
    .take(SHOOTOUT_LIMIT);
  const result = [];
  for (const group of groups) {
    result.push({
      groupId: group._id,
      createdAt: group.createdAt,
      revealed: group.revealedAt !== undefined,
      memberCount: group.members.length,
      episodeArtifactId: await episodeFor(ctx, group),
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
