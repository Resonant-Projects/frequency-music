import { z } from "zod";
import { PENDING_DRAFT_CAP } from "../../../../convex/shared/agentContract.js";
import { hypothesisDraftPayloadZ } from "../../../../convex/shared/draftPayloads.js";
import {
  TOURNAMENT_FAMILIES,
  TOURNAMENT_FEEDBACK_MAX_CHARS,
  TOURNAMENT_SUMMARY_MAX_CHARS,
} from "../../../../convex/shared/hypothesisTournament.js";
import {
  BudgetExhausted,
  TournamentBudget,
  TOURNAMENT_LIMITS,
} from "./budget.js";
import { generationSchema, groundedPayload, readEvidence } from "./evidence.js";
import type {
  ArchiveStage,
  ModelRequest,
  Neighbor,
  SeedFamily,
  TournamentCandidate,
  TournamentDependencies,
  TournamentDraft,
  TournamentEvent,
  TournamentPair,
  TournamentLease,
  TournamentResult,
  TournamentScore,
  TournamentSeed,
} from "./types.js";
export type * from "./types.js";
export { TOURNAMENT_LIMITS } from "./budget.js";
export { tournamentPrompt } from "./prompts.js";

const scoreSchema = z
  .object({
    stake: z.number().min(0).max(5),
    novelty: z.number().min(0).max(5),
    falsifiability: z.number().min(0).max(5),
  })
  .strict();
const checkSchema = z
  .object({
    pass: z.boolean(),
    testable: z.boolean(),
    oneVariable: z.boolean(),
    evidenceGrounded: z.boolean(),
    // Advisory text: keep the verdict, trim what the archive cannot hold.
    feedback: z
      .string()
      .transform((text) => text.slice(0, TOURNAMENT_FEEDBACK_MAX_CHARS)),
  })
  .strict();
const duplicateSchema = z
  .object({ kind: z.enum(["duplicate", "inversion", "refinement"]) })
  .strict();
const pairSchema = z
  .object({ winner: z.enum(["left", "right", "tie"]) })
  .strict();

export function rotateSeeds(
  families: Partial<Record<SeedFamily, TournamentSeed[]>>,
) {
  const seeds: TournamentSeed[] = [];
  for (let round = 0; round < 2; round++) {
    for (const family of TOURNAMENT_FAMILIES) {
      const seed = families[family]?.[round];
      if (seed && seeds.length < 8) seeds.push(seed);
    }
  }
  return seeds;
}

function mean(scores: TournamentScore[], key?: keyof TournamentScore) {
  return (
    scores.reduce(
      (sum, score) =>
        sum +
        (key
          ? score[key]
          : (score.stake + score.novelty + score.falsifiability) / 3),
      0,
    ) / scores.length
  );
}
export function rankCandidates(candidates: TournamentCandidate[]) {
  return candidates
    .filter((c) => c.outcome === "candidate" && c.scores.length >= 2)
    .sort(
      (a, b) =>
        mean(b.scores) - mean(a.scores) ||
        mean(b.scores, "falsifiability") - mean(a.scores, "falsifiability") ||
        a.batchIndex - b.batchIndex,
    );
}
function cosine(a: number[], b: number[]) {
  if (a.length !== b.length) return -1;
  return (
    a.reduce((sum, x, i) => sum + x * b[i]!, 0) /
    Math.sqrt(
      a.reduce((s, x) => s + x * x, 0) * b.reduce((s, x) => s + x * x, 0),
    )
  );
}
function validEmbedding(value: number[] | undefined): value is number[] {
  return Boolean(
    value?.length && value.every(Number.isFinite) && value.some((v) => v !== 0),
  );
}

/** Offline core: no default tools/models, scheduler, registry or production IO.
 * Adapter errors with unknown token usage stop the run. Expected model failures
 * use Metered {ok:false}, so missing judgments still consume their allowance. */
