import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import { buildFeedXml, feedTokenMatches, publicStorageUrl } from "./podcast";
import schema from "./schema";
import type { AudioArtifactInput } from "./shared/audioArtifacts";

describe("podcast feed", () => {
  test("token match is exact and constant-time-safe for prefixes and supersets", () => {
    expect(feedTokenMatches("abc", "abc")).toBe(true);
    expect(feedTokenMatches("ab", "abc")).toBe(false);
    expect(feedTokenMatches("abcd", "abc")).toBe(false);
    expect(feedTokenMatches("abc%20", "abc")).toBe(false);
    expect(feedTokenMatches("", "")).toBe(false);
  });

  test("storage urls are rewritten onto the public host", () => {
    expect(
      publicStorageUrl(
        "http://convex.rproj.art:3211/api/storage/0123-abcd",
        "https://listen.rproj.art",
      ),
    ).toBe("https://listen.rproj.art/api/storage/0123-abcd");
  });

  test("feed renders items newest first with enclosures and escapes text", () => {
    const xml = buildFeedXml({
      title: "Frequency Music, private",
      publicBaseUrl: "https://listen.rproj.art",
      episodes: [
        {
          id: "k1",
          title: "Weekly turn, week of 2026-09-21 & more",
          createdAt: 1_700_000_000_000,
          durationSecs: 600,
          sizeBytes: 9_600_000,
          mimeType: "audio/mpeg",
          storageUrl: "http://convex.rproj.art:3211/api/storage/one",
        },
        {
          id: "k2",
          title: "Older",
          createdAt: 1_600_000_000_000,
          durationSecs: 60,
          sizeBytes: 960_000,
          mimeType: "audio/mpeg",
          storageUrl: "http://convex.rproj.art:3211/api/storage/two",
        },
      ],
    });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<itunes:block>yes</itunes:block>");
    expect(xml).toContain("&amp; more");
    expect(xml.indexOf("api/storage/one")).toBeLessThan(
      xml.indexOf("api/storage/two"),
    );
    expect(xml).toContain(
      'url="https://listen.rproj.art/api/storage/one" length="9600000" type="audio/mpeg"',
    );
    expect(xml).toContain('<guid isPermaLink="false">k1</guid>');
    expect(xml).toContain("<itunes:duration>600</itunes:duration>");
  });

  test("empty feed is still valid", () => {
    const xml = buildFeedXml({
      title: "t",
      publicBaseUrl: "https://x",
      episodes: [],
    });
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});

const baseFields = {
  role: "delivery" as const,
  metadataStripped: true,
  status: "pending" as const,
  encoding: {
    codec: "mp3" as const,
    bitrateKbps: 128,
    sampleRate: 48000,
    channels: 2,
  },
  normalization: "applied" as const,
  refs: {},
  createdBy: "system" as const,
};

describe("podcast.listFeedEpisodes", () => {
  test("returns only ready feed-access episodes with storage url and blob size", async () => {
    const t = convexTest(schema, modules);
    const blob = new Blob(["0123456789abcdef"]);

    const insertReady = async (
      fields: Pick<
        AudioArtifactInput,
        "kind" | "access" | "title" | "contentHash"
      >,
    ) => {
      const artifactId = await t.mutation(
        internal.audioArtifacts.createPending,
        {
          fields: { ...baseFields, ...fields },
        },
      );
      const storageId = await t.run((ctx) => ctx.storage.store(blob));
      await t.mutation(internal.audioArtifacts.attachStorage, {
        artifactId,
        storageId,
      });
      await t.mutation(internal.audioArtifacts.markReady, {
        artifactId,
        durationSecs: 12.4,
        loudnessLufs: -16,
        truePeakDbtp: -1,
        mimeType: "audio/mpeg",
      });
      return artifactId;
    };

    const feedEpisodeId = await insertReady({
      kind: "episode",
      access: "feed",
      title: "Feed episode",
      contentHash: "h-feed-episode",
    });
    await insertReady({
      kind: "episode",
      access: "private",
      title: "Private episode",
      contentHash: "h-private-episode",
    });
    await insertReady({
      kind: "probe",
      access: "feed",
      title: "Feed probe",
      contentHash: "h-feed-probe",
    });

    const episodes = await t.query(internal.podcast.listFeedEpisodes, {});
    expect(episodes).toHaveLength(1);
    const [episode] = episodes;
    expect(episode?.id).toBe(feedEpisodeId);
    expect(episode?.title).toBe("Feed episode");
    expect(episode?.sizeBytes).toBe(blob.size);
    expect(episode?.mimeType).toBe("audio/mpeg");
    expect(episode?.durationSecs).toBe(12.4);
    expect(episode?.storageUrl.startsWith("http")).toBe(true);
  });
});
