/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  conceptEmbeddingText,
  EMBEDDING_MODEL,
  needsEmbedding,
} from "./shared/embeddingText";

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
      .filter((claim): claim is Doc<"claims"> => claim?.status === "active")
      .map((claim) => ({
        claimId: claim._id,
        text: claim.text,
        embedding: claim.embedding,
        embeddingModel: claim.embeddingModel,
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
      .filter(
        (concept): concept is Doc<"concepts"> =>
          concept?.missionRelevance === "on",
      )
      .map((concept) => ({
        conceptId: concept._id,
        displayName: concept.displayName,
        description: concept.description,
        aliases: concept.aliases,
        embedding: concept.embedding,
        embeddingModel: concept.embeddingModel,
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
      const pending = page.page.filter((claim) =>
        needsEmbedding(claim, args.model),
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
    const pending = page.page.filter((concept) =>
      needsEmbedding(concept, args.model),
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
    // Mirrors needsEmbedding except its vector-length check, which Convex filters cannot express; matching models imply valid deployed dimensions.
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
    const hydratedMatches = (
      await Promise.all(
        args.matches.map(async (match) => {
          const claim = await ctx.db.get("claims", match.claimId);
          // Drop rows embedded under a different model: during a re-embed
          // migration their vectors are not comparable to the probe vector.
          return claim && claim.embeddingModel === EMBEDDING_MODEL
            ? { claim, match }
            : null;
        }),
      )
    ).filter((result): result is NonNullable<typeof result> => result !== null);

    const conceptByName = new Map<string, Promise<Doc<"concepts"> | null>>();
    const loadConcept = (name: string) => {
      const cached = conceptByName.get(name);
      if (cached) return cached;
      const concept = ctx.db
        .query("concepts")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      conceptByName.set(name, concept);
      return concept;
    };

    const sourceDetails = await Promise.all(
      Array.from(
        new Set(hydratedMatches.map(({ claim }) => claim.sourceId)),
      ).map(async (sourceId) => {
        const [source, edges] = await Promise.all([
          ctx.db.get("sources", sourceId),
          ctx.db
            .query("edges")
            .withIndex("by_from", (q) =>
              q.eq("fromType", "source").eq("fromId", sourceId),
            )
            .filter((q) => q.eq(q.field("toType"), "concept"))
            .collect(),
        ]);
        const concepts = await Promise.all(
          edges.map((edge) => loadConcept(edge.toId)),
        );
        const domains = Array.from(
          new Set(
            concepts.flatMap((concept) =>
              concept ? (concept.domains ?? [concept.domain]) : [],
            ),
          ),
        ).toSorted();
        return [
          sourceId,
          {
            sourceTitle: source?.title ?? "(untitled source)",
            domains,
          },
        ] as const;
      }),
    );
    const sourceDetailsById = new Map(sourceDetails);

    return hydratedMatches.map(({ claim, match }) => {
      const details = sourceDetailsById.get(claim.sourceId) ?? {
        sourceTitle: "(untitled source)",
        domains: [],
      };
      return {
        claimId: claim._id,
        score: match.score,
        text: claim.text,
        ...details,
      };
    });
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
    const rows = await Promise.all(
      args.entries.map(async (entry) => ({
        entry,
        claim: await ctx.db.get("claims", entry.claimId),
      })),
    );
    const eligible = rows.filter(({ claim }) => claim?.status === "active");
    for (const { entry } of eligible) {
      await ctx.db.patch("claims", entry.claimId, {
        embedding: entry.embedding,
        embeddingModel: entry.model,
      });
    }
    return eligible.length;
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
    const rows = await Promise.all(
      args.entries.map(async (entry) => ({
        entry,
        concept: await ctx.db.get("concepts", entry.conceptId),
      })),
    );
    const eligible = rows.filter(
      ({ concept }) => concept?.missionRelevance === "on",
    );
    for (const { entry } of eligible) {
      await ctx.db.patch("concepts", entry.conceptId, {
        embedding: entry.embedding,
        embeddingModel: entry.model,
      });
    }
    return eligible.length;
  },
});
