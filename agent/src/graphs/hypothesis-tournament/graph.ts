// Worker graph for the hypothesis tournament. The core runs as one bounded
// node; summarize owns the terminal status for every outcome except a
// submitted draft, whose run is marked needs_review inside the draft
// transaction.
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { callConvex } from "../../tools/convexTools.js";
import { redactError } from "../../shared/redactError.js";
import {
  appendRemoteAuditEvent,
  finalizeRunCompleted,
  type ToolCaller,
} from "../shared/audit.js";
import { createTournamentDependencies } from "./adapters.js";
import { runTournament } from "./index.js";
import { createTournamentModel } from "./model.js";
import type { TournamentDependencies, TournamentResult } from "./types.js";

export const HypothesisTournamentAnnotation = Annotation.Root({
  agentRunId: Annotation<string | undefined>,
  seedHint: Annotation<string | undefined>,
  traceUrl: Annotation<string | undefined>,
  result: Annotation<TournamentResult | undefined>,
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
    dependencies?: (callTool: ToolCaller) => TournamentDependencies;
  } = {},
) {
  const callTool = options.callTool ?? callConvex;
  const dependencies =
    options.dependencies ??
    ((caller: ToolCaller) =>
      createTournamentDependencies({
        callTool: caller,
        model: createTournamentModel(),
      }));
  return async (state: State): Promise<Partial<State>> => {
    if (!state.agentRunId)
      throw new Error("hypothesis-tournament requires agentRunId");
    const result = await runTournament(
      { runId: state.agentRunId, seedHint: state.seedHint },
      dependencies(callTool),
    );
    await appendRemoteAuditEvent(
      callTool,
      state.agentRunId,
      "decision",
      `Hypothesis tournament finished: ${result.reason}`,
      summarizeResult(result),
    );
    return { result };
  };
}

/** Persistence failures leave a non-terminal or unverified archive, so they
 * fail the run; every other no-draft outcome is a completed run. */
export function terminalFor(result: TournamentResult) {
  if (result.reason === "submitted") return "needs_review" as const;
  if (result.reason === "busy") return "untouched" as const;
  if (
    result.reason === "dependency_error" ||
    result.events.some((event) => event.reason === "run_persistence_failed")
  )
    return "failed" as const;
  return "completed" as const;
}

export function createSummarizeNode(callTool: ToolCaller = callConvex) {
  return async (state: State): Promise<Partial<State>> => {
    const result = state.result;
    if (!state.agentRunId || !result) return {};
    const terminal = terminalFor(result);
    const summary =
      terminal === "needs_review"
        ? `hypothesis-tournament completed: draft ${result.draftId} awaits human review`
        : `hypothesis-tournament completed: ${result.reason}, no draft`;
    if (terminal === "completed")
      await finalizeRunCompleted(
        callTool,
        state.agentRunId,
        summary,
        state.traceUrl,
      );
    if (terminal === "failed") {
      try {
        await callTool("markAgentRunFailed", {
          runId: state.agentRunId,
          summary: `hypothesis-tournament failed: ${result.reason}`,
          error: {
            reason: result.reason,
            events: result.events.filter((event) => event.kind === "stopped"),
          },
        });
      } catch (error) {
        // The runner's stale sweep still terminates the run.
        console.warn(
          `[hypothesis-tournament] markAgentRunFailed: ${redactError(error)}`,
        );
      }
    }
    return { summary };
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
