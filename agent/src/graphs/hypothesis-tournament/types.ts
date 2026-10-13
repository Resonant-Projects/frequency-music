import type {
  EvidenceClaim,
  TournamentBegin,
  TournamentLease,
  TournamentResult,
  TournamentCandidate,
  TournamentDraft,
  TournamentPair,
  TournamentSeed,
} from "../../../../convex/shared/hypothesisTournament.js";
export type * from "../../../../convex/shared/hypothesisTournament.js";

/** One provider attempt. Include usage even on a failed/invalid response.
 * No hidden SDK retries: each invocation is one counted attempt.
 * Unknown usage must throw, which terminates the run without a draft. */
export type Metered<T> =
  | { ok: true; value: T; totalTokens: number }
  | { ok: false; totalTokens: number };
export type CallContext = {
  signal: AbortSignal;
  /** Adapter must bound input + maximum output tokens to this allowance. */
  maxTotalTokens: number;
};
export type ModelRequest =
  | { kind: "generation"; seed: TournamentSeed }
  | {
      kind: "grounding" | "revision" | "selfCheck" | "scoring";
      candidate: TournamentCandidate;
      seed: TournamentSeed;
      /** Scoring attempts are independent; do not include prior scores. */
      judgeIndex?: number;
    }
  | {
      kind: "duplicate";
      statement: string;
      neighbor: Neighbor;
    }
  | {
      kind: "finalist";
      left: TournamentCandidate;
      right: TournamentCandidate;
    };
export type Neighbor = {
  id: string;
  statement: string;
  similarity: number;
};
export type ArchiveStage =
  | "duplicates"
  | "finalists"
  | "self_check"
  | "submitted"
  | "terminal";
export type TournamentDependencies = {
  now?: () => number;
  /** Atomic durable read/acquire BEFORE any work. Return the original completed
   * result on replay, or busy while another lease is active. An expired lease
   * may be reclaimed only with a new fencing token. Every write below MUST
   * atomically reject expired/stale tokens. Persistence owns lease expiry;
   * retain the acquired lease for at least leaseDurationMs from acquisition.
   * Core requests wallMs + cleanupMs, covering bounded terminal persistence.
   * Completed results remain replayable after lease expiry.
   * No process-local lock suffices. */
  beginRun(
    input: { runId: string; leaseDurationMs: number },
    context: CallContext,
  ): Promise<TournamentBegin>;
  /** Persist a terminal result and close the lease atomically. Submitted runs
   * are already completed by createDraft; never overwrite that saved result. */
  completeRun(
    input: { lease: TournamentLease; result: TournamentResult },
    context: CallContext,
  ): Promise<void>;
  countPendingDrafts(context: CallContext): Promise<number>;
  /** Return at most two eligible seeds. Core supplies hint and records explicit
   * unavailable listening/doctrine skips until their human/passage gates land. */
  loadSeeds(
    family: "correspondence" | "claim" | "inversion",
    context: CallContext,
  ): Promise<TournamentSeed[]>;
  searchClaimsSemantic(
    statement: string,
    context: CallContext,
  ): Promise<string[]>;
  hydrateClaims(ids: string[], context: CallContext): Promise<EvidenceClaim[]>;
  model(request: ModelRequest, context: CallContext): Promise<Metered<unknown>>;
  /** Use the claims embedding model. Report embedding provider token usage. */
  embed(statement: string, context: CallContext): Promise<Metered<number[]>>;
  /** Search hypotheses, pending drafts and archive, excluding this run.
   * Re-embed missing/stale hypothesis hashes and pending draft text before
   * ranking; account for that usage here. Return global nearest neighbors.
   * Core merges current siblings and keeps only the nearest three >= 0.86. */
  neighbors(
    input: { runId: string; statement: string; embedding: number[] },
    context: CallContext,
  ): Promise<Metered<Neighbor[]>>;
  /** Upsert by (agentRunId, batchIndex). Failure stops submission. */
  record(
    snapshot: {
      lease: TournamentLease;
      stage: ArchiveStage;
      candidates: TournamentCandidate[];
      pairs: TournamentPair[];
    },
    context: CallContext,
  ): Promise<void>;
  /** In ONE durable transaction, fence the lease, enforce cap=3, insert the
   * draft and save result with the new draftId on both result and its submitted
   * candidate. Close the lease. beginRun must replay this exact result even if
   * the response is lost. The submitted result is the authoritative archive;
   * materialize its candidates atomically, not via a later record call.
   * Return the saved canonical result, including IDs and original budget.
   * Return cap_reached only for that rejection. Never dedupe an old draft into
   * a new result. No human decisions. */
  createDraft(
    input: {
      lease: TournamentLease;
      draft: TournamentDraft;
      result: TournamentResult;
    },
    context: CallContext,
  ): Promise<
    { status: "created"; result: TournamentResult } | { status: "cap_reached" }
  >;
};
