/* eslint-disable no-underscore-dangle -- Convex document and vector ids use underscore names. */
import { makeFunctionReference } from "convex/server";
import { zodToConvex } from "convex-helpers/server/zod4";
import { v } from "convex/values";
import type { z } from "zod";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import {
  buildPairProposals,
  correspondenceCandidateBaseZ,
  correspondenceCandidateZ,
  evidenceTargetZ,
  rankCandidateScores,
  selectCrossConceptSamples,
  semanticClaimZ,
} from "./shared/correspondenceCandidates";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./shared/embeddingText";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_CANDIDATE_EXECUTION_LIMIT = 25;
const VECTOR_MATCH_LIMIT = 32;
const STRUCTURAL_EDGE_LIMIT = 100;
const MAX_SAMPLE_POOL = 12;
const EVIDENCE_TARGET_SCAN_LIMIT = 500;

const candidateValidator = zodToConvex(correspondenceCandidateBaseZ);
const richCandidateValidator = zodToConvex(correspondenceCandidateZ);
const semanticClaimValidator = zodToConvex(semanticClaimZ);
const evidenceTargetValidator = zodToConvex(evidenceTargetZ);

type Candidate = z.infer<typeof correspondenceCandidateBaseZ>;
type RichCandidate = z.infer<typeof correspondenceCandidateZ>;

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

export function clampCandidateGenerationLimit(limit: number | undefined) {
  return Math.min(clampLimit(limit), MAX_CANDIDATE_EXECUTION_LIMIT);
}

function conceptDomains(concept: Doc<"concepts">): string[] {
  return Array.from(new Set(concept.domains ?? [concept.domain])).toSorted();
}

function describeConcept(concept: Doc<"concepts">) {
  return {
    name: concept.name,
    displayName: concept.displayName,
    description: concept.description,
    domains: conceptDomains(concept),
  };
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
      pairKey: string;
      hitClaimIds: Id<"claims">[];
    }>;
  },
  Array<{
    conceptAId: Id<"concepts">;
    conceptBId: Id<"concepts">;
    pairKey: string;
    similarityScore: number;
    sampleClaimIds: { a: Id<"claims">[]; b: Id<"claims">[] };
  }>
>("correspondenceCandidates:getCandidateSamples");
const hydrateAgentCandidatesRef = makeFunctionReference<
  "query",
  { candidates: Candidate[] },
  RichCandidate[]
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
              ...describeConcept(concept),
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
): Promise<Array<{ claimId: Id<"claims">; embedding: number[] }>> {
  const sourceIds = await sourceIdsForConcept(ctx, concept.name);
  const preferred = (
    await Promise.all(
      preferredClaimIds.map((claimId) => ctx.db.get("claims", claimId)),
    )
  ).filter(
    (claim): claim is Doc<"claims"> =>
      claim?.status === "active" &&
      sourceIds.has(claim.sourceId) &&
      claim.embeddingModel === EMBEDDING_MODEL &&
      claim.embedding?.length === EMBEDDING_DIMENSIONS,
  );
  const claimsBySource = await Promise.all(
    Array.from(sourceIds)
      .slice(0, 12)
      .map((sourceId) =>
        ctx.db
          .query("claims")
          .withIndex("by_sourceId_status", (q) =>
            q.eq("sourceId", sourceId as Id<"sources">).eq("status", "active"),
          )
          .take(3),
      ),
  );
  const claims = [
    ...preferred,
    ...claimsBySource.flatMap((sourceClaims) =>
      sourceClaims.filter(
        (claim) =>
          claim.embeddingModel === EMBEDDING_MODEL &&
          claim.embedding?.length === EMBEDDING_DIMENSIONS,
      ),
    ),
  ];
  return Array.from(
    new Map(
      claims.map((claim) => [
        claim._id,
        { claimId: claim._id, embedding: claim.embedding! },
      ]),
    ).values(),
  ).slice(0, MAX_SAMPLE_POOL);
}

