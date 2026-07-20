/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { conceptEmbeddingText } from "./shared/embeddingText";

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

export const getBackfillPage = internalQuery({
  args: {
    kind: v.union(v.literal("claims"), v.literal("concepts")),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
    model: v.string(),
  },
  returns: v.object({
    claimIds: v.array(v.id("claims")),
    conceptIds: v.array(v.id("concepts")),
    scanned: v.number(),
    pendingChars: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(Math.floor(args.batchSize), 1), 500);
    if (args.kind === "claims") {
      const page = await ctx.db
        .query("claims")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .paginate({ cursor: args.cursor, numItems });
      const pending = page.page.filter(
        (claim) => !claim.embedding || claim.embeddingModel !== args.model,
      );
      return {
        claimIds: pending.map((claim) => claim._id),
        conceptIds: [],
        scanned: page.page.length,
        pendingChars: pending.reduce(
          (total, claim) => total + claim.text.length,
          0,
        ),
        isDone: page.isDone,
        continueCursor: page.continueCursor,
      };
    }
    const page = await ctx.db
      .query("concepts")
      .withIndex("by_missionRelevance", (q) => q.eq("missionRelevance", "on"))
      .paginate({ cursor: args.cursor, numItems });
    const pending = page.page.filter(
      (concept) => !concept.embedding || concept.embeddingModel !== args.model,
    );
    return {
      claimIds: [],
      conceptIds: pending.map((concept) => concept._id),
      scanned: page.page.length,
      pendingChars: pending.reduce(
        (total, concept) => total + conceptEmbeddingText(concept).length,
        0,
      ),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const getSweepCandidates = internalQuery({
  args: { limit: v.number(), model: v.string() },
  returns: v.object({
    claimIds: v.array(v.id("claims")),
    conceptIds: v.array(v.id("concepts")),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit), 1), 500);
    const [claims, concepts] = await Promise.all([
      ctx.db
        .query("claims")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .filter((q) =>
          q.or(
            q.eq(q.field("embedding"), undefined),
            q.neq(q.field("embeddingModel"), args.model),
          ),
        )
        .take(limit),
      ctx.db
        .query("concepts")
        .withIndex("by_missionRelevance", (q) => q.eq("missionRelevance", "on"))
        .filter((q) =>
          q.or(
            q.eq(q.field("embedding"), undefined),
            q.neq(q.field("embeddingModel"), args.model),
          ),
        )
        .take(limit),
    ]);
    return {
      claimIds: claims.map((claim) => claim._id),
      conceptIds: concepts.map((concept) => concept._id),
    };
  },
});

export const getProbeClaim = internalQuery({
  args: { claimId: v.id("claims") },
  returns: v.union(
    v.object({
      claimId: v.id("claims"),
      text: v.string(),
      embedding: v.optional(v.array(v.float64())),
      embeddingModel: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get("claims", args.claimId);
    if (!claim) return null;
    return {
      claimId: claim._id,
      text: claim.text,
      embedding: claim.embedding,
      embeddingModel: claim.embeddingModel,
    };
  },
});

export const hydrateProbeMatches = internalQuery({
  args: {
    matches: v.array(v.object({ claimId: v.id("claims"), score: v.float64() })),
  },
  returns: v.array(
    v.object({
      claimId: v.id("claims"),
      score: v.float64(),
      text: v.string(),
      sourceTitle: v.string(),
      domains: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.matches.map(async (match) => {
        const claim = await ctx.db.get("claims", match.claimId);
        if (!claim) return null;
        const [source, edges] = await Promise.all([
          ctx.db.get("sources", claim.sourceId),
          ctx.db
            .query("edges")
            .withIndex("by_from", (q) =>
              q.eq("fromType", "source").eq("fromId", claim.sourceId),
            )
            .filter((q) => q.eq(q.field("toType"), "concept"))
            .collect(),
        ]);
        const concepts = await Promise.all(
          edges.map((edge) =>
            ctx.db
              .query("concepts")
              .withIndex("by_name", (q) => q.eq("name", edge.toId))
              .first(),
          ),
        );
        const domains = Array.from(
          new Set(
            concepts.flatMap((concept) =>
              concept ? (concept.domains ?? [concept.domain]) : [],
            ),
          ),
        ).toSorted();
        return {
          claimId: claim._id,
          score: match.score,
          text: claim.text,
          sourceTitle: source?.title ?? "(untitled source)",
          domains,
        };
      }),
    );
    return results.filter(
      (result): result is NonNullable<typeof result> => result !== null,
    );
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
