// Pure, side-effect-free helpers for the production worker runner.
//
// This module intentionally imports NOTHING from the compiled graphs (which
// construct models at import time). Keeping the graphName -> input mapping pure
// lets it be unit-tested without env/secrets or network access.

export const KNOWN_GRAPH_NAMES = ["research-pipeline", "weekly-brief"] as const;
export type KnownGraphName = (typeof KNOWN_GRAPH_NAMES)[number];

export const DEFAULT_RESEARCH_LIMIT = 10;
export const MAX_RESEARCH_LIMIT = 100;

export const DEFAULT_WEEKLY_BRIEF_SEED =
  "Generate this week's research brief from the current Convex research state. " +
  "Follow the weekly-brief supervisor instructions and land the result as a " +
  "human-review draft. Do not publish or mutate research data directly.";

// Which side owns the terminal Convex status write for each graph:
// - research-pipeline: its finalizeRunNode already marks completed/needs_review/
//   failed, so the runner must NOT double-mark on the success path.
// - weekly-brief: the graph performs no audit writes, so the runner owns the
//   terminal status write.
export const TERMINAL_STATUS_OWNER: Record<KnownGraphName, "graph" | "runner"> = {
  "research-pipeline": "graph",
  "weekly-brief": "runner",
};

export function isKnownGraphName(name: string): name is KnownGraphName {
  return (KNOWN_GRAPH_NAMES as readonly string[]).includes(name);
}

export function resolveResearchLimit(
  input: unknown,
  fallback = DEFAULT_RESEARCH_LIMIT,
): number {
  if (input && typeof input === "object") {
    const raw = (input as { limit?: unknown }).limit;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      return Math.min(Math.floor(raw), MAX_RESEARCH_LIMIT);
    }
  }
  return fallback;
}

function normalizeMessage(entry: unknown): unknown {
  if (typeof entry === "string") return { role: "user", content: entry };
  return entry;
}

export function buildWeeklyBriefMessages(input: unknown): unknown[] {
  if (input && typeof input === "object") {
    const raw = (input as { messages?: unknown }).messages;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map(normalizeMessage);
    }
  }
  return [{ role: "user", content: DEFAULT_WEEKLY_BRIEF_SEED }];
}

export type ClaimedRun = {
  runId: string;
  graphName: string;
  input?: unknown;
};

export type ResearchPipelineGraphInput = {
  runId: string;
  agentRunId: string;
  dryRun: false;
  smokeMode: false;
  limit: number;
};

export type WeeklyBriefGraphInput = { messages: unknown[] };

export type GraphInvocation =
  | { graphName: "research-pipeline"; input: ResearchPipelineGraphInput }
  | { graphName: "weekly-brief"; input: WeeklyBriefGraphInput };

// Maps a claimed run into the exact input shape the corresponding compiled graph
// expects. For research-pipeline the claimed Convex run id is threaded in as
// `agentRunId` so initializeRunNode reuses it instead of creating a second run.
export function buildGraphInvocation(claim: ClaimedRun): GraphInvocation {
  if (claim.graphName === "research-pipeline") {
    return {
      graphName: "research-pipeline",
      input: {
        runId: `research-pipeline-run-${claim.runId}`,
        agentRunId: claim.runId,
        dryRun: false,
        smokeMode: false,
        limit: resolveResearchLimit(claim.input),
      },
    };
  }
  if (claim.graphName === "weekly-brief") {
    return {
      graphName: "weekly-brief",
      input: { messages: buildWeeklyBriefMessages(claim.input) },
    };
  }
  throw new Error(`Unknown graphName: ${claim.graphName}`);
}

export function summarizeNodeUpdate(
  node: string,
  update: unknown,
): { node: string; keys: string[] } {
  const keys =
    update && typeof update === "object"
      ? Object.keys(update as Record<string, unknown>)
      : [];
  return { node, keys };
}

// Redact obvious secret material from an error before it is logged or sent to
// the audit surface. Mirrors the redaction in research-pipeline nodes.ts.
export function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(
      /((?:api[_-]?key|secret|token|password|passwd)\s*[=:]\s*)[^\s"'}]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(PVEAPIToken=)[^\s"'}]+/gi, "$1[REDACTED]");
}
