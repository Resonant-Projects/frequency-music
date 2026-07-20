// Pure, side-effect-free helpers for the production worker runner.
//
// This module intentionally imports NOTHING from the compiled graphs (which
// construct models at import time). Keeping the graphName -> input mapping pure
// lets it be unit-tested without env/secrets or network access.

import {
  KNOWN_GRAPH_NAMES,
  TERMINAL_STATUS_OWNER,
  type KnownGraphName,
} from "../../../convex/shared/agentContract";
import type { ClaimedRun } from "../../../convex/shared/agentRunClaim";

export { KNOWN_GRAPH_NAMES, TERMINAL_STATUS_OWNER, type KnownGraphName };
export { redactError } from "../shared/redactError.js";
export type { ClaimedRun };

export const DEFAULT_RESEARCH_LIMIT = 10;
export const MAX_RESEARCH_LIMIT = 100;

export const DEFAULT_WEEKLY_BRIEF_SEED =
  "Generate this week's research brief from the current Convex research state. " +
  "Follow the weekly-brief supervisor instructions and land the result as a " +
  "human-review draft. Do not publish or mutate research data directly.";

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

export type ResearchPipelineGraphInput = {
  runId: string;
  agentRunId: string;
  dryRun: false;
  smokeMode: false;
  limit: number;
};

export type WeeklyBriefGraphInput = { messages: unknown[] };

export type CorrespondenceMinerGraphInput = {
  agentRunId: string;
  limit: number;
  traceUrl?: string;
};

export type EvidenceHunterGraphInput = CorrespondenceMinerGraphInput;

export type GraphInvocation =
  | { graphName: "research-pipeline"; input: ResearchPipelineGraphInput }
  | { graphName: "weekly-brief"; input: WeeklyBriefGraphInput }
  | { graphName: "correspondence-miner"; input: CorrespondenceMinerGraphInput }
  | { graphName: "evidence-hunter"; input: EvidenceHunterGraphInput };

function traceUrlFrom(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const traceUrl = (input as { traceUrl?: unknown }).traceUrl;
  return typeof traceUrl === "string" && traceUrl ? traceUrl : undefined;
}

function claimedTraceUrl(claim: ClaimedRun): string | undefined {
  return claim.traceUrl ?? traceUrlFrom(claim.input);
}

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
  if (claim.graphName === "correspondence-miner") {
    return {
      graphName: "correspondence-miner",
      input: {
        agentRunId: claim.runId,
        limit: resolveResearchLimit(claim.input, 20),
        ...(claimedTraceUrl(claim) ? { traceUrl: claimedTraceUrl(claim) } : {}),
      },
    };
  }
  if (claim.graphName === "evidence-hunter") {
    return {
      graphName: "evidence-hunter",
      input: {
        agentRunId: claim.runId,
        limit: Math.min(resolveResearchLimit(claim.input, 5), 5),
        ...(claimedTraceUrl(claim) ? { traceUrl: claimedTraceUrl(claim) } : {}),
      },
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
