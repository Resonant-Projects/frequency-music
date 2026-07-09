// The single declarative list of agent tools. Convex actions, HTTP routes,
// LangChain adapters, and generated documentation all derive from this list.
import type { z } from "zod";
import { agentToolArgs, type AgentToolName } from "./agentToolArgs";

export type AgentToolManifestEntry = {
  name: AgentToolName;
  description: string;
  context: string;
  backing: string;
  args: z.ZodObject;
  langchain: boolean;
  kind: "read" | "audit_write";
};

function entry(
  name: AgentToolName,
  kind: "read" | "audit_write",
  backing: string,
  description: string,
  context: string,
  options: { langchain?: boolean } = {},
): AgentToolManifestEntry {
  return {
    name,
    kind,
    backing,
    description,
    context,
    args: agentToolArgs[name],
    langchain: options.langchain ?? true,
  };
}

export const AGENT_TOOL_MANIFEST: readonly AgentToolManifestEntry[] = [
  entry(
    "listRecentExtractions",
    "read",
    "extractions:listRecent",
    "Fetch recent structured source extractions with claims, topics, open questions, and composition parameters.",
    "Use first when a brief or synthesis needs fresh source material.",
  ),
  entry(
    "getExtraction",
    "read",
    "extractions:get",
    "Fetch one extraction by Convex extraction id.",
    "Use after listRecentExtractions when the agent needs full detail for a selected item.",
  ),
  entry(
    "listRecentHypotheses",
    "read",
    "hypotheses:listByStatus",
    "Fetch recent hypotheses with rationale and whyThisMatters.",
    "No status filter in phase one; returns newest rows.",
  ),
  entry(
    "listActiveTheses",
    "read",
    "theses:list",
    "Fetch active research theses that should anchor weekly brief recommendations.",
    "Helps the weekly brief connect recommendations to durable research questions.",
  ),
  entry(
    "listFailureArchive",
    "read",
    "failures:listArchive",
    "Fetch recent failed, retired, contradicted, archived, or low-yield research paths to avoid repeating them.",
    "Use to avoid recommending ideas already contradicted, retired, archived, or repeatedly low-yield.",
  ),
  entry(
    "getEditorialSignals",
    "read",
    "dashboard:editorialSignals",
    "Fetch high-yield and low-yield concept clusters from the editorial graph.",
    "Useful for naming promising research lanes and weak paths.",
  ),
  entry(
    "getRecentRecipes",
    "read",
    "recipes:listByStatus",
    "Fetch recent composition recipes with parameters, DAW checklists, and protocols.",
    "Gives the agent concrete studio actions, not just abstract claims.",
  ),
  entry(
    "getRecommendedActions",
    "read",
    "campaigns:getRecommendedActions",
    "Fetch deterministic recommended action candidates from the current campaign scope.",
    "Agent recommendations should explain when they diverge from these deterministic suggestions.",
  ),
  entry(
    "searchSourcesByConcept",
    "read",
    "graph:searchSourcesByConcept",
    "Find source metadata linked to a concept name. Raw text is intentionally omitted.",
    "Returns source metadata only. It intentionally omits rawText and transcripts to protect context windows.",
  ),
  entry(
    "getSelfImprovementStats",
    "read",
    "internal.agentTools:selfImprovementStats",
    "Fetch read-only self-improvement stats for the weekly brief's 'what the system learned' section: new edit-captures count, agent-review-draft approve/reject counts with rejection notes, and memory_recall run-event notes, all window-filtered by daysBack (default 7). Prompt promotions are not tracked here yet — never claim one happened unless told separately. All counts come straight from Convex; never invent or round numbers not present in the response.",
    "Accepts optional `daysBack` (default 7, max 90) and degrades to all-zero counts and empty note arrays when the window is empty. Prompt/policy promotions are not included because they live in `docs/eval-baselines.md` and the decision log via `scripts/langsmith/promote.ts`; wire a field here once a queryable store exists.",
  ),
  entry(
    "createAgentRun",
    "audit_write",
    "agentRuns:create + agentRuns:markRunning",
    "Create an audit-only Convex agent run record and mark it running. Does not mutate research data.",
    "Returns safe metadata: run id, status, and timestamps.",
  ),
  entry(
    "appendAgentRunEvent",
    "audit_write",
    "agentRuns:appendEvent",
    "Append an audit-only lifecycle event to a Convex agent run. Does not mutate research data.",
    "Payloads should be sanitized; never include secrets or raw env data.",
  ),
  entry(
    "markAgentRunCompleted",
    "audit_write",
    "agentRuns:markCompleted",
    "Mark an audit-only Convex agent run completed. Does not mutate research data.",
    "Optional summary and trace URL only.",
  ),
  entry(
    "markAgentRunNeedsReview",
    "audit_write",
    "agentRuns:markNeedsReview",
    "Mark an audit-only Convex agent run as needs_review after producing a human-review draft. Does not mutate research data.",
    "Draft is sanitized server-side.",
  ),
  entry(
    "createAgentReviewDraft",
    "audit_write",
    "agentDrafts:createFromAgentRun",
    "Persist a sanitized human-review draft linked to an agent run. Creates an agentReviewDraft row and audit event; does not publish research artifacts.",
    "`whyThisMatters` is enforced at draft creation; payload-less drafts are acknowledge-only and cannot be promoted. The research-pipeline hallucinated-ID gate rejects payloads referencing source, extraction, or hypothesis ids the run never read.",
  ),
  entry(
    "markAgentRunFailed",
    "audit_write",
    "agentRuns:markFailed",
    "Mark an audit-only Convex agent run failed and optionally record sanitized error details. Does not mutate research data.",
    "Error payloads should be high-level, not secrets.",
  ),
  entry(
    "claimNextPendingRun",
    "audit_write",
    "agentRuns:claimNextPending",
    "Atomically claim the oldest queued Convex agent run for a worker, flipping it to running. Production worker only.",
    "Production worker only. A lifecycle write, not a research-data write.",
    { langchain: false },
  ),
  entry(
    "getAgentRun",
    "audit_write",
    "agentRuns:getForWorker",
    "Fetch the full Convex agent run document including raw input by id for status polling. Audit-only read.",
    "Worker status polling; public getters strip input.",
  ),
];

export const AGENT_TOOL_NAMES: readonly AgentToolName[] =
  AGENT_TOOL_MANIFEST.map((tool) => tool.name);
