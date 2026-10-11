import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { runFfmpeg } from "../src/audio/ffmpeg";
import { probeStreams } from "../src/audio/encode";
import type { Measurement } from "../src/audio/loudness";
import { synthTone } from "../src/audio/synth";
import {
  assembleEpisodeHandler,
  EPISODE_LEAD_IN_SECS,
} from "../src/jobs/assembleEpisode";
import { narrateHandler, synthesizeRetained } from "../src/jobs/narrate";
import { voiceById } from "../../convex/shared/voices";
import { SynthesisRejectedError } from "../src/tts/types";
import type { NewArtifact, ToolClient } from "../src/jobs/types";
import { assertUnderUploadCap, MAX_UPLOAD_BYTES } from "../src/upload";

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

const dirs: string[] = [];
function workDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  measureOverride.fn = undefined;
  statOverride.sizeFor = undefined;
});

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

// Records every artifact minted, the path uploaded for it, and the signal
// each upload received.
function fakeTools() {
  const minted: NewArtifact[] = [];
  const uploaded: { path: string; mimeType: string; signal?: AbortSignal }[] =
    [];
  const tools: ToolClient = {
    generateAudioUploadUrl: vi.fn(async ({ artifact }) => {
      minted.push(artifact);
      return {
        artifactId: `a${minted.length}`,
        uploadUrl: "http://upload.test/x",
      };
    }),
    attachAudioStorage: vi.fn(async () => null),
    uploadBytes: vi.fn(
      async (
        _url: string,
        path: string,
        mimeType: string,
        signal?: AbortSignal,
      ) => {
        uploaded.push({ path, mimeType, signal });
        return { storageId: `s${uploaded.length}` };
      },
    ),
  };
  return { tools, minted, uploaded };
}

