/* eslint-disable no-underscore-dangle -- Convex document and vector ids use underscore names. */
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import {
  buildPairProposals,
  rankCandidateScores,
} from "./shared/correspondenceCandidates";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./shared/embeddingText";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const VECTOR_MATCH_LIMIT = 32;
const STRUCTURAL_EDGE_LIMIT = 100;
const TARGET_SCAN_LIMIT = 100;

const candidateValidator = v.object({
  conceptAId: v.id("concepts"),
  conceptBId: v.id("concepts"),
  pairKey: v.string(),
  similarityScore: v.float64(),
  noveltyScore: v.float64(),
  domainsA: v.array(v.string()),
  domainsB: v.array(v.string()),
  sampleClaimIds: v.object({
    a: v.array(v.id("claims")),
    b: v.array(v.id("claims")),
  }),
});

const candidateConceptValidator = v.object({
  id: v.id("concepts"),
  name: v.string(),
  displayName: v.string(),
  description: v.optional(v.string()),
  domains: v.array(v.string()),
});

const sampleClaimValidator = v.object({
  id: v.id("claims"),
  text: v.string(),
  sourceId: v.id("sources"),
  sourceTitle: v.string(),
});

type Candidate = {
  conceptAId: Id<"concepts">;
  conceptBId: Id<"concepts">;
  pairKey: string;
  similarityScore: number;
  noveltyScore: number;
  domainsA: string[];
  domainsB: string[];
  sampleClaimIds: { a: Id<"claims">[]; b: Id<"claims">[] };
};

type ProbeConcept = {
  conceptId: Id<"concepts">;
  domains: string[];
  embedding: number[];
};

type HydratedMatch = {
  claimId: Id<"claims">;
  score: number;
  text: string;
  sourceId: Id<"sources">;
  sourceTitle: string;
  domains: string[];
  concepts: Array<{
    conceptId: Id<"concepts">;
    name: string;
    displayName: string;
    description?: string;
    domains: string[];
  }>;
};

function clampLimit(limit: number | undefined, fallback = DEFAULT_LIMIT) {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(Math.floor(limit), MAX_LIMIT));
}

function conceptDomains(concept: Doc<"concepts">): string[] {
  return Array.from(new Set(concept.domains ?? [concept.domain])).toSorted();
}

const getProbeConceptRef = makeFunctionReference<
  "query",
  { seedConceptId?: Id<"concepts"> },
  ProbeConcept | null
>("correspondenceCandidates:getProbeConcept");
const markConceptProbedRef = makeFunctionReference<
  "mutation",
  { conceptId: Id<"concepts">; probedAt: number },
  null
>("correspondenceCandidates:markConceptProbed");
const hydrateMatchesRef = makeFunctionReference<
  "query",
  { matches: Array<{ claimId: Id<"claims">; score: number }> },
  HydratedMatch[]
>("correspondenceCandidates:hydrateClaimMatches");
const getStructuralScoresRef = makeFunctionReference<
  "query",
  {
    pairs: Array<{
      conceptAId: Id<"concepts">;
      conceptBId: Id<"concepts">;
      pairKey: string;
    }>;
  },
  Array<{
    pairKey: string;
    coMentions: number;
    existingEdges: number;
    correspondenceExists: boolean;
  }>
>("correspondenceCandidates:getStructuralScores");
const getCandidateSamplesRef = makeFunctionReference<
  "query",
  {
    pairs: Array<{
      conceptAId: Id<"concepts">;
      conceptBId: Id<"concepts">;
      hitClaimIds: Id<"claims">[];
    }>;
  },
  Array<{
    conceptAId: Id<"concepts">;
    conceptBId: Id<"concepts">;
    sampleClaimIds: { a: Id<"claims">[]; b: Id<"claims">[] };
  }>
>("correspondenceCandidates:getCandidateSamples");
const hydrateAgentCandidatesRef = makeFunctionReference<
  "query",
  { candidates: Candidate[] },
  unknown[]
>("correspondenceCandidates:hydrateAgentCandidates");
const generateCandidatesRef = makeFunctionReference<
  "action",
  { limit?: number; seedConceptId?: Id<"concepts"> },
  Candidate[]
>("correspondenceCandidates:generateCandidates");
const embedTextsRef = makeFunctionReference<
  "action",
  { texts: string[] },
  { embeddings: number[][]; model: string }
>("embeddings:embedTexts");

