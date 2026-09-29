// Breeze TTS 2 behind an OpenAI-style /v1/audio/speech. The voiceId
// "design:<description>" selects voice design; anything else is a named voice.
import { writeFile } from "node:fs/promises";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

export const openaiCompatible: TtsProvider = {
  id: "openaiCompatible",
  maxChars: 3000,
  async synthesize(text, voice, outputPath) {
    const base = requireEnv(
      voice.baseUrlEnvVar ?? "BREEZE_TTS_BASE_URL",
    ).replace(/\/$/, "");
    const key = process.env[voice.keyEnvVar] ?? "local";
    const design = voice.voiceId.startsWith("design:")
      ? voice.voiceId.slice("design:".length)
      : undefined;
    const bytes = await fetchAudioWithRetry(`${base}/v1/audio/speech`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: voice.model,
        input: text,
        voice: design ? "design" : voice.voiceId,
        ...(design ? { instructions: design } : {}),
        response_format: "wav",
      }),
    });
    await writeFile(outputPath, new Uint8Array(bytes));
  },
};
