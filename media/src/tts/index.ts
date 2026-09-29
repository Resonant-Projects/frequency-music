import type { VoiceEntry } from "../../../convex/shared/voices";
import { breeze } from "./breeze";
import { elevenlabs } from "./elevenlabs";
import { gemini } from "./gemini";
import { inworld } from "./inworld";
import type { TtsProvider } from "./types";

export { chunkForLimit } from "./chunk";
export type { TtsProvider } from "./types";

const providers: Record<VoiceEntry["provider"], TtsProvider> = {
  google: gemini,
  inworld,
  elevenlabs,
  breeze,
};

export function providerFor(voice: VoiceEntry): TtsProvider {
  return providers[voice.provider];
}

// A hosted voice is configured when its key is present; a local voice when
// its base URL is (the bundled Breeze server takes no key).
export function isConfigured(voice: VoiceEntry): boolean {
  if (voice.runsOn === "local") {
    return (
      voice.baseUrlEnvVar !== undefined &&
      Boolean(process.env[voice.baseUrlEnvVar])
    );
  }
  return Boolean(process.env[voice.keyEnvVar]);
}
