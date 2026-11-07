import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { runFfmpeg } from "../src/audio/ffmpeg";
import { probeStreams } from "../src/audio/encode";
import type { Measurement } from "../src/audio/loudness";
import { synthTone } from "../src/audio/synth";
import { narrateHandler } from "../src/jobs/narrate";
import { assertUnderUploadCap, MAX_UPLOAD_BYTES } from "../src/upload";
import { fakeTools, narrateJob, workDir } from "./jobFixtures";

type Measure = (path: string, signal?: AbortSignal) => Promise<Measurement>;
type Stat = typeof import("node:fs/promises").stat;
const { measureOverride, statOverride } = vi.hoisted(() => ({
  measureOverride: {
    fn: undefined as
      | undefined
      | ((path: string, actual: Measure) => Promise<Measurement>),
  },
  statOverride: {
    // Reported size for a path, or undefined for the real stat.
    sizeFor: undefined as undefined | ((path: string) => number | undefined),
  },
}));

// Passthrough by default; a test can pretend one file is huge without
// writing 95 MB to disk.
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const stat: Stat = (async (path: Parameters<Stat>[0], options?: unknown) => {
    const real = await (actual.stat as Stat)(path, options as never);
    const size = statOverride.sizeFor?.(String(path));
    return size === undefined ? real : { ...real, size };
  }) as Stat;
  return { ...actual, stat };
});

// Passthrough by default; a test can override `measure` for one file without
// touching normalize()'s internal measurement.
vi.mock("../src/audio/loudness", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/audio/loudness")>();
  return {
    ...actual,
    measure: (path: string, signal?: AbortSignal) =>
      measureOverride.fn
        ? measureOverride.fn(path, actual.measure)
        : actual.measure(path, signal),
  };
});

afterEach(() => {
  measureOverride.fn = undefined;
  statOverride.sizeFor = undefined;
});

// A fake voice: a 440 Hz tone whose length depends on the text, so the
// second paragraph is audibly longer than the first.
const toneSynth = vi.fn(
  async (text: string, _voice: unknown, out: string, signal?: AbortSignal) => {
    await synthTone(
      out,
      { hz: 440, seconds: text.length > 20 ? 2 : 1, gainDb: -25 },
      signal,
    );
  },
);

