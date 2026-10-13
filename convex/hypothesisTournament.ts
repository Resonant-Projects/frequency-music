// Durable persistence for the hypothesis tournament (wave 4). The agent core
// owns search and judgment; this module owns leases, the candidate archive,
// provenance verification and the single atomic draft submission. Every write
// is fenced by the lease token issued by beginRun.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  buildAgentReviewDraftInsert,
  countPendingDraftsByKind,
} from "./agentDrafts";
import {
  buildReviewedRunCompletionPatch,
  buildStalePatch,
  insertQueuedRun,
  safeReviewDraft,
} from "./agentRuns";
import { markDocketStale } from "./docket";
import { PENDING_DRAFT_CAP } from "./shared/agentContract";
import { EMBEDDING_DIMENSIONS } from "./shared/embeddingText";
import {
  archiveStageZ,
  DUPLICATE_REEMBED_LIMIT,
  HYPOTHESIS_TOURNAMENT_GRAPH,
  hypothesisCandidateRowZ,
  TOURNAMENT_ENABLED_ENV,
  TOURNAMENT_MAX_CANDIDATES,
  TOURNAMENT_MAX_EVIDENCE,
  TOURNAMENT_MAX_LEASE_MS,
  TOURNAMENT_SEED_HINT_MAX_CHARS,
  tournamentCandidateZ,
  tournamentDedupeKey,
  tournamentDraftZ,
  tournamentPairZ,
  tournamentResultZ,
  type EvidenceClaim,
  type TournamentCandidate,
  type TournamentResult,
  type TournamentSeed,
  statementHash,
} from "./shared/hypothesisTournament";
import { stableStringify } from "./shared/stableHash";

export const TOURNAMENT_MIN_LEASE_MS = 60_000;
export const CANDIDATE_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
// Duplicate checks read every hypothesis statement; above this they fail
// closed and ask for a larger bound rather than silently sampling.
export const DUPLICATE_CORPUS_HYPOTHESIS_LIMIT = 500;
const SEED_CONTEXT_MAX_CHARS = 6_000;
const CLAIM_SEED_SCAN_LIMIT = 200;
const STRONG_EVIDENCE_LEVELS = new Set([
  "peer_reviewed",
  "preprint",
  "reference",
]);

export function tournamentEnabled(): boolean {
  return process.env[TOURNAMENT_ENABLED_ENV] === "true";
}

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

function clip(text: string, max = SEED_CONTEXT_MAX_CHARS) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Leases
// ---------------------------------------------------------------------------

async function runRow(ctx: QueryCtx, agentRunId: Id<"agentRuns">) {
  return await ctx.db
    .query("tournamentRuns")
    .withIndex("by_agentRunId", (q) => q.eq("agentRunId", agentRunId))
    .unique();
}

/** Reject any write whose token is not the live lease. Expired, replaced and
 * completed leases all fail the same way, so a stale worker cannot write. */
async function fence(
  ctx: MutationCtx,
  agentRunId: Id<"agentRuns">,
  leaseToken: string,
) {
  const row = await runRow(ctx, agentRunId);
  if (
    !row ||
    row.status !== "leased" ||
    row.leaseToken !== leaseToken ||
    Date.now() >= row.leaseExpiresAt
  ) {
    fail("StaleTournamentLease", "Tournament lease is stale or closed");
  }
  return row;
}

