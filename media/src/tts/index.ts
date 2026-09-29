import type { VoiceEntry } from "../../../convex/shared/voices";
import { elevenlabs } from "./elevenlabs";
import { gemini } from "./gemini";
import { inworld } from "./inworld";
import { openaiCompatible } from "./openaiCompatible";
import type { TtsProvider } from "./types";

export { chunkForLimit } from "./chunk";
export type { TtsProvider } from "./types";

const providers: Record<VoiceEntry["provider"], TtsProvider> = {
  google: gemini,
  inworld,
  elevenlabs,
  openaiCompatible,
};

export function providerFor(voice: VoiceEntry): TtsProvider {
  return providers[voice.provider];
}

// Configured means the key is present, plus the base URL for a local voice.
export function isConfigured(voice: VoiceEntry): boolean {
  if (!process.env[voice.keyEnvVar]) return false;
  if (voice.runsOn === "local" && !process.env[voice.baseUrlEnvVar ?? ""])
    return false;
  return true;
}
