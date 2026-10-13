// Terminal finalization for the hypothesis tournament, kept free of LangGraph
// and LangChain so the root harness can drive it with only root dependencies.
// Convex sets the terminal status from the durable result and lease, never
// from this worker's view alone.
import { redactError } from "../../shared/redactError.js";
import type { ToolCaller } from "../shared/audit.js";
import type { TournamentResult } from "./types.js";

export const FINALIZE_TIMEOUT_MS = 30_000;

export type FinalizeState = {
  agentRunId?: string;
  result?: TournamentResult;
  leaseToken?: string;
};

export function summarizeResult(result: TournamentResult) {
  const outcomes = result.candidates.reduce<Record<string, number>>(
    (counts, candidate) => {
      counts[candidate.outcome] = (counts[candidate.outcome] ?? 0) + 1;
      return counts;
    },
    {},
  );
  return {
    reason: result.reason,
    draftId: result.draftId,
    outcomes,
    pairs: result.pairs.length,
    events: result.events,
    calls: result.budget.calls,
    totalTokens: result.budget.totalTokens,
    elapsedMs: result.budget.elapsedMs,
  };
}

export function createFinalizeNode(callTool: ToolCaller) {
  return async (state: FinalizeState): Promise<{ summary?: string }> => {
    const result = state.result;
    if (!state.agentRunId || !result) return {};
    try {
      // Bounded like the other terminal writes, after the run's own budget.
      const finalized = (await callTool(
        "finalizeTournamentRun",
        {
          agentRunId: state.agentRunId,
          ...(state.leaseToken ? { leaseToken: state.leaseToken } : {}),
          summary: `hypothesis-tournament failed: ${result.reason}`,
        },
        AbortSignal.timeout(FINALIZE_TIMEOUT_MS),
      )) as { status?: unknown; runStatus?: unknown };
      // runStatus is the durable run status; status is only this call's
      // effect, "untouched" whenever the run was already terminal.
      return {
        summary: `hypothesis-tournament ${String(finalized.runStatus)}: ${result.reason}${result.draftId ? `, draft ${result.draftId} awaits human review` : ""}`,
      };
    } catch (error) {
      // The stale-run sweep still terminates a run left running.
      console.warn(
        `[hypothesis-tournament] finalizeTournamentRun: ${redactError(error)}`,
      );
      return { summary: `hypothesis-tournament unfinalized: ${result.reason}` };
    }
  };
}
