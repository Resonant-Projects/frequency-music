// Cross-workspace contract for the agent-run lifecycle. Imported by both the
// Convex backend and the agent workspace; keep this module runtime-pure.
import { AGENT_RUN_STATUSES, type AgentRunStatus } from "./statuses";

export { AGENT_RUN_STATUSES, type AgentRunStatus };

export const PENDING_DRAFT_CAP = 3;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const LISTENING_DEBT_AFTER_MS = 14 * DAY_MS;
export const MAX_FEED_ENABLE_STATE_IDS = 20;

export const AGENT_RUN_EVENT_KINDS = [
  "tool_call",
  "decision",
  "draft_write",
  "error",
  "review_request",
  "status",
  "node",
  // Emitted when cross-run agent memory (LangGraph Store) changes a decision.
  "memory_recall",
  // Per-model-call quota audit trail. Added after the original plan was written.
  "model_call",
] as const;
export type AgentRunEventKind = (typeof AGENT_RUN_EVENT_KINDS)[number];

// A heartbeat interval at or above the stale threshold would let the sweeper
// kill healthy in-flight runs.
export const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
export const STALE_RUN_MS = 30 * 60 * 1000;
if (HEARTBEAT_INTERVAL_MS >= STALE_RUN_MS) {
  throw new Error(
    "agentContract invariant violated: HEARTBEAT_INTERVAL_MS must be < STALE_RUN_MS",
  );
}

export const KNOWN_GRAPH_NAMES = [
  "research-pipeline",
  "weekly-brief",
  "correspondence-miner",
  "evidence-hunter",
  "hypothesis-drafter",
] as const;
export type KnownGraphName = (typeof KNOWN_GRAPH_NAMES)[number];

export function isKnownGraphName(name: string): name is KnownGraphName {
  return (KNOWN_GRAPH_NAMES as readonly string[]).includes(name);
}

export function normalizeTraceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

// Which side owns the terminal Convex status write for each graph.
export const TERMINAL_STATUS_OWNER: Record<KnownGraphName, "graph" | "runner"> =
  {
    "research-pipeline": "graph",
    "weekly-brief": "runner",
    "correspondence-miner": "graph",
    "evidence-hunter": "graph",
    "hypothesis-drafter": "graph",
  };
