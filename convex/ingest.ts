import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { requireAuth } from "./auth";
import { extractYouTubeVideoId, generateDedupeKey } from "./sourceUtils";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Fetch with a timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const JINA_READER_URL = "https://r.jina.ai";
export const MAX_URL_TEXT_CHARS = 100_000;

export type UrlTextFetchResult =
  | { ok: true; text: string; status: number }
  | { ok: false; error: string; status?: number };

interface UrlTextResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
}

/**
 * Validate a source URL and map it to the Jina Reader endpoint.
 */
export function buildJinaReaderUrl(rawUrl: string): string {
  return `${JINA_READER_URL}/${parseHttpUrl(rawUrl).toString()}`;
}

/**
 * Parse a URL and apply the scheme + embedded-credential checks shared by
 * every outbound-URL helper in this module.
 */
function parseHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("invalid_url: URL is not valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_url: only HTTP and HTTPS URLs are supported");
  }
  if (url.username || url.password) {
    throw new Error("invalid_url: URLs with embedded credentials are rejected");
  }
  return url;
}

/**
 * Validate that a URL is safe for a direct fetch from the Convex runtime and
 * return the parsed URL. This is a parse-time guard only; without DNS
 * resolution it cannot prevent DNS rebinding from a public hostname to a
 * private address.
 */
export function assertPublicHttpUrl(rawUrl: string): URL {
  const url = parseHttpUrl(rawUrl);

  // Strip the optional trailing DNS root dot before comparing: `localhost.`
  // and `printer.local.` resolve identically to their dotless forms but would
  // otherwise slip past the suffix checks below.
  const hostname = url.hostname
    .toLowerCase()
    .replaceAll(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  const isInternalHostname =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal");

  const octets = hostname.split(".");
  const isIpv4Literal =
    octets.length === 4 &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
  const [a, b] = isIpv4Literal ? octets.map(Number) : [];
  const isPrivateIpv4 =
    a !== undefined &&
    b !== undefined &&
    (a === 0 || // 0.0.0.0/8 ("this network") — includes 0.0.0.0 itself
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127));

  const isIpv6Literal = hostname.includes(":");
  const isPrivateIpv6 =
    isIpv6Literal &&
    (hostname === "::" ||
      hostname === "::1" ||
      /^fe[89ab]/.test(hostname) ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      // IPv4-mapped IPv6 (::ffff:a.b.c.d) can smuggle a private IPv4 target
      // past the dotted-quad check on dual-stack hosts; public IPv4 targets
      // have no reason to use the mapped form, so reject it wholesale.
      hostname.startsWith("::ffff:"));

  if (isInternalHostname || isPrivateIpv4 || isPrivateIpv6) {
    throw new Error(
      "blocked_url: refusing to fetch a private or loopback address",
    );
  }

  return url;
}

/**
 * Convert a completed HTTP response into the probe's stable result shape.
 */
export function responseToUrlTextResult(
  response: UrlTextResponse,
  maxChars = MAX_URL_TEXT_CHARS,
): UrlTextFetchResult {
  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    return {
      ok: false,
      error: `http_error: Jina Reader returned HTTP ${response.status}${statusText}`,
      status: response.status,
    };
  }

  const text = response.text.trim();
  if (!text) {
    return {
      ok: false,
      error: "no_text: Jina Reader returned an empty response",
      status: response.status,
    };
  }
  if (text.length > maxChars) {
    return {
      ok: false,
      error: `response_too_large: Jina Reader returned ${text.length} characters (limit ${maxChars})`,
      status: response.status,
    };
  }

  return { ok: true, text, status: response.status };
}

/**
 * Classify validation and fetch failures without exposing unstable stack text.
 */
export function classifyUrlTextFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "timeout: Jina Reader request exceeded 30 seconds";
    }
    if (error.message.startsWith("invalid_url:")) {
      return error.message;
    }
    return `network_error: ${error.message || error.name}`;
  }

  return `unknown_error: ${String(error)}`;
}

// ============================================================================
// RSS FEED POLLING
// ============================================================================

export interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  guid?: string;
  content?: string;
}

export interface ParsedFeed {
  title: string;
  items: RSSItem[];
}

/**
 * Parse RSS/Atom XML into structured items
 */
