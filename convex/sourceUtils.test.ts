import { describe, expect, test } from "bun:test";
import {
  extractYouTubeVideoId,
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
});
