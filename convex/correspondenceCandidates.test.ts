import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import { modules } from "../harness/modules";
import schema from "./schema";
import { clampCandidateGenerationLimit } from "./correspondenceCandidates";
import {
  buildPairProposals,
  noveltyScore,
  rankCandidateScores,
  selectCrossConceptSamples,
} from "./shared/correspondenceCandidates";
import { EMBEDDING_MODEL } from "./shared/embeddingText";

describe("correspondence candidate scoring", () => {
  test("caps candidate hydration at the action-safe execution limit", () => {
    expect(clampCandidateGenerationLimit(undefined)).toBe(25);
    expect(clampCandidateGenerationLimit(7.9)).toBe(7);
    expect(clampCandidateGenerationLimit(500)).toBe(25);
  });

  test("groups cross-domain hits by pair and keeps the strongest claim score", () => {
    const proposals = buildPairProposals(
      { conceptId: "concept-a", domains: ["cymatics"] },
      [
        {
          claimId: "claim-weak",
          score: 0.71,
          concepts: [{ conceptId: "concept-b", domains: ["psychoacoustics"] }],
        },
        {
          claimId: "claim-strong",
          score: 0.91,
          concepts: [
            { conceptId: "concept-b", domains: ["psychoacoustics"] },
            { conceptId: "concept-a", domains: ["cymatics"] },
            { conceptId: "concept-c", domains: ["cymatics"] },
          ],
        },
      ],
    );

    expect(proposals).toEqual([
      {
        conceptAId: "concept-a",
        conceptBId: "concept-b",
        pairKey: "concept-a:concept-b",
        domainsA: ["cymatics"],
        domainsB: ["psychoacoustics"],
        similarityScore: 0.91,
        hitClaimIds: ["claim-strong", "claim-weak"],
      },
    ]);
  });

  test("penalizes structural proximity and zeroes existing correspondences", () => {
    expect(
      noveltyScore({
        coMentions: 2,
        existingEdges: 1,
        correspondenceExists: false,
      }),
    ).toBe(0.25);
    expect(
      noveltyScore({
        coMentions: 0,
        existingEdges: 0,
        correspondenceExists: true,
      }),
    ).toBe(0);
  });

  test("drops existing pairs and ranks by similarity times novelty", () => {
    const ranked = rankCandidateScores(
      [
        {
          pairKey: "a:b",
          similarityScore: 0.95,
          coMentions: 3,
          existingEdges: 0,
          correspondenceExists: false,
        },
        {
          pairKey: "a:c",
          similarityScore: 0.8,
          coMentions: 0,
          existingEdges: 0,
          correspondenceExists: false,
        },
        {
          pairKey: "a:d",
          similarityScore: 0.99,
          coMentions: 0,
          existingEdges: 0,
          correspondenceExists: true,
        },
      ],
      2,
    );

    expect(ranked.map((candidate) => candidate.pairKey)).toEqual([
      "a:c",
      "a:b",
    ]);
    expect(ranked.map((candidate) => candidate.noveltyScore)).toEqual([
      1, 0.25,
    ]);
  });

  test("selects the top claims on each side from cross-concept cosine pairs", () => {
    expect(
      selectCrossConceptSamples(
        [
          { claimId: "a-near-x", embedding: [1, 0] },
          { claimId: "a-near-y", embedding: [0, 1] },
          { claimId: "a-diagonal", embedding: [1, 1] },
        ],
        [
          { claimId: "b-x", embedding: [1, 0] },
          { claimId: "b-y", embedding: [0, 1] },
        ],
        2,
      ),
    ).toEqual({
      similarityScore: 1,
      sampleClaimIds: {
        a: ["a-near-x", "a-near-y"],
        b: ["b-x", "b-y"],
      },
    });
  });
});

