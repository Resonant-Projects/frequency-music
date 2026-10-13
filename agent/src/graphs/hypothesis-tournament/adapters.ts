// Production persistence and retrieval for the tournament core, over the
// authenticated agent-tool surface. Every response is parsed with the shared
// contract, so a drifting backend fails the run instead of corrupting it.
// No model imports here: the model adapter lives in model.ts.
import {
  evidenceClaimZ,
  meteredEmbeddingZ,
  meteredNeighborsZ,
  tournamentBeginZ,
  tournamentSeedZ,
  tournamentSubmitResultZ,
} from "../../../../convex/shared/hypothesisTournament.js";
import type { ToolCaller } from "../shared/audit.js";
import type { TournamentDependencies } from "./types.js";

export function createTournamentDependencies(options: {
  callTool: ToolCaller;
  model: TournamentDependencies["model"];
  now?: () => number;
}): TournamentDependencies {
  const { callTool } = options;
  return {
    ...(options.now ? { now: options.now } : {}),
    async beginRun({ runId, leaseDurationMs }, { signal }) {
      return tournamentBeginZ.parse(
        await callTool(
          "beginTournamentRun",
          { agentRunId: runId, leaseDurationMs },
          signal,
        ),
      ) as Awaited<ReturnType<TournamentDependencies["beginRun"]>>;
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
    async searchClaimsSemantic(statement, { signal }) {
      const matches = await callTool(
        "searchClaimsSemantic",
        { text: statement, limit: 10 },
        signal,
      );
      if (!Array.isArray(matches)) throw new Error("Invalid claim search");
      return matches.flatMap((match) =>
        match && typeof match === "object" && "claimId" in match
          ? [String((match as { claimId: unknown }).claimId)]
          : [],
      );
    },
    async hydrateClaims(ids, { signal }) {
      return evidenceClaimZ
        .array()
        .parse(await callTool("hydrateClaims", { claimIds: ids }, signal));
    },
    model: options.model,
    async embed(statement, { signal }) {
      return meteredEmbeddingZ.parse(
        await callTool("embedTournamentStatement", { text: statement }, signal),
      );
    },
    async neighbors({ runId, statement, embedding }, { signal }) {
      return meteredNeighborsZ.parse(
        await callTool(
          "findTournamentNeighbors",
          { agentRunId: runId, statement, embedding },
          signal,
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
