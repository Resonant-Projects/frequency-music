import { describe, expect, test } from "vite-plus/test";
import { VOICE_CATALOG, VOICE_IDS, voiceById } from "./voices";

describe("voice catalog", () => {
  test("has exactly the four shootout voices with unique ids", () => {
    expect([...VOICE_IDS]).toEqual([
      "gemini-flash-tts",
      "inworld-max",
      "elevenlabs-v3",
      "breeze-2",
    ]);
    expect(new Set(VOICE_CATALOG.map((voice) => voice.id)).size).toBe(4);
  });
  test("every entry names a provider, licence, OpenClaw mapping, key env var, and verification date", () => {
    for (const voice of VOICE_CATALOG) {
      expect(voice.provider).toBeTruthy();
      expect(voice.licence).toBeTruthy();
      expect(voice.openclawProvider).toBeTruthy();
      expect(voice.keyEnvVar).toMatch(/^[A-Z0-9_]+$/);
      expect(voice.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(voiceById("breeze-2").runsOn).toBe("local");
    expect(voiceById("breeze-2").baseUrlEnvVar).toBe("BREEZE_TTS_BASE_URL");
    expect(() => voiceById("kokoro")).toThrow(/unknown voice/);
  });
});