export const getProbeConcept = internalQuery({
  args: { seedConceptId: v.optional(v.id("concepts")) },
  returns: v.union(
    v.object({
      conceptId: v.id("concepts"),
      domains: v.array(v.string()),
      embedding: v.array(v.float64()),
    }),
    v.null(),
  ),
  handler: async (ctx, args): Promise<ProbeConcept | null> => {
    const concept = args.seedConceptId
      ? await ctx.db.get("concepts", args.seedConceptId)
      : await ctx.db
          .query("concepts")
          .withIndex("by_missionRelevance_lastProbedAt", (q) =>
            q.eq("missionRelevance", "on"),
          )
          .filter((q) =>
            q.and(
              q.neq(q.field("embedding"), undefined),
              q.eq(q.field("embeddingModel"), EMBEDDING_MODEL),
            ),
          )
          .order("asc")
          .first();
    if (
      !concept ||
      concept.missionRelevance !== "on" ||
      concept.embeddingModel !== EMBEDDING_MODEL ||
      concept.embedding?.length !== EMBEDDING_DIMENSIONS
    ) {
      return null;
    }
    return {
      conceptId: concept._id,
      domains: conceptDomains(concept),
      embedding: concept.embedding,
    };
  },
});

export const markConceptProbed = internalMutation({
  args: { conceptId: v.id("concepts"), probedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const concept = await ctx.db.get("concepts", args.conceptId);
    if (concept?.missionRelevance === "on") {
      await ctx.db.patch("concepts", args.conceptId, {
        lastProbedAt: args.probedAt,
      });
    }
    return null;
  },
});

