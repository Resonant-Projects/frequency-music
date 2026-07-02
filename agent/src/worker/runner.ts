// Production worker runner.
//
// Polls the Convex agent-tool surface for the oldest queued agentRun, maps it to
// a compiled LangGraph, executes it (streaming node decisions to the audit
// surface), and ensures the run reaches a terminal status without double-marking.
//
// Concurrency is fixed at 1: each poll fully awaits the claimed run before
// claiming another. A SIGTERM/SIGINT handler fails any in-flight run so an
// interrupted run does not linger as `running` forever.
//
// All live calls are guarded on a Convex URL + AGENT_TOOL_SECRET; if either is
// missing the process prints a message and exits cleanly.

import { hostname } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { callConvex } from "../tools/convexTools.js";
import { graph as researchPipelineGraph } from "../graphs/research-pipeline/index.js";
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
} from "./graphInput.js";

const POLL_INTERVAL_MS = resolveWorkerPollIntervalMs(
  process.env.WORKER_POLL_INTERVAL_MS,
);
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

let shuttingDown = false;
let currentRunId: string | undefined;

function log(message: string, ...rest: unknown[]) {
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

async function appendWorkerHeartbeat(runId: string): Promise<void> {
  try {
    await callConvex("appendAgentRunEvent", {
      runId,
      kind: "status",
      message: "Worker heartbeat",
      payload: { reason: "worker_heartbeat" },
    });
  } catch (error) {
    log(`failed to append heartbeat for run ${runId}:`, redactError(error));
  }
}

function startRunHeartbeat(runId: string): () => void {
  const timer = setInterval(() => {
    void appendWorkerHeartbeat(runId);
  }, HEARTBEAT_INTERVAL_MS);
  (timer as { unref?: () => void }).unref?.();
  return () => clearInterval(timer);
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
  graphName: "research-pipeline" | "weekly-brief",
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

  if (graphName === "research-pipeline") {
    const stream = await researchPipelineGraph.stream(
      invocationInput as Parameters<typeof researchPipelineGraph.stream>[0],
      { streamMode: "updates" },
    );
    for await (const chunk of stream) await handleChunk(chunk);
  } else {
    const stream = await weeklyBriefAgent.stream(
      invocationInput as Parameters<typeof weeklyBriefAgent.stream>[0],
      { streamMode: "updates" },
    );
    for await (const chunk of stream) await handleChunk(chunk);
  }

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
    stopHeartbeat();
  }
}

// Claims and executes at most one run. Returns true when a run was claimed.
async function pollOnce(
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
  currentRunId = claim.runId;
  try {
    await runClaimedGraph(claim);
  } finally {
    currentRunId = undefined;
  }
  return true;
}

async function handleShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`received ${signal}; shutting down`);

  const runId = currentRunId;
  if (runId) {
    log(`failing in-flight run ${runId} due to ${signal}`);
    await markFailed(runId, `Worker received ${signal} during run`, {
      reason: "worker_shutdown",
      signal,
    });
  }
  process.exit(0);
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

  process.on("SIGTERM", () => void handleShutdown("SIGTERM"));
  process.on("SIGINT", () => void handleShutdown("SIGINT"));

  log(
    `started workerId=${workerId} pollIntervalMs=${POLL_INTERVAL_MS}` +
      (graphFilter ? ` graphFilter=${graphFilter}` : ""),
  );

  while (true) {
    if (shuttingDown) break;
    let claimed = false;
    try {
      claimed = await pollOnce(workerId, graphFilter);
    } catch (error) {
      log("poll iteration failed:", redactError(error));
    }

    if (shuttingDown) break;
    if (!claimed) await sleep(POLL_INTERVAL_MS);
  }

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
