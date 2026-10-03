import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import {
  createYouTubeTranscriber,
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
