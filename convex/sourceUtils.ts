export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
  } catch {
    return url.toLowerCase();
  }
}

export function generateDedupeKey(
  type: string,
  identifiers: {
    notionPageId?: string;
    feedUrl?: string;
    rssGuid?: string;
    canonicalUrl?: string;
    youtubeVideoId?: string;
    fileSha256?: string;
  },
): string {
  switch (type) {
    case "notion":
      return `notion:${identifiers.notionPageId}`;
    case "rss":
      return `rss:${identifiers.feedUrl}:${identifiers.rssGuid || identifiers.canonicalUrl}`;
    case "url":
      return `url:${normalizeUrl(identifiers.canonicalUrl || "")}`;
    case "youtube":
      return `yt:${identifiers.youtubeVideoId}`;
    case "pdf":
      return `pdf:${identifiers.fileSha256}`;
    case "podcast":
      return `podcast:${identifiers.feedUrl}:${identifiers.rssGuid || identifiers.canonicalUrl}`;
    default:
      return `unknown:${Date.now()}`;
  }
}

export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * Move an archived source out of the canonical dedupe-key namespace.
 */
export function generateArchivedDedupeKey(
  dedupeKey: string,
  sourceId: string,
): string {
  return `archived:${dedupeKey}:${sourceId}`;
}

/**
 * Recompute the canonical dedupeKey for an existing source row.
 * Returns null when the row can't be recomputed safely:
 * - pdf keys were minted from file hashes we don't store on the row
 * - notion/podcast rows missing their identifier
 * - rss/url/youtube rows missing the fields their key needs
 */
export function computeCanonicalDedupeKey(source: {
  type: string;
  notionPageId?: string;
  feedUrl?: string;
  rssGuid?: string;
  canonicalUrl?: string;
  youtubeVideoId?: string;
}): string | null {
  switch (source.type) {
    case "notion":
      return source.notionPageId ? generateDedupeKey("notion", source) : null;
    case "rss":
    case "podcast":
      return source.feedUrl && (source.rssGuid || source.canonicalUrl)
        ? generateDedupeKey(source.type, source)
        : null;
    case "url":
      return source.canonicalUrl ? generateDedupeKey("url", source) : null;
    case "youtube": {
      const videoId =
        source.youtubeVideoId ??
        (source.canonicalUrl
          ? extractYouTubeVideoId(source.canonicalUrl)
          : null);
      return videoId ? `yt:${videoId}` : null;
    }
    default:
      return null;
  }
}
