// TTS voices are not LLMs: they live here, not in convex/llm.ts MODELS.
// verifiedOn is the date the model/voice ids were checked against the
// provider's live API; the wave 1 plan's first task re-verifies them.
export type VoiceProvider =
  | "google"
  | "inworld"
  | "elevenlabs"
  | "openaiCompatible";

export type VoiceEntry = {
  id: string;
  provider: VoiceProvider;
  model: string;
  voiceId: string;
  runsOn: "hosted" | "local";
  licence: string;
  openclawProvider: string;
  keyEnvVar: string;
  baseUrlEnvVar?: string;
  verifiedOn: string;
};

export const VOICE_CATALOG: readonly VoiceEntry[] = [
  {
    id: "gemini-flash-tts",
    provider: "google",
    model: "gemini-3.1-flash-tts",
    voiceId: "Charon",
    runsOn: "hosted",
    licence: "Google Gemini API terms",
    openclawProvider: "google",
    keyEnvVar: "GEMINI_API_KEY",
    verifiedOn: "2026-09-28",
  },
  {
    id: "inworld-max",
    provider: "inworld",
    model: "inworld-tts-1.5-max",
    voiceId: "Dennis",
    runsOn: "hosted",
    licence: "Inworld API terms",
    openclawProvider: "inworld",
    keyEnvVar: "INWORLD_API_KEY",
    verifiedOn: "2026-09-28",
  },
  {
    id: "elevenlabs-v3",
    provider: "elevenlabs",
    model: "eleven_v3",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    runsOn: "hosted",
    licence: "ElevenLabs API terms",
    openclawProvider: "elevenlabs",
    keyEnvVar: "ELEVENLABS_API_KEY",
    verifiedOn: "2026-09-28",
  },
  {
    id: "breeze-2",
    provider: "openaiCompatible",
    model: "breeze-tts-2",
    voiceId:
      "design:A calm, warm, unhurried adult narrator with clear diction and a low-mid register.",
    runsOn: "local",
    licence: "Breeze TTS 2 research licence, personal use only",
    openclawProvider: "openai-compatible",
    keyEnvVar: "BREEZE_TTS_API_KEY",
    baseUrlEnvVar: "BREEZE_TTS_BASE_URL",
    verifiedOn: "2026-09-28",
  },
] as const;

export const VOICE_IDS = VOICE_CATALOG.map(
  (voice) => voice.id,
) as readonly string[];

export function voiceById(id: string): VoiceEntry {
  const voice = VOICE_CATALOG.find((entry) => entry.id === id);
  if (!voice) throw new Error(`unknown voice ${id}`);
  return voice;
}
