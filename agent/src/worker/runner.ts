// Production worker runner.
//
// Polls the Convex agent-tool surface for the oldest queued agentRun, maps it to
// a compiled LangGraph, executes it (streaming node decisions to the audit
// surface), and ensures the run reaches a terminal status without double-marking.
//
// Concurrency is fixed at 1: each poll fully awaits the claimed run before
// claiming another. SIGTERM/SIGINT stops future claims and waits for any
// outstanding claim, active graph, and terminal writes to finish.
//
// All live calls are guarded on a Convex URL + AGENT_TOOL_SECRET; if either is
// missing the process prints a message and exits cleanly.

import { hostname } from "node:os";
import { pathToFileURL } from "node:url";

import { HEARTBEAT_INTERVAL_MS } from "../../../convex/shared/agentContract";
import { callConvex } from "../tools/convexTools.js";
import { graph as researchPipelineGraph } from "../graphs/research-pipeline/index.js";
import { graph as correspondenceMinerGraph } from "../graphs/correspondence-miner/index.js";
import { graph as evidenceHunterGraph } from "../graphs/evidence-hunter/index.js";
import { graph as hypothesisDrafterGraph } from "../graphs/hypothesis-drafter/index.js";
import { graph as sourceScoutGraph } from "../graphs/source-scout/index.js";
import { agent as weeklyBriefAgent } from "../agents/weekly-brief/index.js";
import { loadRootEnvLocalForResearchSmoke } from "../../scripts/smoke-research-pipeline.js";
import {
  normalizeConvexSiteUrlEnv,
  resolveWorkerPollIntervalMs,
} from "./config.js";
import {
  buildGraphInvocation,
  isKnownGraphName,
  redactError,
  summarizeNodeUpdate,
  TERMINAL_STATUS_OWNER,
  type ClaimedRun,
  type KnownGraphName,
} from "./graphInput.js";

import { runWorkerLoop } from "./lifecycle.js";

type StreamableGraph = {
  stream: (
    input: never,
    options: {
      streamMode: "updates";
      configurable: { agentRunId: string };
    },
  ) => Promise<AsyncIterable<unknown>>;
};

const GRAPHS: Record<KnownGraphName, StreamableGraph> = {
  "research-pipeline": researchPipelineGraph as unknown as StreamableGraph,
  "weekly-brief": weeklyBriefAgent as unknown as StreamableGraph,
  "correspondence-miner":
    correspondenceMinerGraph as unknown as StreamableGraph,
  "evidence-hunter": evidenceHunterGraph as unknown as StreamableGraph,
  "hypothesis-drafter": hypothesisDrafterGraph as unknown as StreamableGraph,
  "source-scout": sourceScoutGraph as unknown as StreamableGraph,
};

const POLL_INTERVAL_MS = resolveWorkerPollIntervalMs(
  process.env.WORKER_POLL_INTERVAL_MS,
);

function log(message: string, ...rest: unknown[]): void {
  console.log(`[worker] ${message}`, ...rest);
}

function hasLiveConfig(): boolean {
  return Boolean(process.env.CONVEX_SITE_URL && process.env.AGENT_TOOL_SECRET);
}

async function appendNodeEvent(
  runId: string,
  node: string,
  update: unknown,
): Promise<void> {
  try {
    await callConvex("appendAgentRunEvent", {
      runId,
      kind: "node",
      message: `Worker executed graph node '${node}'`,
      payload: summarizeNodeUpdate(node, update),
    });
  } catch (error) {
    log(`failed to append node event for '${node}':`, redactError(error));
  }
}

// Heartbeats are best-effort maintenance, unlike claims and terminal writes.
// Bound their HTTP lifetime so an abandoned heartbeat cannot hold a drained run.
export const WORKER_HEARTBEAT_TIMEOUT_MS = 30_000;

async function appendWorkerHeartbeat(runId: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WORKER_HEARTBEAT_TIMEOUT_MS,
  );
  try {
    await callConvex(
      "appendAgentRunEvent",
      {
        runId,
        kind: "status",
        message: "Worker heartbeat",
        payload: { reason: "worker_heartbeat" },
      },
      controller.signal,
    );
  } catch (error) {
    log(`failed to append heartbeat for run ${runId}:`, redactError(error));
  } finally {
    clearTimeout(timeout);
  }
}

function startRunHeartbeat(runId: string): () => Promise<void> {
  const pending = new Set<Promise<void>>();
  const timer = setInterval(() => {
    const heartbeat = appendWorkerHeartbeat(runId);
    pending.add(heartbeat);
    void heartbeat.finally(() => pending.delete(heartbeat));
  }, HEARTBEAT_INTERVAL_MS);
  (timer as { unref?: () => void }).unref?.();
  return async () => {
    clearInterval(timer);
    await Promise.all(pending);
  };
}

async function markFailed(
  runId: string,
  summary: string,
  error: Record<string, unknown>,
): Promise<void> {
  try {
    await callConvex("markAgentRunFailed", { runId, summary, error });
  } catch (markError) {
    log(`failed to mark run ${runId} failed:`, redactError(markError));
  }
}

