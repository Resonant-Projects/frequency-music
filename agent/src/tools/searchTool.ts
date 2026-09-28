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
const RESEARCH_SEARCH_TIMEOUT_MS = 8_000;
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function doiUrl(value: unknown): string | undefined {
  const raw = text(value)?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return raw && /^10\.\d{4,9}\/\S+$/i.test(raw)
    ? `https://doi.org/${raw}`
    : undefined;
}

function yearDate(value: unknown): string | undefined {
  const year = typeof value === "number" ? value : Number(value);
  return Number.isInteger(year) && year >= 1500 && year <= 2100
    ? `${year}-01-01`
    : undefined;
}

function abstractText(value: unknown): string | undefined {
  const positions: Array<[number, string]> = [];
  for (const [word, offsets] of Object.entries(record(value))) {
    if (!Array.isArray(offsets)) continue;
    for (const offset of offsets) {
      if (Number.isInteger(offset) && offset >= 0 && offset < 5000)
        positions.push([offset, word]);
    }
  }
  return text(
    positions
      .sort((a, b) => a[0] - b[0])
      .map(([, word]) => word)
      .join(" "),
  )?.slice(0, 1000);
}

function mapOpenAlex(payload: unknown, limit: number): WebSearchResult[] {
  const works = record(payload).results;
  if (!Array.isArray(works)) return [];
  return works
    .flatMap((entry): WebSearchResult[] => {
      const work = record(entry);
      const title = text(work.title);
      const url =
        doiUrl(work.doi) ??
        text(record(work.primary_location).landing_page_url) ??
        text(work.id);
      const snippet = abstractText(work.abstract_inverted_index) ?? title;
      if (!title || !url || !snippet) return [];
      const publishedAt = yearDate(work.publication_year);
      return [{ title, url, snippet, ...(publishedAt ? { publishedAt } : {}) }];
    })
    .slice(0, limit);
}

function mapEuropePmc(payload: unknown, limit: number): WebSearchResult[] {
  const works = record(record(payload).resultList).result;
  if (!Array.isArray(works)) return [];
  return works
    .flatMap((entry): WebSearchResult[] => {
      const work = record(entry);
      const title = text(work.title);
      const id = text(work.id);
      const source = text(work.source);
      const url =
        doiUrl(work.doi) ??
        (id && source
          ? `https://europepmc.org/article/${encodeURIComponent(source)}/${encodeURIComponent(id)}`
          : undefined);
      const snippet =
        text(work.abstractText)
          ?.replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 1000) || title;
      if (!title || !url || !snippet) return [];
      const publishedAt = yearDate(work.pubYear);
      return [{ title, url, snippet, ...(publishedAt ? { publishedAt } : {}) }];
    })
    .slice(0, limit);
}

