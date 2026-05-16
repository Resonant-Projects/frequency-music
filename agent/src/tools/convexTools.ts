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

async function callConvex<T>(
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
];

export { stripLargeTextFields };
