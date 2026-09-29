import {
  SCOUTED_TEXT_MAX_CHARS,
  SCOUTED_TEXT_MIN_CHARS,
} from "../../../convex/shared/agentContract.js";
import { redactError } from "../shared/redactError.js";

const DEFAULT_CRAWL4AI_URL = "https://crawl4ai.rproj.art";
const CRAWL_TIMEOUT_MS = 40_000;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type CrawledPage = { text: string; provider: "crawl4ai" };

function isPublicPage(rawUrl: string): boolean {
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
    return !/\.pdf(?:$|[?#])/i.test(url.pathname);
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

// Never end on a lone high surrogate: Convex rejects ill-formed strings.
function truncate(text: string, max: number): string {
  const cut = text.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

export function createCrawlPage(
  deps: {
    apiToken?: string;
    baseUrl?: string;
    fetchImpl?: FetchLike;
    egressGuarded?: boolean;
  } = {},
) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  return async (url: string): Promise<CrawledPage | null> => {
    // The crawler resolves DNS and follows page redirects in its own network.
    // Hostname checks here cannot provide an SSRF boundary. Fail closed until
    // its deployment blocks private/reserved destinations on every hop.
    if (!(deps.egressGuarded ?? process.env.CRAWL4AI_EGRESS_GUARDED === "true"))
      return null;
    if (!isPublicPage(url)) return null;
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
            params: { cache_mode: "bypass" },
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`Crawl4AI returned HTTP ${response.status}`);
      }
      const payload: unknown = await response.json();
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
      const clean = markdownText("markdown" in result ? result.markdown : "");
      if (
        clean.length < SCOUTED_TEXT_MIN_CHARS ||
        /^(?:just a moment|attention required|access denied|captcha)\b/i.test(
          clean.replace(/^#+\s*/, ""),
        )
      )
        return null;
      return {
        text: truncate(clean, SCOUTED_TEXT_MAX_CHARS),
        provider: "crawl4ai",
      };
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
