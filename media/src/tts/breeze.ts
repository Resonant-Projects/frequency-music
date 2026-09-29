// Breeze TTS 2's own server (`python -m breeze_infer.api`, verified
// 2026-09-29 against breezeblue-ai/breeze-tts). POST /v1/audio/speech takes a
// multipart form and streams raw mono 24 kHz signed 16-bit PCM (`audio/pcm`,
// no WAV header), so the bytes are wrapped as WAV here. The server renders one
// request at a time and answers 409 while busy, and 503 while the model is
// still loading after a (re)start; both statuses wait longer before the
// retry (R27). The voiceId "design:<description>" selects voice design
// through the `instruction` field; reference-audio voices (`ref_audio`) are
// out of scope for wave 1. The server takes no API key; a bearer token is
// sent only when BREEZE_TTS_API_KEY is set for a fronting proxy.
import { writeFile } from "node:fs/promises";
import { wrapPcmAsWav } from "./elevenlabs";
import type { TtsProvider } from "./types";
import {
  attemptSignal,
  defaultBackoffMs,
  fetchAudioWithRetry,
  requireEnv,
  sleep,
} from "./types";

export const BREEZE_SAMPLE_RATE = 24000;
const BUSY_STATUSES = new Set([409, 503]);
const BUSY_BACKOFF_MS = 5000;
const DESIGN_PREFIX = "design:";
export const BREEZE_READY_TIMEOUT_MS = 5 * 60_000;
export const BREEZE_READY_INTERVAL_MS = 10_000;

// R27 cold start: a fresh tts-local container downloads nothing but still
// takes minutes to load 7.7 GB of weights, during which GET /health answers
// 503. Polls until it answers 200 or the budget runs out. Network errors
// (the container not yet listening) are waited out the same way.
export async function waitForBreezeReady(
  baseUrl: string,
  signal: AbortSignal | undefined,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? BREEZE_READY_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? BREEZE_READY_INTERVAL_MS;
  const url = `${baseUrl.replace(/\/$/, "")}/health`;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "error",
        signal: attemptSignal(signal, intervalMs),
      });
      if (response.ok) return;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
    if (Date.now() + intervalMs > deadline) {
      throw new Error(
        `Breeze TTS did not become ready within ${Math.round(timeoutMs / 60_000)} min`,
      );
    }
    await sleep(intervalMs, signal);
  }
}

// Readiness is checked once per process per base URL, before the first
// synthesis; concurrent first calls share one wait. A failed wait is
// forgotten so the next job checks again.
const readiness = new Map<string, Promise<void>>();

function ensureReady(baseUrl: string, signal?: AbortSignal): Promise<void> {
  let pending = readiness.get(baseUrl);
  if (!pending) {
    pending = waitForBreezeReady(baseUrl, signal).catch((error: unknown) => {
      readiness.delete(baseUrl);
      throw error;
    });
    readiness.set(baseUrl, pending);
  }
  return pending;
}

export function resetBreezeReadiness(): void {
  readiness.clear();
}

export const breeze: TtsProvider = {
  id: "breeze",
  maxChars: 3000,
  async synthesize(text, voice, outputPath, signal) {
    const base = requireEnv(
      voice.baseUrlEnvVar ?? "BREEZE_TTS_BASE_URL",
    ).replace(/\/$/, "");
    const instruction = designInstruction(voice.voiceId);
    await ensureReady(base, signal);
    // fetch derives the multipart content-type (with boundary) from the
    // FormData body; setting it by hand would break the request.
    const form = new FormData();
    form.set("text", text);
    if (instruction !== undefined) form.set("instruction", instruction);
    form.set("cfg_scale", "4");
    form.set("seed", "42");
    const key = process.env[voice.keyEnvVar];
    const bytes = await fetchAudioWithRetry(
      `${base}/v1/audio/speech`,
      {
        method: "POST",
        headers: key ? { authorization: `Bearer ${key}` } : {},
        body: form,
        signal,
      },
      {
        backoffMs: (status, attempt) =>
          status !== undefined && BUSY_STATUSES.has(status)
            ? BUSY_BACKOFF_MS
            : defaultBackoffMs(attempt),
      },
    );
    await writeFile(
      outputPath,
      wrapPcmAsWav(new Uint8Array(bytes), BREEZE_SAMPLE_RATE, 1),
    );
  },
};

// "design:<description>" -> the description; "" -> no instruction (the
// server's default voice). Anything else would need reference audio.
function designInstruction(voiceId: string): string | undefined {
  if (voiceId === "") return undefined;
  if (voiceId.startsWith(DESIGN_PREFIX)) {
    return voiceId.slice(DESIGN_PREFIX.length).trim();
  }
  throw new Error(
    `breeze voice id must be "design:<description>" or empty; reference-audio voices are not supported`,
  );
}
