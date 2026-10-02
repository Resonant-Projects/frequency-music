import { trustedDoiForUrl } from "./shared/doi";

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * The version-less arXiv identifier an arxiv.org URL or OAI guid names, so a
 * paper's revisions and cross-listed announcements key as one source.
 */
export function arxivIdForUrl(value: string): string | null {
  const id =
    "((?:\\d{4}\\.\\d{4,5})|(?:[a-z-]+(?:\\.[A-Z]{2})?\\/\\d{7}))(?:v\\d+)?";
  const oai = new RegExp(`^oai:arXiv\\.org:${id}$`, "i").exec(value.trim());
  if (oai) return oai[1] ?? null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  // Only arXiv itself names arXiv papers.
  if (host !== "arxiv.org" && !host.endsWith(".arxiv.org")) return null;
  const path = new RegExp(
    `^\\/(?:abs|pdf|html)\\/${id}(?:\\.pdf)?\\/?$`,
    "i",
  ).exec(url.pathname);
  return path?.[1] ?? null;
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
    case "rss": {
      const arxivId =
        arxivIdForUrl(identifiers.canonicalUrl || "") ??
        arxivIdForUrl(identifiers.rssGuid || "");
      if (arxivId) return `arxiv:${arxivId}`;
      return `rss:${identifiers.feedUrl}:${identifiers.rssGuid || identifiers.canonicalUrl}`;
    }
    case "url": {
      const arxivId = arxivIdForUrl(identifiers.canonicalUrl || "");
      if (arxivId) return `arxiv:${arxivId}`;
      // One work reached through doi.org and its publisher page is one source.
      const doi = trustedDoiForUrl(identifiers.canonicalUrl || "");
      return doi
        ? // DOI names are case-insensitive for ASCII letters only.
          `doi:${doi.replace(/[A-Z]/g, (letter) => letter.toLowerCase())}`
        : `url:${normalizeUrl(identifiers.canonicalUrl || "")}`;
    }
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
