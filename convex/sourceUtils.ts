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
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}
