import {
  looksLikeBotChallenge,
  SCOUTED_TEXT_MAX_CHARS,
  SCOUTED_TEXT_MIN_CHARS,
  type ScoutedContentProvider,
} from "../../../convex/shared/agentContract.js";
import { redactError } from "../shared/redactError.js";
import { isFirecrawlCloud, reconstructAbstract } from "./searchTool.js";

const DEFAULT_CRAWL4AI_URL = "https://crawl4ai.rproj.art";
const CRAWL_TIMEOUT_MS = 40_000;
const FIRECRAWL_SCRAPE_TIMEOUT_MS = 45_000;
const OPENALEX_TIMEOUT_MS = 10_000;
const OPENALEX_WORKS_URL = "https://api.openalex.org/works";
// Below this many words a title can coincide with an unrelated work.
const MIN_TITLE_MATCH_WORDS = 4;
// A title search with more matches than one page cannot prove uniqueness.
const TITLE_SEARCH_PAGE_SIZE = 25;
// A crawl result also carries page HTML and link lists; images are excluded at
// the crawler. Refuse anything larger before it is buffered and parsed.
const MAX_CRAWL_RESPONSE_BYTES = 16 * 1024 * 1024;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type CrawledPage = { text: string; provider: ScoutedContentProvider };
/** What the Scout already knows about a candidate, for lookups that need it. */
export type PageHint = { title?: string };
type PageFetcher = (
  url: string,
  hint?: PageHint,
) => Promise<CrawledPage | null>;

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
    abstractFallback?: PageFetcher;
  } = {},
): PageFetcher {
  const crawl4ai = createCrawl4aiPage(deps);
  const fallback =
    deps.fallback ?? createFirecrawlPage({ fetchImpl: deps.fetchImpl });
  const abstractFallback =
    deps.abstractFallback ??
    createOpenAlexAbstract({ fetchImpl: deps.fetchImpl });
  return async (url: string, hint?: PageHint): Promise<CrawledPage | null> => {
    if (!isPublicUrl(url)) return null;
    if (!isPdf(url)) {
      const page = await crawl4ai(url);
      if (page) return page;
    }
    // Bot walls (JSTOR, DataDome) defeat both crawlers; a scholarly work's
    // abstract from OpenAlex is then the best available text.
    return (await fallback(url, hint)) ?? (await abstractFallback(url, hint));
  };
}

// Search results often decorate scholarly titles with the hosting site
// ("The Geometry of Musical Chords - ResearchGate", "(PDF) ..."), which
// defeats an exact title match; remove those decorations first.
const SITE_TITLE_SUFFIX =
  /\s*[|\-–—]\s*(?:ResearchGate|Request PDF|Academia\.edu|JSTOR|Semantic Scholar|ScienceDirect|SpringerLink|PubMed|PhilPapers|Google Scholar)\s*$/i;

export function undecoratedTitle(value: string): string {
  let title = value.trim().replace(/^\((?:PDF|DOC|PPT)\)\s*/i, "");
  while (SITE_TITLE_SUFFIX.test(title)) {
    title = title.replace(SITE_TITLE_SUFFIX, "");
  }
  return title.trim();
}

