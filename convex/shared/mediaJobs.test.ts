import { describe, expect, test } from "vite-plus/test";
import {
  ARTIFACT_POLICY_BY_JOB_KIND,
  LEASE_MS,
  MAX_ATTEMPTS,
  MEDIA_JOB_KINDS,
  mediaJobDedupeKey,
  mediaJobInputZ,
  mediaJobResultZ,
  spokenLabel,
} from "./mediaJobs";

describe("media job contracts", () => {
  test("probe input validates and dedupes by snapshot", () => {
    const input = {
      kind: "probe",
      toneHz: 440,
      seconds: 2,
      rendererVersion: "0.1.0",
    } as const;
    expect(mediaJobInputZ.parse(input)).toEqual(input);
    expect(mediaJobDedupeKey(input)).toBe(mediaJobDedupeKey({ ...input }));
    expect(mediaJobDedupeKey(input)).not.toBe(
      mediaJobDedupeKey({ ...input, toneHz: 441 }),
    );
  });

  test("probe input rejects out-of-range tone and seconds", () => {
    expect(
      mediaJobInputZ.safeParse({
        kind: "probe",
        toneHz: 10,
        seconds: 2,
        rendererVersion: "x",
      }).success,
    ).toBe(false);
    expect(
      mediaJobInputZ.safeParse({
        kind: "probe",
        toneHz: 440,
        seconds: 0,
        rendererVersion: "x",
      }).success,
    ).toBe(false);
  });

  test("probe result requires exactly two ready artifacts with measurements", () => {
    const measured = {
      durationSecs: 2,
      loudnessLufs: -16.1,
      truePeakDbtp: -1.4,
    };
    const ok = mediaJobResultZ.safeParse({
      kind: "probe",
      artifacts: [
        { ...measured, artifactId: "k123", mimeType: "audio/wav" },
        { ...measured, artifactId: "k456", mimeType: "audio/mpeg" },
      ],
    });
    expect(ok.success).toBe(true);
    expect(
      mediaJobResultZ.safeParse({
        kind: "probe",
        artifacts: [{ ...measured, artifactId: "k123", mimeType: "audio/wav" }],
      }).success,
    ).toBe(false);
    expect(
      mediaJobResultZ.safeParse({ kind: "probe", artifacts: [] }).success,
    ).toBe(false);
  });

  test("lease and attempt constants match the spec", () => {
    expect(LEASE_MS).toBe(10 * 60 * 1000);
    expect(MAX_ATTEMPTS).toBe(3);
  });

  test("narrate, shootout, and assembleEpisode inputs validate", () => {
    expect(
      mediaJobInputZ.safeParse({
        kind: "narrate",
        script: {
          paragraphs: ["Hello.", "World."],
          chapters: [{ title: "Open", startParagraph: 0 }],
        },
        voiceId: "inworld-max",
        promptVersion: "narration.v1",
        target: "spoken",
        title: "Weekly turn, week of 2026-09-21",
        access: "feed",
        refs: {},
        assembleOnDone: true,
        episodeTitle: "Weekly turn, week of 2026-09-21",
        rendererVersion: "0.2.0",
      }).success,
    ).toBe(true);
    expect(
      mediaJobInputZ.safeParse({
        kind: "shootout",
        passage: ["a"],
        voiceIds: [],
        title: "t",
        rendererVersion: "x",
      }).success,
    ).toBe(false);
    // R29: refs are optional (older queued jobs) and carry the brief id.
    const assemble = {
      kind: "assembleEpisode",
      narrationArtifactId: "k1",
      narrationStorageUrl: "http://convex.test/api/storage/x",
      title: "t",
      chapters: [],
      rendererVersion: "x",
    };
    expect(mediaJobInputZ.safeParse(assemble).success).toBe(true);
    expect(
      mediaJobInputZ.safeParse({
        ...assemble,
        refs: { weeklyBriefId: "wb1" },
      }).success,
    ).toBe(true);
  });

  test("spokenLabel is the single source of the heard and stored take label", () => {
    expect(spokenLabel(0)).toBe("take one");
    expect(spokenLabel(7)).toBe("take eight");
    // Beyond the ordinal table (never reached: groups cap at eight).
    expect(spokenLabel(8)).toBe("take 9");
  });

  test("every job kind has an artifact policy with at least one kind and access", () => {
    for (const kind of MEDIA_JOB_KINDS) {
      const policy = ARTIFACT_POLICY_BY_JOB_KIND[kind];
      expect(policy, kind).toBeDefined();
      expect(policy.artifactKinds.length, kind).toBeGreaterThan(0);
      expect(policy.access.length, kind).toBeGreaterThan(0);
    }
    expect(MEDIA_JOB_KINDS).toEqual([
      "probe",
      "narrate",
      "shootout",
      "assembleEpisode",
    ]);
  });
});
