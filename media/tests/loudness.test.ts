import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { encodeMp3 } from "../src/audio/encode";
import {
  assertWithinPolicy,
  LOUDNESS_TARGETS,
  measure,
  normalize,
  TRUE_PEAK_CEILING,
} from "../src/audio/loudness";
import { synthTone } from "../src/audio/synth";

const dir = mkdtempSync(join(tmpdir(), "media-loudness-"));

describe("loudness pipeline", () => {
  test("a quiet tone normalizes to the spoken target within tolerance and under the peak ceiling", async () => {
    const raw = join(dir, "raw.wav");
    const out = join(dir, "norm.wav");
    await synthTone(raw, { hz: 440, seconds: 3, gainDb: -30 });
    const before = await measure(raw);
    expect(before.integratedLufs).toBeLessThan(-25);
    const after = await normalize(raw, out, {
      targetLufs: LOUDNESS_TARGETS.spoken,
    });
    expect(
      Math.abs(after.integratedLufs - LOUDNESS_TARGETS.spoken),
    ).toBeLessThanOrEqual(0.5);
    expect(after.truePeakDbtp).toBeLessThanOrEqual(TRUE_PEAK_CEILING);
    expect(after.durationSecs).toBeGreaterThan(2.9);
    expect(() =>
      assertWithinPolicy(after, LOUDNESS_TARGETS.spoken),
    ).not.toThrow();
  });

  test("assertWithinPolicy rejects level and peak violations", () => {
    expect(() =>
      assertWithinPolicy(
        { integratedLufs: -17.2, truePeakDbtp: -2, durationSecs: 1 },
        -16,
      ),
    ).toThrow(/LUFS/);
    expect(() =>
      assertWithinPolicy(
        { integratedLufs: -16, truePeakDbtp: -0.5, durationSecs: 1 },
        -16,
      ),
    ).toThrow(/dBTP/);
  });

  test("decoded mp3 true peak is measured, and a hot encode fails policy", async () => {
    const raw = join(dir, "hot.wav");
    const mp3 = join(dir, "hot.mp3");
    await synthTone(raw, { hz: 1000, seconds: 2, gainDb: -0.2 });
    // mono: ffmpeg's mono→stereo upmix is −3 dB per side (loudness-preserving), which would hide the overshoot
    await encodeMp3(raw, mp3, { bitrateKbps: 128, channels: 1 });
    const decoded = await measure(mp3);
    expect(decoded.truePeakDbtp).toBeGreaterThan(TRUE_PEAK_CEILING);
    expect(() => assertWithinPolicy(decoded, decoded.integratedLufs)).toThrow(
      /dBTP/,
    );
  });
});
