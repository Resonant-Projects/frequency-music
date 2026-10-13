import { describe, expect, test } from "vite-plus/test";
import {
  ARTIFACT_POLICY_BY_JOB_KIND,
  LEASE_MS,
  MAX_ATTEMPTS,
  MEDIA_JOB_KINDS,
  type MediaJobInput,
  mediaJobDedupeKey,
  mediaJobInputZ,
  mediaJobResultZ,
  narrationScriptZ,
  spokenLabel,
} from "./mediaJobs";

const litmusInput: Extract<MediaJobInput, { kind: "litmusRender" }> = {
  kind: "litmusRender",
  recipeId: "recipe" as never,
  recipeUpdatedAt: 1,
  rendererVersion: "0.3.0",
  renderPlan: {
    version: 1,
    engine: "sc-litmus",
    tuning: { kind: "edo", divisions: 19 },
    referenceHz: 432,
    normalize: true,
    tempoBpm: 120,
    durationSecs: 2,
    seed: [{ degree: 1, octave: 0, startBeat: 0, beats: 1, velocity: 100 }],
  },
};

describe("media job contracts", () => {
  test("litmus snapshots dedupe by recipe revision and plan", () => {
    expect(mediaJobInputZ.parse(litmusInput)).toEqual(litmusInput);
    const key = mediaJobDedupeKey(litmusInput);
    expect(key.startsWith("litmusRender:")).toBe(true);
    expect(mediaJobDedupeKey({ ...litmusInput, recipeUpdatedAt: 2 })).not.toBe(
      key,
    );
    expect(
      mediaJobDedupeKey({
        ...litmusInput,
        renderPlan: { ...litmusInput.renderPlan, referenceHz: 440 },
      }),
    ).not.toBe(key);
  });

  test("litmus results carry one to four members and no labels", () => {
    const artifact = {
      artifactId: "a",
      durationSecs: 2,
      loudnessLufs: -18,
      truePeakDbtp: -2,
      mimeType: "audio/mpeg",
    };
    const member = { member: 0, master: artifact, delivery: artifact };
    expect(
      mediaJobResultZ.safeParse({ kind: "litmusRender", members: [member] })
        .success,
    ).toBe(true);
    expect(
      mediaJobResultZ.safeParse({ kind: "litmusRender", members: [] }).success,
    ).toBe(false);
    expect(
      mediaJobResultZ.safeParse({
        kind: "litmusRender",
        members: [{ ...member, member: 4 }],
      }).success,
    ).toBe(false);
  });

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

  test("narration script chapters must start inside the script", () => {
    const script = {
      paragraphs: ["One.", "Two."],
      chapters: [{ title: "Late", startParagraph: 2 }],
    };
    expect(narrationScriptZ.safeParse(script).success).toBe(false);
    expect(
      narrationScriptZ.safeParse({
        ...script,
        chapters: [{ title: "Last", startParagraph: 1 }],
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
      "litmusRender",
    ]);
    // Litmus renders are never feed-published by their own job.
    expect(ARTIFACT_POLICY_BY_JOB_KIND.litmusRender).toEqual({
      artifactKinds: ["litmusRender"],
      access: ["private"],
    });
  });
});
