import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  appendRemoteAuditEvent,
  type ToolCaller,
} from "../graphs/shared/audit.js";
import { redactError } from "../shared/redactError.js";
import { callConvex } from "./convexTools.js";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const DEFAULT_MAX_RESULTS = 5;
const MAX_RESULTS = 10;

export const webSearchInputSchema = z.object({
  query: z.string().trim().min(1),
  maxResults: z.number().int().positive().max(MAX_RESULTS).optional(),
});

export type WebSearchInput = z.infer<typeof webSearchInputSchema>;
export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
};

type SearchContext = {
  agentRunId?: string;
  targetGap?: string;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  published_date?: unknown;
};

function mapResults(payload: unknown, maxResults: number): WebSearchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results
    .flatMap((entry): WebSearchResult[] => {
      if (!entry || typeof entry !== "object") return [];
      const result = entry as TavilyResult;
      if (
        typeof result.title !== "string" ||
        typeof result.url !== "string" ||
        typeof result.content !== "string"
      ) {
        return [];
      }
      return [
        {
          title: result.title,
          url: result.url,
          snippet: result.content,
          ...(typeof result.published_date === "string" && result.published_date
            ? { publishedAt: result.published_date }
            : {}),
        },
      ];
    })
    .slice(0, maxResults);
}

export function createWebSearch(
  dependencies: {
    apiKey?: string;
    fetchImpl?: FetchLike;
    callTool?: ToolCaller;
  } = {},
) {
  const configuredApiKey = dependencies.apiKey;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const callTool = dependencies.callTool ?? callConvex;

  return async (
    input: WebSearchInput,
    context: SearchContext = {},
  ): Promise<WebSearchResult[]> => {
    const args = webSearchInputSchema.parse(input);
    const maxResults = args.maxResults ?? DEFAULT_MAX_RESULTS;
    try {
      const apiKey = configuredApiKey ?? process.env.TAVILY_API_KEY;
      if (!apiKey) throw new Error("TAVILY_API_KEY is required");
      const response = await fetchImpl(TAVILY_SEARCH_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          max_results: maxResults,
          search_depth: "basic",
          include_answer: false,
          include_raw_content: false,
        }),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 240);
        throw new Error(
          `Tavily search failed with ${response.status}${detail ? `: ${detail}` : ""}`,
        );
      }
      const results = mapResults(await response.json(), maxResults);
      await appendRemoteAuditEvent(
        callTool,
        context.agentRunId,
        "tool_call",
        "Searched Tavily for source-scout candidates",
        {
          query: args.query,
          ...(context.targetGap ? { targetGap: context.targetGap } : {}),
          requested: maxResults,
          returned: results.length,
          status: "ok",
        },
      );
      return results;
    } catch (error) {
      const message = redactError(error);
      console.warn(
        "[source-scout] Tavily search failed; skipping query:",
        message,
      );
      await appendRemoteAuditEvent(
        callTool,
        context.agentRunId,
        "tool_call",
        "Tavily search failed; source-scout skipped query",
        {
          query: args.query,
          ...(context.targetGap ? { targetGap: context.targetGap } : {}),
          requested: maxResults,
          returned: 0,
          status: "failed",
          error: message,
        },
      );
      return [];
    }
  };
}

const defaultWebSearch = createWebSearch();

export const webSearchTool = tool(
  (input, config) =>
    defaultWebSearch(input, {
      agentRunId:
        typeof config?.configurable?.agentRunId === "string"
          ? config.configurable.agentRunId
          : undefined,
      targetGap:
        typeof config?.configurable?.targetGap === "string"
          ? config.configurable.targetGap
          : undefined,
    }),
  {
    name: "web_search",
    description:
      "Search the web with Tavily for source-scout candidates. Provider failures return no results.",
    schema: webSearchInputSchema,
  },
);