export const beginRun = internalMutation({
  args: { agentRunId: v.id("agentRuns"), leaseDurationMs: v.number() },
  handler: async (ctx, args) => {
    const row = await runRow(ctx, args.agentRunId);
    // Completed results replay forever, including after the gate closes.
    if (row?.status === "completed") {
      return {
        status: "replay" as const,
        result: tournamentResultZ.parse(row.result),
      };
    }
    if (!tournamentEnabled()) {
      fail(
        "TournamentDisabled",
        `${TOURNAMENT_ENABLED_ENV} is not "true"; no tournament lease issued`,
      );
    }
    if (
      !Number.isSafeInteger(args.leaseDurationMs) ||
      args.leaseDurationMs < TOURNAMENT_MIN_LEASE_MS ||
      args.leaseDurationMs > TOURNAMENT_MAX_LEASE_MS
    ) {
      fail("InvalidLease", "leaseDurationMs is out of bounds");
    }
    const run = await ctx.db.get(args.agentRunId);
    if (
      !run ||
      run.graphName !== HYPOTHESIS_TOURNAMENT_GRAPH ||
      run.status !== "running"
    ) {
      fail("TournamentRunUnavailable", "Agent run is not a running tournament");
    }
    const now = Date.now();
    if (row && now < row.leaseExpiresAt) return { status: "busy" as const };
    const epoch = (row?.epoch ?? 0) + 1;
    const leaseToken = `${epoch}:${crypto.randomUUID()}`;
    const lease = {
      status: "leased" as const,
      epoch,
      leaseToken,
      leaseExpiresAt: now + args.leaseDurationMs,
      updatedAt: now,
    };
    if (row) await ctx.db.patch(row._id, lease);
    else
      await ctx.db.insert("tournamentRuns", {
        agentRunId: args.agentRunId,
        pairs: [],
        createdAt: now,
        ...lease,
      });
    return {
      status: "acquired" as const,
      lease: { runId: args.agentRunId, token: leaseToken },
    };
  },
});

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

const CITATION = /\[claim:([A-Za-z0-9_-]+)\]/g;

function sameSet(values: readonly string[], expected: Set<string>) {
  const unique = new Set(values);
  return (
    unique.size === values.length &&
    unique.size === expected.size &&
    [...unique].every((value) => expected.has(value))
  );
}

/** Every claim the worker cites must be an active claim read from this
 * database with the same text, source and extraction. */
async function verifyEvidence(ctx: QueryCtx, evidence: EvidenceClaim[]) {
  for (const entry of evidence) {
    const claimId = ctx.db.normalizeId("claims", entry.claimId);
    const claim = claimId ? await ctx.db.get(claimId) : null;
    if (
      !claim ||
      claim.status !== "active" ||
      claim.text !== entry.text ||
      claim.sourceId !== entry.sourceId ||
      claim.extractionId !== entry.extractionId
    ) {
      fail(
        "TournamentProvenanceRejected",
        "Evidence does not match a hydrated active claim",
      );
    }
  }
}

async function verifyCandidate(
  ctx: QueryCtx,
  agentRunId: string,
  candidate: TournamentCandidate,
) {
  if (candidate.agentRunId !== agentRunId)
    fail("TournamentProvenanceRejected", "Candidate belongs to another run");
  if (
    !sameSet(
      candidate.evidenceClaimIds,
      new Set(candidate.evidence.map((claim) => claim.claimId)),
    )
  )
    fail("TournamentProvenanceRejected", "Evidence ids disagree with claims");
  await verifyEvidence(ctx, candidate.evidence);
  const sources = new Set(candidate.evidence.map((claim) => claim.sourceId));
  const extractions = new Set(
    candidate.evidence.map((claim) => claim.extractionId),
  );
  for (const payload of [candidate.payload, candidate.finalPayload]) {
    if (!payload) continue;
    if (
      payload.thesisId !== undefined ||
      payload.sourceIds.some((id) => !sources.has(id)) ||
      payload.extractionIds.some((id) => !extractions.has(id))
    )
      fail("TournamentProvenanceRejected", "Payload cites unread provenance");
    if (payload.correspondenceId !== undefined) {
      const correspondenceId = ctx.db.normalizeId(
        "correspondences",
        payload.correspondenceId,
      );
      if (
        candidate.seedFamily !== "correspondence" ||
        !candidate.seedRefs.includes(payload.correspondenceId) ||
        !correspondenceId ||
        !(await ctx.db.get(correspondenceId))
      )
        fail(
          "TournamentProvenanceRejected",
          "Correspondence was not this candidate's seed",
        );
    }
  }
}

/** The submitted payload must be exactly grounded: at least two distinct
 * claims, the full source/extraction sets, and one [claim:<id>] citation per
 * claim. */
