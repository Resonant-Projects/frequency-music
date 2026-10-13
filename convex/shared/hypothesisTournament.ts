// Tournament records shared by the agent core, worker adapters and Convex
// persistence. Runtime-pure: types, bounds and zod schemas only.
import { zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";
import {
  hypothesisDraftPayloadZ,
  type HypothesisDraftPayload,
} from "./draftPayloads.js";

export const TOURNAMENT_FAMILIES = [
  "correspondence",
  "claim",
  "listening",
  "inversion",
  "doctrine",
  "hint",
] as const;
export type SeedFamily = (typeof TOURNAMENT_FAMILIES)[number];
export type TournamentSeed = {
  family: SeedFamily;
  refs: string[];
  context: string;
  correspondenceId?: string;
};
export type EvidenceClaim = {
  claimId: string;
  text: string;
  sourceId: string;
  extractionId: string;
};
export type TournamentScore = {
  stake: number;
  novelty: number;
  falsifiability: number;
};
export type TournamentSelfCheck = {
  pass: boolean;
  testable: boolean;
  oneVariable: boolean;
  evidenceGrounded: boolean;
  feedback: string;
};
export type DuplicateKind = "duplicate" | "inversion" | "refinement";
export type TournamentOutcome =
  | "candidate"
  | "dropped_evidence"
  | "dropped_duplicate"
  | "ineligible"
  | "lost"
  | "finalist"
  | "failed_self_check"
  | "submitted";
export type TournamentCandidate = {
  agentRunId: string;
  batchIndex: number;
  seedFamily: SeedFamily;
  seedRefs: string[];
  payload: HypothesisDraftPayload;
  finalPayload?: HypothesisDraftPayload;
  evidenceClaimIds: string[];
  evidence: EvidenceClaim[];
  selfCheck?: TournamentSelfCheck;
  statementEmbedding?: number[];
  relations: { id: string; kind: DuplicateKind }[];
  duplicateOf?: string;
  duplicateKind?: DuplicateKind;
  scores: TournamentScore[];
  outcome: TournamentOutcome;
  flags: string[];
  draftId?: string;
  createdAt: number;
};
export type TournamentPair = {
  left: number;
  right: number;
  winner: number | null;
  status: "judged" | "missing";
};
export type TournamentDraft = {
  agentRunId: string;
  dedupeKey: string;
  draft: {
    kind: "hypothesis_draft";
    title: string;
    summary: string;
    candidateIds: string[];
    needsReview: true;
    payload: HypothesisDraftPayload;
  };
};

export type TournamentEvent = {
  kind: "family_skipped" | "attempt_failed" | "stopped";
  reason: string;
  family?: SeedFamily;
  batchIndex?: number;
};

export type TournamentResult = {
  reason:
    | "busy"
    | "submitted"
    | "capacity"
    | "insufficient_seeds"
    | "no_eligible_candidates"
    | "failed_self_check"
    | "duplicate_revision"
    | "budget_exhausted"
    | "dependency_error";
  candidates: TournamentCandidate[];
  pairs: TournamentPair[];
  events: TournamentEvent[];
  draft?: TournamentDraft;
  draftId?: string;
  budget: {
    calls: Record<
      | "generation"
      | "grounding"
      | "scoring"
      | "duplicate"
      | "finalist"
      | "selfCheck"
      | "revision"
      | "duplicateRecheck",
      number
    >;
    duplicateCalls: Record<number, number>;
    totalTokens: number;
    elapsedMs: number;
  };
};

/** Opaque fencing token issued by durable persistence, never by the core. */
export type TournamentLease = { runId: string; token: string };
export type TournamentBegin =
  | { status: "acquired"; lease: TournamentLease }
  | { status: "busy" }
  | { status: "replay"; result: TournamentResult };

// ---------------------------------------------------------------------------
// Durable persistence contract (Convex agent tools <-> worker adapters).
// ---------------------------------------------------------------------------

export const HYPOTHESIS_TOURNAMENT_GRAPH = "hypothesis-tournament";
/** Convex deployment env flag. Only the literal "true" admits new leases or
 * requests; replay of completed results never needs it. */
export const TOURNAMENT_ENABLED_ENV = "HYPOTHESIS_TOURNAMENT_ENABLED";
export const TOURNAMENT_SEED_HINT_MAX_CHARS = 500;
export const TOURNAMENT_MAX_CANDIDATES = 8;
export const TOURNAMENT_MAX_PAIRS = 3;
export const TOURNAMENT_MAX_EVIDENCE = 20;
export const TOURNAMENT_DUPLICATE_THRESHOLD = 0.86;
// Missing or stale hypothesis vectors re-embedded per neighbor query. More
// than this fails closed until backfillHypothesisEmbeddings runs.
export const DUPLICATE_REEMBED_LIMIT = 32;
/** Upper bound on a requested lease: 20 min wall + 10 s cleanup, with slack. */
export const TOURNAMENT_MAX_LEASE_MS = 30 * 60_000;
/** sha256 hex of a statement; marks hypothesis vectors stale when text moves. */
export async function statementHash(statement: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(statement),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export const tournamentDedupeKey = (runId: string) => `tournament:${runId}`;

// Validate without transforming: provenance compares these values exactly
// against the database, so parsing must never rewrite them.
const nonblank = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0, "Must not be blank");
const id = nonblank(200);
const text = (max: number) => z.string().max(max);
const familyZ = z.enum(TOURNAMENT_FAMILIES);
const duplicateKindZ = z.enum(["duplicate", "inversion", "refinement"]);

export const tournamentSeedZ = z
  .object({
    family: familyZ,
    refs: z.array(id).max(20),
    context: z.string().trim().min(1).max(6_000),
    correspondenceId: id.optional(),
  })
  .strict();
export const evidenceClaimZ = z
  .object({
    claimId: id,
    text: nonblank(4_000),
    sourceId: id,
    extractionId: id,
  })
  .strict();
export const tournamentScoreZ = z
  .object({
    stake: z.number().min(0).max(5),
    novelty: z.number().min(0).max(5),
    falsifiability: z.number().min(0).max(5),
  })
  .strict();
export const tournamentSelfCheckZ = z
  .object({
    pass: z.boolean(),
    testable: z.boolean(),
    oneVariable: z.boolean(),
    evidenceGrounded: z.boolean(),
    feedback: text(4_000),
  })
  .strict();
export const tournamentOutcomeZ = z.enum([
  "candidate",
  "dropped_evidence",
  "dropped_duplicate",
  "ineligible",
  "lost",
  "finalist",
  "failed_self_check",
  "submitted",
]);
export const tournamentCandidateZ = z
  .object({
    agentRunId: id,
    batchIndex: z
      .number()
      .int()
      .min(0)
      .max(TOURNAMENT_MAX_CANDIDATES - 1),
    seedFamily: familyZ,
    seedRefs: z.array(id).max(20),
    payload: hypothesisDraftPayloadZ,
    finalPayload: hypothesisDraftPayloadZ.optional(),
    evidenceClaimIds: z.array(id).max(TOURNAMENT_MAX_EVIDENCE),
    evidence: z.array(evidenceClaimZ).max(TOURNAMENT_MAX_EVIDENCE),
    selfCheck: tournamentSelfCheckZ.optional(),
    statementEmbedding: z.array(z.number()).max(4_096).optional(),
    relations: z.array(z.object({ id, kind: duplicateKindZ }).strict()).max(4),
    duplicateOf: id.optional(),
    duplicateKind: duplicateKindZ.optional(),
    scores: z.array(tournamentScoreZ).max(3),
    outcome: tournamentOutcomeZ,
    flags: z.array(text(80)).max(10),
    draftId: id.optional(),
    createdAt: z.number(),
  })
  .strict();
export const tournamentPairZ = z
  .object({
    left: z.number().int().min(0),
    right: z.number().int().min(0),
    winner: z.number().int().min(0).nullable(),
    status: z.enum(["judged", "missing"]),
  })
  .strict();
export const tournamentEventZ = z
  .object({
    kind: z.enum(["family_skipped", "attempt_failed", "stopped"]),
    reason: text(200),
    family: familyZ.optional(),
    batchIndex: z.number().int().min(0).optional(),
  })
  .strict();
const callsZ = z
  .object({
    generation: z.number().int().min(0),
    grounding: z.number().int().min(0),
    scoring: z.number().int().min(0),
    duplicate: z.number().int().min(0),
    finalist: z.number().int().min(0),
    selfCheck: z.number().int().min(0),
    revision: z.number().int().min(0),
    duplicateRecheck: z.number().int().min(0),
  })
  .strict();
export const tournamentDraftZ = z
  .object({
    agentRunId: id,
    dedupeKey: id,
    draft: z
      .object({
        kind: z.literal("hypothesis_draft"),
        title: z.string().min(1).max(240),
        summary: z.string().min(1).max(8_000),
        candidateIds: z.array(id).min(1).max(40),
        needsReview: z.literal(true),
        payload: hypothesisDraftPayloadZ,
      })
      .strict(),
  })
  .strict();
export const tournamentResultZ = z
  .object({
    reason: z.enum([
      "busy",
      "submitted",
      "capacity",
      "insufficient_seeds",
      "no_eligible_candidates",
      "failed_self_check",
      "duplicate_revision",
      "budget_exhausted",
      "dependency_error",
    ]),
    candidates: z.array(tournamentCandidateZ).max(TOURNAMENT_MAX_CANDIDATES),
    pairs: z.array(tournamentPairZ).max(TOURNAMENT_MAX_PAIRS),
    events: z.array(tournamentEventZ).max(64),
    draft: tournamentDraftZ.optional(),
    draftId: id.optional(),
    budget: z
      .object({
        calls: callsZ,
        duplicateCalls: z.record(z.string(), z.number().int().min(0)),
        totalTokens: z.number().int().min(0),
        elapsedMs: z.number().min(0),
      })
      .strict(),
  })
  .strict();
export const tournamentLeaseZ = z.object({ runId: id, token: id }).strict();
export const archiveStageZ = z.enum([
  "duplicates",
  "finalists",
  "self_check",
  "submitted",
  "terminal",
]);
export const tournamentBeginZ = z.discriminatedUnion("status", [
  z.object({ status: z.literal("acquired"), lease: tournamentLeaseZ }).strict(),
  z.object({ status: z.literal("busy") }).strict(),
  z.object({ status: z.literal("replay"), result: tournamentResultZ }).strict(),
]);
export const tournamentSubmitResultZ = z.discriminatedUnion("status", [
  z
    .object({ status: z.literal("created"), result: tournamentResultZ })
    .strict(),
  z.object({ status: z.literal("cap_reached") }).strict(),
]);
export const tournamentNeighborZ = z
  .object({
    id,
    statement: z.string().max(4_000),
    similarity: z.number(),
  })
  .strict();
/** Metered embedding-backed responses: usage is always reported. A refusal
 * with budgetExceeded made no provider call because the strict input bound
 * (UTF-8 bytes) exceeded the caller's remaining allowance. */
const meteredMissZ = z
  .object({
    ok: z.literal(false),
    totalTokens: z.number().int().min(0),
    budgetExceeded: z.literal(true).optional(),
  })
  .strict();
const meteredHit = <T extends z.ZodType>(value: T) =>
  z
    .object({
      ok: z.literal(true),
      value,
      totalTokens: z.number().int().min(0),
    })
    .strict();
export const meteredEmbeddingZ = z.discriminatedUnion("ok", [
  meteredHit(z.array(z.number())),
  meteredMissZ,
]);
export const meteredNeighborsZ = z.discriminatedUnion("ok", [
  meteredHit(z.array(tournamentNeighborZ).max(20)),
  meteredMissZ,
]);
export const meteredClaimIdsZ = z.discriminatedUnion("ok", [
  meteredHit(z.array(id).max(TOURNAMENT_MAX_EVIDENCE)),
  meteredMissZ,
]);
/** Embedding tokenizers emit at most one token per UTF-8 byte. */
export function embeddingTokenBound(texts: readonly string[]) {
  const encoder = new TextEncoder();
  return texts.reduce((sum, text) => sum + encoder.encode(text).length, 0);
}

// Compile-time drift checks between the hand-written core types and schemas.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sameSeed: Same<z.infer<typeof tournamentSeedZ>, TournamentSeed> = true;
const sameClaim: Same<z.infer<typeof evidenceClaimZ>, EvidenceClaim> = true;
const samePair: Same<z.infer<typeof tournamentPairZ>, TournamentPair> = true;
const sameEvent: Same<z.infer<typeof tournamentEventZ>, TournamentEvent> = true;
void [sameSeed, sameClaim, samePair, sameEvent];

/** Archive row: the candidate plus write time. Statement vectors must have the
 * claims embedding dimensions; persistence rejects any other length. */
export const hypothesisCandidateRowZ = tournamentCandidateZ.extend({
  updatedAt: z.number(),
});
export type HypothesisCandidateRow = z.infer<typeof hypothesisCandidateRowZ>;
export const hypothesisCandidateRowValidator = zodToConvex(
  hypothesisCandidateRowZ,
);