const narrateJob = {
  jobId: "j",
  kind: "narrate" as const,
  leaseToken: "L",
  leaseExpiresAt: Date.now() + 60_000,
  attempts: 0,
  input: {
    kind: "narrate" as const,
    script: {
      paragraphs: ["Short one.", "This is a longer second paragraph here."],
      chapters: [
        { title: "A", startParagraph: 0 },
        { title: "B", startParagraph: 1 },
      ],
    },
    voiceId: "inworld-max",
    promptVersion: "narration.v1",
    target: "spoken" as const,
    title: "T",
    access: "feed" as const,
    refs: { weeklyBriefId: "wb1" as never },
    assembleOnDone: false,
    rendererVersion: "0.2.0",
  },
};

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
  test.each([
    "abort",
    "network",
  ])("%s during synthesis preserves unfinished intent and refuses another paid call", async (kind) => {
    const controller = new AbortController();
    const ctx = {
      job: narrateJob,
      workDir: workDir("unfinished-"),
      retainedDir: workDir("unfinished-retained-"),
      tools: fakeTools().tools,
      rendererVersion: "0.2.0",
      signal: controller.signal,
    };
    const voice = voiceById(narrateJob.input.voiceId);
    const synthesize = vi.fn(async () => {
      if (kind === "abort") controller.abort(new Error("lease lost"));
      throw new Error(
        kind === "abort" ? "lease lost" : "ambiguous transport failure",
      );
    });
    await expect(
      synthesizeRetained(
        ctx,
        { synthesize },
        voice,
        "test",
        join(ctx.workDir, "chunk.wav"),
      ),
    ).rejects.toThrow();
    await expect(
      synthesizeRetained(
        { ...ctx, signal: new AbortController().signal },
        { synthesize },
        voice,
        "test",
        join(ctx.workDir, "retry.wav"),
      ),
    ).rejects.toThrow("unfinished chunk");
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  test("a confirmed synthesis rejection permits a later call", async () => {
    const ctx = {
      job: narrateJob,
      workDir: workDir("rejected-"),
      retainedDir: workDir("rejected-retained-"),
      tools: fakeTools().tools,
      rendererVersion: "0.2.0",
      signal: new AbortController().signal,
    };
    const voice = voiceById(narrateJob.input.voiceId);
    const synthesize = vi
      .fn()
      .mockRejectedValueOnce(
        new SynthesisRejectedError("Provider rejected request"),
      )
      .mockImplementationOnce(async (_text, _voice, output) => {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(output, "acknowledged audio");
      });
    await expect(
      synthesizeRetained(
        ctx,
        { synthesize },
        voice,
        "test",
        join(ctx.workDir, "chunk.wav"),
      ),
    ).rejects.toThrow("Provider rejected");
    await synthesizeRetained(
      ctx,
      { synthesize },
      voice,
      "test",
      join(ctx.workDir, "retry.wav"),
    );
    expect(synthesize).toHaveBeenCalledTimes(2);
  });
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

describe("assembleEpisode job", () => {
  let server: Server | undefined;
  afterAll(() => {
    server?.close();
  });

  // Serves one WAV the way Convex storage does: a plain GET by URL.
  async function serveWav(path: string): Promise<string> {
    const bytes = await readFile(path);
    server = createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(302, { location: "/narration" });
        response.end();
        return;
      }
      if (request.url !== "/narration") {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "audio/wav" });
      response.end(bytes);
    });
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  test("downloads the narration master, prepends the lead-in, shifts chapters, uploads private master and feed delivery", async () => {
    const dir = workDir("episode-src-");
    const narration = join(dir, "narration-master.wav");
    await synthTone(narration, { hz: 440, seconds: 2, gainDb: -20 });
    const base = await serveWav(narration);
    const { tools, minted, uploaded } = fakeTools();
    const signal = new AbortController().signal;
    const chapters = [
      { title: "Open", startSecs: 0 },
      { title: "Next", startSecs: 1.25 },
    ];
    const result = await assembleEpisodeHandler({
      job: {
        jobId: "e",
        kind: "assembleEpisode",
        leaseToken: "L",
        leaseExpiresAt: Date.now() + 60_000,
        attempts: 0,
        input: {
          kind: "assembleEpisode",
          narrationArtifactId: "n1" as never,
          narrationStorageUrl: `${base}/narration`,
          title: "Weekly turn",
          chapters,
          refs: { weeklyBriefId: "wb1" as never },
          rendererVersion: "0.2.0",
        },
      },
      workDir: workDir("episode-"),
      tools,
      rendererVersion: "0.2.0",
      signal,
    });
    expect(result.kind).toBe("assembleEpisode");
    expect(minted.map((artifact) => artifact.role)).toEqual([
      "masterNormalized",
      "delivery",
    ]);
    expect(minted.map((artifact) => artifact.kind)).toEqual([
      "episode",
      "episode",
    ]);
    expect(minted[0]?.access).toBe("private");
    expect(minted[1]?.access).toBe("feed");
    // R29: the episode links back to the brief through the job's refs.
    for (const artifact of minted) {
      expect(artifact.refs).toEqual({ weeklyBriefId: "wb1" });
    }
    const shifted = [
      { title: "Open", startSecs: EPISODE_LEAD_IN_SECS },
      { title: "Next", startSecs: 1.25 + EPISODE_LEAD_IN_SECS },
    ];
    expect(minted[1]?.chapters).toEqual(shifted);
    // R22: the result carries the shifted chapters for the effect to store.
    expect(result.chapters).toEqual(shifted);
    for (const artifact of result.artifacts) {
      expect(artifact.durationSecs).toBeCloseTo(2 + EPISODE_LEAD_IN_SECS, 0);
      expect(Math.abs(artifact.loudnessLufs + 16)).toBeLessThanOrEqual(0.5);
      expect(artifact.truePeakDbtp).toBeLessThanOrEqual(-1);
    }
    for (const upload of uploaded) expect(upload.signal).toBe(signal);

    // A job enqueued before refs existed still assembles, with empty refs.
    const legacy = fakeTools();
    await assembleEpisodeHandler({
      job: {
        jobId: "e",
        kind: "assembleEpisode",
        leaseToken: "L",
        leaseExpiresAt: Date.now() + 60_000,
        attempts: 0,
        input: {
          kind: "assembleEpisode",
          narrationArtifactId: "n1" as never,
          narrationStorageUrl: `${base}/narration`,
          title: "Weekly turn",
          chapters,
          rendererVersion: "0.2.0",
        },
      },
      workDir: workDir("episode-legacy-"),
      tools: legacy.tools,
      rendererVersion: "0.2.0",
      signal,
    });
    expect(legacy.minted.map((artifact) => artifact.refs)).toEqual([{}, {}]);

    // Redirects and missing blobs fail before anything is minted, and the
    // error never carries the URL.
    for (const path of ["/redirect", "/missing"]) {
      const again = fakeTools();
      const error: unknown = await assembleEpisodeHandler({
        job: {
          jobId: "e",
          kind: "assembleEpisode",
          leaseToken: "L",
          leaseExpiresAt: Date.now() + 60_000,
          attempts: 0,
          input: {
            kind: "assembleEpisode",
            narrationArtifactId: "n1" as never,
            narrationStorageUrl: `${base}${path}`,
            title: "Weekly turn",
            chapters,
            rendererVersion: "0.2.0",
          },
        },
        workDir: workDir("episode-bad-"),
        tools: again.tools,
        rendererVersion: "0.2.0",
        signal,
      }).then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/download failed/);
      expect((error as Error).message).not.toContain(base);
      expect(again.minted).toHaveLength(0);
    }
  });
});