describe("narrate job", () => {
  test("renders paragraphs, joins with gaps, computes chapter starts, uploads master then delivery", async () => {
    const { tools, minted, uploaded } = fakeTools();
    const signal = new AbortController().signal;
    const result = await narrateHandler(
      {
        job: narrateJob,
        workDir: workDir("narr-"),
        tools,
        rendererVersion: "0.2.0",
        signal,
      },
      { synthesize: toneSynth },
    );
    expect(result.kind).toBe("narrate");
    expect(minted.map((artifact) => artifact.role)).toEqual([
      "masterNormalized",
      "delivery",
    ]);
    expect(result.chapters[0]).toEqual({ title: "A", startSecs: 0 });
    expect(result.chapters[1]?.startSecs).toBeCloseTo(1.4, 1);
    expect(result.artifacts).toHaveLength(2);
    for (const artifact of result.artifacts) {
      expect(Math.abs(artifact.loudnessLufs + 16)).toBeLessThanOrEqual(0.5);
      expect(artifact.truePeakDbtp).toBeLessThanOrEqual(-1);
      expect(artifact.durationSecs).toBeCloseTo(3.4, 0);
    }
    // R18: the master is always private; only the delivery takes the
    // caller's access.
    expect(minted[0]?.access).toBe("private");
    expect(minted[1]?.access).toBe("feed");
    expect(minted[1]?.masterArtifactId).toBe("a1");
    expect(minted[0]?.encoding).toEqual({
      codec: "wav",
      sampleRate: 48000,
      channels: 1,
    });
    expect(minted[0]?.chapters).toEqual(result.chapters);
    expect(minted[0]?.voice).toEqual({
      catalogId: "inworld-max",
      promptVersion: "narration.v1",
    });
    expect(minted[0]?.scriptMd).toBe(
      "Short one.\n\nThis is a longer second paragraph here.",
    );
    expect(minted[0]?.contentHash).not.toBe(minted[1]?.contentHash);
    // Both artifacts carry the job's refs (the brief).
    for (const artifact of minted) {
      expect(artifact.refs).toEqual({ weeklyBriefId: "wb1" });
    }
    // R21: the master is 16-bit mono 48 kHz; the delivery is dual-mono MP3.
    const master = await probeStreams(uploaded[0]!.path);
    expect(master.codec).toBe("pcm_s16le");
    expect(master.channels).toBe(1);
    expect(master.sampleRate).toBe(48000);
    expect(uploaded[0]?.mimeType).toBe("audio/wav");
    const delivery = await probeStreams(uploaded[1]!.path);
    expect(delivery.codec).toBe("mp3");
    expect(delivery.channels).toBe(2);
    expect(uploaded[1]?.mimeType).toBe("audio/mpeg");
    // R8: the job signal reaches every upload and the synthesizer.
    for (const upload of uploaded) expect(upload.signal).toBe(signal);
    for (const call of toneSynth.mock.calls) expect(call[3]).toBe(signal);
    expect(tools.attachAudioStorage).toHaveBeenCalledTimes(2);
  });

  test("oversize WAV uses lossless FLAC at 48 kHz with identical decoded PCM", async () => {
    statOverride.sizeFor = (path) =>
      path.endsWith("master.wav") ? MAX_UPLOAD_BYTES + 1 : undefined;
    const { tools, minted, uploaded } = fakeTools();
    const dir = workDir("narr-flac-");
    await narrateHandler(
      {
        job: narrateJob,
        workDir: dir,
        tools,
        rendererVersion: "0.2.0",
        signal: new AbortController().signal,
      },
      { synthesize: toneSynth },
    );
    expect(minted[0]?.encoding).toEqual({
      codec: "flac",
      sampleRate: 48000,
      channels: 1,
    });
    expect(uploaded[0]?.mimeType).toBe("audio/flac");
    expect(await probeStreams(join(dir, "master.flac"))).toMatchObject({
      sampleRate: 48000,
      channels: 1,
    });
    for (const format of ["wav", "flac"])
      await runFfmpeg([
        "-i",
        join(dir, `master.${format}`),
        "-f",
        "s16le",
        join(dir, `${format}.pcm`),
      ]);
    expect(await readFile(join(dir, "flac.pcm"))).toEqual(
      await readFile(join(dir, "wav.pcm")),
    );
  });

  test("oversize FLAC prevents upload and retains synthesized chunks for retry", async () => {
    const { tools, minted } = fakeTools();
    const retainedDir = workDir("narr-retained-");
    const ctx = {
      job: narrateJob,
      workDir: workDir("narr-oversize-"),
      retainedDir,
      tools,
      rendererVersion: "0.2.0",
      signal: new AbortController().signal,
    };
    statOverride.sizeFor = (path) =>
      path.endsWith("master.wav") || path.endsWith("master.flac")
        ? MAX_UPLOAD_BYTES + 1
        : undefined;
    toneSynth.mockClear();
    await expect(
      narrateHandler(ctx, { synthesize: toneSynth }),
    ).rejects.toThrow(/upload cap/);
    const calls = toneSynth.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    expect(minted).toHaveLength(0);
    statOverride.sizeFor = undefined;
    await narrateHandler(
      { ...ctx, workDir: workDir("narr-retry-") },
      { synthesize: toneSynth },
    );
    expect(toneSynth).toHaveBeenCalledTimes(calls);
  });

  test("a delivery that breaks the true-peak ceiling is rejected before any upload is minted for it", async () => {
    measureOverride.fn = async (path, actual) =>
      path.endsWith(".mp3")
        ? { integratedLufs: -16, truePeakDbtp: -0.5, durationSecs: 3.4 }
        : actual(path);
    const { tools, minted } = fakeTools();
    await expect(
      narrateHandler(
        {
          job: narrateJob,
          workDir: workDir("narr-hot-"),
          tools,
          rendererVersion: "0.2.0",
          signal: new AbortController().signal,
        },
        { synthesize: toneSynth },
      ),
    ).rejects.toThrow(/dBTP/);
    // R9: the master passed policy and was uploaded; the delivery never
    // reached Convex.
    expect(minted.map((artifact) => artifact.role)).toEqual([
      "masterNormalized",
    ]);
    expect(tools.uploadBytes).toHaveBeenCalledTimes(1);
    expect(tools.attachAudioStorage).toHaveBeenCalledTimes(1);
  });

  test("an artifact over the upload cap is refused before its upload URL is minted", async () => {
    // Pure guard: the boundary is inclusive and the message names the role,
    // size, and cap.
    expect(() =>
      assertUnderUploadCap("delivery", MAX_UPLOAD_BYTES),
    ).not.toThrow();
    expect(() =>
      assertUnderUploadCap("masterNormalized", MAX_UPLOAD_BYTES + 1),
    ).toThrow(
      "masterNormalized is 95.0 MB, over the 95 MB upload cap (Cloudflare); split the script or move masters to FLAC",
    );
    // Through the handler: the delivery reports as 121 MB.
    statOverride.sizeFor = (path) =>
      path.endsWith(".mp3") ? 121_000_000 : undefined;
    const { tools, minted } = fakeTools();
    await expect(
      narrateHandler(
        {
          job: narrateJob,
          workDir: workDir("narr-big-"),
          tools,
          rendererVersion: "0.2.0",
          signal: new AbortController().signal,
        },
        { synthesize: toneSynth },
      ),
    ).rejects.toThrow(/delivery is 121\.0 MB, over the 95 MB upload cap/);
    // The master passed and was uploaded; the delivery never reached Convex.
    expect(minted.map((artifact) => artifact.role)).toEqual([
      "masterNormalized",
    ]);
    expect(tools.uploadBytes).toHaveBeenCalledTimes(1);
  });

  test("chunks a paragraph over the provider cap and joins the chunks", async () => {
    const { tools } = fakeTools();
    const synth = vi.fn(
      async (
        _text: string,
        _voice: unknown,
        out: string,
        signal?: AbortSignal,
      ) => {
        await synthTone(out, { hz: 440, seconds: 1, gainDb: -25 }, signal);
      },
    );
    const result = await narrateHandler(
      {
        job: {
          ...narrateJob,
          input: {
            ...narrateJob.input,
            script: {
              paragraphs: ["One sentence. Two sentence. Three sentence."],
              chapters: [{ title: "A", startParagraph: 0 }],
            },
          },
        },
        workDir: workDir("narr-chunk-"),
        tools,
        rendererVersion: "0.2.0",
        signal: new AbortController().signal,
      },
      { synthesize: synth, maxChars: 30 },
    );
    expect(synth.mock.calls.map((call) => call[0])).toEqual([
      "One sentence. Two sentence.",
      "Three sentence.",
    ]);
    // Two 1 s chunks with a 400 ms gap.
    expect(result.artifacts[0]?.durationSecs).toBeCloseTo(2.4, 0);
  });

  test("refuses another job kind", async () => {
    const { tools } = fakeTools();
    await expect(
      narrateHandler({
        job: {
          jobId: "j",
          kind: "probe",
          leaseToken: "L",
          leaseExpiresAt: Date.now() + 60_000,
          attempts: 0,
          input: {
            kind: "probe",
            toneHz: 440,
            seconds: 1,
            rendererVersion: "0.2.0",
          },
        },
        workDir: workDir("narr-kind-"),
        tools,
        rendererVersion: "0.2.0",
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/another kind/);
  });
});
