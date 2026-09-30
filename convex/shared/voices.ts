// TTS voices are not LLMs: they live here, not in convex/llm.ts MODELS.
// verifiedOn is the date the model/voice ids were checked against the
// provider's live API; the wave 1 plan's first task re-verifies them.
export type VoiceProvider =
  | "google"
  | "inworld"
  | "elevenlabs"
  | "breeze"
  | "cartesia";

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
    model: "gemini-3.1-flash-tts-preview",
    voiceId: "Charon",
    runsOn: "hosted",
    licence: "Google Gemini API terms",
    openclawProvider: "google",
    keyEnvVar: "GEMINI_API_KEY",
    verifiedOn: "2026-09-29",
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
    verifiedOn: "2026-09-29",
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
    verifiedOn: "2026-09-29",
  },
  // The local voice speaks Breeze TTS 2's own server API (media/src/tts/
  // breeze.ts). openclawProvider names OpenClaw's side for wave 2 and is not
  // that API. keyEnvVar is kept for schema stability; the bundled server takes
  // no key, so a local voice is configured by baseUrlEnvVar alone.
  {
    id: "breeze-2",
    provider: "breeze",
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
  // Cartesia Sonic, pinned to a dated snapshot so a take stays reproducible
  // (the bare "sonic-3.6" alias moves). One feminine and one masculine
  // English narrator from Cartesia's voice library. openclawProvider is the
  // mapping name only; wave 2 verifies OpenClaw's side separately.
  {
    // Nandi, "Poised Concierge": documentary and informational narration.
    id: "cartesia-sonic-nandi",
    provider: "cartesia",
    model: "sonic-3.6-2026-08-27",
    voiceId: "33d406dd-ff6f-4be7-a7f5-8b1ba183b3e4",
    runsOn: "hosted",
    licence: "Cartesia API terms",
    openclawProvider: "cartesia",
    keyEnvVar: "CARTESIA_API_KEY",
    verifiedOn: "2026-09-30",
  },
  {
    // Quentin, "Refined Narrator": polished, measured narration.
    id: "cartesia-sonic-quentin",
    provider: "cartesia",
    model: "sonic-3.6-2026-08-27",
    voiceId: "5568a7df-e5ab-4442-9fae-2e9ba1b15ad8",
    runsOn: "hosted",
    licence: "Cartesia API terms",
    openclawProvider: "cartesia",
    keyEnvVar: "CARTESIA_API_KEY",
    verifiedOn: "2026-09-30",
  },
] as const;

export const VOICE_IDS = VOICE_CATALOG.map(
  (voice) => voice.id,
) as readonly string[];

// R28: dedicated announcer voices for the shootout intro and take labels.
// They are never candidates (never in VOICE_IDS, never rated, never the house
// voice), so hearing one reveals nothing about a take even when the whole
// catalog competes. Each reuses a catalog entry's provider, model, and
// configuration so no extra key or server is needed; only the voice differs.
export const ANNOUNCER_VOICES: readonly VoiceEntry[] = [
  {
    id: "announcer-breeze",
    provider: "breeze",
    model: "breeze-tts-2",
    voiceId:
      "design:A brisk, neutral radio announcer with clear diction and a slightly higher register.",
    runsOn: "local",
    licence: "Breeze TTS 2 research licence, personal use only",
    openclawProvider: "openai-compatible",
    keyEnvVar: "BREEZE_TTS_API_KEY",
    baseUrlEnvVar: "BREEZE_TTS_BASE_URL",
    verifiedOn: "2026-09-28",
  },
  {
    id: "announcer-gemini",
    provider: "google",
    model: "gemini-3.1-flash-tts-preview",
    voiceId: "Kore",
    runsOn: "hosted",
    licence: "Google Gemini API terms",
    openclawProvider: "google",
    keyEnvVar: "GEMINI_API_KEY",
    verifiedOn: "2026-09-29",
  },
];

export function voiceById(id: string): VoiceEntry {
  const voice = VOICE_CATALOG.find((entry) => entry.id === id);
  if (!voice) throw new Error(`unknown voice ${id}`);
  return voice;
}