describe("correspondence candidate query hydration", () => {
  test("hydrates only active current-model claims and on-mission concepts", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        title: "Primary source",
        status: "extracted",
        dedupeKey: "source-primary",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const missingSourceId = await ctx.db.insert("sources", {
        type: "url",
        title: "Soon deleted",
        status: "extracted",
        dedupeKey: "source-missing",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const extractionId = await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "test",
        inputHash: "test-input",
        summary: "Summary",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 1,
      });
      const onMissionConceptId = await ctx.db.insert("concepts", {
        name: "resonance",
        displayName: "Resonance",
        aliases: [],
        domain: "wave-physics",
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("concepts", {
        name: "optimizer",
        displayName: "Optimizer",
        aliases: [],
        domain: "machine-learning",
        missionRelevance: "off",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      for (const conceptName of ["resonance", "optimizer"]) {
        await ctx.db.insert("edges", {
          fromType: "source",
          fromId: sourceId,
          toType: "concept",
          toId: conceptName,
          relationship: "mentions",
          autoGenerated: true,
          createdAt: 1,
          createdBy: "system",
        });
      }
      const baseClaim = {
        extractionId,
        sourceId,
        ordinal: 0,
        text: "Active claim",
        evidenceLevel: "peer_reviewed" as const,
        citations: [],
        createdBy: "system" as const,
        createdAt: 1,
      };
      const activeClaimId = await ctx.db.insert("claims", {
        ...baseClaim,
        status: "active",
        embeddingModel: EMBEDDING_MODEL,
      });
      const supersededClaimId = await ctx.db.insert("claims", {
        ...baseClaim,
        ordinal: 1,
        text: "Superseded claim",
        status: "superseded",
        embeddingModel: EMBEDDING_MODEL,
      });
      const staleModelClaimId = await ctx.db.insert("claims", {
        ...baseClaim,
        ordinal: 2,
        text: "Stale model claim",
        status: "active",
        embeddingModel: "stale-embedding-model",
      });
      const missingSourceClaimId = await ctx.db.insert("claims", {
        ...baseClaim,
        sourceId: missingSourceId,
        ordinal: 3,
        text: "Claim whose source was deleted",
        status: "active",
        embeddingModel: EMBEDDING_MODEL,
      });
      await ctx.db.delete(missingSourceId);
      return {
        activeClaimId,
        supersededClaimId,
        staleModelClaimId,
        missingSourceClaimId,
        onMissionConceptId,
      };
    });

    const matches = await t.query(
      internal.correspondenceCandidates.hydrateClaimMatches,
      {
        matches: [
          { claimId: seeded.activeClaimId, score: 0.9 },
          { claimId: seeded.supersededClaimId, score: 0.8 },
          { claimId: seeded.staleModelClaimId, score: 0.7 },
          { claimId: seeded.missingSourceClaimId, score: 0.6 },
        ],
      },
    );

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      claimId: seeded.activeClaimId,
      sourceTitle: "Primary source",
      domains: ["wave-physics"],
      concepts: [{ conceptId: seeded.onMissionConceptId, name: "resonance" }],
    });
    expect(matches[1]).toMatchObject({
      claimId: seeded.missingSourceClaimId,
      sourceTitle: "(untitled source)",
      domains: [],
      concepts: [],
    });
  });

  test("scores co-mentions and edges and safely suppresses missing concepts", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const conceptAId = await ctx.db.insert("concepts", {
        name: "cymatics",
        displayName: "Cymatics",
        aliases: [],
        domain: "cymatics",
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const conceptBId = await ctx.db.insert("concepts", {
        name: "beating",
        displayName: "Beating",
        aliases: [],
        domain: "psychoacoustics",
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const missingConceptId = await ctx.db.insert("concepts", {
        name: "deleted-concept",
        displayName: "Deleted concept",
        aliases: [],
        domain: "test",
        mentionCount: 0,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("edges", {
        fromType: "source",
        fromId: "shared-source",
        toType: "concept",
        toId: "cymatics",
        relationship: "mentions",
        autoGenerated: true,
        createdAt: 1,
        createdBy: "system",
      });
      await ctx.db.insert("edges", {
        fromType: "source",
        fromId: "shared-source",
        toType: "concept",
        toId: "beating",
        relationship: "mentions",
        autoGenerated: true,
        createdAt: 1,
        createdBy: "system",
      });
      await ctx.db.insert("edges", {
        fromType: "concept",
        fromId: "cymatics",
        toType: "concept",
        toId: "beating",
        relationship: "related",
        autoGenerated: true,
        createdAt: 1,
        createdBy: "system",
      });
      await ctx.db.delete(missingConceptId);
      return { conceptAId, conceptBId, missingConceptId };
    });

    const scores = await t.query(
      internal.correspondenceCandidates.getStructuralScores,
      {
        pairs: [
          {
            conceptAId: seeded.conceptAId,
            conceptBId: seeded.conceptBId,
            pairKey: "cymatics:beating",
          },
          {
            conceptAId: seeded.conceptAId,
            conceptBId: seeded.missingConceptId,
            pairKey: "cymatics:deleted-concept",
          },
        ],
      },
    );

    expect(scores).toEqual([
      {
        pairKey: "cymatics:beating",
        coMentions: 1,
        existingEdges: 1,
        correspondenceExists: false,
      },
      {
        pairKey: "cymatics:deleted-concept",
        coMentions: 0,
        existingEdges: 0,
        correspondenceExists: true,
      },
    ]);
  });
});