export function parseRSSXML(xml: string): ParsedFeed {
  // Simple regex-based parser (works for most RSS/Atom feeds)
  const items: RSSItem[] = [];

  // Get feed title
  const feedTitleMatch = xml.match(
    /<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i,
  );
  const feedTitle = feedTitleMatch ? feedTitleMatch[1]!.trim() : "Unknown Feed";

  // Match RSS items or Atom entries
  const itemRegex =
    /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  while (true) {
    const match = itemRegex.exec(xml);
    if (match === null) break;
    const itemXml = (match[1] || match[2])!;

    // Extract fields
    const titleMatch = itemXml.match(
      /<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i,
    );
    const linkMatch = itemXml.match(
      /<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>|<link[^>]*href="([^"]+)"/i,
    );
    const pubDateMatch = itemXml.match(
      /<pubDate[^>]*>(.*?)<\/pubDate>|<published[^>]*>(.*?)<\/published>|<updated[^>]*>(.*?)<\/updated>/i,
    );
    const descMatch = itemXml.match(
      /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>|<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i,
    );
    const guidMatch = itemXml.match(
      /<guid[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/guid>|<id[^>]*>(.*?)<\/id>/i,
    );
    const contentMatch = itemXml.match(
      /<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>|<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i,
    );

    const title = titleMatch ? titleMatch[1]!.trim() : "";
    const link = linkMatch ? (linkMatch[1] || linkMatch[2] || "").trim() : "";

    if (title && link) {
      items.push({
        title,
        link,
        pubDate: pubDateMatch
          ? (pubDateMatch[1] || pubDateMatch[2] || pubDateMatch[3] || "").trim()
          : undefined,
        description: descMatch
          ? (descMatch[1] || descMatch[2] || "").trim()
          : undefined,
        guid: guidMatch
          ? (guidMatch[1] || guidMatch[2] || "").trim()
          : undefined,
        content: contentMatch
          ? (contentMatch[1] || contentMatch[2] || "").trim()
          : undefined,
      });
    }
  }

  return { title: feedTitle, items };
}

/**
 * Strip HTML tags from text
 */