export const hydrateClaimMatches = internalQuery({
  args: {
    matches: v.array(v.object({ claimId: v.id("claims"), score: v.float64() })),
  },
  returns: v.array(
    v.object({
      claimId: v.id("claims"),
      score: v.float64(),
      text: v.string(),
      sourceId: v.id("sources"),
      sourceTitle: v.string(),
      domains: v.array(v.string()),
      concepts: v.array(
        v.object({
          conceptId: v.id("concepts"),
          name: v.string(),
          displayName: v.string(),
          description: v.optional(v.string()),
          domains: v.array(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args): Promise<HydratedMatch[]> => {
    return (
      await Promise.all(
        args.matches.map(async (match): Promise<HydratedMatch | null> => {
          const claim = await ctx.db.get("claims", match.claimId);
          if (
            !claim ||
            claim.status !== "active" ||
            claim.embeddingModel !== EMBEDDING_MODEL
          ) {
            return null;
          }
          const [source, edges] = await Promise.all([
            ctx.db.get("sources", claim.sourceId),
            ctx.db
              .query("edges")
              .withIndex("by_from", (q) =>
                q.eq("fromType", "source").eq("fromId", claim.sourceId),
              )
              .filter((q) => q.eq(q.field("toType"), "concept"))
              .take(STRUCTURAL_EDGE_LIMIT),
          ]);
          const concepts = (
            await Promise.all(
              edges.map((edge) =>
                ctx.db
                  .query("concepts")
                  .withIndex("by_name", (q) => q.eq("name", edge.toId))
                  .first(),
              ),
            )
          )
            .filter(
              (concept): concept is Doc<"concepts"> =>
                concept?.missionRelevance === "on",
            )
            .map((concept) => ({
              conceptId: concept._id,
              name: concept.name,
              displayName: concept.displayName,
              description: concept.description,
              domains: conceptDomains(concept),
            }));
          return {
            claimId: claim._id,
            score: match.score,
            text: claim.text,
            sourceId: claim.sourceId,
            sourceTitle: source?.title ?? "(untitled source)",
            domains: Array.from(
              new Set(concepts.flatMap((concept) => concept.domains)),
            ).toSorted(),
            concepts,
          };
        }),
      )
    ).filter((match): match is HydratedMatch => match !== null);
  },
});

async function sourceIdsForConcept(ctx: QueryCtx, conceptName: string) {
  const edges = await ctx.db
    .query("edges")
    .withIndex("by_to", (q) =>
      q.eq("toType", "concept").eq("toId", conceptName),
    )
    .take(STRUCTURAL_EDGE_LIMIT);
  return new Set(
    edges
      .filter((edge) => edge.fromType === "source")
      .map((edge) => edge.fromId),
  );
}

export const getStructuralScores = internalQuery({
  args: {
    pairs: v.array(
      v.object({
        conceptAId: v.id("concepts"),
        conceptBId: v.id("concepts"),
        pairKey: v.string(),
      }),
    ),
  },
  returns: v.array(
    v.object({
      pairKey: v.string(),
      coMentions: v.number(),
      existingEdges: v.number(),
      correspondenceExists: v.boolean(),
    }),
  ),
  handler: async (ctx, args) =>
    await Promise.all(
      args.pairs.map(async (pair) => {
        const [conceptA, conceptB, correspondence] = await Promise.all([
          ctx.db.get("concepts", pair.conceptAId),
          ctx.db.get("concepts", pair.conceptBId),
          ctx.db
            .query("correspondences")
            .withIndex("by_pairKey", (q) => q.eq("pairKey", pair.pairKey))
            .first(),
        ]);
        if (!conceptA || !conceptB) {
          return {
            pairKey: pair.pairKey,
            coMentions: 0,
            existingEdges: 0,
            correspondenceExists: true,
          };
        }
        const [sourcesA, sourcesB, forward, reverse] = await Promise.all([
          sourceIdsForConcept(ctx, conceptA.name),
          sourceIdsForConcept(ctx, conceptB.name),
          ctx.db
            .query("edges")
            .withIndex("by_from", (q) =>
              q.eq("fromType", "concept").eq("fromId", conceptA.name),
            )
            .filter((q) =>
              q.and(
                q.eq(q.field("toType"), "concept"),
                q.eq(q.field("toId"), conceptB.name),
              ),
            )
            .take(STRUCTURAL_EDGE_LIMIT),
          ctx.db
            .query("edges")
            .withIndex("by_from", (q) =>
              q.eq("fromType", "concept").eq("fromId", conceptB.name),
            )
            .filter((q) =>
              q.and(
                q.eq(q.field("toType"), "concept"),
                q.eq(q.field("toId"), conceptA.name),
              ),
            )
            .take(STRUCTURAL_EDGE_LIMIT),
        ]);
        return {
          pairKey: pair.pairKey,
          coMentions: Array.from(sourcesA).filter((id) => sourcesB.has(id))
            .length,
          existingEdges: forward.length + reverse.length,
          correspondenceExists: correspondence !== null,
        };
      }),
    ),
});

async function sampleClaimsForConcept(
  ctx: QueryCtx,
  concept: Doc<"concepts">,
  preferredClaimIds: readonly Id<"claims">[],
): Promise<Id<"claims">[]> {
  const sourceIds = await sourceIdsForConcept(ctx, concept.name);
  const preferred = (
    await Promise.all(
      preferredClaimIds.map((claimId) => ctx.db.get("claims", claimId)),
    )
  ).filter(
    (claim): claim is Doc<"claims"> =>
      claim?.status === "active" && sourceIds.has(claim.sourceId),
  );
  const claims = [...preferred];
  for (const sourceId of Array.from(sourceIds).slice(0, 12)) {
    if (claims.length >= 3) break;
    const sourceClaims = await ctx.db
      .query("claims")
      .withIndex("by_sourceId_status", (q) =>
        q.eq("sourceId", sourceId as Id<"sources">).eq("status", "active"),
      )
      .take(3);
    claims.push(...sourceClaims);
  }
  return Array.from(new Set(claims.map((claim) => claim._id))).slice(0, 3);
}

export const getCandidateSamples = internalQuery({
  args: {
    pairs: v.array(
      v.object({
        conceptAId: v.id("concepts"),
        conceptBId: v.id("concepts"),
        hitClaimIds: v.array(v.id("claims")),
      }),
    ),
  },
  returns: v.array(
    v.object({
      conceptAId: v.id("concepts"),
      conceptBId: v.id("concepts"),
      sampleClaimIds: v.object({
        a: v.array(v.id("claims")),
        b: v.array(v.id("claims")),
      }),
    }),
  ),
  handler: async (ctx, args) =>
    (
      await Promise.all(
        args.pairs.map(async (pair) => {
          const [conceptA, conceptB] = await Promise.all([
            ctx.db.get("concepts", pair.conceptAId),
            ctx.db.get("concepts", pair.conceptBId),
          ]);
          if (!conceptA || !conceptB) return null;
          const [a, b] = await Promise.all([
            sampleClaimsForConcept(ctx, conceptA, []),
            sampleClaimsForConcept(ctx, conceptB, pair.hitClaimIds),
          ]);
          return {
            conceptAId: pair.conceptAId,
            conceptBId: pair.conceptBId,
            sampleClaimIds: { a, b },
          };
        }),
      )
    ).filter((value): value is NonNullable<typeof value> => value !== null),
});

export const generateCandidates = internalAction({
  args: {
    limit: v.optional(v.number()),
    seedConceptId: v.optional(v.id("concepts")),
  },
  returns: v.array(candidateValidator),
  handler: async (ctx, args): Promise<Candidate[]> => {
    const probe = await ctx.runQuery(getProbeConceptRef, {
      seedConceptId: args.seedConceptId,
    });
    if (!probe) return [];
    const matches = await ctx.vectorSearch("claims", "by_embedding", {
      vector: probe.embedding,
      limit: VECTOR_MATCH_LIMIT,
      filter: (q) => q.eq("status", "active"),
    });
    const hydrated = await ctx.runQuery(hydrateMatchesRef, {
      matches: matches.map((match) => ({
        claimId: match._id,
        score: match._score,
      })),
    });
    await ctx.runMutation(markConceptProbedRef, {
      conceptId: probe.conceptId,
      probedAt: Date.now(),
    });
    const proposals = buildPairProposals(
      { conceptId: probe.conceptId, domains: probe.domains },
      hydrated,
    ).map((proposal) => ({
      ...proposal,
      conceptAId: proposal.conceptAId as Id<"concepts">,
      conceptBId: proposal.conceptBId as Id<"concepts">,
      hitClaimIds: proposal.hitClaimIds as Id<"claims">[],
    }));
    if (proposals.length === 0) return [];
    const structural = await ctx.runQuery(getStructuralScoresRef, {
      pairs: proposals.map((proposal) => ({
        conceptAId: proposal.conceptAId,
        conceptBId: proposal.conceptBId,
        pairKey: proposal.pairKey,
      })),
    });
    const structuralByPair = new Map(
      structural.map((score) => [score.pairKey, score]),
    );
    const ranked = rankCandidateScores(
      proposals.map((proposal) => ({
        ...proposal,
        ...(structuralByPair.get(proposal.pairKey) ?? {
          coMentions: 0,
          existingEdges: 0,
          correspondenceExists: true,
        }),
      })),
      clampLimit(args.limit),
    );
    const samples = await ctx.runQuery(getCandidateSamplesRef, {
      pairs: ranked.map((candidate) => ({
        conceptAId: candidate.conceptAId,
        conceptBId: candidate.conceptBId,
        hitClaimIds: candidate.hitClaimIds,
      })),
    });
    const samplesByPair = new Map(
      samples.map((sample) => [
        `${sample.conceptAId}:${sample.conceptBId}`,
        sample.sampleClaimIds,
      ]),
    );
    return ranked.map((candidate) => ({
      conceptAId: candidate.conceptAId,
      conceptBId: candidate.conceptBId,
      pairKey: candidate.pairKey,
      similarityScore: candidate.similarityScore,
      noveltyScore: candidate.noveltyScore,
      domainsA: candidate.domainsA,
      domainsB: candidate.domainsB,
      sampleClaimIds: samplesByPair.get(
        `${candidate.conceptAId}:${candidate.conceptBId}`,
      ) ?? { a: [], b: candidate.hitClaimIds.slice(0, 3) },
    }));
  },
});

async function hydrateSampleClaims(
  ctx: QueryCtx,
  claimIds: readonly Id<"claims">[],
) {
  return (
    await Promise.all(
      claimIds.map(async (claimId) => {
        const claim = await ctx.db.get("claims", claimId);
        if (!claim) return null;
        const source = await ctx.db.get("sources", claim.sourceId);
        return {
          id: claim._id,
          text: claim.text,
          sourceId: claim.sourceId,
          sourceTitle: source?.title ?? "(untitled source)",
        };
      }),
    )
  ).filter((claim): claim is NonNullable<typeof claim> => claim !== null);
}

export const hydrateAgentCandidates = internalQuery({
  args: { candidates: v.array(candidateValidator) },
  returns: v.array(
    v.object({
      ...candidateValidator.fields,
      conceptA: candidateConceptValidator,
      conceptB: candidateConceptValidator,
      sampleClaims: v.object({
        a: v.array(sampleClaimValidator),
        b: v.array(sampleClaimValidator),
      }),
    }),
  ),
  handler: async (ctx, args) =>
    (
      await Promise.all(
        args.candidates.map(async (candidate) => {
          const [conceptA, conceptB, claimsA, claimsB] = await Promise.all([
            ctx.db.get("concepts", candidate.conceptAId),
            ctx.db.get("concepts", candidate.conceptBId),
            hydrateSampleClaims(ctx, candidate.sampleClaimIds.a),
            hydrateSampleClaims(ctx, candidate.sampleClaimIds.b),
          ]);
          if (!conceptA || !conceptB) return null;
          return {
            ...candidate,
            conceptA: {
              id: conceptA._id,
              name: conceptA.name,
              displayName: conceptA.displayName,
              description: conceptA.description,
              domains: conceptDomains(conceptA),
            },
            conceptB: {
              id: conceptB._id,
              name: conceptB.name,
              displayName: conceptB.displayName,
              description: conceptB.description,
              domains: conceptDomains(conceptB),
            },
            sampleClaims: { a: claimsA, b: claimsB },
          };
        }),
      )
    ).filter(
      (candidate): candidate is NonNullable<typeof candidate> =>
        candidate !== null,
    ),
});

export const listForAgent = internalAction({
  args: {
    limit: v.optional(v.number()),
    seedConceptId: v.optional(v.id("concepts")),
  },
  handler: async (ctx, args) => {
    const candidates = await ctx.runAction(generateCandidatesRef, args);
    return await ctx.runQuery(hydrateAgentCandidatesRef, { candidates });
  },
});

export const searchClaimsSemantic = internalAction({
  args: { text: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      claimId: v.id("claims"),
      score: v.float64(),
      text: v.string(),
      sourceId: v.id("sources"),
      sourceTitle: v.string(),
      domains: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (!text) return [];
    const embedded = await ctx.runAction(embedTextsRef, { texts: [text] });
    const vector = embedded.embeddings[0];
    if (!vector || vector.length !== EMBEDDING_DIMENSIONS) return [];
    const matches = await ctx.vectorSearch("claims", "by_embedding", {
      vector,
      limit: Math.min(clampLimit(args.limit, 10), VECTOR_MATCH_LIMIT),
      filter: (q) => q.eq("status", "active"),
    });
    const hydrated = await ctx.runQuery(hydrateMatchesRef, {
      matches: matches.map((match) => ({
        claimId: match._id,
        score: match._score,
      })),
    });
    return hydrated.map(({ concepts: _concepts, ...match }) => match);
  },
});

export const listEvidenceTargets = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      correspondenceId: v.id("correspondences"),
      pairKey: v.string(),
      statement: v.string(),
      rationaleMd: v.string(),
      existingClaimIds: v.array(v.id("claims")),
      lastEvidenceAt: v.optional(v.number()),
      conceptA: candidateConceptValidator,
      conceptB: candidateConceptValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("correspondences")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "conjectured"))
      .order("asc")
      .take(TARGET_SCAN_LIMIT);
    const sorted = rows.toSorted((left, right) => {
      const leftAt = Math.max(
        left.createdAt,
        ...left.evidence.map((entry) => entry.addedAt),
      );
      const rightAt = Math.max(
        right.createdAt,
        ...right.evidence.map((entry) => entry.addedAt),
      );
      return leftAt - rightAt || left.pairKey.localeCompare(right.pairKey);
    });
    return (
      await Promise.all(
        sorted
          .slice(0, Math.min(clampLimit(args.limit, 5), 5))
          .map(async (row) => {
            const [conceptA, conceptB] = await Promise.all([
              ctx.db.get("concepts", row.conceptAId),
              ctx.db.get("concepts", row.conceptBId),
            ]);
            if (!conceptA || !conceptB) return null;
            const lastEvidenceAt = row.evidence.reduce<number | undefined>(
              (latest, entry) => Math.max(latest ?? 0, entry.addedAt),
              undefined,
            );
            const describe = (concept: Doc<"concepts">) => ({
              id: concept._id,
              name: concept.name,
              displayName: concept.displayName,
              description: concept.description,
              domains: conceptDomains(concept),
            });
            return {
              correspondenceId: row._id,
              pairKey: row.pairKey,
              statement: row.statement,
              rationaleMd: row.rationaleMd,
              existingClaimIds: row.evidence.map((entry) => entry.claimId),
              lastEvidenceAt,
              conceptA: describe(conceptA),
              conceptB: describe(conceptB),
            };
          }),
      )
    ).filter((target): target is NonNullable<typeof target> => target !== null);
  },
});
