import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  appendRemoteAuditEvent,
  type ToolCaller,
} from "../graphs/shared/audit.js";
import { redactError } from "../shared/redactError.js";
import { callConvex } from "./convexTools.js";

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";
const FIRECRAWL_SEARCH_TIMEOUT_MS = 15_000;
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

type FirecrawlResult = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  markdown?: unknown;
};

function mapResults(payload: unknown, maxResults: number): WebSearchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return [];
  const results = (data as { web?: unknown }).web;
  if (!Array.isArray(results)) return [];
  return results
    .flatMap((entry): WebSearchResult[] => {
      if (!entry || typeof entry !== "object") return [];
      const result = entry as FirecrawlResult;
      const snippet =
        typeof result.description === "string" && result.description
          ? result.description
          : typeof result.markdown === "string"
            ? result.markdown
            : undefined;
      if (
        typeof result.title !== "string" ||
        typeof result.url !== "string" ||
        !snippet
      ) {
        return [];
      }
      return [
        {
          title: result.title,
          url: result.url,
          snippet,
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
    const auditSearch = async (
      outcome:
        | { status: "ok"; returned: number }
        | { status: "failed"; error: string },
    ) =>
      await appendRemoteAuditEvent(
        callTool,
        context.agentRunId,
        "tool_call",
        outcome.status === "ok"
          ? "Searched Firecrawl for source-scout candidates"
          : "Firecrawl search failed; source-scout skipped query",
        {
          query: args.query,
          ...(context.targetGap ? { targetGap: context.targetGap } : {}),
          requested: maxResults,
          returned: outcome.status === "ok" ? outcome.returned : 0,
          status: outcome.status,
          ...(outcome.status === "failed" ? { error: outcome.error } : {}),
        },
      );
    try {
      const apiKey = configuredApiKey ?? process.env.FIRECRAWL_API_KEY;
      if (!apiKey) throw new Error("FIRECRAWL_API_KEY is required");
      const controller = new AbortController();
      const timeout = setTimeout(
        () =>
          controller.abort(
            new Error(
              `Firecrawl search timed out after ${FIRECRAWL_SEARCH_TIMEOUT_MS}ms`,
            ),
          ),
        FIRECRAWL_SEARCH_TIMEOUT_MS,
      );
      let response: Response;
      try {
        response = await fetchImpl(FIRECRAWL_SEARCH_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            query: args.query,
            limit: maxResults,
            sources: ["web"],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 240);
        throw new Error(
          `Firecrawl search failed with ${response.status}${detail ? `: ${detail}` : ""}`,
        );
      }
      const results = mapResults(await response.json(), maxResults);
      await auditSearch({ status: "ok", returned: results.length });
      return results;
    } catch (error) {
      const message = redactError(error);
      console.warn(
        "[source-scout] Firecrawl search failed; skipping query:",
        message,
      );
      await auditSearch({ status: "failed", error: message });
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
      "Search the web with Firecrawl for source-scout candidates. Provider failures return no results.",
    schema: webSearchInputSchema,
  },
);