export async function runTournament(
  input: { runId: string; seedHint?: string },
  dependencies: TournamentDependencies,
): Promise<TournamentResult> {
  if (!input.runId.trim()) throw new Error("Tournament requires runId");
  const now = dependencies.now ?? Date.now;
  const budget = new TournamentBudget(now);
  const empty = (reason: TournamentResult["reason"]): TournamentResult => ({
    reason,
    candidates: [],
    pairs: [],
    events: [],
    budget: {
      calls: { ...budget.calls },
      duplicateCalls: { ...budget.duplicateCalls },
      totalTokens: budget.tokens,
      elapsedMs: now() - budget.startedAt,
    },
  });
  let completedResult: TournamentResult | undefined;
  try {
    const begin = await budget.call((context) =>
      dependencies.beginRun(
        {
          runId: input.runId,
          leaseDurationMs:
            TOURNAMENT_LIMITS.wallMs + TOURNAMENT_LIMITS.cleanupMs,
        },
        context,
      ),
    );
    if (begin.status === "replay") return structuredClone(begin.result);
    if (begin.status === "busy") return empty("busy");
    const result = await runLeasedTournament(
      input,
      dependencies,
      budget,
      begin.lease,
      now,
    );
    completedResult = result;
    if (result.reason !== "submitted" && !result.draftId) {
      await budget.call(
        (context) =>
          dependencies.completeRun(
            { lease: begin.lease, result: structuredClone(result) },
            context,
          ),
        true,
      );
    }
    return result;
  } catch (error) {
    const reason =
      error instanceof BudgetExhausted
        ? "budget_exhausted"
        : "dependency_error";
    const result = completedResult ?? empty(reason);
    result.reason = reason;
    result.events.push({ kind: "stopped", reason: "run_persistence_failed" });
    return result;
  }
}

