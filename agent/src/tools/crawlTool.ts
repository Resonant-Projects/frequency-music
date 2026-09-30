import {
  looksLikeBotChallenge,
  SCOUTED_TEXT_MAX_CHARS,
  SCOUTED_TEXT_MIN_CHARS,
  type ScoutedContentProvider,
} from "../../../convex/shared/agentContract.js";
import { redactError } from "../shared/redactError.js";
import { isFirecrawlCloud } from "./searchTool.js";

const DEFAULT_CRAWL4AI_URL = "https://crawl4ai.rproj.art";
const CRAWL_TIMEOUT_MS = 40_000;
const FIRECRAWL_SCRAPE_TIMEOUT_MS = 45_000;
// A crawl result also carries page HTML and link lists; images are excluded at
// the crawler. Refuse anything larger before it is buffered and parsed.
const MAX_CRAWL_RESPONSE_BYTES = 16 * 1024 * 1024;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type CrawledPage = { text: string; provider: ScoutedContentProvider };
type PageFetcher = (url: string) => Promise<CrawledPage | null>;

function isPdf(rawUrl: string): boolean {
  try {
    return /\.pdf(?:$|[?#])/i.test(new URL(rawUrl).pathname);
  } catch {
    return false;
  }
}

function isPublicUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return false;
    const host = url.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "");
    if (host === "localhost" || /\.(localhost|local|internal)$/.test(host))
      return false;
    if (host.includes(":")) return false; // Refuse IPv6 literals, including mapped private addresses.
    const octets = host.split(".");
    if (
      octets.length === 4 &&
      octets.every((s) => /^\d{1,3}$/.test(s) && Number(s) <= 255)
    ) {
      const [a, b] = octets.map(Number);
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Crawl4AI returns fit_markdown as "" unless a content filter ran, so an empty
// filtered view must fall through to the full page markdown.
function markdownText(markdown: unknown): string {
  if (typeof markdown === "string") return markdown.trim();
  if (!markdown || typeof markdown !== "object") return "";
  for (const key of ["fit_markdown", "raw_markdown"] as const) {
    const value =
      key in markdown ? (markdown as Record<string, unknown>)[key] : "";
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function readCappedJson(
  response: Response,
  service: string,
): Promise<unknown> {
  const tooLarge = () =>
    new Error(`${service} response exceeded ${MAX_CRAWL_RESPONSE_BYTES} bytes`);
  if (
    Number(response.headers.get("content-length") ?? 0) >
    MAX_CRAWL_RESPONSE_BYTES
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  if (!response.body) return JSON.parse(await response.text());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CRAWL_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// Never end on a lone high surrogate: Convex rejects ill-formed strings.
function truncate(text: string, max: number): string {
  const cut = text.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

// Text too thin for Extraction, or a bot wall reported as a page, is dropped
// so the Source stays URL-only and a later run can capture it.
function acceptedPage(
  markdown: string,
  provider: ScoutedContentProvider,
): CrawledPage | null {
  const clean = markdown.trim();
  if (clean.length < SCOUTED_TEXT_MIN_CHARS || looksLikeBotChallenge(clean))
    return null;
  return { text: truncate(clean, SCOUTED_TEXT_MAX_CHARS), provider };
}

export function createCrawl4aiPage(
  deps: {
    apiToken?: string;
    baseUrl?: string;
    fetchImpl?: FetchLike;
    egressGuarded?: boolean;
  } = {},
): PageFetcher {
  const fetchImpl = deps.fetchImpl ?? fetch;
  return async (url: string): Promise<CrawledPage | null> => {
    // The crawler resolves DNS and follows page redirects in its own network.
    // Hostname checks here cannot provide an SSRF boundary. Fail closed until
    // its deployment blocks private/reserved destinations on every hop.
    if (!(deps.egressGuarded ?? process.env.CRAWL4AI_EGRESS_GUARDED === "true"))
      return null;
    if (!isPublicUrl(url) || isPdf(url)) return null;
    const token = deps.apiToken ?? process.env.CRAWL4AI_API_TOKEN;
    if (!token) return null;
    const baseUrl =
      deps.baseUrl ?? process.env.CRAWL4AI_URL ?? DEFAULT_CRAWL4AI_URL;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/crawl`, {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          urls: [url],
          crawler_config: {
            type: "CrawlerRunConfig",
            params: { cache_mode: "bypass", exclude_all_images: true },
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`Crawl4AI returned HTTP ${response.status}`);
      }
      const payload = await readCappedJson(response, "Crawl4AI");
      const rawResults =
        payload && typeof payload === "object" && "results" in payload
          ? payload.results
          : undefined;
      const result: unknown = Array.isArray(rawResults) ? rawResults[0] : null;
      if (
        !result ||
        typeof result !== "object" ||
        !("success" in result) ||
        result.success !== true
      )
        return null;
      if (
        "status_code" in result &&
        typeof result.status_code === "number" &&
        result.status_code >= 400
      )
        return null;
      return acceptedPage(
        markdownText("markdown" in result ? result.markdown : ""),
        "crawl4ai",
      );
    } catch (error) {
      console.warn(
        "[source-scout] Crawl4AI content fetch failed:",
        redactError(error),
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };
}

/**
 * The Lab's self-hosted Firecrawl scrape: PDFs, and pages Crawl4AI could not
 * capture. It never calls Firecrawl Cloud, which is paid and receives the key.
 */
export function createFirecrawlPage(
  deps: {
    baseUrl?: string;
    fetchImpl?: FetchLike;
    egressGuarded?: boolean;
  } = {},
): PageFetcher {
  const fetchImpl = deps.fetchImpl ?? fetch;
  return async (url: string): Promise<CrawledPage | null> => {
    // Like Crawl4AI, Firecrawl fetches in its own network. Its egress proxy
    // must be verified to block private targets before this is enabled.
    if (
      !(
        deps.egressGuarded ??
        process.env.FIRECRAWL_SCRAPE_EGRESS_GUARDED === "true"
      )
    )
      return null;
    if (!isPublicUrl(url)) return null;
    const baseUrl = (deps.baseUrl ?? process.env.FIRECRAWL_API_URL ?? "")
      .trim()
      .replace(/\/$/, "");
    if (!baseUrl || isFirecrawlCloud(baseUrl)) return null;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FIRECRAWL_SCRAPE_TIMEOUT_MS,
    );
    try {
      const response = await fetchImpl(`${baseUrl}/v2/scrape`, {
        method: "POST",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          removeBase64Images: true,
          skipTlsVerification: false,
          timeout: FIRECRAWL_SCRAPE_TIMEOUT_MS - 5_000,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`Firecrawl returned HTTP ${response.status}`);
      }
      const payload = await readCappedJson(response, "Firecrawl");
      if (
        !payload ||
        typeof payload !== "object" ||
        !("success" in payload) ||
        payload.success !== true ||
        !("data" in payload) ||
        !payload.data ||
        typeof payload.data !== "object"
      )
        return null;
      const data = payload.data as { markdown?: unknown; metadata?: unknown };
      const metadata = (data.metadata ?? {}) as { statusCode?: unknown };
      if (typeof metadata.statusCode === "number" && metadata.statusCode >= 400)
        return null;
      return acceptedPage(
        typeof data.markdown === "string" ? data.markdown : "",
        "firecrawl",
      );
    } catch (error) {
      console.warn(
        "[source-scout] Firecrawl content fetch failed:",
        redactError(error),
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };
}

/**
 * Source Scout page text: Crawl4AI first for HTML, then the Lab Firecrawl for
 * anything Crawl4AI could not capture and for PDFs, which Crawl4AI skips.
 */
export function createCrawlPage(
  deps: {
    apiToken?: string;
    baseUrl?: string;
    fetchImpl?: FetchLike;
    egressGuarded?: boolean;
    fallback?: PageFetcher;
  } = {},
): PageFetcher {
  const crawl4ai = createCrawl4aiPage(deps);
  const fallback =
    deps.fallback ?? createFirecrawlPage({ fetchImpl: deps.fetchImpl });
  return async (url: string): Promise<CrawledPage | null> => {
    if (!isPublicUrl(url)) return null;
    if (!isPdf(url)) {
      const page = await crawl4ai(url);
      if (page) return page;
    }
    return await fallback(url);
  };
}
