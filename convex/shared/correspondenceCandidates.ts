import { pairKey } from "./correspondenceKey";

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

type RankedCandidateInput = {
  pairKey: string;
  similarityScore: number;
  coMentions: number;
  existingEdges: number;
  correspondenceExists: boolean;
};

function normalizedDomains(domains: readonly string[]): string[] {
  return Array.from(new Set(domains)).toSorted();
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
      const rankedClaims = Array.from(claims.entries()).toSorted(
        ([leftId, leftScore], [rightId, rightScore]) =>
          rightScore - leftScore || leftId.localeCompare(rightId),
      );
      return {
        ...proposal,
        similarityScore: rankedClaims[0]?.[1] ?? 0,
        hitClaimIds: rankedClaims.slice(0, 3).map(([claimId]) => claimId),
      };
    })
    .toSorted((left, right) => left.pairKey.localeCompare(right.pairKey));
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
    .toSorted(
      (left, right) =>
        right.similarityScore * right.noveltyScore -
          left.similarityScore * left.noveltyScore ||
        left.pairKey.localeCompare(right.pairKey),
    )
    .slice(0, Math.max(0, Math.floor(limit)));
}
