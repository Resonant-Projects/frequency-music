import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { wrapPcmAsWav } from "./elevenlabs";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

// Inworld returns JSON with base64 audioContent for LINEAR16.
const inworldResponseZ = z.object({ audioContent: z.string() });

export const inworld: TtsProvider = {
  id: "inworld",
  maxChars: 2000,
  async synthesize(text, voice, outputPath, signal) {
    const key = requireEnv(voice.keyEnvVar);
    const bytes = await fetchAudioWithRetry(
      "https://api.inworld.ai/tts/v1/voice",
      {
        method: "POST",
        headers: {
          authorization: `Basic ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId: voice.voiceId,
          modelId: voice.model,
          audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 },
        }),
        signal,
      },
    );
    const parsed = inworldResponseZ.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const pcm = new Uint8Array(Buffer.from(parsed.audioContent, "base64"));
    await writeFile(outputPath, wrapPcmAsWav(pcm, 24000, 1));
  },
};
