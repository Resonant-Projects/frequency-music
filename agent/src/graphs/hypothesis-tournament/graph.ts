// Worker graph for the hypothesis tournament. The core runs as one bounded
// node; summarize is the dependency-light finalizer in finalize.ts.
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { callConvex } from "../../tools/convexTools.js";
import { appendRemoteAuditEvent, type ToolCaller } from "../shared/audit.js";
import { createTournamentDependencies } from "./adapters.js";
import { createFinalizeNode, summarizeResult } from "./finalize.js";
import { runTournament } from "./index.js";
import { createTournamentModel } from "./model.js";
import type {
  TournamentDependencies,
  TournamentLease,
  TournamentResult,
} from "./types.js";

export const HypothesisTournamentAnnotation = Annotation.Root({
  agentRunId: Annotation<string | undefined>,
  seedHint: Annotation<string | undefined>,
  traceUrl: Annotation<string | undefined>,
  result: Annotation<TournamentResult | undefined>,
  leaseToken: Annotation<string | undefined>,
  summary: Annotation<string | undefined>,
});
type State = typeof HypothesisTournamentAnnotation.State;

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
  return createFinalizeNode(callTool);
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
