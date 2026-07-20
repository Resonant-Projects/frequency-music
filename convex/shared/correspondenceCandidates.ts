/* eslint-disable unicorn/no-array-sort -- The agent's ES target does not include Array#toSorted. */

import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import { pairKey } from "./correspondenceKey";

export const candidateConceptZ = z.object({
  id: zid("concepts"),
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  domains: z.array(z.string()),
});

export const candidateClaimZ = z.object({
  id: zid("claims"),
  text: z.string(),
  sourceId: zid("sources"),
  sourceTitle: z.string(),
});

export const correspondenceCandidateBaseZ = z.object({
  conceptAId: zid("concepts"),
  conceptBId: zid("concepts"),
  pairKey: z.string(),
  similarityScore: z.number(),
  noveltyScore: z.number(),
  domainsA: z.array(z.string()),
  domainsB: z.array(z.string()),
  sampleClaimIds: z.object({
    a: z.array(zid("claims")),
    b: z.array(zid("claims")),
  }),
});

export const correspondenceCandidateZ = correspondenceCandidateBaseZ.extend({
  conceptA: candidateConceptZ,
  conceptB: candidateConceptZ,
  sampleClaims: z.object({
    a: z.array(candidateClaimZ),
    b: z.array(candidateClaimZ),
  }),
});

export const semanticClaimZ = z.object({
  claimId: zid("claims"),
  score: z.number(),
  text: z.string(),
  sourceId: zid("sources"),
  sourceTitle: z.string(),
  domains: z.array(z.string()),
});

export const evidenceTargetZ = z.object({
  correspondenceId: zid("correspondences"),
  pairKey: z.string(),
  statement: z.string(),
  rationaleMd: z.string(),
  existingClaimIds: z.array(zid("claims")),
  lastEvidenceAt: z.number().optional(),
  conceptA: candidateConceptZ,
  conceptB: candidateConceptZ,
});

export type CandidateConceptPayload = z.input<typeof candidateConceptZ>;
export type CandidateClaimPayload = z.input<typeof candidateClaimZ>;
export type CorrespondenceCandidatePayload = z.input<
  typeof correspondenceCandidateZ
>;
export type SemanticClaimPayload = z.input<typeof semanticClaimZ>;
export type EvidenceTargetPayload = z.input<typeof evidenceTargetZ>;

export type PairingConcept = {
  conceptId: string;
  domains: string[];
};

export type PairingHit = {
  claimId: string;
  score: number;
  concepts: PairingConcept[];
};

export type PairProposal = {
  conceptAId: string;
  conceptBId: string;
  pairKey: string;
  domainsA: string[];
  domainsB: string[];
  similarityScore: number;
  hitClaimIds: string[];
};

export type ClaimVector = {
  claimId: string;
  embedding: number[];
};

export type CrossConceptSamples = {
  similarityScore: number;
  sampleClaimIds: { a: string[]; b: string[] };
};

type RankedCandidateInput = {
  pairKey: string;
  similarityScore: number;
  coMentions: number;
  existingEdges: number;
  correspondenceExists: boolean;
};

type DraftableCorrespondenceRank = {
  status: string;
  similarityScore?: number;
  noveltyScore?: number;
  pairKey: string;
};

export function compareDraftableCorrespondences(
  left: DraftableCorrespondenceRank,
  right: DraftableCorrespondenceRank,
): number {
  const statusRank = (status: string) => (status === "evidenced" ? 0 : 1);
  return (
    statusRank(left.status) - statusRank(right.status) ||
    (right.similarityScore ?? 0) * (right.noveltyScore ?? 0) -
      (left.similarityScore ?? 0) * (left.noveltyScore ?? 0) ||
    left.pairKey.localeCompare(right.pairKey)
  );
}

function normalizedDomains(domains: readonly string[]): string[] {
  return Array.from(new Set(domains)).sort();
}

export function domainSetsDiffer(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const a = normalizedDomains(left);
  const b = normalizedDomains(right);
  return (
    a.length !== b.length || a.some((domain, index) => domain !== b[index])
  );
}