// OpenAlex title search does not fold accents ("klänge" and "klange" match
// different works), so the query keeps them and drops only punctuation, which
// also keeps commas out of the filter syntax.
export function titleSearchTerms(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

// For comparing titles: drop accents before splitting on punctuation, so
// "Étude" stays one word, and keep letters of every script.
export function normalizedTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The DOI a candidate URL names: a doi.org link, a publisher /doi/ path, or a
 * JSTOR stable page, whose DOI is 10.2307/<stable id>.
 */
export function doiForUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const doi = /^10\.\d{4,9}\/\S+$/;
  if (host === "doi.org" || host === "dx.doi.org") {
    const name = path.replace(/^\//, "");
    return doi.test(name) ? name : null;
  }
  if (host === "jstor.org") {
    const stable = /^\/stable\/(?:pdf\/)?(\d+)(?:\.pdf)?\/?$/.exec(path);
    if (stable) return `10.2307/${stable[1]}`;
    const named = /^\/stable\/(10\.\d{4,9}\/[^/]+)\/?$/.exec(path);
    return named?.[1] ?? null;
  }
  const publisher =
    /\/doi\/(?:(?:abs|full|pdf|epdf|epub|book|reader)\/)?(10\.\d{4,9}\/.+?)\/?$/.exec(
      path,
    );
  const name = publisher?.[1]?.replace(/\.pdf$/i, "");
  return name && doi.test(name) ? name : null;
}

type OpenAlexWork = {
  id?: unknown;
  doi?: unknown;
  title?: unknown;
  publication_year?: unknown;
  abstract_inverted_index?: unknown;
};

/**
 * A scholarly work's abstract from OpenAlex, when no crawler could capture
 * the page. The work is found by the URL's DOI, else by an exact, unambiguous
 * title match. The text says it is an abstract, not the full text.
 */
export function createOpenAlexAbstract(
  deps: { fetchImpl?: FetchLike } = {},
): PageFetcher {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const select = "id,doi,title,publication_year,abstract_inverted_index";

  async function getJson(url: URL): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENALEX_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url.toString(), {
        method: "GET",
        redirect: "error",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (response.status === 404) {
        await response.body?.cancel().catch(() => undefined);
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`OpenAlex returned HTTP ${response.status}`);
      }
      return await readCappedJson(response, "OpenAlex");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function byDoi(doi: string): Promise<OpenAlexWork | null> {
    // The DOI is path data: encode characters that would end the path.
    const path = doi.replace(/[%?#\s]/g, encodeURIComponent);
    const url = new URL(`${OPENALEX_WORKS_URL}/doi:${path}`);
    url.searchParams.set("select", select);
    const work = await getJson(url);
    return work && typeof work === "object" ? (work as OpenAlexWork) : null;
  }

  async function byTitle(rawTitle: string): Promise<OpenAlexWork | null> {
    const title = undecoratedTitle(rawTitle);
    const wanted = normalizedTitle(title);
    if (wanted.split(" ").length < MIN_TITLE_MATCH_WORDS) return null;
    const url = new URL(OPENALEX_WORKS_URL);
    url.searchParams.set("filter", `title.search:${titleSearchTerms(title)}`);
    url.searchParams.set("per_page", String(TITLE_SEARCH_PAGE_SIZE));
    url.searchParams.set("select", select);
    const payload = await getJson(url);
    if (!payload || typeof payload !== "object") return null;
    const results = "results" in payload ? payload.results : undefined;
    const meta = "meta" in payload ? payload.meta : undefined;
    const count =
      meta && typeof meta === "object" && "count" in meta ? meta.count : NaN;
    // Uniqueness needs every match: OpenAlex ranks by similarity and
    // citations, so a second exact title could sit on a later page.
    if (
      !Array.isArray(results) ||
      !Number.isInteger(count) ||
      (count as number) > results.length
    )
      return null;
    const exact = (results as OpenAlexWork[]).filter(
      (work) =>
        typeof work.title === "string" &&
        normalizedTitle(work.title) === wanted,
    );
    // Two distinct works with the same title are ambiguous; take neither. A
    // result without a DOI or id counts as its own work, never a duplicate.
    const identities = new Set(
      exact.map((work, index) =>
        typeof work.doi === "string"
          ? work.doi
          : typeof work.id === "string"
            ? work.id
            : `unidentified-${index}`,
      ),
    );
    return identities.size === 1 ? (exact[0] ?? null) : null;
  }

  return async (url: string, hint?: PageHint): Promise<CrawledPage | null> => {
    if (!isPublicUrl(url)) return null;
    try {
      const doi = doiForUrl(url);
      const work =
        (doi ? await byDoi(doi) : null) ??
        (hint?.title ? await byTitle(hint.title) : null);
      if (!work) return null;
      const abstract = reconstructAbstract(work.abstract_inverted_index);
      if (!abstract || abstract.length < SCOUTED_TEXT_MIN_CHARS) return null;
      const id = typeof work.id === "string" ? work.id.split("/").pop() : "";
      const workDoi =
        typeof work.doi === "string"
          ? work.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
          : "";
      const title = typeof work.title === "string" ? work.title : "";
      const year =
        typeof work.publication_year === "number"
          ? ` (${work.publication_year})`
          : "";
      const source = [id, workDoi ? `DOI ${workDoi}` : ""]
        .filter(Boolean)
        .join("; ");
      return acceptedPage(
        `Abstract from OpenAlex (${source}). The full text was not captured.\n\n` +
          `# ${title}${year}\n\n${abstract}`,
        "openalex",
      );
    } catch (error) {
      console.warn(
        "[source-scout] OpenAlex abstract lookup failed:",
        redactError(error),
      );
      return null;
    }
  };
}
