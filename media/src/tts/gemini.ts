import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { wrapPcmAsWav } from "./elevenlabs";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

// Gemini returns the audio as an inlineData part whose mimeType carries the
// sample rate, e.g. "audio/L16;codec=pcm;rate=24000".
const geminiResponseZ = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        parts: z.array(
          z.object({
            inlineData: z
              .object({ data: z.string(), mimeType: z.string() })
              .optional(),
          }),
        ),
      }),
    }),
  ),
});

export const gemini: TtsProvider = {
  id: "google",
  maxChars: 4000,
  async synthesize(text, voice, outputPath, signal) {
    const key = requireEnv(voice.keyEnvVar);
    const bytes = await fetchAudioWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${voice.model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice.voiceId },
              },
            },
          },
        }),
        signal,
      },
    );
    const parsed = geminiResponseZ.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const part = parsed.candidates[0]?.content.parts.find((p) => p.inlineData);
    if (!part?.inlineData) throw new Error("Gemini returned no audio part");
    const rate = Number(
      /rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000,
    );
    await writeFile(
      outputPath,
      wrapPcmAsWav(
        new Uint8Array(Buffer.from(part.inlineData.data, "base64")),
        rate,
        1,
      ),
    );
  },
};
