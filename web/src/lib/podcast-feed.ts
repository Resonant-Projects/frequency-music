export type PodcastEpisode = {
  id: string;
  title: string;
  createdAt: number;
  durationSecs?: number;
  playbackUrl: string;
};

// Treat RSS as data, never markup. Restrict enclosures to the configured
// podcast host so malformed feed content cannot introduce another player URL.
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
  const episodes: PodcastEpisode[] = [];
  for (const item of document.querySelectorAll("channel > item")) {
    const id = item.querySelector("guid")?.textContent?.trim();
    const title = item.querySelector("title")?.textContent?.trim();
    const date = item.querySelector("pubDate")?.textContent ?? "";
    const src = item.querySelector("enclosure")?.getAttribute("url");
    if (!id || !title || !src || !Number.isFinite(Date.parse(date)))
      throw new Error("Invalid episode");
    const playback = new URL(src);
    if (
      playback.origin !== origin ||
      !["https:", "http:"].includes(playback.protocol)
    )
      throw new Error("Invalid enclosure");
    const rawDuration = item
      .getElementsByTagNameNS(
        "http://www.itunes.com/dtds/podcast-1.0.dtd",
        "duration",
      )[0]
      ?.textContent?.trim();
    const duration = rawDuration ? Number(rawDuration) : undefined;
    episodes.push({
      id,
      title,
      createdAt: Date.parse(date),
      durationSecs:
        duration !== undefined && Number.isFinite(duration) && duration >= 0
          ? duration
          : undefined,
      playbackUrl: playback.href,
    });
  }
  return episodes.sort((a, b) => b.createdAt - a.createdAt);
}
