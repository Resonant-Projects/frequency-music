import { writeFile } from "node:fs/promises";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

// Cartesia's /tts/bytes contract is dated by the Cartesia-Version header;
// the body shape below (voice as an id string, output_format object) is the
// one that version documents.
export const CARTESIA_API_VERSION = "2026-08-14";
export const CARTESIA_SAMPLE_RATE = 48000;

function isWav(bytes: Uint8Array): boolean {
  const tag = (offset: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + 4));
  return bytes.length > 12 && tag(0) === "RIFF" && tag(8) === "WAVE";
}

export const cartesia: TtsProvider = {
  id: "cartesia",
  // The API documents no transcript cap; 2 000 keeps each request well
  // inside one short generation and matches Inworld's chunking.
  maxChars: 2000,
  async synthesize(text, voice, outputPath, signal) {
    const key = requireEnv(voice.keyEnvVar);
    const bytes = await fetchAudioWithRetry(
      "https://api.cartesia.ai/tts/bytes",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "cartesia-version": CARTESIA_API_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model_id: voice.model,
          transcript: text,
          voice: voice.voiceId,
          output_format: {
            container: "wav",
            encoding: "pcm_s16le",
            sample_rate: CARTESIA_SAMPLE_RATE,
          },
          language: "en",
        }),
        signal,
      },
    );
    // The WAV container already carries its header; write it as returned.
    // Anything else (an error document on a 200) fails without its body.
    const audio = new Uint8Array(bytes);
    if (!isWav(audio)) throw new Error("Cartesia returned no WAV audio");
    await writeFile(outputPath, audio);
  },
};
