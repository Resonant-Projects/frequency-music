// Production persistence and retrieval for the tournament core, over the
// authenticated agent-tool surface. Every response is parsed with the shared
// contract, so a drifting backend fails the run instead of corrupting it.
// No model imports here: the model adapter lives in model.ts.
import {
  evidenceClaimZ,
  meteredClaimIdsZ,
  meteredEmbeddingZ,
  meteredNeighborsZ,
  tournamentBeginZ,
  tournamentSeedZ,
  tournamentSubmitResultZ,
} from "../../../../convex/shared/hypothesisTournament.js";
import type { ToolCaller } from "../shared/audit.js";
import { BudgetExhausted } from "./budget.js";
import type {
  Metered,
  TournamentDependencies,
  TournamentLease,
} from "./types.js";

/** The backend refused before calling the provider: the strict input bound
 * exceeded the remaining run allowance. That is budget exhaustion. */
function withinBudget<T>(
  response: Metered<T> & { budgetExceeded?: true },
): Metered<T> {
  if (!response.ok && response.budgetExceeded)
    throw new BudgetExhausted("tokens");
  const { budgetExceeded: _refused, ...metered } = response;
  return metered as Metered<T>;
}

export function createTournamentDependencies(options: {
  callTool: ToolCaller;
  model: TournamentDependencies["model"];
  now?: () => number;
  /** Receives the lease this attempt acquired, for terminal finalization. */
  onLease?: (lease: TournamentLease) => void;
}): TournamentDependencies {
  const { callTool } = options;
  return {
    ...(options.now ? { now: options.now } : {}),
    async beginRun({ runId, leaseDurationMs }, { signal }) {
      const begin = tournamentBeginZ.parse(
        await callTool(
          "beginTournamentRun",
          { agentRunId: runId, leaseDurationMs },
          signal,
        ),
      ) as Awaited<ReturnType<TournamentDependencies["beginRun"]>>;
      if (begin.status === "acquired") options.onLease?.(begin.lease);
      return begin;
    },
    async completeRun({ lease, result }, { signal }) {
      await callTool(
        "completeTournamentRun",
        { agentRunId: lease.runId, leaseToken: lease.token, result },
        signal,
      );
    },
    async countPendingDrafts({ signal }) {
      const count = await callTool(
        "countPendingDrafts",
        { kind: "hypothesis_draft" },
        signal,
      );
      if (typeof count !== "number") throw new Error("Invalid pending count");
      return count;
    },
    async loadSeeds(family, { signal }) {
      return tournamentSeedZ
        .array()
        .max(2)
        .parse(await callTool("listTournamentSeeds", { family }, signal));
    },
    async searchClaimsSemantic(statement, { signal, maxTotalTokens }) {
      return withinBudget(
        meteredClaimIdsZ.parse(
          await callTool(
            "searchTournamentEvidence",
            { text: statement, maxTotalTokens },
            signal,
          ),
        ),
      );
    },
    async hydrateClaims(ids, { signal }) {
      return evidenceClaimZ
        .array()
        .parse(await callTool("hydrateClaims", { claimIds: ids }, signal));
    },
    model: options.model,
    async embed(statement, { signal, maxTotalTokens }) {
      return withinBudget(
        meteredEmbeddingZ.parse(
          await callTool(
            "embedTournamentStatement",
            { text: statement, maxTotalTokens },
            signal,
          ),
        ),
      );
    },
    async neighbors(
      { runId, statement, embedding },
      { signal, maxTotalTokens },
    ) {
      return withinBudget(
        meteredNeighborsZ.parse(
          await callTool(
            "findTournamentNeighbors",
            { agentRunId: runId, statement, embedding, maxTotalTokens },
            signal,
          ),
        ),
      );
    },
    async record({ lease, stage, candidates, pairs }, { signal }) {
      await callTool(
        "recordHypothesisCandidates",
        {
          agentRunId: lease.runId,
          leaseToken: lease.token,
          stage,
          candidates,
          pairs,
        },
        signal,
      );
    },
    async createDraft({ lease, draft, result }, { signal }) {
      return tournamentSubmitResultZ.parse(
        await callTool(
          "submitTournamentDraft",
          {
            agentRunId: lease.runId,
            leaseToken: lease.token,
            draft,
            result,
          },
          signal,
        ),
      ) as Awaited<ReturnType<TournamentDependencies["createDraft"]>>;
    },
  };
}