export function buildPairProposals(
  probe: PairingConcept,
  hits: readonly PairingHit[],
): PairProposal[] {
  const domainsA = normalizedDomains(probe.domains);
  const grouped = new Map<
    string,
    Omit<PairProposal, "similarityScore" | "hitClaimIds"> & {
      claims: Map<string, number>;
    }
  >();

  for (const hit of hits) {
    for (const concept of hit.concepts) {
      if (
        concept.conceptId === probe.conceptId ||
        !domainSetsDiffer(domainsA, concept.domains)
      ) {
        continue;
      }
      const key = pairKey(probe.conceptId, concept.conceptId);
      const current = grouped.get(key) ?? {
        conceptAId: probe.conceptId,
        conceptBId: concept.conceptId,
        pairKey: key,
        domainsA,
        domainsB: normalizedDomains(concept.domains),
        claims: new Map<string, number>(),
      };
      current.claims.set(
        hit.claimId,
        Math.max(
          current.claims.get(hit.claimId) ?? Number.NEGATIVE_INFINITY,
          hit.score,
        ),
      );
      grouped.set(key, current);
    }
  }

  return Array.from(grouped.values())
    .map(({ claims, ...proposal }) => {
      const rankedClaims = Array.from(claims.entries()).sort(
        ([leftId, leftScore], [rightId, rightScore]) =>
          rightScore - leftScore || leftId.localeCompare(rightId),
      );
      return {
        ...proposal,
        similarityScore: rankedClaims[0]?.[1] ?? 0,
        hitClaimIds: rankedClaims.slice(0, 3).map(([claimId]) => claimId),
      };
    })
    .sort((left, right) => left.pairKey.localeCompare(right.pairKey));
}

export function noveltyScore(input: {
  coMentions: number;
  existingEdges: number;
  correspondenceExists: boolean;
}): number {
  if (input.correspondenceExists) return 0;
  const coMentions = Math.max(0, Math.floor(input.coMentions));
  const existingEdges = Math.max(0, Math.floor(input.existingEdges));
  return 1 / (1 + coMentions + existingEdges);
}

export function rankCandidateScores<T extends RankedCandidateInput>(
  candidates: readonly T[],
  limit: number,
): Array<T & { noveltyScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      noveltyScore: noveltyScore(candidate),
    }))
    .filter((candidate) => candidate.noveltyScore > 0)
    .sort(
      (left, right) =>
        right.similarityScore * right.noveltyScore -
          left.similarityScore * left.noveltyScore ||
        left.pairKey.localeCompare(right.pairKey),
    )
    .slice(0, Math.max(0, Math.floor(limit)));
}

function cosineSimilarity(left: readonly number[], right: readonly number[]) {
  if (left.length === 0 || left.length !== right.length) return -1;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return -1;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export function selectCrossConceptSamples(
  claimsA: readonly ClaimVector[],
  claimsB: readonly ClaimVector[],
  limit = 3,
): CrossConceptSamples | null {
  if (claimsA.length === 0 || claimsB.length === 0) return null;
  const scoresA = new Map<string, number>();
  const scoresB = new Map<string, number>();
  let similarityScore = -1;
  for (const claimA of claimsA) {
    for (const claimB of claimsB) {
      const score = cosineSimilarity(claimA.embedding, claimB.embedding);
      similarityScore = Math.max(similarityScore, score);
      scoresA.set(
        claimA.claimId,
        Math.max(scoresA.get(claimA.claimId) ?? -1, score),
      );
      scoresB.set(
        claimB.claimId,
        Math.max(scoresB.get(claimB.claimId) ?? -1, score),
      );
    }
  }
  if (!Number.isFinite(similarityScore) || similarityScore < -0.999_999) {
    return null;
  }
  const rankedIds = (scores: Map<string, number>) =>
    Array.from(scores.entries())
      .sort(
        ([leftId, leftScore], [rightId, rightScore]) =>
          rightScore - leftScore || leftId.localeCompare(rightId),
      )
      .slice(0, Math.max(1, Math.floor(limit)))
      .map(([claimId]) => claimId);
  return {
    similarityScore,
    sampleClaimIds: { a: rankedIds(scoresA), b: rankedIds(scoresB) },
  };
}