async function runLeasedTournament(
  input: { runId: string; seedHint?: string },
  dependencies: TournamentDependencies,
  budget: TournamentBudget,
  lease: TournamentLease,
  now: () => number,
): Promise<TournamentResult> {
  const candidates: TournamentCandidate[] = [];
  const events: TournamentEvent[] = [];
  const pairs: TournamentPair[] = [];
  let phase: "before_finalists" | "pairwise" | "winner" = "before_finalists";
  let winner: TournamentCandidate | undefined;
  let draft: TournamentDraft | undefined;
  const record = (stage: ArchiveStage) =>
    budget.call(
      (context) =>
        dependencies.record(
          structuredClone({ lease, stage, candidates, pairs }),
          context,
        ),
      stage === "terminal",
    );
  const finish = (reason: TournamentResult["reason"]): TournamentResult => ({
    reason,
    candidates,
    pairs,
    events,
    draft,
    budget: {
      calls: { ...budget.calls },
      duplicateCalls: { ...budget.duplicateCalls },
      totalTokens: budget.tokens,
      elapsedMs: now() - budget.startedAt,
    },
  });
  const model = async (request: ModelRequest, batchIndex?: number) => {
    budget.count(request.kind, batchIndex);
    const value = await budget.metered((context) =>
      dependencies.model(structuredClone(request), context),
    );
    if (value === undefined)
      events.push({ kind: "attempt_failed", reason: request.kind, batchIndex });
    return value;
  };
  const embedding = async (
    candidate: TournamentCandidate,
    statement: string,
  ) => {
    const value = await budget.metered((context) =>
      dependencies.embed(statement, context),
    );
    if (!validEmbedding(value)) {
      candidate.flags.push("embedding_failed_open");
      candidate.statementEmbedding = undefined;
    } else candidate.statementEmbedding = value;
  };
  const duplicateCheck = async (
    candidate: TournamentCandidate,
    revised = false,
  ) => {
    const payload = candidate.finalPayload ?? candidate.payload;
    if (!candidate.statementEmbedding) return;
    const neighbors = await budget.metered((context) =>
      dependencies.neighbors(
        {
          runId: input.runId,
          statement: payload.statement,
          embedding: candidate.statementEmbedding!,
        },
        context,
      ),
    );
    if (!neighbors) throw new Error("Duplicate retrieval failed");
    const siblings: Neighbor[] = candidates
      .filter(
        (other) =>
          other !== candidate &&
          (revised || other.batchIndex < candidate.batchIndex) &&
          other.statementEmbedding,
      )
      .map((other) => ({
        id: `tournament:${input.runId}:${other.batchIndex}`,
        statement: (other.finalPayload ?? other.payload).statement,
        similarity: cosine(
          candidate.statementEmbedding!,
          other.statementEmbedding!,
        ),
      }));
    const nearest = [...neighbors, ...siblings]
      .filter((n) => Number.isFinite(n.similarity) && n.similarity >= 0.86)
      .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));
    const seen = new Set<string>();
    const unique = nearest
      .filter((n) => !seen.has(n.id) && Boolean(seen.add(n.id)))
      .slice(0, 3);
    for (const neighbor of unique) {
      const parsed = duplicateSchema.safeParse(
        await model(
          { kind: "duplicate", statement: payload.statement, neighbor },
          candidate.batchIndex,
        ),
      );
      if (!parsed.success) {
        candidate.flags.push("duplicate_judgment_missing");
        // Only embedding errors fail open in the specification.
        candidate.outcome = "ineligible";
        return;
      }
      candidate.relations.push({ id: neighbor.id, kind: parsed.data.kind });
      if (parsed.data.kind === "duplicate") {
        candidate.duplicateOf = neighbor.id;
        candidate.duplicateKind = "duplicate";
        candidate.outcome = "dropped_duplicate";
        return;
      }
    }
  };
  try {
    const pending = await budget.call((context) =>
      dependencies.countPendingDrafts(context),
    );
    if (!Number.isSafeInteger(pending) || pending < 0)
      throw new Error("Invalid pending draft count");
    if (pending >= PENDING_DRAFT_CAP) return finish("capacity");
    const families: Partial<Record<SeedFamily, TournamentSeed[]>> = {};
    for (const family of ["correspondence", "claim", "inversion"] as const) {
      try {
        const loaded = await budget.call((context) =>
          dependencies.loadSeeds(family, context),
        );
        families[family] = loaded
          .filter(
            (seed) =>
              seed.family === family &&
              seed.refs.length > 0 &&
              seed.refs.every(
                (id) => typeof id === "string" && id.length > 0,
              ) &&
              seed.context.trim() &&
              (family === "correspondence"
                ? Boolean(
                    seed.correspondenceId &&
                      seed.refs.includes(seed.correspondenceId),
                  )
                : seed.correspondenceId === undefined),
          )
          .slice(0, 2);
        if (!families[family]?.length)
          events.push({ kind: "family_skipped", family, reason: "empty" });
      } catch (error) {
        if (error instanceof BudgetExhausted) throw error;
        events.push({ kind: "family_skipped", family, reason: "tool_failure" });
      }
    }
    events.push(
      {
        kind: "family_skipped",
        family: "listening",
        reason: "no_eligible_validated_human_sessions",
      },
      {
        kind: "family_skipped",
        family: "doctrine",
        reason: "passages_unavailable",
      },
    );
    if (input.seedHint?.trim())
      families.hint = [
        { family: "hint", refs: [], context: input.seedHint.trim() },
      ];
    else
      events.push({ kind: "family_skipped", family: "hint", reason: "empty" });
    const seeds = rotateSeeds(families);
    if (seeds.length < 3) return finish("insufficient_seeds");
    for (const [batchIndex, seed] of seeds.entries()) {
      const parsed = generationSchema.safeParse(
        await model({ kind: "generation", seed }),
      );
      if (!parsed.success) {
        events.push({
          kind: "attempt_failed",
          reason: "invalid_generation",
          batchIndex,
        });
        continue;
      }
      const candidate: TournamentCandidate = {
        agentRunId: input.runId,
        batchIndex,
        seedFamily: seed.family,
        seedRefs: [...seed.refs],
        payload: hypothesisDraftPayloadZ.parse({
          ...parsed.data,
          sourceIds: [],
          extractionIds: [],
          correspondenceId: seed.correspondenceId,
        }),
        evidenceClaimIds: [],
        evidence: [],
        relations: [],
        scores: [],
        outcome: "candidate",
        flags: [],
        createdAt: now(),
      };
      candidates.push(candidate);
      const found = await budget.metered((context) =>
        dependencies.searchClaimsSemantic(candidate.payload.statement, context),
      );
      if (found === undefined) {
        events.push({
          kind: "attempt_failed",
          reason: "evidence_search",
          batchIndex,
        });
        candidate.outcome = "dropped_evidence";
        continue;
      }
      const ids = [...new Set(found)].slice(0, 20);
      candidate.evidence = readEvidence(
        ids,
        await budget.call((context) =>
          dependencies.hydrateClaims(ids, context),
        ),
      );
      candidate.evidenceClaimIds = candidate.evidence.map(
        (claim) => claim.claimId,
      );
      if (candidate.evidence.length < 2) {
        candidate.outcome = "dropped_evidence";
        continue;
      }
      candidate.payload = hypothesisDraftPayloadZ.parse({
        ...candidate.payload,
        sourceIds: [
          ...new Set(candidate.evidence.map((claim) => claim.sourceId)),
        ],
        extractionIds: [
          ...new Set(candidate.evidence.map((claim) => claim.extractionId)),
        ],
      });
      const grounded = groundedPayload(
        await model({ kind: "grounding", candidate, seed }),
        candidate,
        seed,
      );
      if (!grounded || grounded.statement !== candidate.payload.statement) {
        candidate.outcome = "dropped_evidence";
        continue;
      }
      candidate.payload = grounded;
    }
    for (const candidate of candidates.filter((c) => c.outcome === "candidate"))
      await embedding(candidate, candidate.payload.statement);
    for (const candidate of candidates.filter((c) => c.outcome === "candidate"))
      await duplicateCheck(candidate);
    await record("duplicates");
    for (const candidate of candidates.filter(
      (c) => c.outcome === "candidate",
    )) {
      for (let judgeIndex = 0; judgeIndex < 3; judgeIndex++) {
        const parsed = scoreSchema.safeParse(
          await model({
            kind: "scoring",
            candidate: { ...candidate, scores: [] },
            seed: seeds[candidate.batchIndex]!,
            judgeIndex,
          }),
        );
        if (parsed.success) candidate.scores.push(parsed.data);
      }
      if (candidate.scores.length < 2) candidate.outcome = "ineligible";
    }
    const eligible = rankCandidates(candidates);
    if (!eligible.length) {
      await record("finalists");
      return finish("no_eligible_candidates");
    }
    const finalists = eligible.slice(0, 3);
    for (const candidate of eligible)
      candidate.outcome = finalists.includes(candidate) ? "finalist" : "lost";
    phase = "pairwise";
    const wins = new Map(
      finalists.map((candidate) => [candidate.batchIndex, 0]),
    );
    for (let i = 0; i < finalists.length; i++) {
      for (let j = i + 1; j < finalists.length; j++) {
        const left = finalists[i]!;
        const right = finalists[j]!;
        const parsed = pairSchema.safeParse(
          await model({ kind: "finalist", left, right }),
        );
        const selected =
          parsed.success && parsed.data.winner !== "tie"
            ? parsed.data.winner === "left"
              ? left
              : right
            : undefined;
        pairs.push({
          left: left.batchIndex,
          right: right.batchIndex,
          winner: selected?.batchIndex ?? null,
          status: parsed.success ? "judged" : "missing",
        });
        if (selected)
          wins.set(selected.batchIndex, wins.get(selected.batchIndex)! + 1);
      }
    }
    // Missing comparisons cannot establish a winner, unlike explicit ties.
    if (pairs.some((pair) => pair.status === "missing"))
      throw new Error("Finalist comparison missing");
    winner = [...finalists].sort(
      (a, b) =>
        wins.get(b.batchIndex)! - wins.get(a.batchIndex)! ||
        mean(b.scores, "falsifiability") - mean(a.scores, "falsifiability") ||
        mean(b.scores) - mean(a.scores) ||
        a.batchIndex - b.batchIndex,
    )[0]!;
    phase = "winner";
    for (const candidate of finalists)
      if (candidate !== winner) candidate.outcome = "lost";
    await record("finalists");
    const seed = seeds[winner.batchIndex]!;
    for (let check = 0; check < 2; check++) {
      const parsed = checkSchema.safeParse(
        await model({
          kind: "selfCheck",
          candidate: {
            ...winner,
            payload: winner.finalPayload ?? winner.payload,
          },
          seed,
        }),
      );
      winner.selfCheck = parsed.success
        ? parsed.data
        : {
            pass: false,
            testable: false,
            oneVariable: false,
            evidenceGrounded: false,
            feedback: "Self-check unavailable",
          };
      winner.selfCheck.pass =
        winner.selfCheck.pass &&
        winner.selfCheck.testable &&
        winner.selfCheck.oneVariable &&
        winner.selfCheck.evidenceGrounded;
      if (winner.selfCheck.pass) break;
      if (check === 1) {
        winner.outcome = "failed_self_check";
        await record("self_check");
        return finish("failed_self_check");
      }
      const revised = groundedPayload(
        await model({ kind: "revision", candidate: winner, seed }),
        winner,
        seed,
      );
      if (!revised) {
        winner.outcome = "failed_self_check";
        await record("self_check");
        return finish("failed_self_check");
      }
      // Clear the old vector in the same synchronous step as changing text.
      // Even budget.count or a throwing/timed-out embedding must archive no
      // vector rather than one that describes the original statement.
      if (revised.statement !== winner.payload.statement)
        winner.statementEmbedding = undefined;
      winner.finalPayload = revised;
      if (revised.statement !== winner.payload.statement) {
        budget.count("duplicateRecheck");
        await embedding(winner, revised.statement);
        await duplicateCheck(winner, true);
        if (
          winner.outcome === "dropped_duplicate" ||
          winner.outcome === "ineligible"
        ) {
          await record("self_check");
          return finish("duplicate_revision");
        }
      }
    }
    await record("self_check");
    budget.check();
    const payload = winner.finalPayload ?? winner.payload;
    const relations = winner.relations
      .filter((r) => r.kind !== "duplicate")
      .map((r) => `${r.kind}: ${r.id}`);
    draft = {
      agentRunId: input.runId,
      dedupeKey: `tournament:${input.runId}`,
      draft: {
        kind: "hypothesis_draft",
        title: payload.title,
        payload,
        needsReview: true,
        candidateIds: [
          ...new Set([...winner.seedRefs, ...winner.evidenceClaimIds]),
        ],
        summary: [
          payload.statement,
          `Finalist mean score: ${mean(winner.scores).toFixed(2)}; falsifiability: ${mean(winner.scores, "falsifiability").toFixed(2)}.`,
          `Other candidates: ${candidates
            .filter((c) => c !== winner)
            .map((c) => c.payload.title)
            .join("; ")}.`,
          ...relations,
          ...winner.flags,
        ]
          .join("\n")
          .slice(0, TOURNAMENT_SUMMARY_MAX_CHARS),
      },
    };
    winner.outcome = "submitted";
    const result = await budget.call((context) =>
      dependencies.createDraft(
        structuredClone({ lease, draft: draft!, result: finish("submitted") }),
        context,
      ),
    );
    if (result.status === "cap_reached") {
      for (const candidate of candidates)
        if (
          candidate.outcome === "lost" ||
          candidate.outcome === "finalist" ||
          candidate.outcome === "submitted"
        )
          candidate.outcome = "ineligible";
      draft = undefined;
      await record("terminal");
      return finish("capacity");
    }
    if (result.result.reason !== "submitted" || !result.result.draftId)
      throw new Error("Draft writer returned no submitted result");
    return structuredClone(result.result);
  } catch (error) {
    const reason =
      error instanceof BudgetExhausted
        ? "budget_exhausted"
        : "dependency_error";
    events.push({
      kind: "stopped",
      reason:
        error instanceof BudgetExhausted
          ? error.dimension
          : "dependency_failure",
    });
    if (phase === "before_finalists") {
      for (const candidate of candidates)
        if (candidate.outcome === "candidate")
          candidate.outcome =
            candidate.scores.length >= 2 ? "lost" : "ineligible";
    }
    // A lost submission response may already have committed. Fenced writes
    // cannot overwrite it, and beginRun will replay the original result.
    if (winner?.outcome === "submitted") winner.outcome = "finalist";
    draft = undefined;
    try {
      await record("terminal");
    } catch {
      events.push({ kind: "stopped", reason: "archive_failed" });
    }
    return finish(reason);
  }
}
