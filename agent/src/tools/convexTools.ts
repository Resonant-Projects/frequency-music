import { tool } from "@langchain/core/tools";
import { z } from "zod";

const rawTextKeys = new Set(["rawText", "transcript"]);

function stripLargeTextFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripLargeTextFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (rawTextKeys.has(key)) continue;
    result[key] = stripLargeTextFields(child);
  }
  return result;
}

export async function callConvex<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const convexUrl = process.env.CONVEX_SITE_URL;
  const agentSecret = process.env.AGENT_TOOL_SECRET;
  if (!convexUrl) throw new Error("CONVEX_SITE_URL is required");
  if (!agentSecret) throw new Error("AGENT_TOOL_SECRET is required");

  const resp = await fetch(
    convexUrl.replace(/\/$/, "") + "/agent-tools/" + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: agentSecret, ...body }),
    },
  );
  if (!resp.ok) {
    throw new Error(
      "Convex tool " +
        path +
        " failed: " +
        resp.status +
        " " +
        (await resp.text()),
    );
  }
  return stripLargeTextFields(await resp.json()) as T;
}

export const listRecentExtractions = tool(
  ({ limit }) => callConvex("listRecentExtractions", { limit }),
  {
    name: "list_recent_extractions",
    description:
      "Fetch recent structured source extractions with claims, topics, open questions, and composition parameters.",
    schema: z.object({
      limit: z.number().int().positive().max(100).optional(),
    }),
  },
);

export const getExtraction = tool(
  ({ id }) => callConvex("getExtraction", { id }),
  {
    name: "get_extraction",
    description: "Fetch one extraction by Convex extraction id.",
    schema: z.object({ id: z.string() }),
  },
);

export const listRecentHypotheses = tool(
  ({ limit }) => callConvex("listRecentHypotheses", { limit }),
  {
    name: "list_recent_hypotheses",
    description: "Fetch recent hypotheses with rationale and whyThisMatters.",
    schema: z.object({
      limit: z.number().int().positive().max(100).optional(),
    }),
  },
);

export const listActiveTheses = tool(
  ({ limit }) => callConvex("listActiveTheses", { limit }),
  {
    name: "list_active_theses",
    description:
      "Fetch active research theses that should anchor weekly brief recommendations.",
    schema: z.object({
      limit: z.number().int().positive().max(100).optional(),
    }),
  },
);

export const listFailureArchive = tool(
  ({ limit }) => callConvex("listFailureArchive", { limit }),
  {
    name: "list_failure_archive",
    description:
      "Fetch recent failed, retired, contradicted, archived, or low-yield research paths to avoid repeating them.",
    schema: z.object({
      limit: z.number().int().positive().max(100).optional(),
    }),
  },
);

export const getEditorialSignals = tool(
  ({ limit }) => callConvex("getEditorialSignals", { limit }),
  {
    name: "get_editorial_signals",
    description:
      "Fetch high-yield and low-yield concept clusters from the editorial graph.",
    schema: z.object({
      limit: z.number().int().positive().max(100).optional(),
    }),
  },
);

export const getRecentRecipes = tool(
  ({ limit }) => callConvex("getRecentRecipes", { limit }),
  {
    name: "get_recent_recipes",
    description:
      "Fetch recent composition recipes with parameters, DAW checklists, and protocols.",
    schema: z.object({
      limit: z.number().int().positive().max(100).optional(),
    }),
  },
);

export const getRecommendedActions = tool(
  () => callConvex("getRecommendedActions", {}),
  {
    name: "get_recommended_actions",
    description:
      "Fetch deterministic recommended action candidates from the current campaign scope.",
    schema: z.object({}),
  },
);

export const searchSourcesByConcept = tool(
  ({ conceptName, limit }) =>
    callConvex("searchSourcesByConcept", { conceptName, limit }),
  {
    name: "search_sources_by_concept",
    description:
      "Find source metadata linked to a concept name. Raw text is intentionally omitted.",
    schema: z.object({
      conceptName: z.string().min(1),
      limit: z.number().int().positive().max(100).optional(),
    }),
  },
);

export const createAgentRun = tool(
  ({ graphName, input, traceUrl }) =>
    callConvex("createAgentRun", { graphName, input, traceUrl }),
  {
    name: "create_agent_run",
    description:
      "Create an audit-only Convex agent run record and mark it running. Does not mutate research data.",
    schema: z.object({
      graphName: z.string().min(1),
      input: z.unknown().optional(),
      traceUrl: z.string().url().optional(),
    }),
  },
);

