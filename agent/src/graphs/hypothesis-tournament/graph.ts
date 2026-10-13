// Worker graph for the hypothesis tournament. The core runs as one bounded
// node; summarize asks Convex to set the terminal status from the durable
// result and lease, never from this worker's view alone.
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { callConvex } from "../../tools/convexTools.js";
import { redactError } from "../../shared/redactError.js";
import { appendRemoteAuditEvent, type ToolCaller } from "../shared/audit.js";
import { createTournamentDependencies } from "./adapters.js";
import { runTournament } from "./index.js";
import { createTournamentModel } from "./model.js";
import type {
  TournamentDependencies,
  TournamentLease,
  TournamentResult,
} from "./types.js";

export const FINALIZE_TIMEOUT_MS = 30_000;

export const HypothesisTournamentAnnotation = Annotation.Root({
  agentRunId: Annotation<string | undefined>,
  seedHint: Annotation<string | undefined>,
  traceUrl: Annotation<string | undefined>,
  result: Annotation<TournamentResult | undefined>,
  leaseToken: Annotation<string | undefined>,
  summary: Annotation<string | undefined>,
});
type State = typeof HypothesisTournamentAnnotation.State;

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

export function createRunTournamentNode(
  options: {
    callTool?: ToolCaller;
    dependencies?: (
      callTool: ToolCaller,
      onLease: (lease: TournamentLease) => void,
    ) => TournamentDependencies;
  } = {},
) {
  const callTool = options.callTool ?? callConvex;
  const dependencies =
    options.dependencies ??
    ((caller: ToolCaller, onLease: (lease: TournamentLease) => void) =>
      createTournamentDependencies({
        callTool: caller,
        model: createTournamentModel(),
        onLease,
      }));
  return async (state: State): Promise<Partial<State>> => {
    if (!state.agentRunId)
      throw new Error("hypothesis-tournament requires agentRunId");
    let leaseToken: string | undefined;
    const result = await runTournament(
      { runId: state.agentRunId, seedHint: state.seedHint },
      dependencies(callTool, (lease) => {
        leaseToken = lease.token;
      }),
    );
    await appendRemoteAuditEvent(
      callTool,
      state.agentRunId,
      "decision",
      `Hypothesis tournament finished: ${result.reason}`,
      summarizeResult(result),
    );
    return { result, leaseToken };
  };
}

export function createSummarizeNode(callTool: ToolCaller = callConvex) {
  return async (state: State): Promise<Partial<State>> => {
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
      return {
        summary: `hypothesis-tournament ${String(finalized.status)}: ${result.reason}${result.draftId ? `, draft ${result.draftId} awaits human review` : ""}`,
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

export function buildTournamentGraph(
  nodes: {
    run?: ReturnType<typeof createRunTournamentNode>;
    summarize?: ReturnType<typeof createSummarizeNode>;
  } = {},
) {
  return new StateGraph(HypothesisTournamentAnnotation)
    .addNode("run_tournament", nodes.run ?? createRunTournamentNode())
    .addNode("summarize", nodes.summarize ?? createSummarizeNode())
    .addEdge(START, "run_tournament")
    .addEdge("run_tournament", "summarize")
    .addEdge("summarize", END)
    .compile();
}

export const graph = buildTournamentGraph();
