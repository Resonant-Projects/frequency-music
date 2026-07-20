/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const embeddingWriteValidator = v.object({
  embedding: v.array(v.float64()),
  model: v.string(),
});

export const getClaims = internalQuery({
  args: { claimIds: v.array(v.id("claims")) },
  returns: v.array(
    v.object({
      claimId: v.id("claims"),
      text: v.string(),
      embedding: v.optional(v.array(v.float64())),
      embeddingModel: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const claims = await Promise.all(
      args.claimIds.map((claimId) => ctx.db.get("claims", claimId)),
    );
    return claims
      .filter((claim) => claim?.status === "active")
      .map((claim) => ({
        claimId: claim!._id,
        text: claim!.text,
        embedding: claim!.embedding,
        embeddingModel: claim!.embeddingModel,
      }));
  },
});

export const getConcepts = internalQuery({
  args: { conceptIds: v.array(v.id("concepts")) },
  returns: v.array(
    v.object({
      conceptId: v.id("concepts"),
      displayName: v.string(),
      description: v.optional(v.string()),
      aliases: v.array(v.string()),
      embedding: v.optional(v.array(v.float64())),
      embeddingModel: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const concepts = await Promise.all(
      args.conceptIds.map((conceptId) => ctx.db.get("concepts", conceptId)),
    );
    return concepts
      .filter((concept) => concept?.missionRelevance === "on")
      .map((concept) => ({
        conceptId: concept!._id,
        displayName: concept!.displayName,
        description: concept!.description,
        aliases: concept!.aliases,
        embedding: concept!.embedding,
        embeddingModel: concept!.embeddingModel,
      }));
  },
});

export const storeClaimEmbeddings = internalMutation({
  args: {
    entries: v.array(
      v.object({
        claimId: v.id("claims"),
        ...embeddingWriteValidator.fields,
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let stored = 0;
    for (const entry of args.entries) {
      const claim = await ctx.db.get("claims", entry.claimId);
      if (!claim || claim.status !== "active") continue;
      await ctx.db.patch("claims", entry.claimId, {
        embedding: entry.embedding,
        embeddingModel: entry.model,
      });
      stored++;
    }
    return stored;
  },
});

export const storeConceptEmbeddings = internalMutation({
  args: {
    entries: v.array(
      v.object({
        conceptId: v.id("concepts"),
        ...embeddingWriteValidator.fields,
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let stored = 0;
    for (const entry of args.entries) {
      const concept = await ctx.db.get("concepts", entry.conceptId);
      if (!concept || concept.missionRelevance !== "on") continue;
      await ctx.db.patch("concepts", entry.conceptId, {
        embedding: entry.embedding,
        embeddingModel: entry.model,
      });
      stored++;
    }
    return stored;
  },
});
