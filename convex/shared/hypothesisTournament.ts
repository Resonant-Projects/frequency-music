// Offline tournament records for the future worker/Convex persistence seam.
// No validators, table definitions, model selection, or live dependencies.
import type { HypothesisDraftPayload } from "./draftPayloads.js";

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