export const getCandidateSamples = internalQuery({
  args: {
    pairs: v.array(
      v.object({
        conceptAId: v.id("concepts"),
        conceptBId: v.id("concepts"),
        pairKey: v.string(),
        hitClaimIds: v.array(v.id("claims")),
      }),
    ),
  },
  returns: v.array(
    v.object({
      conceptAId: v.id("concepts"),
      conceptBId: v.id("concepts"),
      pairKey: v.string(),
      similarityScore: v.float64(),
      sampleClaimIds: v.object({
        a: v.array(v.id("claims")),
        b: v.array(v.id("claims")),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const [firstPair] = args.pairs;
    if (!firstPair) return [];
    const conceptA = await ctx.db.get("concepts", firstPair.conceptAId);
    if (!conceptA) return [];
    const probeSamples = await sampleClaimsForConcept(ctx, conceptA, []);

    return (
      await Promise.all(
        args.pairs.map(async (pair) => {
          if (pair.conceptAId !== firstPair.conceptAId) {
            throw new Error(
              "getCandidateSamples requires one shared probe conceptAId",
            );
          }
          const conceptB = await ctx.db.get("concepts", pair.conceptBId);
          if (!conceptB) return null;
          const b = await sampleClaimsForConcept(
            ctx,
            conceptB,
            pair.hitClaimIds,
          );
          const a = probeSamples;
          const selected = selectCrossConceptSamples(a, b);
          if (!selected) return null;
          return {
            conceptAId: pair.conceptAId,
            conceptBId: pair.conceptBId,
            pairKey: pair.pairKey,
            similarityScore: selected.similarityScore,
            sampleClaimIds: {
              a: selected.sampleClaimIds.a as Id<"claims">[],
              b: selected.sampleClaimIds.b as Id<"claims">[],
            },
          };
        }),
      )
    ).filter((value): value is NonNullable<typeof value> => value !== null);
  },
});

export const generateCandidates = internalAction({
  args: {
    limit: v.optional(v.number()),
    seedConceptId: v.optional(v.id("concepts")),
  },
  returns: v.array(candidateValidator),
  handler: async (ctx, args): Promise<Candidate[]> => {
    const effectiveLimit = clampCandidateGenerationLimit(args.limit);
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
    )
      .toSorted(
        (left, right) =>
          right.similarityScore - left.similarityScore ||
          left.pairKey.localeCompare(right.pairKey),
      )
      // Bound every downstream per-proposal query to the requested output
      // size, itself capped for worst-case per-pair action-budget safety.
      .slice(0, effectiveLimit)
      .map((proposal) => ({
        ...proposal,
        conceptAId: proposal.conceptAId as Id<"concepts">,
        conceptBId: proposal.conceptBId as Id<"concepts">,
        hitClaimIds: proposal.hitClaimIds as Id<"claims">[],
      }));
    if (proposals.length === 0) return [];
    const samples = await ctx.runQuery(getCandidateSamplesRef, {
      pairs: proposals.map((proposal) => ({
        conceptAId: proposal.conceptAId,
        conceptBId: proposal.conceptBId,
        pairKey: proposal.pairKey,
        hitClaimIds: proposal.hitClaimIds,
      })),
    });
    const samplesByPair = new Map(
      samples.map((sample) => [sample.pairKey, sample]),
    );
    const sampledProposals = proposals.flatMap((proposal) => {
      const sample = samplesByPair.get(proposal.pairKey);
      return sample
        ? [
            {
              ...proposal,
              similarityScore: sample.similarityScore,
              sampleClaimIds: sample.sampleClaimIds,
            },
          ]
        : [];
    });
    if (sampledProposals.length === 0) return [];
    const structural = await ctx.runQuery(getStructuralScoresRef, {
      pairs: sampledProposals.map((proposal) => ({
        conceptAId: proposal.conceptAId,
        conceptBId: proposal.conceptBId,
        pairKey: proposal.pairKey,
      })),
    });
    const structuralByPair = new Map(
      structural.map((score) => [score.pairKey, score]),
    );
    const ranked = rankCandidateScores(
      sampledProposals.map((proposal) => ({
        ...proposal,
        ...(structuralByPair.get(proposal.pairKey) ?? {
          coMentions: 0,
          existingEdges: 0,
          correspondenceExists: true,
        }),
      })),
      effectiveLimit,
    );
    return ranked.map((candidate) => ({
      conceptAId: candidate.conceptAId,
      conceptBId: candidate.conceptBId,
      pairKey: candidate.pairKey,
      similarityScore: candidate.similarityScore,
      noveltyScore: candidate.noveltyScore,
      domainsA: candidate.domainsA,
      domainsB: candidate.domainsB,
      sampleClaimIds: candidate.sampleClaimIds,
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
  returns: v.array(richCandidateValidator),
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
              ...describeConcept(conceptA),
            },
            conceptB: {
              id: conceptB._id,
              ...describeConcept(conceptB),
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
  returns: v.array(richCandidateValidator),
  handler: async (ctx, args) => {
    const candidates = await ctx.runAction(generateCandidatesRef, args);
    return await ctx.runQuery(hydrateAgentCandidatesRef, { candidates });
  },
});

export const searchClaimsSemantic = internalAction({
  args: { text: v.string(), limit: v.optional(v.number()) },
  returns: v.array(semanticClaimValidator),
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
  returns: v.array(evidenceTargetValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(clampLimit(args.limit, 5), 5);
    const rows = await ctx.db
      .query("correspondences")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "conjectured"))
      .take(EVIDENCE_TARGET_SCAN_LIMIT);
    const lastEvidenceAt = (row: (typeof rows)[number]) =>
      row.evidence.reduce<number | undefined>(
        (latest, entry) => Math.max(latest ?? 0, entry.addedAt),
        undefined,
      );
    const selected = rows
      .toSorted((left, right) => {
        const leftEvidence = lastEvidenceAt(left);
        const rightEvidence = lastEvidenceAt(right);
        if (leftEvidence === undefined && rightEvidence !== undefined)
          return -1;
        if (leftEvidence !== undefined && rightEvidence === undefined) return 1;
        return (
          (leftEvidence ?? 0) - (rightEvidence ?? 0) ||
          left.createdAt - right.createdAt ||
          left._id.localeCompare(right._id)
        );
      })
      .slice(0, limit);
    return (
      await Promise.all(
        selected.map(async (row) => {
          const [conceptA, conceptB] = await Promise.all([
            ctx.db.get("concepts", row.conceptAId),
            ctx.db.get("concepts", row.conceptBId),
          ]);
          if (!conceptA || !conceptB) return null;
          return {
            correspondenceId: row._id,
            pairKey: row.pairKey,
            statement: row.statement,
            rationaleMd: row.rationaleMd,
            existingClaimIds: row.evidence.map((entry) => entry.claimId),
            lastEvidenceAt: lastEvidenceAt(row),
            conceptA: { id: conceptA._id, ...describeConcept(conceptA) },
            conceptB: { id: conceptB._id, ...describeConcept(conceptB) },
          };
        }),
      )
    ).filter((target): target is NonNullable<typeof target> => target !== null);
  },
});