function verifyGrounded(candidate: TournamentCandidate) {
  const payload = candidate.finalPayload ?? candidate.payload;
  const claimIds = new Set(candidate.evidence.map((claim) => claim.claimId));
  const cited = [...payload.rationale.matchAll(CITATION)].map(
    (match) => match[1]!,
  );
  if (
    claimIds.size < 2 ||
    claimIds.size !== candidate.evidence.length ||
    !sameSet(
      payload.sourceIds,
      new Set(candidate.evidence.map((claim) => claim.sourceId)),
    ) ||
    !sameSet(
      payload.extractionIds,
      new Set(candidate.evidence.map((claim) => claim.extractionId)),
    ) ||
    !sameSet([...new Set(cited)], claimIds)
  )
    fail("TournamentProvenanceRejected", "Winner is not fully grounded");
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

function withoutVectors(result: TournamentResult): TournamentResult {
  return {
    ...result,
    candidates: result.candidates.map(
      ({ statementEmbedding: _vector, ...candidate }) => candidate,
    ),
  };
}

function parseCandidates(agentRunId: string, raw: unknown) {
  const candidates = tournamentCandidateZ
    .array()
    .max(TOURNAMENT_MAX_CANDIDATES)
    .parse(raw);
  const indexes = new Set(candidates.map((c) => c.batchIndex));
  if (indexes.size !== candidates.length)
    fail("InvalidTournamentArchive", "Duplicate batch index");
  for (const candidate of candidates) {
    if (candidate.agentRunId !== agentRunId)
      fail("TournamentProvenanceRejected", "Candidate belongs to another run");
    const vector = candidate.statementEmbedding;
    if (vector && vector.length !== EMBEDDING_DIMENSIONS)
      fail("InvalidTournamentArchive", "Statement vector has wrong dimensions");
  }
  return candidates;
}

/** Replace, never patch: a revised statement without a fresh vector must not
 * keep the vector of the original statement. */
async function materialize(
  ctx: MutationCtx,
  candidates: TournamentCandidate[],
  now: number,
) {
  for (const candidate of candidates) {
    const row = hypothesisCandidateRowZ.parse({ ...candidate, updatedAt: now });
    const existing = await ctx.db
      .query("hypothesisCandidates")
      .withIndex("by_agentRunId_batchIndex", (q) =>
        q
          .eq("agentRunId", candidate.agentRunId)
          .eq("batchIndex", candidate.batchIndex),
      )
      .unique();
    if (existing) await ctx.db.replace(existing._id, row as never);
    else await ctx.db.insert("hypothesisCandidates", row as never);
  }
}

export const recordCandidates = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    leaseToken: v.string(),
    stage: v.string(),
    candidates: v.any(),
    pairs: v.any(),
  },
  handler: async (ctx, args) => {
    const row = await fence(ctx, args.agentRunId, args.leaseToken);
    archiveStageZ.parse(args.stage);
    const candidates = parseCandidates(args.agentRunId, args.candidates);
    const pairs = tournamentPairZ.array().max(3).parse(args.pairs);
    for (const candidate of candidates)
      await verifyCandidate(ctx, args.agentRunId, candidate);
    const now = Date.now();
    await materialize(ctx, candidates, now);
    await ctx.db.patch(row._id, { pairs, updatedAt: now });
    return null;
  },
});

export const completeRun = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    leaseToken: v.string(),
    result: v.any(),
  },
  handler: async (ctx, args) => {
    const row = await fence(ctx, args.agentRunId, args.leaseToken);
    const result = tournamentResultZ.parse(args.result);
    if (result.reason === "submitted" || result.draftId || result.draft)
      fail("InvalidTournamentResult", "Submitted results complete via draft");
    const candidates = parseCandidates(args.agentRunId, result.candidates);
    if (candidates.some((candidate) => candidate.outcome === "submitted"))
      fail("InvalidTournamentResult", "Unsubmitted run has a submitted row");
    // Terminal archives feed later duplicate checks, so they get the same
    // provenance checks as every other archive write.
    for (const candidate of candidates)
      await verifyCandidate(ctx, args.agentRunId, candidate);
    const now = Date.now();
    await materialize(ctx, candidates, now);
    await ctx.db.patch(row._id, {
      status: "completed",
      result: withoutVectors(result),
      pairs: result.pairs,
      updatedAt: now,
    });
    return null;
  },
});

