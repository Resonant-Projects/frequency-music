// Breeze TTS 2's own server (`python -m breeze_infer.api`, verified
// 2026-09-29 against breezeblue-ai/breeze-tts). POST /v1/audio/speech takes a
// multipart form and streams raw mono 24 kHz signed 16-bit PCM (`audio/pcm`,
// no WAV header), so the bytes are wrapped as WAV here. The server renders one
// request at a time and answers 409 while busy; that status waits longer
// before the retry. The voiceId "design:<description>" selects voice design
// through the `instruction` field; reference-audio voices (`ref_audio`) are
// out of scope for wave 1. The server takes no API key; a bearer token is
// sent only when BREEZE_TTS_API_KEY is set for a fronting proxy.
import { writeFile } from "node:fs/promises";
import { wrapPcmAsWav } from "./elevenlabs";
import type { TtsProvider } from "./types";
import { defaultBackoffMs, fetchAudioWithRetry, requireEnv } from "./types";

export const BREEZE_SAMPLE_RATE = 24000;
const BUSY_STATUS = 409;
const BUSY_BACKOFF_MS = 5000;
const DESIGN_PREFIX = "design:";

export const breeze: TtsProvider = {
  id: "breeze",
  maxChars: 3000,
  async synthesize(text, voice, outputPath, signal) {
    const base = requireEnv(
      voice.baseUrlEnvVar ?? "BREEZE_TTS_BASE_URL",
    ).replace(/\/$/, "");
    const instruction = designInstruction(voice.voiceId);
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
          status === BUSY_STATUS ? BUSY_BACKOFF_MS : defaultBackoffMs(attempt),
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
