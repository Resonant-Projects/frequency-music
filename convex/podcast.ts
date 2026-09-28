// Private podcast feed. Only feed.xml is served by an HTTP action; audio bytes
// come from storage URLs rewritten onto the public host. A wrong token is a
// 404 so the route is invisible to scanners.
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { constantTimeEqual } from "./auth";

export type FeedEpisode = {
  id: string;
  title: string;
  createdAt: number;
  durationSecs?: number;
  sizeBytes: number;
  mimeType: string;
  storageUrl: string;
};

const FEED_LIMIT = 100;

export function feedTokenMatches(
  pathToken: string,
  expected: string | undefined,
): boolean {
  if (!expected || !pathToken) return false;
  return constantTimeEqual(pathToken, expected);
}

export function publicStorageUrl(
  storageUrl: string,
  publicBaseUrl: string,
): string {
  const parsed = new URL(storageUrl);
  return `${publicBaseUrl.replace(/\/$/, "")}${parsed.pathname}`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildFeedXml(args: {
  title: string;
  publicBaseUrl: string;
  episodes: FeedEpisode[];
}): string {
  const items = [...args.episodes]
    .toSorted((a, b) => b.createdAt - a.createdAt)
    .slice(0, FEED_LIMIT)
    .map((episode) => {
      const url = publicStorageUrl(episode.storageUrl, args.publicBaseUrl);
      const duration =
        episode.durationSecs === undefined
          ? ""
          : `<itunes:duration>${Math.round(episode.durationSecs)}</itunes:duration>`;
      return [
        "<item>",
        `<title>${escapeXml(episode.title)}</title>`,
        `<guid isPermaLink="false">${escapeXml(episode.id)}</guid>`,
        `<pubDate>${new Date(episode.createdAt).toUTCString()}</pubDate>`,
        `<enclosure url="${escapeXml(url)}" length="${episode.sizeBytes}" type="${escapeXml(episode.mimeType)}"/>`,
        duration,
        "</item>",
      ].join("");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
    "<channel>",
    `<title>${escapeXml(args.title)}</title>`,
    `<link>${escapeXml(args.publicBaseUrl)}</link>`,
    "<language>en-us</language>",
    "<itunes:author>Freq</itunes:author>",
    "<itunes:block>yes</itunes:block>",
    "<itunes:explicit>false</itunes:explicit>",
    '<itunes:category text="Music"/>',
    `<itunes:image href="${escapeXml(args.publicBaseUrl)}/podcast-cover.png"/>`,
    items,
    "</channel>",
    "</rss>",
  ].join("\n");
}

export const listFeedEpisodes = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<FeedEpisode[]> => {
    const rows = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_access_kind_createdAt", (q) =>
        q.eq("access", "feed").eq("kind", "episode"),
      )
      .order("desc")
      .take(args.limit ?? FEED_LIMIT);
    const episodes: FeedEpisode[] = [];
    for (const row of rows) {
      if (row.status !== "ready" || !row.storageId) continue;
      const storageUrl = await ctx.storage.getUrl(row.storageId);
      const meta = await ctx.db.system.get(row.storageId);
      if (!storageUrl || !meta) continue;
      episodes.push({
        id: row._id,
        title: row.title,
        createdAt: row.createdAt,
        durationSecs: row.durationSecs,
        sizeBytes: meta.size,
        mimeType: row.mimeType ?? "audio/mpeg",
        storageUrl,
      });
    }
    return episodes;
  },
});
