import { redactError } from "../shared/redactError.js";

const DEFAULT_CRAWL4AI_URL = "https://crawl4ai.rproj.art";
const MAX_SCOUT_TEXT_CHARS = 30_000;
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

export function createCrawlPage(
  deps: { apiToken?: string; baseUrl?: string; fetchImpl?: FetchLike } = {},
) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  return async (url: string): Promise<CrawledPage | null> => {
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
      if (!response.ok)
        throw new Error(`Crawl4AI returned HTTP ${response.status}`);
      const payload = (await response.json()) as {
        results?: unknown;
        success?: unknown;
      };
      const result = Array.isArray(payload.results) ? payload.results[0] : null;
      if (!result || result.success !== true || result.status_code >= 400)
        return null;
      const markdown = result.markdown;
      const text =
        typeof markdown === "string"
          ? markdown
          : markdown && typeof markdown === "object"
            ? markdown.fit_markdown || markdown.raw_markdown
            : "";
      if (typeof text !== "string") return null;
      const clean = text.trim();
      if (
        clean.length < 100 ||
        /^(?:just a moment|attention required|access denied|captcha)\b/i.test(
          clean.replace(/^#+\s*/, ""),
        )
      )
        return null;
      return {
        text: clean.slice(0, MAX_SCOUT_TEXT_CHARS),
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