async function correspondenceAvailable(
  ctx: QueryCtx,
  correspondenceId: Id<"correspondences">,
) {
  const pending = await ctx.db
    .query("agentReviewDrafts")
    .withIndex("by_status_kind_updatedAt", (q) =>
      q.eq("status", "pending_review").eq("kind", "hypothesis_draft"),
    )
    .collect();
  if (
    pending.some(
      (draft) =>
        draft.payload &&
        "statement" in draft.payload &&
        draft.payload.correspondenceId === correspondenceId,
    )
  )
    return false;
  return !(await ctx.db
    .query("hypotheses")
    .withIndex("by_correspondenceId", (q) =>
      q.eq("correspondenceId", correspondenceId),
    )
    .first());
}

/** One transaction: fence, cap, provenance, draft insert, needs_review, and
 * the canonical submitted result. A lost response replays via beginRun. */
export const submitDraft = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    leaseToken: v.string(),
    draft: v.any(),
    result: v.any(),
  },
  handler: async (ctx, args) => {
    const row = await fence(ctx, args.agentRunId, args.leaseToken);
    const run = await ctx.db.get(args.agentRunId);
    if (!run || run.graphName !== HYPOTHESIS_TOURNAMENT_GRAPH)
      fail("TournamentRunUnavailable", "Agent run is not a tournament");
    const draft = tournamentDraftZ.parse(args.draft);
    const result = tournamentResultZ.parse(args.result);
    const dedupeKey = tournamentDedupeKey(args.agentRunId);
    if (draft.agentRunId !== args.agentRunId || draft.dedupeKey !== dedupeKey)
      fail("InvalidTournamentDraft", "Draft is not keyed to this run");
    if (result.reason !== "submitted" || result.draftId || row.draftId)
      fail("InvalidTournamentResult", "Result is not an unsaved submission");
    const candidates = parseCandidates(args.agentRunId, result.candidates);
    const winners = candidates.filter((c) => c.outcome === "submitted");
    if (winners.length !== 1)
      fail("InvalidTournamentResult", "Exactly one candidate must submit");
    const winner = winners[0]!;
    const payload = winner.finalPayload ?? winner.payload;
    if (stableStringify(payload) !== stableStringify(draft.draft.payload))
      fail("InvalidTournamentDraft", "Draft payload is not the winner's");
    const allowedRefs = new Set([
      ...winner.seedRefs,
      ...winner.evidenceClaimIds,
    ]);
    if (draft.draft.candidateIds.some((id) => !allowedRefs.has(id)))
      fail("TournamentProvenanceRejected", "Draft cites unread candidate ids");
    for (const candidate of candidates)
      await verifyCandidate(ctx, args.agentRunId, candidate);
    verifyGrounded(winner);
    if (
      payload.correspondenceId &&
      !(await correspondenceAvailable(ctx, payload.correspondenceId))
    )
      fail(
        "DraftTargetUnavailable",
        "Correspondence already has a hypothesis or pending hypothesis draft",
      );
    if (
      await ctx.db
        .query("agentReviewDrafts")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
        .first()
    )
      fail("TournamentDraftExists", "This run already submitted a draft");
    if (
      (await countPendingDraftsByKind(ctx, "hypothesis_draft")) >=
      PENDING_DRAFT_CAP
    )
      return { status: "cap_reached" as const };

    const now = Date.now();
    const insert = buildAgentReviewDraftInsert({
      agentRunId: args.agentRunId,
      graphName: run.graphName,
      draft: draft.draft,
      now,
    });
    if (!insert) fail("InvalidTournamentDraft", "Invalid human-review draft");
    const draftId = await ctx.db.insert("agentReviewDrafts", {
      ...insert,
      revision: 0,
      dedupeKey,
    });
    await markDocketStale(ctx);
    const saved: TournamentResult = {
      ...result,
      draftId,
      candidates: candidates.map((candidate) =>
        candidate === winner ? { ...candidate, draftId } : candidate,
      ),
    };
    await materialize(ctx, saved.candidates, now);
    const stored = withoutVectors(saved);
    await ctx.db.patch(row._id, {
      status: "completed",
      result: stored,
      pairs: saved.pairs,
      draftId,
      updatedAt: now,
    });
    const reviewDraft = safeReviewDraft(draft.draft);
    const summary = `Hypothesis tournament draft ${draftId} awaits human review`;
    await ctx.db.patch(args.agentRunId, {
      status: "needs_review",
      summary,
      ...(reviewDraft ? { reviewDraft } : {}),
      updatedAt: now,
    });
    for (const [kind, message] of [
      ["draft_write", "Persisted tournament human-review draft"],
      ["review_request", "Agent run needs review"],
    ] as const)
      await ctx.db.insert("agentRunEvents", {
        runId: args.agentRunId,
        kind,
        message,
        payload: { draftId, dedupeKey, title: draft.draft.title },
        createdAt: now,
      });
    return { status: "created" as const, result: stored };
  },
});

