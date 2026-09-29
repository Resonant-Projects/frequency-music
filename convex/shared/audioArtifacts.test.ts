// convex/shared/audioArtifacts.test.ts
import { describe, expect, test } from "vite-plus/test";
import {
  AUDIO_ARTIFACT_KINDS,
  audioArtifactFieldsZ,
  audioArtifactInputZ,
  audioEncodingZ,
} from "./audioArtifacts";

describe("audio artifact contracts", () => {
  test("kinds are the closed wave-0 set", () => {
    expect([...AUDIO_ARTIFACT_KINDS]).toEqual([
      "narration",
      "shootoutTake",
      "episode",
      "litmusRender",
      "voiceNote",
      "blurb",
      "probe",
    ]);
  });

  test("encoding requires a codec and positive sample rate and channels", () => {
    expect(
      audioEncodingZ.safeParse({
        codec: "mp3",
        bitrateKbps: 128,
        sampleRate: 48000,
        channels: 2,
      }).success,
    ).toBe(true);
    expect(
      audioEncodingZ.safeParse({
        codec: "flac",
        sampleRate: 48000,
        channels: 2,
      }).success,
    ).toBe(false);
    expect(
      audioEncodingZ.safeParse({ codec: "wav", sampleRate: 0, channels: 2 })
        .success,
    ).toBe(false);
  });

  test("artifact fields default access to private and require a title", () => {
    const parsed = audioArtifactFieldsZ.parse({
      kind: "probe",
      role: "delivery",
      status: "pending",
      encoding: {
        codec: "mp3",
        bitrateKbps: 128,
        sampleRate: 48000,
        channels: 2,
      },
      normalization: "applied",
      metadataStripped: false,
      title: "probe tone",
      refs: {},
      contentHash: "abc",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(parsed.access).toBe("private");
    expect(
      audioArtifactFieldsZ.safeParse({ ...parsed, title: "" }).success,
    ).toBe(false);
  });

  test("artifact input omits the server-stamped timestamps", () => {
    expect(
      audioArtifactInputZ.safeParse({
        kind: "probe",
        role: "delivery",
        status: "pending",
        encoding: {
          codec: "mp3",
          bitrateKbps: 128,
          sampleRate: 48000,
          channels: 2,
        },
        normalization: "applied",
        metadataStripped: false,
        title: "probe tone",
        refs: {},
        contentHash: "abc",
        createdBy: "system",
      }).success,
    ).toBe(true);
  });
});