export function stripHtml(html: string): string {
  return html
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Poll a single RSS feed and ingest new items
 */
export const pollFeed = internalAction({
  args: {
    feedId: v.id("feeds"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ processed: number; errors: string[] }> => {
    // Get feed config
    const feed = await ctx.runQuery(api.feeds.get, { id: args.feedId });
    if (!feed || !feed.enabled) {
      return { processed: 0, errors: ["Feed not found or disabled"] };
    }

    const errors: string[] = [];
    let processed = 0;
    let latestItemDate: number | undefined;

    try {
      // Fetch the feed
      const response = await fetchWithTimeout(feed.url, {
        headers: {
          "User-Agent": "ResonantProjects/1.0 (research aggregator)",
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xml = await response.text();
      const parsed = parseRSSXML(xml);

      // Process each item
      for (const item of parsed.items) {
        try {
          // YouTube feed items must carry the canonical youtube identity
          // (yt:videoId) so cron ingests dedupe against the HTTP ingest path.
          const videoId =
            feed.type === "youtube" ? extractYouTubeVideoId(item.link) : null;
          const dedupeKey = videoId
            ? generateDedupeKey("youtube", { youtubeVideoId: videoId })
            : generateDedupeKey("rss", {
                feedUrl: feed.url,
                rssGuid: item.guid,
                canonicalUrl: item.link,
              });

          // Check if already exists
          const existing = await ctx.runQuery(api.sources.getByDedupeKey, {
            dedupeKey,
          });
          if (existing) {
            continue; // Skip duplicates
          }

          // Parse publish date
          let publishedAt: number | undefined;
          if (item.pubDate) {
            const parsedDate = Date.parse(item.pubDate);
            if (!Number.isNaN(parsedDate)) {
              publishedAt = parsedDate;
              if (!latestItemDate || parsedDate > latestItemDate) {
                latestItemDate = parsedDate;
              }
            }
          }

          // Get text content
          const rawText = item.content
            ? stripHtml(item.content)
            : item.description
              ? stripHtml(item.description)
              : undefined;

          // Create source (use internal mutation — no auth needed for cron/internal)
          await ctx.runMutation(internal.sources.upsertExternal, {
            type: feed.type === "youtube" ? "youtube" : "rss",
            title: item.title,
            canonicalUrl: item.link,
            publishedAt,
            feedUrl: feed.url,
            rssGuid: item.guid || item.link,
            rawText,
            tags: ["auto-ingested"],
            metadata: {
              feedName: feed.name,
              feedCategory: feed.category,
            },
            dedupeKey,
          });

          processed++;
        } catch (itemError) {
          errors.push(`Item "${item.title}": ${String(itemError)}`);
        }
      }

      // Update feed last polled timestamp
      await ctx.runMutation(internal.feeds.updateLastPolled, {
        id: args.feedId,
        lastPolledAt: Date.now(),
        lastItemAt: latestItemDate,
      });
    } catch (fetchError) {
      errors.push(`Fetch error: ${String(fetchError)}`);
    }

    return { processed, errors };
  },
});

/**
 * Poll all enabled feeds (public action)
 */
export const pollAllFeeds = action({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: v.object({
    results: v.any(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    results: Record<string, { processed: number; errors: string[] }>;
  }> => {
    await requireAuth(ctx, args);
    const feeds = await ctx.runQuery(api.feeds.listEnabled);
    const results: Record<string, { processed: number; errors: string[] }> = {};

    for (const feed of feeds) {
      try {
        const result = await ctx.runAction(internal.ingest.pollFeed, {
          feedId: feed._id,
        });
        results[feed.name] = result;
      } catch (error) {
        results[feed.name] = {
          processed: 0,
          errors: [`Action error: ${String(error)}`],
        };
      }
    }

    return { results };
  },
});

/**
 * Poll all enabled feeds (internal action for cron)
 */
export const pollAllFeedsInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const feeds = await ctx.runQuery(api.feeds.listEnabled);

    for (const feed of feeds) {
      try {
        await ctx.runAction(internal.ingest.pollFeed, { feedId: feed._id });
      } catch (error) {
        console.error(`Failed to poll feed ${feed.name}:`, error);
      }
    }
  },
});

// ============================================================================
// URL INGESTION
// ============================================================================

/**
 * Probe whether the Convex action runtime can retrieve readable URL text.
 * This action intentionally performs no database writes.
 */
export const fetchUrlText = internalAction({
  args: { url: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      text: v.string(),
      status: v.number(),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
      status: v.optional(v.number()),
    }),
  ),
  handler: async (_ctx, args): Promise<UrlTextFetchResult> => {
    try {
      const response = await fetchWithTimeout(buildJinaReaderUrl(args.url), {
        headers: {
          Accept: "text/plain",
          "User-Agent": "ResonantProjects/1.0 (research aggregator)",
        },
      });
      const text = response.ok ? await response.text() : "";

      return responseToUrlTextResult({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text,
      });
    } catch (error) {
      return { ok: false, error: classifyUrlTextFetchError(error) };
    }
  },
});

/**
 * Ingest a URL by fetching and extracting readable content
 */
export const ingestUrl = action({
  args: {
    url: v.string(),
    tags: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ id: Id<"sources">; created: boolean }> => {
    await requireAuth(ctx, args);
    const safeUrl = assertPublicHttpUrl(args.url);
    // Generate dedupeKey (canonical: keeps query string, matches sources.createFromUrlInput)
    const dedupeKey = generateDedupeKey("url", { canonicalUrl: args.url });

    // Check if already exists
    const existing: Doc<"sources"> | null = await ctx.runQuery(
      api.sources.getByDedupeKey,
      {
        dedupeKey,
      },
    );
    if (existing) {
      return { id: existing._id, created: false };
    }

    // Fetch the page
    // assertPublicHttpUrl only vets the initial URL; following redirects would
    // let a public host bounce this fetch to a loopback or metadata address.
    const response = await fetchWithTimeout(safeUrl.toString(), {
      redirect: "error",
      headers: {
        "User-Agent": "ResonantProjects/1.0 (research aggregator)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]!) : safeUrl.hostname;

    // Extract main content (simplified - could use readability library)
    // For now, just strip HTML from body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const rawText = bodyMatch
      ? stripHtml(bodyMatch[1]!).slice(0, 50000)
      : undefined;

    // Create source
    const result: { id: Id<"sources">; created: boolean } =
      await ctx.runMutation(api.sources.create, {
        type: "url",
        title,
        canonicalUrl: args.url,
        rawText,
        tags: args.tags || [],
        dedupeKey,
        devBypassSecret: args.devBypassSecret,
      });

    return { id: result.id, created: result.created };
  },
});

// ============================================================================
// YOUTUBE INGESTION
// ============================================================================

/**
 * Ingest a YouTube video (metadata only - transcript extraction is separate)
 */
export const ingestYouTube = action({
  args: {
    url: v.string(),
    tags: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    videoId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ id: Id<"sources">; created: boolean; videoId: string }> => {
    await requireAuth(ctx, args);
    const videoId = extractYouTubeVideoId(args.url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    const dedupeKey = generateDedupeKey("youtube", {
      youtubeVideoId: videoId,
    });

    // Check if already exists
    const existing: Doc<"sources"> | null = await ctx.runQuery(
      api.sources.getByDedupeKey,
      {
        dedupeKey,
      },
    );
    if (existing) {
      return { id: existing._id, created: false, videoId };
    }

    // Fetch video page for metadata
    const response = await fetchWithTimeout(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ResonantProjects/1.0)",
        },
      },
    );

    let title = `YouTube: ${videoId}`;
    let author: string | undefined;

    if (response.ok) {
      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch) {
        title = stripHtml(titleMatch[1]!).replace(" - YouTube", "").trim();
      }

      // Extract channel name
      const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
      if (channelMatch) {
        author = channelMatch[1];
      }
    }

    // Create source (transcript will be added later)
    const result: { id: Id<"sources">; created: boolean } =
      await ctx.runMutation(api.sources.create, {
        type: "youtube",
        title,
        author,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        youtubeVideoId: videoId,
        tags: args.tags || [],
        dedupeKey,
        devBypassSecret: args.devBypassSecret,
      });

    return { id: result.id, created: result.created, videoId };
  },
});