/** The graph's only terminal write. The durable row, not the worker's view,
 * decides: a saved draft keeps needs_review, a saved result completes, and a
 * run fails only when this attempt holds the lease or no attempt does. A
 * lost submission response therefore cannot fail a run with a pending draft,
 * and an expired worker cannot overwrite a newer attempt. */
export const finalizeRun = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    leaseToken: v.optional(v.string()),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.agentRunId);
    if (!run || run.graphName !== HYPOTHESIS_TOURNAMENT_GRAPH)
      fail("TournamentRunUnavailable", "Agent run is not a tournament");
    if (run.status !== "running")
      return { status: "untouched" as const, runStatus: run.status };
    const row = await runRow(ctx, args.agentRunId);
    const now = Date.now();
    if (row?.status === "completed") {
      if (row.draftId)
        return { status: "untouched" as const, runStatus: run.status };
      const result = tournamentResultZ.parse(row.result);
      const summary = `hypothesis-tournament completed: ${result.reason}, no draft`;
      await ctx.db.patch(args.agentRunId, {
        ...buildReviewedRunCompletionPatch(now),
        summary,
      });
      await ctx.db.insert("agentRunEvents", {
        runId: args.agentRunId,
        kind: "status",
        message: "Agent run completed",
        payload: { summary, reason: result.reason },
        createdAt: now,
      });
      return { status: "completed" as const, runStatus: "completed" };
    }
    const ours = row !== null && row.leaseToken === args.leaseToken;
    if (row && !ours && now < row.leaseExpiresAt)
      return { status: "untouched" as const, runStatus: run.status };
    // Release this attempt's lease so no write of it can land afterwards.
    if (row && ours) await ctx.db.patch(row._id, { leaseExpiresAt: now });
    const summary = args.summary.slice(0, 2_000);
    await ctx.db.patch(args.agentRunId, { ...buildStalePatch(now), summary });
    await ctx.db.insert("agentRunEvents", {
      runId: args.agentRunId,
      kind: "error",
      message: summary,
      payload: { reason: "tournament_not_completed" },
      createdAt: now,
    });
    return { status: "failed" as const, runStatus: "failed" };
  },
});

// ---------------------------------------------------------------------------
// Seeds and evidence
// ---------------------------------------------------------------------------

type DraftableCorrespondence = {
  correspondenceId: Id<"correspondences">;
  statement: string;
  rationaleMd: string;
  conceptA: { name: string };
  conceptB: { name: string };
  evidenceClaims: Array<{ text: string }>;
};

