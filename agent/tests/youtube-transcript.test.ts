import { readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import {
  createYouTubeTranscriber,
  ffmpegSegmentArgs,
  GROQ_TRANSCRIPTION_URL,
  ytDlpAudioArgs,
} from "../src/tools/youtubeTranscript";
import {
  createCaptureTranscriptsNode,
  createSummarizeNode,
} from "../src/graphs/transcript-capture/nodes";
import type { TranscriptCaptureState } from "../src/state/transcriptCaptureState";

const speech =
  "Do you know why we have a perfect eclipse? The moon and the sun appear the same size from Earth because of their distances. ";

// A fake yt-dlp that writes an audio file where -o points.
const downloads =
  (output = "[download] done") =>
  async (args: string[]) => {
    const template = args[args.indexOf("-o") + 1] as string;
    await writeFile(`${dirname(template)}/vid.webm`, Buffer.from("audio"));
    return { code: 0, output };
  };

const groq = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

// Audio over Groq's 24 MB upload limit.
const downloadsLong = async (args: string[]) => {
  const template = args[args.indexOf("-o") + 1] as string;
  await writeFile(`${dirname(template)}/vid.webm`, Buffer.alloc(24_000_001, 1));
  return { code: 0, output: "[download] done" };
};

// A fake ffmpeg that writes segments where the output pattern points.
const segments = (count: number, code = 0) =>
  vi.fn(async (args: string[]) => {
    const pattern = args.at(-1) as string;
    for (let i = 0; i < count; i++) {
      await writeFile(
        pattern.replace("%03d", String(i).padStart(3, "0")),
        Buffer.from(`segment ${i}`),
      );
    }
    return { code, output: code ? "Error opening input" : "" };
  });

describe("YouTube transcriber", () => {
  test("asks yt-dlp for the lowest-bitrate original-language audio", () => {
    const args = ytDlpAudioArgs("dQw4w9WgXcQ", "/tmp/x", {
      pluginDirs: "/opt/yt-dlp/plugins",
      potBaseUrl: "http://127.0.0.1:4416",
    });
    expect(args).toEqual(
      expect.arrayContaining([
        "--plugin-dirs",
        "/opt/yt-dlp/plugins",
        "--extractor-args",
        "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416",
        "--js-runtimes",
        "node",
        "-f",
        "wa[protocol=https][format_note*=original]/wa[protocol=https][language^=en]/wa[protocol=https]/ba[protocol=https]",
        "--abort-on-unavailable-fragments",
        "--no-cache-dir",
        "--max-filesize",
        "150000000",
        "--match-filter",
        "duration <= 7200",
      ]),
    );
    // The URL follows "--" so it can never be read as an option.
    expect(args.slice(-2)).toEqual([
      "--",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ]);
  });

  test("transcribes downloaded audio with Groq Whisper", async () => {
    const fetchImpl = groq({ text: speech.repeat(2), language: "English" });
    const { transcribe } = createYouTubeTranscriber({
      apiKey: "test-groq-key",
      ytDlp: downloads(),
      fetchImpl,
    });
    expect(await transcribe("dQw4w9WgXcQ")).toEqual({
      kind: "captured",
      text: speech.repeat(2).trim(),
      model: "whisper-large-v3-turbo",
      language: "English",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(GROQ_TRANSCRIPTION_URL);
    expect(init.headers).toEqual({ authorization: "Bearer test-groq-key" });
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("response_format")).toBe("verbose_json");
  });

  test("splits audio over 24 MB into Opus segments and joins their text in order", async () => {
    const ffmpeg = segments(3);
    let call = 0;
    let filesAtUpload: string[] = [];
    const prompts: unknown[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (call === 0) {
        const ffmpegArgs = ffmpeg.mock.calls[0]?.[0] as string[];
        const input = ffmpegArgs[ffmpegArgs.indexOf("-i") + 1] as string;
        filesAtUpload = await readdir(dirname(input));
      }
      const form = init?.body as FormData;
      const file = form.get("file") as File;
      expect(file.size).toBeLessThan(24_000_000);
      // Each segment after the first sees how the previous one ended.
      prompts.push(form.get("prompt"));
      call += 1;
      return new Response(
        JSON.stringify({
          text: ` Part ${call}. ${speech}`,
          ...(call === 1 ? { language: "English" } : {}),
        }),
      );
    });
    const { transcribe } = createYouTubeTranscriber({
      apiKey: "k",
      ytDlp: downloadsLong,
      ffmpeg,
      fetchImpl,
    });
    const outcome = await transcribe("dQw4w9WgXcQ");
    expect(outcome).toMatchObject({ kind: "captured", language: "English" });
    const text = (outcome as { text: string }).text;
    expect(text.indexOf("Part 1.")).toBe(0);
    expect(text.indexOf("Part 2.")).toBeGreaterThan(text.indexOf("Part 1."));
    expect(text.indexOf("Part 3.")).toBeGreaterThan(text.indexOf("Part 2."));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(prompts[0]).toBeNull();
    expect(String(prompts[1])).toMatch(/^Part 1\. .*distances\.$/);
    expect(String(prompts[2])).toMatch(/^Part 2\. /);
    const args = ffmpeg.mock.calls[0]?.[0] as string[];
    expect(args.slice(0, 4)).toEqual([
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
    ]);
    expect(args).toEqual(
      expect.arrayContaining([
        "-c:a",
        "libopus",
        "-b:a",
        "24k",
        "-f",
        "segment",
      ]),
    );
    // The original download is deleted before the segments are uploaded.
    expect(filesAtUpload).toEqual(["segments"]);
  });

  test("does not run ffmpeg for audio within the upload limit", async () => {
    const ffmpeg = segments(1);
    const { transcribe } = createYouTubeTranscriber({
      apiKey: "k",
      ytDlp: downloads(),
      ffmpeg,
      fetchImpl: groq({ text: speech.repeat(2) }),
    });
    expect(await transcribe("dQw4w9WgXcQ")).toMatchObject({ kind: "captured" });
    expect(ffmpeg).not.toHaveBeenCalled();
  });

  test("classifies segmentation failures and segment rate limits", async () => {
    const make = (
      ffmpeg: ReturnType<typeof segments>,
      fetchImpl: typeof fetch = groq({ text: speech.repeat(2) }),
    ) =>
      createYouTubeTranscriber({
        apiKey: "k",
        ytDlp: downloadsLong,
        ffmpeg,
        fetchImpl,
      }).transcribe("dQw4w9WgXcQ");
    expect(await make(segments(0, 1))).toEqual({
      kind: "failed",
      detail: "ffmpeg: Error opening input",
    });
    expect(await make(segments(0))).toEqual({
      kind: "failed",
      detail: "ffmpeg produced no segments",
    });
    // A rate limit on any segment retries the whole video later.
    let call = 0;
    const secondLimited = vi.fn(async () =>
      ++call === 2
        ? new Response("{}", { status: 429 })
        : new Response(JSON.stringify({ text: speech })),
    );
    expect(await make(segments(3), secondLimited)).toEqual({
      kind: "rate_limited",
      detail: "Groq: HTTP 429",
    });
    expect(secondLimited).toHaveBeenCalledTimes(2);
  });

  test("ffmpeg writes numbered Ogg segments into the given directory", () => {
    const args = ffmpegSegmentArgs("/tmp/x/vid.webm", "/tmp/x/segments");
    expect(args.at(-1)).toBe(join("/tmp/x/segments", "segment-%03d.ogg"));
    expect(args).toEqual(
      expect.arrayContaining([
        "-i",
        "/tmp/x/vid.webm",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-segment_time",
        "1800",
      ]),
    );
  });

  test("classifies rate limits, unavailable videos and silence", async () => {
    const make = (
      ytDlp: Parameters<typeof createYouTubeTranscriber>[0]["ytDlp"],
      fetchImpl = groq({ text: speech.repeat(2) }),
    ) => createYouTubeTranscriber({ apiKey: "k", ytDlp, fetchImpl }).transcribe;
    expect(
      await make(async () => ({
        code: 1,
        output: "ERROR: Unable to download: HTTP Error 429: Too Many Requests",
      }))("dQw4w9WgXcQ"),
    ).toMatchObject({ kind: "rate_limited" });
    expect(
      await make(async () => ({
        code: 1,
        output: "ERROR: [youtube] x: Video unavailable",
      }))("dQw4w9WgXcQ"),
    ).toMatchObject({ kind: "unavailable" });
    expect(
      await make(async () => ({ code: 1, output: "ERROR: network down" }))(
        "dQw4w9WgXcQ",
      ),
    ).toMatchObject({ kind: "failed" });
    // A partial download that exits non-zero is never transcribed.
    const partial = async (args: string[]) => {
      await downloads()(args);
      return {
        code: 1,
        output: "ERROR: fragment 3 not found, unable to continue",
      };
    };
    const unusedGroq = groq({ text: speech.repeat(2) });
    expect(await make(partial, unusedGroq)("dQw4w9WgXcQ")).toMatchObject({
      kind: "failed",
    });
    expect(unusedGroq).not.toHaveBeenCalled();
    // A filter-skipped video exits 0 without audio.
    expect(
      await make(async () => ({
        code: 0,
        output:
          "[download] x does not pass filter (duration <= 7200), skipping ..",
      }))("dQw4w9WgXcQ"),
    ).toMatchObject({ kind: "unavailable" });
    expect(await make(downloads(), groq({ text: "♪" }))("dQw4w9WgXcQ")).toEqual(
      { kind: "unavailable", detail: "No speech to transcribe" },
    );
    expect(
      await make(downloads(), groq({ error: {} }, 429))("dQw4w9WgXcQ"),
    ).toEqual({ kind: "rate_limited", detail: "Groq: HTTP 429" });
    // "This video is unavailable" is parked only when oEmbed confirms it.
    const unavailableOutput = async () => ({
      code: 1,
      output: "ERROR: [youtube] x: This video is unavailable",
    });
    const oembed = (status: number) =>
      vi.fn(async () => new Response("{}", { status }));
    const gone = oembed(404);
    expect(await make(unavailableOutput, gone)("dQw4w9WgXcQ")).toMatchObject({
      kind: "unavailable",
    });
    expect(String((gone.mock.calls[0] as unknown[])[0])).toContain(
      "https://www.youtube.com/oembed?url=",
    );
    expect(
      await make(unavailableOutput, oembed(200))("dQw4w9WgXcQ"),
    ).toMatchObject({ kind: "failed" });
    // 401 also means "embedding disabled" for a public video: not proof.
    expect(
      await make(unavailableOutput, oembed(401))("dQw4w9WgXcQ"),
    ).toMatchObject({ kind: "failed" });
    expect(
      await make(
        unavailableOutput,
        vi.fn(async () => {
          throw new Error("offline");
        }),
      )("dQw4w9WgXcQ"),
    ).toMatchObject({ kind: "failed" });
    // An upcoming livestream or premiere is retried later, not parked.
    expect(
      await make(async () => ({
        code: 1,
        output: "ERROR: [youtube] x: This live event will begin in 3 hours.",
      }))("dQw4w9WgXcQ"),
    ).toMatchObject({ kind: "failed" });
    expect(await make(downloads())("--exec=rm")).toMatchObject({
      kind: "unavailable",
    });
    expect(
      createYouTubeTranscriber({ apiKey: "", ytDlp: downloads() }).configured,
    ).toBe(false);
  });
});

describe("transcript-capture graph", () => {
  const backlog = (ids: string[], isDone = true) => ({
    rows: ids.map((id) => ({
      id: `source-${id}`,
      videoId: id,
      title: `T ${id}`,
    })),
    continueCursor: "next",
    isDone,
  });

  test("captures a paced batch and records every outcome", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "listTranscriptBacklog"
        ? backlog(["AAAAAAAAAAA", "BBBBBBBBBBB"])
        : name === "recordTranscriptCapture"
          ? { updated: true }
          : { ok: true },
    );
    const sleep = vi.fn(async () => undefined);
    const transcribe = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "captured",
        text: speech.repeat(2),
        model: "whisper-large-v3-turbo",
        language: "English",
      })
      .mockResolvedValueOnce({ kind: "unavailable", detail: "Private video" });
    const update = await createCaptureTranscriptsNode(
      callTool,
      { configured: true, transcribe },
      sleep,
    )({ agentRunId: "run-t" });
    expect(sleep).toHaveBeenCalledTimes(1);
    const records = callTool.mock.calls.filter(
      ([name]) => name === "recordTranscriptCapture",
    );
    expect(records).toEqual([
      [
        "recordTranscriptCapture",
        {
          sourceId: "source-AAAAAAAAAAA",
          agentRunId: "run-t",
          outcome: "captured",
          transcript: speech.repeat(2),
          model: "whisper-large-v3-turbo",
          language: "English",
        },
      ],
      [
        "recordTranscriptCapture",
        {
          sourceId: "source-BBBBBBBBBBB",
          agentRunId: "run-t",
          outcome: "unavailable",
          detail: "Private video",
        },
      ],
    ]);
    expect(update.tally).toMatchObject({
      attempted: 2,
      captured: ["T AAAAAAAAAAA"],
      unavailable: 1,
      rateLimited: false,
    });
  });

  test("counts a capture only when it was stored", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "listTranscriptBacklog"
        ? backlog(["AAAAAAAAAAA"])
        : name === "recordTranscriptCapture"
          ? { updated: false }
          : { ok: true },
    );
    const update = await createCaptureTranscriptsNode(
      callTool,
      {
        configured: true,
        transcribe: async () => ({
          kind: "captured" as const,
          text: speech.repeat(2),
          model: "whisper-large-v3-turbo",
        }),
      },
      async () => undefined,
    )({ agentRunId: "run-t" });
    expect(update.tally).toMatchObject({ captured: [], failed: 1 });
  });

  test("an unexpected transcriber error is recorded and the batch continues", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "listTranscriptBacklog"
        ? backlog(["AAAAAAAAAAA", "BBBBBBBBBBB"])
        : name === "recordTranscriptCapture"
          ? { updated: true }
          : { ok: true },
    );
    const transcribe = vi
      .fn()
      .mockRejectedValueOnce(new Error("ENOSPC: no space left on device"))
      .mockResolvedValueOnce({
        kind: "captured",
        text: speech.repeat(2),
        model: "whisper-large-v3-turbo",
      });
    const update = await createCaptureTranscriptsNode(
      callTool,
      { configured: true, transcribe },
      async () => undefined,
    )({ agentRunId: "run-t" });
    expect(callTool).toHaveBeenCalledWith("recordTranscriptCapture", {
      sourceId: "source-AAAAAAAAAAA",
      agentRunId: "run-t",
      outcome: "attempted",
      detail: "ENOSPC: no space left on device",
    });
    expect(update.tally).toMatchObject({
      captured: ["T BBBBBBBBBBB"],
      failed: 1,
    });
  });

  test("stops at the first rate limit and records the attempt", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "listTranscriptBacklog"
        ? backlog(["AAAAAAAAAAA", "BBBBBBBBBBB"])
        : { ok: true },
    );
    const transcribe = vi.fn(async () => ({
      kind: "rate_limited" as const,
      detail: "YouTube: HTTP Error 429",
    }));
    const update = await createCaptureTranscriptsNode(
      callTool,
      { configured: true, transcribe },
      async () => undefined,
    )({ agentRunId: "run-t" });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledWith("recordTranscriptCapture", {
      sourceId: "source-AAAAAAAAAAA",
      agentRunId: "run-t",
      outcome: "rate_limited",
      detail: "YouTube: HTTP Error 429",
    });
    expect(update.tally?.rateLimited).toBe(true);
  });

  test("does nothing without a Groq key and says so", async () => {
    const callTool = vi.fn(async () => ({ ok: true }));
    const update = await createCaptureTranscriptsNode(
      callTool,
      { configured: false, transcribe: vi.fn() },
      async () => undefined,
    )({ agentRunId: "run-t" });
    expect(callTool).not.toHaveBeenCalled();
    const summary = await createSummarizeNode(callTool)({
      ...update,
      agentRunId: "run-t",
      auditEvents: [],
    } as unknown as TranscriptCaptureState);
    expect(summary.summary).toBe(
      "transcript-capture completed: skipped, GROQ_API_KEY is not configured",
    );
  });
});