async function getRunStatus(runId: string): Promise<string | undefined> {
  try {
    const run = await callConvex<{ status?: unknown } | null>("getAgentRun", {
      runId,
    });
    return typeof run?.status === "string" ? run.status : undefined;
  } catch (error) {
    log(`failed to fetch run ${runId} status:`, redactError(error));
    return undefined;
  }
}

async function markRunnerCompleted(
  runId: string,
  messageCount: number,
): Promise<void> {
  const summary = `weekly-brief agent run completed (${messageCount} messages)`;
  try {
    await callConvex("markAgentRunCompleted", { runId, summary });
    return;
  } catch (error) {
    const observedStatus = await getRunStatus(runId);
    if (observedStatus === "completed") {
      log(`run ${runId} was already marked completed after write retry check`);
      return;
    }
    log(`failed to mark run ${runId} completed:`, redactError(error));
    await markFailed(runId, "Worker could not persist completed status", {
      reason: "terminal_status_write_error",
      message: redactError(error),
      ...(observedStatus ? { observedStatus } : {}),
    });
  }
}

// Streams a compiled graph, forwarding each per-node update to the audit surface.
// Returns the number of messages observed on the final update (for weekly-brief
// completion summaries).
async function streamGraph(
  runId: string,
  graphName: KnownGraphName,
  invocationInput: unknown,
): Promise<{ messageCount: number }> {
  let messageCount = 0;

  const handleChunk = async (chunk: unknown) => {
    if (!chunk || typeof chunk !== "object") return;
    for (const [node, update] of Object.entries(
      chunk as Record<string, unknown>,
    )) {
      if (update && typeof update === "object") {
        const messages = (update as { messages?: unknown }).messages;
        if (Array.isArray(messages)) messageCount = messages.length;
      }
      await appendNodeEvent(runId, node, update);
    }
  };

  const stream = await GRAPHS[graphName].stream(invocationInput as never, {
    streamMode: "updates",
    configurable: { agentRunId: runId },
  });
  for await (const chunk of stream) await handleChunk(chunk);

  return { messageCount };
}

async function runClaimedGraph(claim: ClaimedRun): Promise<void> {
  const { runId, graphName } = claim;

  if (!isKnownGraphName(graphName)) {
    log(
      `claimed run ${runId} has unknown graph '${graphName}'; marking failed`,
    );
    await markFailed(runId, `Unknown graph '${graphName}'`, {
      reason: "unknown_graph",
      graphName,
    });
    return;
  }

  const invocation = buildGraphInvocation(claim);
  const stopHeartbeat = startRunHeartbeat(runId);

  try {
    const { messageCount } = await streamGraph(
      runId,
      invocation.graphName,
      invocation.input,
    );
    log(`run ${runId} (${graphName}) finished`);

    if (TERMINAL_STATUS_OWNER[invocation.graphName] === "runner") {
      // weekly-brief: the graph writes no audit terminal status, so the runner
      // owns it. Isolate terminal-write failures from graph execution failures.
      await markRunnerCompleted(runId, messageCount);
    }
  } catch (error) {
    // The graph threw before reaching its own terminal-status write (or has no
    // owner), so the runner ensures the run does not linger as running.
    log(`run ${runId} (${graphName}) threw:`, redactError(error));
    await markFailed(runId, "Worker caught graph execution error", {
      reason: "graph_execution_error",
      message: redactError(error),
    });
  } finally {
    await stopHeartbeat();
  }
}

// Claims and executes at most one run. Returns true when a run was claimed.
export async function pollOnce(
  workerId: string,
  graphName?: string,
): Promise<boolean> {
  const claim = await callConvex<ClaimedRun | null>("claimNextPendingRun", {
    workerId,
    ...(graphName ? { graphName } : {}),
  });
  if (!claim || typeof claim !== "object" || !claim.runId || !claim.graphName) {
    return false;
  }

  log(`claimed run ${claim.runId} for graph '${claim.graphName}'`);
  // A claim already sent when shutdown arrives must still run to completion.
  await runClaimedGraph(claim);
  return true;
}

export async function main(): Promise<void> {
  // Pick up Convex URL aliases / AGENT_TOOL_SECRET from the repo-root
  // .env.local for local runs (Bun also auto-loads agent/.env.local; Docker
  // uses env_file).
  loadRootEnvLocalForResearchSmoke();
  normalizeConvexSiteUrlEnv();

  if (!hasLiveConfig()) {
    log(
      "CONVEX_SITE_URL, CONVEX_URL, or CONVEX_SELF_HOSTED_URL plus AGENT_TOOL_SECRET are required to run the worker. Exiting.",
    );
    return;
  }

  const workerId =
    process.env.WORKER_ID ?? `worker-${hostname()}-${process.pid}`;
  const graphFilter = process.env.WORKER_GRAPH_NAME;

  log(
    `started workerId=${workerId} pollIntervalMs=${POLL_INTERVAL_MS}` +
      (graphFilter ? ` graphFilter=${graphFilter}` : ""),
  );

  await runWorkerLoop({
    poll: () => pollOnce(workerId, graphFilter),
    pollIntervalMs: POLL_INTERVAL_MS,
    signals: process,
    log,
    onPollError: (error) => log("poll iteration failed:", redactError(error)),
  });

  log("worker loop exited");
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(`[worker] fatal: ${redactError(error)}`);
    process.exit(1);
  });
}
