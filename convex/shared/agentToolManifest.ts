// The single declarative list of agent tools. Convex actions, HTTP routes,
// LangChain adapters, and generated documentation all derive from this list.
import type { z } from "zod";
import { agentToolArgs, type AgentToolName } from "./agentToolArgs";

export type AgentToolManifestEntry = {
  name: AgentToolName;
  description: string;
  args: z.ZodObject;
  langchain: boolean;
  kind: "read" | "audit_write";
};

function entry(
  name: AgentToolName,
  kind: "read" | "audit_write",
  description: string,
  options: { langchain?: boolean } = {},
): AgentToolManifestEntry {
  return {
    name,
    kind,
    description,
    args: agentToolArgs[name],
    langchain: options.langchain ?? true,
  };
}

export const AGENT_TOOL_MANIFEST: readonly AgentToolManifestEntry[] = [
  entry(
    "listRecentExtractions",
    "read",
    "Fetch recent structured source extractions with claims, topics, open questions, and composition parameters.",
  ),
  entry(
    "getExtraction",
    "read",
    "Fetch one extraction by Convex extraction id.",
  ),
  entry(
    "listRecentHypotheses",
    "read",
    "Fetch recent hypotheses with rationale and whyThisMatters.",
  ),
  entry(
    "listActiveTheses",
    "read",
    "Fetch active research theses that should anchor weekly brief recommendations.",
  ),
  entry(
    "listFailureArchive",
    "read",
    "Fetch recent failed, retired, contradicted, archived, or low-yield research paths to avoid repeating them.",
  ),
  entry(
    "getEditorialSignals",
    "read",
    "Fetch high-yield and low-yield concept clusters from the editorial graph.",
  ),
  entry(
    "getRecentRecipes",
    "read",
    "Fetch recent composition recipes with parameters, DAW checklists, and protocols.",
  ),
  entry(
    "getRecommendedActions",
    "read",
    "Fetch deterministic recommended action candidates from the current campaign scope.",
  ),
  entry(
    "searchSourcesByConcept",
    "read",
    "Find source metadata linked to a concept name. Raw text is intentionally omitted.",
  ),
  entry(
    "getSelfImprovementStats",
    "read",
    "Fetch read-only self-improvement stats for the weekly brief's 'what the system learned' section: new edit-captures count, agent-review-draft approve/reject counts with rejection notes, and memory_recall run-event notes, all window-filtered by daysBack (default 7). Prompt promotions are not tracked here yet — never claim one happened unless told separately. All counts come straight from Convex; never invent or round numbers not present in the response.",
  ),
  entry(
    "createAgentRun",
    "audit_write",
    "Create an audit-only Convex agent run record and mark it running. Does not mutate research data.",
  ),
  entry(
    "appendAgentRunEvent",
    "audit_write",
    "Append an audit-only lifecycle event to a Convex agent run. Does not mutate research data.",
  ),
  entry(
    "markAgentRunCompleted",
    "audit_write",
    "Mark an audit-only Convex agent run completed. Does not mutate research data.",
  ),
  entry(
    "markAgentRunNeedsReview",
    "audit_write",
    "Mark an audit-only Convex agent run as needs_review after producing a human-review draft. Does not mutate research data.",
  ),
  entry(
    "createAgentReviewDraft",
    "audit_write",
    "Persist a sanitized human-review draft linked to an agent run. Creates an agentReviewDraft row and audit event; does not publish research artifacts.",
  ),
  entry(
    "markAgentRunFailed",
    "audit_write",
    "Mark an audit-only Convex agent run failed and optionally record sanitized error details. Does not mutate research data.",
  ),
  entry(
    "claimNextPendingRun",
    "audit_write",
    "Atomically claim the oldest queued Convex agent run for a worker, flipping it to running. Production worker only.",
    { langchain: false },
  ),
  entry(
    "getAgentRun",
    "audit_write",
    "Fetch the full Convex agent run document including raw input by id for status polling. Audit-only read.",
  ),
];

export const AGENT_TOOL_NAMES: readonly AgentToolName[] =
  AGENT_TOOL_MANIFEST.map((tool) => tool.name);
