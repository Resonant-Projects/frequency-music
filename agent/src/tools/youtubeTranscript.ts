// YouTube transcripts for Sources that arrive without text. YouTube now
// rate-limits subtitle downloads (timedtext) from the Lab IP even with a PO
// token, so the worker downloads the video's audio with yt-dlp (PO tokens from
// the bgutil provider sidecar) and transcribes it with Groq Whisper. Audio
// over Groq's upload limit is re-encoded with ffmpeg into short segments,
// transcribed in order and joined.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  TRANSCRIPT_MAX_CHARS,
  TRANSCRIPT_MIN_CHARS,
  TRANSCRIPTION_MODEL,
} from "../../../convex/shared/agentContract.js";
import { redactError } from "../shared/redactError.js";

export const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
// Groq's API takes the model id without the catalog's "groq/" prefix.
const OEMBED_URL = "https://www.youtube.com/oembed";
export const DEFAULT_TRANSCRIPTION_MODEL = TRANSCRIPTION_MODEL.replace(
  /^groq\//,
  "",
);
// Groq caps a request at 25,000,000 bytes; leave room for multipart overhead.
const MAX_UPLOAD_BYTES = 24_000_000;
// The download fits the worker's 256 MiB /tmp together with its segments.
const MAX_DOWNLOAD_BYTES = 150_000_000;
// Groq limits audio seconds per hour, so very long videos stay out of scope.
const MAX_DURATION_SECONDS = 2 * 60 * 60;
// Mono 16 kHz Opus at 24 kbit/s (what Whisper resamples to anyway): a
// 30-minute segment is about 5.4 MB.
const SEGMENT_SECONDS = 30 * 60;
const YTDLP_TIMEOUT_MS = 5 * 60 * 1000;
const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;
const GROQ_TIMEOUT_MS = 3 * 60 * 1000;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const RATE_LIMITED =
  /HTTP Error 429|Too Many Requests|Sign in to confirm you(?:'|’)re not a bot/i;
const UNAVAILABLE =
  /Video unavailable|Private video|has been removed|members-only|Join this channel|confirm your age|age-restricted|not available in your country|does not pass filter|larger than max-filesize/i;
// "This video is unavailable" covers both deleted videos and refusals.
const GONE_OR_REFUSED = /This video is unavailable/i;
// A scheduled livestream or premiere becomes downloadable later: retry it.
const NOT_YET = /This live event|Premieres in|is upcoming|will begin in/i;

export type TranscriptOutcome =
  | { kind: "captured"; text: string; model: string; language?: string }
  | { kind: "unavailable"; detail: string }
  | { kind: "rate_limited"; detail: string }
  | { kind: "failed"; detail: string };

export type ProcessRunner = (
  args: string[],
) => Promise<{ code: number | null; output: string }>;
export type YtDlpRunner = ProcessRunner;

function runProcess(
  binary: string,
  label: string,
  timeoutMs: number,
): ProcessRunner {
  return (args) =>
    new Promise((resolve) => {
      // Its own process group: the PyInstaller binary runs yt-dlp in a child
      // process, which a signal to the bootloader alone would not stop.
      const child = spawn(binary, args, {
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
      let output = "";
      let settled = false;
      const settle = (result: { code: number | null; output: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const append = (chunk: Buffer) => {
        // Keep the tail: errors come last.
        output = (output + chunk.toString("utf8")).slice(-20_000);
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      const timer = setTimeout(() => {
        try {
          if (child.pid) process.kill(-child.pid, "SIGKILL");
        } catch {
          // The group already exited.
        }
        settle({ code: null, output: `${output}\n${label} timed out` });
      }, timeoutMs);
      child.on("error", (error) =>
        settle({ code: null, output: `${output}\n${error.message}` }),
      );
      child.on("close", (code) => settle({ code, output }));
    });
}

/** The last yt-dlp ERROR line, for audit detail. */
function errorLine(output: string): string {
  const lines = output.split("\n").filter((line) => /ERROR|error/.test(line));
  return (lines.at(-1) ?? output.split("\n").at(-1) ?? "").trim().slice(0, 300);
}

/** yt-dlp arguments: the lowest-bitrate audio in the original language. */
export function ytDlpAudioArgs(
  videoId: string,
  outputDir: string,
  options: { pluginDirs?: string; potBaseUrl?: string } = {},
): string[] {
  return [
    ...(options.pluginDirs ? ["--plugin-dirs", options.pluginDirs] : []),
    ...(options.potBaseUrl
      ? [
          "--extractor-args",
          `youtubepot-bgutilhttp:base_url=${options.potBaseUrl}`,
        ]
      : []),
    "--js-runtimes",
    "node",
    "--no-playlist",
    "--no-progress",
    // The worker's root filesystem is read-only.
    "--no-cache-dir",
    // A missing fragment would yield a silently truncated transcript.
    "--abort-on-unavailable-fragments",
    "--match-filter",
    `duration <= ${MAX_DURATION_SECONDS}`,
    "--max-filesize",
    String(MAX_DOWNLOAD_BYTES),
    // Direct (DASH) audio only: HLS streams are MPEG-TS, which Groq rejects.
    "-f",
    "wa[protocol=https][format_note*=original]/wa[protocol=https][language^=en]/wa[protocol=https]/ba[protocol=https]",
    "-o",
    join(outputDir, "%(id)s.%(ext)s"),
    "--",
    `https://www.youtube.com/watch?v=${videoId}`,
  ];
}

/**
 * ffmpeg arguments: re-encode the audio as mono 16 kHz Opus segments small
 * enough for one Groq request each.
 */
export function ffmpegSegmentArgs(input: string, outputDir: string): string[] {
  return [
    "-nostdin",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    input,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libopus",
    "-b:a",
    "24k",
    "-f",
    "segment",
    "-segment_time",
    String(SEGMENT_SECONDS),
    "-reset_timestamps",
    "1",
    join(outputDir, "segment-%03d.ogg"),
  ];
}

export function createYouTubeTranscriber(
  deps: {
    apiKey?: string;
    model?: string;
    ytDlp?: YtDlpRunner;
    ffmpeg?: ProcessRunner;
    fetchImpl?: typeof fetch;
    pluginDirs?: string;
    potBaseUrl?: string;
  } = {},
) {
  const apiKey = deps.apiKey ?? process.env.GROQ_API_KEY;
  const model =
    deps.model ??
    process.env.GROQ_TRANSCRIPTION_MODEL ??
    DEFAULT_TRANSCRIPTION_MODEL;
  const ytDlp =
    deps.ytDlp ??
    runProcess(process.env.YTDLP_PATH || "yt-dlp", "yt-dlp", YTDLP_TIMEOUT_MS);
  const ffmpeg =
    deps.ffmpeg ??
    runProcess(
      process.env.FFMPEG_PATH || "ffmpeg",
      "ffmpeg",
      FFMPEG_TIMEOUT_MS,
    );
  const fetchImpl = deps.fetchImpl ?? fetch;
  const pluginDirs = deps.pluginDirs ?? process.env.YTDLP_PLUGIN_DIRS;
  const potBaseUrl = deps.potBaseUrl ?? process.env.BGUTIL_POT_BASE_URL;

  // True only when YouTube's oEmbed endpoint says the video does not exist
  // (404). 401/403 also mean "embedding disabled" for public videos, so they
  // are not proof; a private video reaches the attempt limit instead.
  const videoIsGone = async (videoId: string): Promise<boolean> => {
    try {
      const url = new URL(OEMBED_URL);
      url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
      url.searchParams.set("format", "json");
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel().catch(() => undefined);
      return response.status === 404;
    } catch {
      return false;
    }
  };

  const transcribe = async (videoId: string): Promise<TranscriptOutcome> => {
    if (!VIDEO_ID.test(videoId)) {
      return { kind: "unavailable", detail: "Not a YouTube video id" };
    }
    if (!apiKey) return { kind: "failed", detail: "GROQ_API_KEY is not set" };
    let dir: string;
    try {
      dir = await mkdtemp(join(tmpdir(), "yt-audio-"));
    } catch (error) {
      return {
        kind: "failed",
        detail: `Temp directory: ${redactError(error)}`,
      };
    }
    try {
      const { code, output } = await ytDlp(
        ytDlpAudioArgs(videoId, dir, { pluginDirs, potBaseUrl }),
      );
      if (RATE_LIMITED.test(output)) {
        return {
          kind: "rate_limited",
          detail: `YouTube: ${errorLine(output)}`,
        };
      }
      if (NOT_YET.test(output)) {
        return {
          kind: "failed",
          detail: `Not yet available: ${errorLine(output)}`,
        };
      }
      if (code !== 0 && GONE_OR_REFUSED.test(output)) {
        // yt-dlp says the same for a deleted video and a refused request;
        // YouTube's oEmbed endpoint answers 404 only for a video that is gone.
        return (await videoIsGone(videoId))
          ? { kind: "unavailable", detail: errorLine(output) }
          : { kind: "failed", detail: errorLine(output) };
      }
      if (code !== 0) {
        // Only a completed download is transcribed.
        return UNAVAILABLE.test(output)
          ? { kind: "unavailable", detail: errorLine(output) }
          : {
              kind: "failed",
              detail: errorLine(output) || `yt-dlp exited ${code}`,
            };
      }
      const files = (await readdir(dir)).filter(
        (name) => !name.endsWith(".part"),
      );
      if (files.length === 0) {
        // yt-dlp exits 0 when a filter (duration, size) skips the video.
        return {
          kind: "unavailable",
          detail: errorLine(output) || "No audio downloaded",
        };
      }
      const name = files[0] as string;
      const downloaded = join(dir, name);
      let parts: string[] = [downloaded];
      if ((await stat(downloaded)).size > MAX_UPLOAD_BYTES) {
        const segmentDir = join(dir, "segments");
        await mkdir(segmentDir);
        const split = await ffmpeg(ffmpegSegmentArgs(downloaded, segmentDir));
        // The original is no longer needed; free /tmp before uploading.
        await rm(downloaded, { force: true });
        if (split.code !== 0) {
          return {
            kind: "failed",
            detail: `ffmpeg: ${errorLine(split.output) || `exited ${split.code}`}`,
          };
        }
        parts = (await readdir(segmentDir))
          .filter((file) => /^segment-\d{3}\.ogg$/.test(file))
          .sort()
          .map((file) => join(segmentDir, file));
        if (parts.length === 0) {
          return { kind: "failed", detail: "ffmpeg produced no segments" };
        }
      }
      const texts: string[] = [];
      let language: string | undefined;
      for (const part of parts) {
        const audio = await readFile(part);
        if (audio.byteLength > MAX_UPLOAD_BYTES) {
          return { kind: "failed", detail: "Audio segment exceeds 24 MB" };
        }
        const form = new FormData();
        form.append("file", new Blob([audio]), basename(part));
        form.append("model", model);
        form.append("response_format", "verbose_json");
        form.append("temperature", "0");
        let response: Response;
        try {
          response = await fetchImpl(GROQ_TRANSCRIPTION_URL, {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}` },
            body: form,
            redirect: "error",
            signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
          });
        } catch (error) {
          return { kind: "failed", detail: `Groq: ${redactError(error)}` };
        }
        if (response.status === 429) {
          await response.body?.cancel().catch(() => undefined);
          return { kind: "rate_limited", detail: "Groq: HTTP 429" };
        }
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          return { kind: "failed", detail: `Groq: HTTP ${response.status}` };
        }
        const body = (await response.json()) as {
          text?: unknown;
          language?: unknown;
        };
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (text) texts.push(text);
        if (!language && typeof body.language === "string" && body.language) {
          language = body.language;
        }
      }
      const text = texts.join(" ");
      if (text.length < TRANSCRIPT_MIN_CHARS) {
        return { kind: "unavailable", detail: "No speech to transcribe" };
      }
      return {
        kind: "captured",
        text: text.slice(0, TRANSCRIPT_MAX_CHARS),
        model,
        ...(language ? { language } : {}),
      };
    } catch (error) {
      return { kind: "failed", detail: redactError(error) };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  };
  return { configured: Boolean(apiKey), transcribe };
}
