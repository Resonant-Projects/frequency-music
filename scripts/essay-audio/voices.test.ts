import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { voiceById } from "../../convex/shared/voices";
import { wrapPcmAsWav } from "../../media/src/tts/elevenlabs";
import { synthesize, voiceFor } from "./voices";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("essay Cartesia narration", () => {
  test.each([
    "cartesia-nandi",
    "cartesia-quentin",
  ] as const)("%s sends the catalog voice and preserves lossless audio", async (key) => {
    vi.stubEnv("CARTESIA_API_KEY", "test-key");
    const wav = wrapPcmAsWav(new Uint8Array([1, 0, 2, 0]), 48000, 1);
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from(wav)));
    vi.stubGlobal("fetch", fetchMock);
    const dir = await mkdtemp(join(tmpdir(), "essay-cartesia-"));
    try {
      const voice = voiceFor(key);
      const output = join(dir, "take.wav");
      await synthesize(voice, "A complete spoken paragraph.", 0, output);
      expect(new Uint8Array(await readFile(output))).toEqual(wav);
      const catalog = voiceById(voice.catalogId);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://api.cartesia.ai/tts/bytes");
      expect(JSON.parse(init.body)).toEqual({
        model_id: catalog.model,
        transcript: "A complete spoken paragraph.",
        voice: catalog.voiceId,
        language: "en",
        output_format: {
          container: "wav",
          encoding: "pcm_s16le",
          sample_rate: 48000,
        },
      });
      expect(init.redirect).toBe("error");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("failed paid calls do not retry outside the essay ledger", async () => {
    vi.stubEnv("CARTESIA_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("private error body", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      synthesize(voiceFor("cartesia-nandi"), "Text", 0, "/unused.wav"),
    ).rejects.toThrow("TTS request failed with status 429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("unknown manifest voices fail instead of falling back to local synthesis", () => {
    expect(() => voiceFor("typo" as never)).toThrow("unknown voice typo");
  });
});