export const claimNextPendingRun = tool(
  ({ workerId, graphName }) =>
    callConvex("claimNextPendingRun", { workerId, graphName }),
  {
    name: "claim_next_pending_run",
    description:
      "Atomically claim the oldest queued Convex agent run for a worker, flipping it to running. Returns {runId, graphName, input, status} or null when the queue is empty. Audit-only lifecycle write; does not mutate research data.",
    schema: z.object({
      workerId: z.string().min(1),
      graphName: z.string().min(1).optional(),
    }),
  },
);

export const getAgentRun = tool(
  ({ runId }) => callConvex("getAgentRun", { runId }),
  {
    name: "get_agent_run",
    description:
      "Fetch the full Convex agent run document (including raw input) by id for status polling. Audit-only read.",
    schema: z.object({ runId: z.string().min(1) }),
  },
);

export const appendAgentRunEvent = tool(
  ({ runId, kind, message, payload }) =>
    callConvex("appendAgentRunEvent", { runId, kind, message, payload }),
  {
    name: "append_agent_run_event",
    description:
      "Append an audit-only lifecycle event to a Convex agent run. Does not mutate research data.",
    schema: z.object({
      runId: z.string().min(1),
      kind: z.enum([
        "tool_call",
        "decision",
        "draft_write",
        "error",
        "review_request",
        "status",
        "node",
      ]),
      message: z.string().min(1),
      payload: z.unknown().optional(),
    }),
  },
);

export const markAgentRunCompleted = tool(
  ({ runId, summary, traceUrl }) =>
    callConvex("markAgentRunCompleted", { runId, summary, traceUrl }),
  {
    name: "mark_agent_run_completed",
    description:
      "Mark an audit-only Convex agent run completed. Does not mutate research data.",
    schema: z.object({
      runId: z.string().min(1),
      summary: z.string().optional(),
      traceUrl: z.string().url().optional(),
    }),
  },
);

export const markAgentRunNeedsReview = tool(
  ({ runId, summary, reviewDraft }) =>
    callConvex("markAgentRunNeedsReview", { runId, summary, reviewDraft }),
  {
    name: "mark_agent_run_needs_review",
    description:
      "Mark an audit-only Convex agent run as needs_review after producing a human-review draft. Does not mutate research data.",
    schema: z.object({
      runId: z.string().min(1),
      summary: z.string().optional(),
      reviewDraft: z
        .object({
          kind: z.enum(["dry_run_summary", "hypothesis_draft", "recipe_draft"]),
          title: z.string(),
          summary: z.string(),
          candidateIds: z.array(z.string()),
          needsReview: z.boolean(),
        })
        .optional(),
    }),
  },
);

export const createAgentReviewDraft = tool(
  ({ agentRunId, draft }) =>
    callConvex("createAgentReviewDraft", { agentRunId, draft }),
  {
    name: "create_agent_review_draft",
    description:
      "Persist a sanitized human-review draft linked to an agent run. Creates an agentReviewDraft row and audit event; does not publish research artifacts.",
    schema: z.object({
      agentRunId: z.string().min(1),
      draft: z.object({
        kind: z.enum(["hypothesis_draft", "recipe_draft"]),
        title: z.string(),
        summary: z.string(),
        candidateIds: z.array(z.string()).min(1),
        needsReview: z.literal(true),
        // Optional structured, promotable payload. Kept loose here (the Convex
        // action takes draft:v.any() and createFromAgentRun validates the exact
        // discriminated shape + enforces whyThisMatters server-side).
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
    }),
  },
);

export const markAgentRunFailed = tool(
  ({ runId, summary, error, traceUrl }) =>
    callConvex("markAgentRunFailed", { runId, summary, error, traceUrl }),
  {
    name: "mark_agent_run_failed",
    description:
      "Mark an audit-only Convex agent run failed and optionally record sanitized error details. Does not mutate research data.",
    schema: z.object({
      runId: z.string().min(1),
      summary: z.string().optional(),
      error: z.unknown().optional(),
      traceUrl: z.string().url().optional(),
    }),
  },
);

export const convexTools = [
  listRecentExtractions,
  getExtraction,
  listRecentHypotheses,
  listActiveTheses,
  listFailureArchive,
  getEditorialSignals,
  getRecentRecipes,
  getRecommendedActions,
  searchSourcesByConcept,
  createAgentRun,
  getAgentRun,
  appendAgentRunEvent,
  markAgentRunCompleted,
  markAgentRunNeedsReview,
  createAgentReviewDraft,
  markAgentRunFailed,
];

export { stripLargeTextFields };
