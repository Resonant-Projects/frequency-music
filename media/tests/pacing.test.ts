import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { concatWithGaps } from "../src/audio/concat";
import { runFfmpeg } from "../src/audio/ffmpeg";
import { measure } from "../src/audio/loudness";
import {
  assemblePaced,
  checkChunk,
  gapBeforeSegment,
  noiseFloorDb,
  PACING_GAPS_MS,
  trimToSpeech,
} from "../src/audio/pacing";
import { synthTone } from "../src/audio/synth";

const dir = mkdtempSync(join(tmpdir(), "pacing-"));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("gapBeforeSegment", () => {
  const segments = [
    { role: "intro" as const },
    { role: "paragraph" as const },
    { role: "heading" as const },
    { role: "paragraph" as const },
    { role: "paragraph" as const },
    { role: "paragraph" as const, breakBefore: true },
    { role: "subheading" as const },
    { role: "paragraph" as const },
    { role: "outro" as const },
  ];
  test("section changes get the long pauses", () => {
    const gaps = segments.map((_, index) => gapBeforeSegment(segments, index));
    expect(gaps).toEqual([
      0,
      PACING_GAPS_MS.afterIntro,
      PACING_GAPS_MS.beforeHeading,
      PACING_GAPS_MS.afterHeading,
      PACING_GAPS_MS.betweenParagraphs,
      PACING_GAPS_MS.sceneBreak,
      PACING_GAPS_MS.beforeSubheading,
      PACING_GAPS_MS.afterSubheading,
      PACING_GAPS_MS.beforeOutro,
    ]);
    expect(PACING_GAPS_MS.beforeHeading).toBeGreaterThan(
      PACING_GAPS_MS.betweenParagraphs * 2,
    );
  });
});

describe("checkChunk", () => {
  test("rejects the October 5 Voxtral runaway: 496 characters for 163.8 s", () => {
    const verdict = checkChunk(496, 163.8, 15);
    expect(verdict.ok).toBe(false);
  });
  test("accepts ordinary speech and its neighbours", () => {
    expect(checkChunk(422, 30.3, 15).ok).toBe(true);
    expect(checkChunk(568, 33.0, 15).ok).toBe(true);
    expect(checkChunk(433, 26.8).ok).toBe(true);
  });
  test("rejects a truncated take and empty audio", () => {
    expect(checkChunk(600, 8, 15).ok).toBe(false);
    expect(checkChunk(300, 0.1).ok).toBe(false);
  });
  test("short pieces are judged on an absolute ceiling", () => {
    expect(checkChunk(22, 1.8, 15).ok).toBe(true);
    expect(checkChunk(22, 12, 15).ok).toBe(false);
  });
});

describe("audio", () => {
  test("trimToSpeech removes provider silence but keeps a little air", async () => {
    const tone = join(dir, "tone.wav");
    const padded = join(dir, "padded.wav");
    const trimmed = join(dir, "trimmed.wav");
    await synthTone(tone, { hz: 220, seconds: 1 });
    await concatWithGaps([tone], padded, 0, { leadMs: 900, tailMs: 900 });
    await trimToSpeech(padded, trimmed);
    const seconds = (await measure(trimmed)).durationSecs;
    expect(seconds).toBeGreaterThan(1.1);
    expect(seconds).toBeLessThan(1.35);
  });

  test("assemblePaced places segments by role and reports their starts", async () => {
    const a = join(dir, "a.wav");
    const b = join(dir, "b.wav");
    await synthTone(a, { hz: 330, seconds: 1 });
    await synthTone(b, { hz: 440, seconds: 0.5 });
    const out = join(dir, "paced.wav");
    const { segmentStarts, durationSecs } = await assemblePaced(
      [
        { role: "intro", files: [a] },
        { role: "heading", files: [b] },
        { role: "paragraph", files: [a, a] },
      ],
      out,
      { tailMs: 500 },
    );
    expect(segmentStarts[0]).toBe(0);
    expect(segmentStarts[1]).toBeCloseTo(
      1 + PACING_GAPS_MS.beforeHeading / 1000,
      2,
    );
    expect(segmentStarts[2]).toBeCloseTo(
      1 + 2 + 0.5 + PACING_GAPS_MS.afterHeading / 1000,
      2,
    );
    const expected =
      segmentStarts[2]! + 2 + PACING_GAPS_MS.withinParagraph / 1000 + 0.5;
    expect(durationSecs).toBeCloseTo(expected, 2);
    expect((await measure(out)).durationSecs).toBeCloseTo(expected, 1);
  });

  test("room tone fills the gaps at the requested floor", async () => {
    const a = join(dir, "quiet-a.wav");
    await synthTone(a, { hz: 300, seconds: 0.5 });
    const out = join(dir, "toned.wav");
    await assemblePaced(
      [
        { role: "paragraph", files: [a] },
        { role: "heading", files: [a] },
      ],
      out,
      { tailMs: 0, roomToneDb: -60 },
    );
    // The 2 s gap between the two tones holds only the bed.
    const gap = join(dir, "gap.wav");
    await runFfmpeg([
      "-i",
      out,
      "-ss",
      "0.8",
      "-t",
      "1.4",
      "-c:a",
      "pcm_s24le",
      gap,
    ]);
    const floor = await noiseFloorDb(gap);
    expect(floor).toBeGreaterThan(-64);
    expect(floor).toBeLessThan(-57);
  });
});

describe("checkChunk short pieces", () => {
  test("a short piece cut to a blip is rejected", () => {
    expect(checkChunk(59, 0.3).ok).toBe(false);
    expect(checkChunk(40, 2.4).ok).toBe(true);
  });
});
