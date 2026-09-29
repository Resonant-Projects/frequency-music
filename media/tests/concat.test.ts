import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { concatWithGaps, trimEdges } from "../src/audio/concat";
import { probeStreams } from "../src/audio/encode";
import { measure } from "../src/audio/loudness";
import { synthTone } from "../src/audio/synth";

const dir = mkdtempSync(join(tmpdir(), "concat-"));
const signal = new AbortController().signal;

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("concat", () => {
  test("joins with gaps and reports start offsets", async () => {
    const a = join(dir, "a.wav");
    const b = join(dir, "b.wav");
    const out = join(dir, "ab.wav");
    await synthTone(a, { hz: 440, seconds: 1 });
    await synthTone(b, { hz: 660, seconds: 2 });
    const { starts } = await concatWithGaps([a, b], out, 400, {}, signal);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeCloseTo(1.4, 1);
    expect((await measure(out)).durationSecs).toBeCloseTo(3.4, 1);
    const info = await probeStreams(out);
    expect(info.channels).toBe(1);
    expect(info.sampleRate).toBe(48000);
  });

  test("a single input with lead and tail padding keeps its level and length", async () => {
    const tone = join(dir, "tone.wav");
    const padded = join(dir, "padded.wav");
    await synthTone(tone, { hz: 440, seconds: 1, gainDb: -20 });
    await concatWithGaps([tone], padded, 0, { leadMs: 1000, tailMs: 500 });
    const measured = await measure(padded);
    expect(measured.durationSecs).toBeCloseTo(2.5, 1);
    // amix with normalize=0 must not attenuate the lone input.
    expect(measured.truePeakDbtp).toBeCloseTo(-20, 0);
  });

  test("trimEdges keeps 300 ms of edge silence", async () => {
    const tone = join(dir, "tone2.wav");
    const padded = join(dir, "padded2.wav");
    const trimmed = join(dir, "trimmed.wav");
    // 2 s silence, 1 s tone, 2 s silence
    await synthTone(tone, { hz: 440, seconds: 1 });
    await concatWithGaps([tone], padded, 0, { leadMs: 2000, tailMs: 2000 });
    expect((await measure(padded)).durationSecs).toBeCloseTo(5, 1);
    await trimEdges(padded, trimmed, 300, signal);
    const duration = (await measure(trimmed)).durationSecs;
    expect(duration).toBeGreaterThan(1.4);
    expect(duration).toBeLessThan(1.8);
  });
});
