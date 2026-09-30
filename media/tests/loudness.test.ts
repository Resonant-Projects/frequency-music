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
import { writeSpeechLikeWav } from "./speechLike";

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

  // Production shootout takes failed at -16.70 and -16.60 LUFS on the MP3
  // probe: loudnorm fell back to dynamic mode on speech whose peaks were too
  // hot for linear gain and landed low, and the encode then lost another
  // 0.45 LU.
  test("speech too peaky for linear gain lands on target, and so does its 128k dual-mono delivery", async () => {
    const raw = join(dir, "speech-raw.wav");
    const out = join(dir, "speech-norm.wav");
    const mp3 = join(dir, "speech.mp3");
    writeSpeechLikeWav(raw, { seconds: 12 });
    const before = await measure(raw);
    // Linear gain to target would push the true peak past the ceiling.
    expect(
      before.truePeakDbtp + (LOUDNESS_TARGETS.spoken - before.integratedLufs),
    ).toBeGreaterThan(TRUE_PEAK_CEILING);

    const master = await normalize(raw, out, {
      targetLufs: LOUDNESS_TARGETS.spoken,
    });
    expect(
      Math.abs(master.integratedLufs - LOUDNESS_TARGETS.spoken),
    ).toBeLessThanOrEqual(0.2);
    expect(master.truePeakDbtp).toBeLessThanOrEqual(TRUE_PEAK_CEILING);
    expect(Math.abs(master.durationSecs - before.durationSecs)).toBeLessThan(
      0.01,
    );

    await encodeMp3(out, mp3, { bitrateKbps: 128, channels: 2 });
    const delivery = await measure(mp3);
    expect(() =>
      assertWithinPolicy(delivery, LOUDNESS_TARGETS.spoken),
    ).not.toThrow();
  });

  test("a take whose peaks limiting cannot tame fails with the reason instead of landing off target", async () => {
    // A dense pulse train peaks every pitch period, so a limiter only scales
    // it: its crest factor is intrinsic. Speech is not like this, but the
    // failure must say why rather than hand an off-target master to policy.
    const raw = join(dir, "pulses-raw.wav");
    writeSpeechLikeWav(raw, { seconds: 6, harmonics: 20, burstGain: 0 });
    await expect(
      normalize(raw, join(dir, "pulses-norm.wav"), {
        targetLufs: LOUDNESS_TARGETS.spoken,
      }),
    ).rejects.toThrow(/cannot reach -16 LUFS under -1 dBTP/);
  });

  test("a 128k mp3 decodes at its source's loudness", async () => {
    // LAME scales input by 0.95 (-0.45 dB) below 192 kbps; the delivery must
    // not inherit that offset, or it eats most of the ±0.5 LU tolerance.
    const raw = join(dir, "level-raw.wav");
    const mp3 = join(dir, "level.mp3");
    await synthTone(raw, { hz: 1000, seconds: 3, gainDb: -10 });
    await encodeMp3(raw, mp3, { bitrateKbps: 128, channels: 2 });
    const source = await measure(raw);
    const decoded = await measure(mp3);
    expect(
      Math.abs(decoded.integratedLufs - source.integratedLufs),
    ).toBeLessThanOrEqual(0.1);
  });
});
