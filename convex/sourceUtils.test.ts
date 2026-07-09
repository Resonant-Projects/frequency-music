import { describe, expect, test } from "bun:test";
import {
  computeCanonicalDedupeKey,
  extractYouTubeVideoId,
  generateArchivedDedupeKey,
  generateDedupeKey,
  normalizeUrl,
} from "./sourceUtils";

describe("source utilities", () => {
  test("normalizes URLs for dedupe", () => {
    expect(normalizeUrl("https://Example.com/path/to/item/?a=1")).toBe(
      "example.com/path/to/item?a=1",
    );
  });

  test("builds dedupe keys for URL and RSS sources", () => {
    expect(
      generateDedupeKey("url", {
        canonicalUrl: "https://example.com/research/article",
      }),
    ).toBe("url:example.com/research/article");

    expect(
      generateDedupeKey("rss", {
        feedUrl: "https://feed.test/rss.xml",
        rssGuid: "entry-42",
      }),
    ).toBe("rss:https://feed.test/rss.xml:entry-42");
  });

  test("extracts video ids from standard and shorts URLs", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(
      extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://example.com/video")).toBeNull();
  });

  test("extracts video ids from /v/ URLs (inherited from ingest.ts copy)", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/v/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  test("rss dedupe key falls back to canonicalUrl when guid is missing", () => {
    expect(
      generateDedupeKey("rss", {
        feedUrl: "https://feed.test/rss.xml",
        canonicalUrl: "https://feed.test/entry-1",
      }),
    ).toBe("rss:https://feed.test/rss.xml:https://feed.test/entry-1");
  });

  test("moves archived rows out of the canonical key namespace", () => {
    expect(generateArchivedDedupeKey("url:example.com/a", "source-1")).toBe(
      "archived:url:example.com/a:source-1",
    );
  });

  test("computeCanonicalDedupeKey recomputes per type and skips unrecomputable rows", () => {
    expect(
      computeCanonicalDedupeKey({
        type: "rss",
        feedUrl: "https://feed.test/rss.xml",
        rssGuid: "entry-42",
      }),
    ).toBe("rss:https://feed.test/rss.xml:entry-42");

    expect(
      computeCanonicalDedupeKey({
        type: "url",
        canonicalUrl: "https://Example.com/a/?q=1",
      }),
    ).toBe("url:example.com/a?q=1");

    expect(
      computeCanonicalDedupeKey({
        type: "youtube",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).toBe("yt:dQw4w9WgXcQ");

    expect(computeCanonicalDedupeKey({ type: "rss" })).toBeNull(); // no feedUrl
    expect(computeCanonicalDedupeKey({ type: "pdf" })).toBeNull(); // never recomputed
    expect(computeCanonicalDedupeKey({ type: "notion" })).toBeNull(); // no notionPageId
  });
});