function canonicalKey(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.toLowerCase() === "doi.org" ||
      parsed.hostname.toLowerCase() === "dx.doi.org"
    )
      return `doi:${decodeURIComponent(parsed.pathname).replace(/^\//, "").toLowerCase()}`;
    parsed.hash = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return `url:${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
  } catch {
    return `url:${url}`;
  }
}

type ProviderOutcome = {
  status: "ok" | "failed";
  returned: number;
  error?: string;
};

async function fetchResearch(
  fetchImpl: FetchLike,
  provider: "OpenAlex" | "Europe PMC",
  url: string,
  map: (payload: unknown, limit: number) => WebSearchResult[],
  limit: number,
): Promise<{ results: WebSearchResult[]; outcome: ProviderOutcome }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const payload = await Promise.race([
      (async () => {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok)
          throw new Error(`${provider} search failed with ${response.status}`);
        return response.json();
      })(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error(
            `${provider} search timed out after ${RESEARCH_SEARCH_TIMEOUT_MS}ms`,
          );
          controller.abort(error);
          reject(error);
        }, RESEARCH_SEARCH_TIMEOUT_MS);
      }),
    ]);
    const results = map(payload, limit);
    return { results, outcome: { status: "ok", returned: results.length } };
  } catch (error) {
    const message = redactError(error);
    console.warn(`[source-scout] ${provider} search failed:`, message);
    return {
      results: [],
      outcome: { status: "failed", returned: 0, error: message },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
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
    const providers: Record<string, ProviderOutcome> = {};
    let firecrawlResults: WebSearchResult[] = [];
    try {
      const apiKey = configuredApiKey ?? process.env.FIRECRAWL_API_KEY;
      if (!apiKey) throw new Error("FIRECRAWL_API_KEY is required");
      const controller = new AbortController();
      let rejectTimeout!: (reason: Error) => void;
      const deadline = new Promise<never>((_resolve, reject) => {
        rejectTimeout = reject;
      });
      const timeout = setTimeout(() => {
        const error = new Error(
          `Firecrawl search timed out after ${FIRECRAWL_SEARCH_TIMEOUT_MS}ms`,
        );
        controller.abort(error);
        rejectTimeout(error);
      }, FIRECRAWL_SEARCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await Promise.race([
          fetchImpl(FIRECRAWL_SEARCH_URL, {
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
          }),
          deadline,
        ]);
        if (!response.ok) {
          throw new Error(`Firecrawl search failed with ${response.status}`);
        }
        firecrawlResults = mapResults(
          await Promise.race([response.json(), deadline]),
          maxResults,
        );
      } finally {
        clearTimeout(timeout);
      }
      providers.firecrawl = { status: "ok", returned: firecrawlResults.length };
    } catch (error) {
      const message = redactError(error);
      if (message !== "FIRECRAWL_API_KEY is required")
        console.warn(
          "[source-scout] Firecrawl search failed; skipping provider:",
          message,
        );
      providers.firecrawl = { status: "failed", returned: 0, error: message };
    }

    const openAlexUrl = new URL("https://api.openalex.org/works");
    openAlexUrl.searchParams.set("search", args.query);
    openAlexUrl.searchParams.set("per_page", String(maxResults));
    openAlexUrl.searchParams.set(
      "select",
      "id,title,doi,publication_year,abstract_inverted_index,primary_location",
    );
    const europePmcUrl = new URL(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
    );
    europePmcUrl.searchParams.set("query", args.query);
    europePmcUrl.searchParams.set("format", "json");
    europePmcUrl.searchParams.set("pageSize", String(maxResults));
    europePmcUrl.searchParams.set("resultType", "core");
    const [openalex, europePmc] = await Promise.all([
      fetchResearch(
        fetchImpl,
        "OpenAlex",
        openAlexUrl.toString(),
        mapOpenAlex,
        maxResults,
      ),
      fetchResearch(
        fetchImpl,
        "Europe PMC",
        europePmcUrl.toString(),
        mapEuropePmc,
        maxResults,
      ),
    ]);
    providers.openalex = openalex.outcome;
    providers.europePmc = europePmc.outcome;
    const results: WebSearchResult[] = [];
    const resultProviders: Array<{ url: string; provider: string }> = [];
    const seen = new Set<string>();
    // Interleave provider rankings so a full web result page cannot crowd out
    // paper metadata. Preserve each provider's own ordering and the global cap.
    const ranked = [firecrawlResults, openalex.results, europePmc.results];
    const names = ["firecrawl", "openalex", "europePmc"] as const;
    for (
      let rank = 0;
      rank < maxResults && results.length < maxResults;
      rank++
    ) {
      for (
        let providerIndex = 0;
        providerIndex < ranked.length;
        providerIndex++
      ) {
        const result = ranked[providerIndex]?.[rank];
        if (!result) continue;
        const key = canonicalKey(result.url);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(result);
        resultProviders.push({
          url: result.url,
          provider: names[providerIndex]!,
        });
        if (results.length === maxResults) break;
      }
    }
    const status = Object.values(providers).some(
      (provider) => provider.status === "ok",
    )
      ? "ok"
      : "failed";
    await appendRemoteAuditEvent(
      callTool,
      context.agentRunId,
      "tool_call",
      status === "ok"
        ? "Searched federated providers for source-scout candidates"
        : "Source-scout search providers failed",
      {
        query: args.query,
        ...(context.targetGap ? { targetGap: context.targetGap } : {}),
        requested: maxResults,
        returned: results.length,
        status,
        providers,
        resultProviders,
      },
    );
    return results;
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
      "Search Firecrawl, OpenAlex, and Europe PMC for source-scout candidates. Research providers work without API keys; individual provider failures do not discard other results.",
    schema: webSearchInputSchema,
  },
);
