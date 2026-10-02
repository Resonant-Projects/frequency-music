import { describe, expect, test } from "vite-plus/test";
import {
  arxivIdForUrl,
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

  test("keys a DOI-bearing URL by its DOI so publisher and doi.org links match", () => {
    const doiOrg = generateDedupeKey("url", {
      canonicalUrl: "https://doi.org/10.1080/17459737.2025.2465976",
    });
    const publisher = generateDedupeKey("url", {
      canonicalUrl:
        "https://www.tandfonline.com/doi/full/10.1080/17459737.2025.2465976",
    });
    expect(doiOrg).toBe("doi:10.1080/17459737.2025.2465976");
    expect(publisher).toBe(doiOrg);
    expect(
      generateDedupeKey("url", {
        canonicalUrl: "https://DOI.org/10.1080/ABC.1",
      }),
    ).toBe("doi:10.1080/abc.1");
    expect(
      generateDedupeKey("url", { canonicalUrl: "https://example.org/paper" }),
    ).toBe("url:example.org/paper");
    // A /doi/ path on an unknown host cannot claim a real work's identity.
    expect(
      generateDedupeKey("url", {
        canonicalUrl:
          "https://attacker.example/doi/10.1080/17459737.2025.2465976",
      }),
    ).toBe("url:attacker.example/doi/10.1080/17459737.2025.2465976");
  });

  test("keys arXiv revisions, cross-lists and links by the version-less id", () => {
    expect(arxivIdForUrl("https://arxiv.org/abs/2603.27528v2")).toBe(
      "2603.27528",
    );
    expect(arxivIdForUrl("https://arxiv.org/pdf/2603.27528v1.pdf")).toBe(
      "2603.27528",
    );
    expect(arxivIdForUrl("https://arxiv.org/html/2603.27528")).toBe(
      "2603.27528",
    );
    expect(arxivIdForUrl("oai:arXiv.org:2602.01634v2")).toBe("2602.01634");
    expect(arxivIdForUrl("https://arxiv.org/abs/math/0601001v3")).toBe(
      "math/0601001",
    );
    expect(arxivIdForUrl("https://arxiv.org/abs/CS.sd/0601001")).toBe(
      "cs/0601001",
    );
    expect(arxivIdForUrl("oai:arXiv.org:cs.SD/0601001v2")).toBe("cs/0601001");
    expect(arxivIdForUrl("https://arxiv.org/list/cs.SD/new")).toBeNull();
    expect(arxivIdForUrl("https://example.org/abs/2603.27528")).toBeNull();
    expect(arxivIdForUrl("https://notarxiv.org/abs/2603.27528")).toBeNull();
    expect(
      arxivIdForUrl("https://example.org/arxiv.org/abs/2603.27528"),
    ).toBeNull();
    expect(arxivIdForUrl("https://export.arxiv.org/abs/2603.27528v3")).toBe(
      "2603.27528",
    );
    const csSd = generateDedupeKey("rss", {
      feedUrl: "https://arxiv.org/rss/cs.SD",
      rssGuid: "oai:arXiv.org:2603.27528v1",
      canonicalUrl: "https://arxiv.org/abs/2603.27528",
    });
    const eessAs = generateDedupeKey("rss", {
      feedUrl: "https://arxiv.org/rss/eess.AS",
      rssGuid: "oai:arXiv.org:2603.27528v2",
      canonicalUrl: "https://arxiv.org/abs/2603.27528v2",
    });
    expect(csSd).toBe("arxiv:2603.27528");
    expect(eessAs).toBe(csSd);
    expect(
      generateDedupeKey("url", {
        canonicalUrl: "https://arxiv.org/abs/2603.27528",
      }),
    ).toBe(csSd);
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
    expect(extractYouTubeVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
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