export function correspondenceSeed(
  target: DraftableCorrespondence,
): TournamentSeed {
  return {
    family: "correspondence",
    refs: [target.correspondenceId],
    correspondenceId: target.correspondenceId,
    context: clip(
      [
        `Correspondence: ${target.conceptA.name} × ${target.conceptB.name}`,
        `Statement: ${target.statement}`,
        `Rationale: ${target.rationaleMd}`,
        ...target.evidenceClaims.slice(0, 6).map((c) => `Evidence: ${c.text}`),
      ].join("\n"),
    ),
  };
}

type FailureEntry = {
  key: string;
  reason: string;
  title: string;
  summary: string;
  explanation: string;
};

/** Contradicted or retired hypotheses only: their inversion is a hypothesis. */
export function inversionSeeds(entries: FailureEntry[]): TournamentSeed[] {
  return entries
    .filter(
      (entry) =>
        entry.reason === "contradicted_hypothesis" ||
        entry.reason === "retired_hypothesis",
    )
    .slice(0, 2)
    .map((entry) => ({
      family: "inversion" as const,
      refs: [entry.key],
      context: clip(
        [
          `Failed path (${entry.reason}): ${entry.title}`,
          entry.summary,
          entry.explanation,
          "Consider the inverted or narrowed prediction this failure suggests.",
        ].join("\n"),
      ),
    }));
}

/** Strong active claims whose source concepts no hypothesis names yet. */
export const listUnhypothesizedClaimSeeds = internalQuery({
  args: {},
  handler: async (ctx): Promise<TournamentSeed[]> => {
    const hypotheses = await ctx.db
      .query("hypotheses")
      .take(DUPLICATE_CORPUS_HYPOTHESIS_LIMIT);
    const covered = new Set(
      hypotheses.flatMap((h) => (h.concepts ?? []).map((c) => c.toLowerCase())),
    );
    const claims = await ctx.db
      .query("claims")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .take(CLAIM_SEED_SCAN_LIMIT);
    const seeds: TournamentSeed[] = [];
    const usedSources = new Set<string>();
    for (const claim of claims) {
      if (seeds.length >= 2) break;
      if (
        !STRONG_EVIDENCE_LEVELS.has(claim.evidenceLevel) ||
        claim.truthConfidence === "low" ||
        usedSources.has(claim.sourceId)
      )
        continue;
      const edges = await ctx.db
        .query("edges")
        .withIndex("by_from", (q) =>
          q.eq("fromType", "source").eq("fromId", claim.sourceId),
        )
        .filter((q) => q.eq(q.field("toType"), "concept"))
        .take(10);
      const concepts = (
        await Promise.all(
          // Source edges name concepts by canonical name, not by id.
          edges.map((edge) =>
            ctx.db
              .query("concepts")
              .withIndex("by_name", (q) => q.eq("name", edge.toId))
              .first(),
          ),
        )
      ).filter(
        (concept): concept is Doc<"concepts"> =>
          concept?.missionRelevance === "on",
      );
      if (
        !concepts.length ||
        concepts.some((concept) => covered.has(concept.name.toLowerCase()))
      )
        continue;
      usedSources.add(claim.sourceId);
      seeds.push({
        family: "claim",
        refs: [claim._id],
        context: clip(
          [
            `Claim (${claim.evidenceLevel}): ${claim.text}`,
            `Concepts no hypothesis references: ${concepts.map((c) => c.name).join(", ")}`,
          ].join("\n"),
        ),
      });
    }
    return seeds;
  },
});

export const hydrateClaims = internalQuery({
  args: { claimIds: v.array(v.string()) },
  handler: async (ctx, args): Promise<EvidenceClaim[]> => {
    const claims: EvidenceClaim[] = [];
    for (const raw of [...new Set(args.claimIds)].slice(
      0,
      TOURNAMENT_MAX_EVIDENCE,
    )) {
      const claimId = ctx.db.normalizeId("claims", raw);
      const claim = claimId ? await ctx.db.get(claimId) : null;
      if (!claim || claim.status !== "active") continue;
      claims.push({
        claimId: claim._id,
        text: claim.text,
        sourceId: claim.sourceId,
        extractionId: claim.extractionId,
      });
    }
    return claims;
  },
});

