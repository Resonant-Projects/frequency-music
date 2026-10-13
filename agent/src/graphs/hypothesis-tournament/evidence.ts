import { z } from "zod";
import { hypothesisDraftPayloadZ } from "../../../../convex/shared/draftPayloads.js";
import {
  citedClaims,
  TOURNAMENT_STATEMENT_MAX_CHARS,
  TOURNAMENT_TITLE_MAX_CHARS,
} from "../../../../convex/shared/hypothesisTournament.js";
import { findHallucinatedIds } from "../research-pipeline/idGate.js";
import type {
  EvidenceClaim,
  TournamentCandidate,
  TournamentSeed,
} from "./types.js";

// Text the durable draft or the statement tools cannot take is invalid
// output here, not a persistence or dependency failure later.
const titleZ = z.string().min(1).max(TOURNAMENT_TITLE_MAX_CHARS);
const statementZ = z
  .string()
  .max(TOURNAMENT_STATEMENT_MAX_CHARS)
  .refine((text) => text.trim().length > 0, "Must not be blank");
const bounded = { title: titleZ, statement: statementZ };

export const generationSchema = hypothesisDraftPayloadZ
  .extend(bounded)
  .omit({
    sourceIds: true,
    extractionIds: true,
    correspondenceId: true,
    thesisId: true,
    confidence: true,
  })
  .strict();

const equals = (ids: string[], expected: Set<string>) =>
  ids.length === new Set(ids).size &&
  ids.length === expected.size &&
  ids.every((id) => expected.has(id));

export const groundedPayloadSchema = hypothesisDraftPayloadZ
  .extend(bounded)
  .strict()
  .refine((payload) => citedClaims(payload.rationale) !== undefined, {
    message: "Use only [claim:<id>] citations, with no bare claim IDs",
  });

/** Reuse the existing pure ID gate; parent must extract a shared typed ledger
 * before production wiring. Existing gate does not cover claims/correspondences.
 * This check additionally requires exact provenance from THIS candidate's
 * hydrated claims, so a read elsewhere in the run cannot launder a reference. */
export function groundedPayload(
  value: unknown,
  candidate: TournamentCandidate,
  seed: TournamentSeed,
) {
  const parsed = groundedPayloadSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const payload = parsed.data;
  const claims = candidate.evidence;
  const citations = citedClaims(payload.rationale);
  const sources = new Set(claims.map((claim) => claim.sourceId));
  const extractions = new Set(claims.map((claim) => claim.extractionId));

  if (
    claims.length < 2 ||
    findHallucinatedIds(payload, [...sources, ...extractions]).length > 0 ||
    !equals(payload.sourceIds, sources) ||
    !equals(payload.extractionIds, extractions) ||
    payload.thesisId !== undefined ||
    payload.correspondenceId !== seed.correspondenceId ||
    !citations ||
    !equals(
      [...new Set(citations)],
      new Set(claims.map((claim) => claim.claimId)),
    )
  )
    return undefined;
  return payload;
}

export function readEvidence(
  ids: string[],
  hydrated: EvidenceClaim[],
): EvidenceClaim[] {
  const requested = new Set(ids);
  const byId = new Map<string, EvidenceClaim>();
  for (const claim of hydrated) {
    if (
      !requested.has(claim.claimId) ||
      !claim.text?.trim() ||
      !claim.sourceId ||
      !claim.extractionId
    )
      continue;
    const prior = byId.get(claim.claimId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(claim)) {
      throw new Error("Hydration returned conflicting claim provenance");
    }
    byId.set(claim.claimId, claim);
  }
  return [...byId.values()];
}
