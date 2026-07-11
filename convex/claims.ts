import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireAuth } from "./auth";
import { claimReturnValidator } from "./validators";

const CLAIM_READ_LIMIT = 1000;

function enforceClaimReadLimit(claims: Doc<"claims">[]): Doc<"claims">[] {
  if (claims.length > CLAIM_READ_LIMIT) {
    throw new ConvexError({
      code: "READ_LIMIT_EXCEEDED",
      message: `Claim query exceeds the ${CLAIM_READ_LIMIT}-row safety limit`,
    });
  }
  return claims;
}

export const listByExtraction = query({
  args: {
    extractionId: v.id("extractions"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.array(claimReturnValidator),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const claims = await ctx.db
      .query("claims")
      .withIndex("by_extractionId_ordinal", (q) =>
        q.eq("extractionId", args.extractionId),
      )
      .take(CLAIM_READ_LIMIT + 1);
    return enforceClaimReadLimit(claims);
  },
});

export const listBySource = query({
  args: {
    sourceId: v.id("sources"),
    includeSuperseded: v.optional(v.boolean()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.array(claimReturnValidator),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const claims = args.includeSuperseded
      ? await ctx.db
          .query("claims")
          .withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
          .take(CLAIM_READ_LIMIT + 1)
      : await ctx.db
          .query("claims")
          .withIndex("by_sourceId_status", (q) =>
            q.eq("sourceId", args.sourceId).eq("status", "active"),
          )
          .take(CLAIM_READ_LIMIT + 1);
    return enforceClaimReadLimit(claims);
  },
});

export const getMany = query({
  args: {
    ids: v.array(v.id("claims")),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.array(claimReturnValidator),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    if (args.ids.length > CLAIM_READ_LIMIT) {
      throw new ConvexError({
        code: "READ_LIMIT_EXCEEDED",
        message: `getMany accepts at most ${CLAIM_READ_LIMIT} claim ids`,
      });
    }
    const claims = await Promise.all(
      args.ids.map((id) => ctx.db.get("claims", id)),
    );
    return claims.filter((claim): claim is Doc<"claims"> => claim !== null);
  },
});