// ---------------------------------------------------------------------------
// Duplicate corpus (read by the node action that owns embeddings)
// ---------------------------------------------------------------------------

/** Hypotheses whose stored vector is missing or describes older text, plus
 * pending hypothesis drafts, which are always embedded at query time. */
export const duplicateCorpus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const hypotheses = await ctx.db
      .query("hypotheses")
      .take(DUPLICATE_CORPUS_HYPOTHESIS_LIMIT + 1);
    if (hypotheses.length > DUPLICATE_CORPUS_HYPOTHESIS_LIMIT)
      fail(
        "DuplicateCorpusTooLarge",
        `More than ${DUPLICATE_CORPUS_HYPOTHESIS_LIMIT} hypotheses; raise the bound`,
      );
    const stale: Array<{ id: string; statement: string }> = [];
    for (const hypothesis of hypotheses) {
      const stored = await ctx.db
        .query("hypothesisEmbeddings")
        .withIndex("by_hypothesisId", (q) =>
          q.eq("hypothesisId", hypothesis._id),
        )
        .first();
      if (
        stored?.statementHash !== (await statementHash(hypothesis.hypothesis))
      )
        stale.push({ id: hypothesis._id, statement: hypothesis.hypothesis });
    }
    if (stale.length > DUPLICATE_REEMBED_LIMIT)
      fail(
        "HypothesisEmbeddingBackfillRequired",
        `${stale.length} hypotheses lack current vectors; run backfillHypothesisEmbeddings`,
      );
    const pending = await ctx.db
      .query("agentReviewDrafts")
      .withIndex("by_status_kind_updatedAt", (q) =>
        q.eq("status", "pending_review").eq("kind", "hypothesis_draft"),
      )
      .collect();
    const drafts = pending.flatMap((draft) => {
      const payload = draft.amendedPayload ?? draft.payload;
      return payload && "statement" in payload
        ? [{ id: draft._id as string, statement: payload.statement }]
        : [];
    });
    return { stale, drafts };
  },
});

/** Hydrate vector hits. Stale hypothesis vectors are dropped here because
 * duplicateCorpus already re-embeds them; this run's own rows are excluded. */
export const hydrateNeighborHits = internalQuery({
  args: {
    agentRunId: v.string(),
    hypothesisHits: v.array(
      v.object({ id: v.id("hypothesisEmbeddings"), score: v.float64() }),
    ),
    candidateHits: v.array(
      v.object({ id: v.id("hypothesisCandidates"), score: v.float64() }),
    ),
  },
  handler: async (ctx, args) => {
    const neighbors: Array<{
      id: string;
      statement: string;
      similarity: number;
    }> = [];
    for (const hit of args.hypothesisHits) {
      const stored = await ctx.db.get(hit.id);
      const hypothesis = stored ? await ctx.db.get(stored.hypothesisId) : null;
      if (
        !stored ||
        !hypothesis ||
        stored.statementHash !== (await statementHash(hypothesis.hypothesis))
      )
        continue;
      neighbors.push({
        id: `hypothesis:${hypothesis._id}`,
        statement: hypothesis.hypothesis,
        similarity: hit.score,
      });
    }
    for (const hit of args.candidateHits) {
      const row = await ctx.db.get(hit.id);
      if (!row || row.agentRunId === args.agentRunId || !row.statementEmbedding)
        continue;
      neighbors.push({
        id: `candidate:${row.agentRunId}:${row.batchIndex}`,
        statement: (row.finalPayload ?? row.payload).statement,
        similarity: hit.score,
      });
    }
    return neighbors;
  },
});

