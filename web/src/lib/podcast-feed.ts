export type PodcastEpisode = {
  id: string;
  title: string;
  createdAt: number;
  durationSecs?: number;
  playbackUrl: string;
};

const ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd";

// itunes:duration is either whole seconds or a clock: HH:MM:SS or MM:SS.
export function parseDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const parts = raw.split(":");
  if (parts.length < 2 || parts.length > 3) return undefined;
  if (!parts.every((part) => /^\d+$/.test(part))) return undefined;
  const [seconds, minutes, hours = 0] = parts.map(Number).reverse();
  if (seconds >= 60 || (parts.length === 3 && minutes >= 60)) return undefined;
  return hours * 3600 + minutes * 60 + seconds;
}

function parseItem(item: Element, origin: string): PodcastEpisode | null {
  const id = item.querySelector("guid")?.textContent?.trim();
  const title = item.querySelector("title")?.textContent?.trim();
  const createdAt = Date.parse(
    item.querySelector("pubDate")?.textContent ?? "",
  );
  const src = item.querySelector("enclosure")?.getAttribute("url");
  if (!id || !title || !src || !Number.isFinite(createdAt)) return null;
  let playback: URL;
  try {
    playback = new URL(src);
  } catch {
    return null;
  }
  if (
    playback.origin !== origin ||
    !["https:", "http:"].includes(playback.protocol)
  )
    return null;
  const rawDuration = item
    .getElementsByTagNameNS(ITUNES_NS, "duration")[0]
    ?.textContent?.trim();
  return {
    id,
    title,
    createdAt,
    durationSecs: parseDuration(rawDuration),
    playbackUrl: playback.href,
  };
}

// Treat RSS as data, never markup. Restrict enclosures to the configured
// podcast host so malformed feed content cannot introduce another player URL.
// A malformed item is skipped rather than blanking the whole list; only an
// invalid document (or one whose every item is malformed) is an error.
export function parsePodcastFeed(
  xml: string,
  feedUrl: string,
): PodcastEpisode[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (
    document.querySelector("parsererror") ||
    document.documentElement.tagName !== "rss" ||
    !document.querySelector("rss > channel")
  ) {
    throw new Error("Invalid podcast feed");
  }
  const origin = new URL(feedUrl).origin;
  const items = [...document.querySelectorAll("channel > item")];
  const episodes = items
    .map((item) => parseItem(item, origin))
    .filter((episode): episode is PodcastEpisode => episode !== null);
  if (items.length > 0 && episodes.length === 0) {
    throw new Error("Invalid podcast feed");
  }
  return episodes.sort((a, b) => b.createdAt - a.createdAt);
}
