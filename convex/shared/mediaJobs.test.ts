import { describe, expect, test } from "vite-plus/test";
import {
  LEASE_MS,
  MAX_ATTEMPTS,
  mediaJobDedupeKey,
  mediaJobInputZ,
  mediaJobResultZ,
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
});