export const storeHypothesisEmbeddings = internalMutation({
  args: {
    rows: v.array(
      v.object({
        hypothesisId: v.string(),
        statementHash: v.string(),
        embedding: v.array(v.float64()),
        model: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let stored = 0;
    for (const row of args.rows) {
      const hypothesisId = ctx.db.normalizeId("hypotheses", row.hypothesisId);
      const hypothesis = hypothesisId ? await ctx.db.get(hypothesisId) : null;
      // Text moved since embedding: leave it stale for the next pass.
      if (
        !hypothesis ||
        row.embedding.length !== EMBEDDING_DIMENSIONS ||
        (await statementHash(hypothesis.hypothesis)) !== row.statementHash
      )
        continue;
      const existing = await ctx.db
        .query("hypothesisEmbeddings")
        .withIndex("by_hypothesisId", (q) =>
          q.eq("hypothesisId", hypothesis._id),
        )
        .first();
      const value = {
        hypothesisId: hypothesis._id,
        statementHash: row.statementHash,
        embedding: row.embedding,
        model: row.model,
        updatedAt: Date.now(),
      };
      if (existing) await ctx.db.replace(existing._id, value);
      else await ctx.db.insert("hypothesisEmbeddings", value);
      stored += 1;
    }
    return { stored };
  },
});

export const hypothesesNeedingEmbeddings = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), batchSize: v.number() },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("hypotheses").paginate({
      cursor: args.cursor,
      numItems: Math.max(1, Math.min(Math.floor(args.batchSize), 100)),
    });
    const rows: Array<{ id: string; statement: string; hash: string }> = [];
    for (const hypothesis of page.page) {
      const hash = await statementHash(hypothesis.hypothesis);
      const stored = await ctx.db
        .query("hypothesisEmbeddings")
        .withIndex("by_hypothesisId", (q) =>
          q.eq("hypothesisId", hypothesis._id),
        )
        .first();
      if (stored?.statementHash !== hash)
        rows.push({
          id: hypothesis._id,
          statement: hypothesis.hypothesis,
          hash,
        });
    }
    return {
      rows,
      scanned: page.page.length,
      cursor: page.isDone ? null : page.continueCursor,
      done: page.isDone,
    };
  },
});

// ---------------------------------------------------------------------------
// Requests and retention
// ---------------------------------------------------------------------------

/** Gated enqueue for freq (MCP) and operators. Never runs work itself; at most
 * one queued or running tournament exists at a time. */
export const request = internalMutation({
  args: {
    seedHint: v.optional(v.string()),
    requestedBy: v.union(v.literal("freq"), v.literal("operator")),
  },
  handler: async (ctx, args) => {
    if (!tournamentEnabled())
      fail("TournamentDisabled", `${TOURNAMENT_ENABLED_ENV} is not "true"`);
    const seedHint = args.seedHint?.trim();
    if (seedHint && seedHint.length > TOURNAMENT_SEED_HINT_MAX_CHARS)
      fail("InvalidSeedHint", "Seed hint is too long");
    for (const status of ["queued", "running"] as const) {
      const active = await ctx.db
        .query("agentRuns")
        .withIndex("by_status_graphName_updatedAt", (q) =>
          q.eq("status", status).eq("graphName", HYPOTHESIS_TOURNAMENT_GRAPH),
        )
        .first();
      if (active)
        return { runId: active._id, status: active.status, created: false };
    }
    const queued = await insertQueuedRun(ctx, {
      graphName: HYPOTHESIS_TOURNAMENT_GRAPH,
      input: {
        requestedBy: args.requestedBy,
        ...(seedHint ? { seedHint } : {}),
      },
    });
    return { runId: queued.runId, status: queued.status, created: true };
  },
});

/** Delete unsubmitted archive rows older than the retention window. Bounded
 * and resumable; not scheduled by this module. */
export const pruneCandidates = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - CANDIDATE_RETENTION_MS;
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 100), 500));
    let deleted = 0;
    for (const outcome of tournamentCandidateZ.shape.outcome.options) {
      if (outcome === "submitted") continue;
      const rows = await ctx.db
        .query("hypothesisCandidates")
        .withIndex("by_outcome_createdAt", (q) =>
          q.eq("outcome", outcome).lt("createdAt", cutoff),
        )
        .take(limit - deleted);
      for (const row of rows) await ctx.db.delete(row._id);
      deleted += rows.length;
      if (deleted >= limit) break;
    }
    return { deleted, done: deleted < limit };
  },
});
