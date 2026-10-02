// YouTube transcripts for Sources that arrive without text. YouTube now
// rate-limits subtitle downloads (timedtext) from the Lab IP even with a PO
// token, so the worker downloads the video's audio with yt-dlp (PO tokens from
// the bgutil provider sidecar) and transcribes it with Groq Whisper.
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TRANSCRIPT_MAX_CHARS,
  TRANSCRIPT_MIN_CHARS,
} from "../../../convex/shared/agentContract.js";
import { redactError } from "../shared/redactError.js";

export const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
export const DEFAULT_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
// Groq accepts at most 25 MB per request; the lowest-bitrate audio of a
// two-hour video stays under this.
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const MAX_DURATION_SECONDS = 2 * 60 * 60;
const YTDLP_TIMEOUT_MS = 5 * 60 * 1000;
const GROQ_TIMEOUT_MS = 3 * 60 * 1000;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const RATE_LIMITED =
  /HTTP Error 429|Too Many Requests|Sign in to confirm you(?:'|’)re not a bot/i;
const UNAVAILABLE =
  /Video unavailable|Private video|has been removed|members-only|Join this channel|confirm your age|age-restricted|not available in your country|This live event|Premieres in|does not pass filter|larger than max-filesize/i;

export type TranscriptOutcome =
  | { kind: "captured"; text: string; model: string; language?: string }
  | { kind: "unavailable"; detail: string }
  | { kind: "rate_limited"; detail: string }
  | { kind: "failed"; detail: string };

export type YtDlpRunner = (
  args: string[],
) => Promise<{ code: number | null; output: string }>;

function runYtDlp(binary: string): YtDlpRunner {
  return (args) =>
    new Promise((resolve) => {
      const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      const append = (chunk: Buffer) => {
        // Keep the tail: errors come last.
        output = (output + chunk.toString("utf8")).slice(-20_000);
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      const timer = setTimeout(() => child.kill("SIGKILL"), YTDLP_TIMEOUT_MS);
      child.on("error", (error) => {
        clearTimeout(timer);
        resolve({ code: null, output: `${output}\n${error.message}` });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code, output });
      });
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
    "--match-filter",
    `duration <= ${MAX_DURATION_SECONDS}`,
    "--max-filesize",
    String(MAX_AUDIO_BYTES),
    "-f",
    "wa[format_note*=original]/wa[language^=en]/wa/ba",
    "-o",
    join(outputDir, "%(id)s.%(ext)s"),
    "--",
    `https://www.youtube.com/watch?v=${videoId}`,
  ];
}

export function createYouTubeTranscriber(
  deps: {
    apiKey?: string;
    model?: string;
    ytDlp?: YtDlpRunner;
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
  const ytDlp = deps.ytDlp ?? runYtDlp(process.env.YTDLP_PATH || "yt-dlp");
  const fetchImpl = deps.fetchImpl ?? fetch;
  const pluginDirs = deps.pluginDirs ?? process.env.YTDLP_PLUGIN_DIRS;
  const potBaseUrl = deps.potBaseUrl ?? process.env.BGUTIL_POT_BASE_URL;

  const transcribe = async (videoId: string): Promise<TranscriptOutcome> => {
    if (!VIDEO_ID.test(videoId)) {
      return { kind: "unavailable", detail: "Not a YouTube video id" };
    }
    if (!apiKey) return { kind: "failed", detail: "GROQ_API_KEY is not set" };
    const dir = await mkdtemp(join(tmpdir(), "yt-audio-"));
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
      const files = (await readdir(dir)).filter(
        (name) => !name.endsWith(".part"),
      );
      if (files.length === 0) {
        return UNAVAILABLE.test(output) || code === 0
          ? { kind: "unavailable", detail: errorLine(output) || "No audio" }
          : {
              kind: "failed",
              detail: errorLine(output) || `yt-dlp exited ${code}`,
            };
      }
      const name = files[0] as string;
      const audio = await readFile(join(dir, name));
      if (audio.byteLength > MAX_AUDIO_BYTES) {
        return { kind: "unavailable", detail: "Audio exceeds 24 MB" };
      }
      const form = new FormData();
      form.append("file", new Blob([audio]), name);
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
      if (text.length < TRANSCRIPT_MIN_CHARS) {
        return { kind: "unavailable", detail: "No speech to transcribe" };
      }
      return {
        kind: "captured",
        text: text.slice(0, TRANSCRIPT_MAX_CHARS),
        model,
        ...(typeof body.language === "string" && body.language
          ? { language: body.language }
          : {}),
      };
    } catch (error) {
      return { kind: "failed", detail: redactError(error) };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  };
  return { configured: Boolean(apiKey), transcribe };
}
