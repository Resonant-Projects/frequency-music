import { describe, expect, test } from "vite-plus/test";
import {
  ANNOUNCER_VOICES,
  VOICE_CATALOG,
  VOICE_IDS,
  voiceById,
} from "./voices";

describe("voice catalog", () => {
  test("has exactly the six shootout voices with unique ids", () => {
    expect([...VOICE_IDS]).toEqual([
      "gemini-flash-tts",
      "inworld-max",
      "elevenlabs-v3",
      "breeze-2",
      "cartesia-sonic-nandi",
      "cartesia-sonic-quentin",
    ]);
    expect(new Set(VOICE_CATALOG.map((voice) => voice.id)).size).toBe(6);
  });
  test("earlier voices keep their provider, model, and voice for provenance", () => {
    expect(
      VOICE_CATALOG.slice(0, 4).map(({ id, provider, model, voiceId }) => [
        id,
        provider,
        model,
        voiceId,
      ]),
    ).toEqual([
      ["gemini-flash-tts", "google", "gemini-3.1-flash-tts-preview", "Charon"],
      ["inworld-max", "inworld", "inworld-tts-1.5-max", "Dennis"],
      ["elevenlabs-v3", "elevenlabs", "eleven_v3", "JBFqnCBsd6RMkjVDRZzb"],
      [
        "breeze-2",
        "breeze",
        "breeze-tts-2",
        "design:A calm, warm, unhurried adult narrator with clear diction and a low-mid register.",
      ],
    ]);
  });
  test("Cartesia voices are hosted, keyed, and pinned to a dated Sonic snapshot", () => {
    const nandi = voiceById("cartesia-sonic-nandi");
    const quentin = voiceById("cartesia-sonic-quentin");
    expect(nandi.voiceId).toBe("33d406dd-ff6f-4be7-a7f5-8b1ba183b3e4");
    expect(quentin.voiceId).toBe("5568a7df-e5ab-4442-9fae-2e9ba1b15ad8");
    for (const voice of [nandi, quentin]) {
      expect(voice).toMatchObject({
        provider: "cartesia",
        model: "sonic-3.6-2026-08-27",
        runsOn: "hosted",
        licence: "Cartesia API terms",
        keyEnvVar: "CARTESIA_API_KEY",
        verifiedOn: "2026-09-30",
      });
      expect(voice.baseUrlEnvVar).toBeUndefined();
    }
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
  test("R28: announcer voices are never candidates and reuse a catalog provider", () => {
    expect(ANNOUNCER_VOICES.map((voice) => voice.id)).toEqual([
      "announcer-breeze",
      "announcer-gemini",
    ]);
    for (const announcer of ANNOUNCER_VOICES) {
      expect(VOICE_IDS).not.toContain(announcer.id);
      expect(() => voiceById(announcer.id)).toThrow(/unknown voice/);
      // Same provider, model, and configuration as a catalog voice, so an
      // announcer is configured exactly when that catalog voice is.
      const twin = VOICE_CATALOG.find(
        (voice) =>
          voice.provider === announcer.provider &&
          voice.model === announcer.model &&
          voice.keyEnvVar === announcer.keyEnvVar &&
          voice.baseUrlEnvVar === announcer.baseUrlEnvVar &&
          voice.runsOn === announcer.runsOn,
      );
      expect(twin, announcer.id).toBeDefined();
      expect(twin?.voiceId).not.toBe(announcer.voiceId);
    }
  });
});
