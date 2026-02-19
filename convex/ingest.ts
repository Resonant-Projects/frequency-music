import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

// ============================================================================
// RSS FEED POLLING
// ============================================================================

interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  guid?: string;
  content?: string;
}

interface ParsedFeed {
  title: string;
  items: RSSItem[];
}

/**
 * Parse RSS/Atom XML into structured items
 */
function parseRSSXML(xml: string): ParsedFeed {
  // Simple regex-based parser (works for most RSS/Atom feeds)
  const items: RSSItem[] = [];

  // Get feed title
  const feedTitleMatch = xml.match(
    /<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i,
  );
  const feedTitle = feedTitleMatch ? feedTitleMatch[1].trim() : "Unknown Feed";

  // Match RSS items or Atom entries
  const itemRegex =
    /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1] || match[2];

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

    const title = titleMatch ? titleMatch[1].trim() : "";
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
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate dedupeKey for RSS items
 */
function generateRSSDedupeKey(feedUrl: string, item: RSSItem): string {
  const identifier = item.guid || item.link;
  return `rss:${new URL(feedUrl).hostname}:${identifier}`;
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
      const response = await fetch(feed.url, {
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
          const dedupeKey = generateRSSDedupeKey(feed.url, item);

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
            const parsed = Date.parse(item.pubDate);
            if (!isNaN(parsed)) {
              publishedAt = parsed;
              if (!latestItemDate || parsed > latestItemDate) {
                latestItemDate = parsed;
              }
            }
          }

          // Get text content
          const rawText = item.content
            ? stripHtml(item.content)
            : item.description
              ? stripHtml(item.description)
              : undefined;

          // Create source
          await ctx.runMutation(api.sources.create, {
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
          errors.push(`Item "${item.title}": ${itemError}`);
        }
      }

      // Update feed last polled timestamp
      await ctx.runMutation(internal.feeds.updateLastPolled, {
        id: args.feedId,
        lastPolledAt: Date.now(),
        lastItemAt: latestItemDate,
      });
    } catch (fetchError) {
      errors.push(`Fetch error: ${fetchError}`);
    }

    return { processed, errors };
  },
});

/**
 * Poll all enabled feeds (public action)
 */
export const pollAllFeeds = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    results: Record<string, { processed: number; errors: string[] }>;
  }> => {
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
          errors: [`Action error: ${error}`],
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
 * Ingest a URL by fetching and extracting readable content
 */
export const ingestUrl = action({
  args: {
    url: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Generate dedupeKey
    const urlObj = new URL(args.url);
    const dedupeKey = `url:${urlObj.hostname}${urlObj.pathname.replace(/\/$/, "")}`;

    // Check if already exists
    const existing = await ctx.runQuery(api.sources.getByDedupeKey, {
      dedupeKey,
    });
    if (existing) {
      return { id: existing._id, created: false };
    }

    // Fetch the page
    const response = await fetch(args.url, {
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
    const title = titleMatch ? stripHtml(titleMatch[1]) : urlObj.hostname;

    // Extract main content (simplified - could use readability library)
    // For now, just strip HTML from body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const rawText = bodyMatch
      ? stripHtml(bodyMatch[1]).slice(0, 50000)
      : undefined;

    // Create source
    const result = await ctx.runMutation(api.sources.create, {
      type: "url",
      title,
      canonicalUrl: args.url,
      rawText,
      tags: args.tags || [],
      dedupeKey,
    });

    return { id: result.id, created: result.created };
  },
});

// ============================================================================
// YOUTUBE INGESTION
// ============================================================================

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Ingest a YouTube video (metadata only - transcript extraction is separate)
 */
export const ingestYouTube = action({
  args: {
    url: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const videoId = extractYouTubeVideoId(args.url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    const dedupeKey = `yt:${videoId}`;

    // Check if already exists
    const existing = await ctx.runQuery(api.sources.getByDedupeKey, {
      dedupeKey,
    });
    if (existing) {
      return { id: existing._id, created: false, videoId };
    }

    // Fetch video page for metadata
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ResonantProjects/1.0)",
      },
    });

    let title = `YouTube: ${videoId}`;
    let author: string | undefined;

    if (response.ok) {
      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch) {
        title = stripHtml(titleMatch[1]).replace(" - YouTube", "").trim();
      }

      // Extract channel name
      const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
      if (channelMatch) {
        author = channelMatch[1];
      }
    }

    // Create source (transcript will be added later)
    const result = await ctx.runMutation(api.sources.create, {
      type: "youtube",
      title,
      author,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      youtubeVideoId: videoId,
      tags: args.tags || [],
      dedupeKey,
    });

    return { id: result.id, created: result.created, videoId };
  },
});
