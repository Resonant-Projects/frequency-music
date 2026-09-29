import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { encodeMp3, encodeWav, probeStreams } from "../src/audio/encode";
import { synthTone } from "../src/audio/synth";

const dir = mkdtempSync(join(tmpdir(), "media-encode-"));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("encodeMp3", () => {
  test("produces dual-mono stereo at 48 kHz with no metadata tags", async () => {
    const raw = join(dir, "t.wav");
    const mp3 = join(dir, "t.mp3");
    await synthTone(raw, { hz: 440, seconds: 1, gainDb: -20 });
    await encodeMp3(raw, mp3, {
      bitrateKbps: 128,
      channels: 2,
      title: "should be stripped",
    });
    const info = await probeStreams(mp3);
    expect(info.codec).toBe("mp3");
    expect(info.channels).toBe(2);
    expect(info.sampleRate).toBe(48000);
    expect(info.tags).toEqual({});
  });
});

describe("encodeWav", () => {
  test("produces 24-bit stereo at 48 kHz with no metadata tags", async () => {
    const raw = join(dir, "w.wav");
    const wav = join(dir, "w-stereo.wav");
    await synthTone(raw, { hz: 440, seconds: 1, gainDb: -20 });
    await encodeWav(raw, wav, { channels: 2 });
    const info = await probeStreams(wav);
    expect(info.codec).toBe("pcm_s24le");
    expect(info.channels).toBe(2);
    expect(info.sampleRate).toBe(48000);
    expect(info.tags).toEqual({});
  });

  test("bitDepth 16 writes pcm_s16le mono for the wave 1 masters", async () => {
    const raw = join(dir, "w16-raw.wav");
    const wav = join(dir, "w16.wav");
    await synthTone(raw, { hz: 440, seconds: 1, gainDb: -20 });
    await encodeWav(raw, wav, { channels: 1, bitDepth: 16 });
    const info = await probeStreams(wav);
    expect(info.codec).toBe("pcm_s16le");
    expect(info.channels).toBe(1);
    expect(info.sampleRate).toBe(48000);
    expect(info.tags).toEqual({});
  });
});
