import { writeFile } from "node:fs/promises";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

export const elevenlabs: TtsProvider = {
  id: "elevenlabs",
  maxChars: 5000,
  async synthesize(text, voice, outputPath) {
    const key = requireEnv(voice.keyEnvVar);
    const bytes = await fetchAudioWithRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=pcm_24000`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "content-type": "application/json",
          accept: "audio/wav",
        },
        body: JSON.stringify({ text, model_id: voice.model }),
      },
    );
    await writeFile(outputPath, wrapPcmAsWav(new Uint8Array(bytes), 24000, 1));
  },
};

// ElevenLabs pcm_* formats are headerless 16-bit little-endian; add a WAV header.
export function wrapPcmAsWav(
  pcm: Uint8Array,
  sampleRate: number,
  channels: number,
): Uint8Array {
  if (
    pcm.length >= 4 &&
    pcm[0] === 0x52 &&
    pcm[1] === 0x49 &&
    pcm[2] === 0x46 &&
    pcm[3] === 0x46
  ) {
    return pcm; // already RIFF
  }
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}
