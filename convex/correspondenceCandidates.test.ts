import { describe, expect, test } from "vite-plus/test";
import {
  buildPairProposals,
  noveltyScore,
  rankCandidateScores,
  selectCrossConceptSamples,
} from "./shared/correspondenceCandidates";

describe("correspondence candidate scoring", () => {
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
