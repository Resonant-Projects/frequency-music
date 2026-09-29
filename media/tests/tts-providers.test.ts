import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { voiceById } from "../../convex/shared/voices";
import { isConfigured, providerFor } from "../src/tts";

// The shape every provider hands to fetch; typing it here keeps the
// assertions cast-free.
type CapturedInit = {
  headers: Record<string, string>;
  body: string;
  redirect?: RequestRedirect;
};

const dir = mkdtempSync(join(tmpdir(), "tts-"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("tts providers", () => {
  test("isConfigured reflects key and base url presence", () => {
    expect(isConfigured(voiceById("inworld-max"))).toBe(false);
    vi.stubEnv("INWORLD_API_KEY", "k");
    expect(isConfigured(voiceById("inworld-max"))).toBe(true);
    vi.stubEnv("BREEZE_TTS_API_KEY", "k");
    expect(isConfigured(voiceById("breeze-2"))).toBe(false);
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://ai-5090-02:8881");
    expect(isConfigured(voiceById("breeze-2"))).toBe(true);
  });

  test("elevenlabs provider posts text with the model id and writes the audio bytes", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "el-key");
    const fetchMock = vi.fn((url: string, init: CapturedInit) => {
      expect(url).toContain("/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb");
      expect(init.headers["xi-api-key"]).toBe("el-key");
      expect(init.redirect).toBe("error");
      expect(JSON.parse(init.body)).toMatchObject({
        text: "Hello there.",
        model_id: "eleven_v3",
      });
      return Promise.resolve(
        new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = join(dir, "el.wav");
    await providerFor(voiceById("elevenlabs-v3")).synthesize(
      "Hello there.",
      voiceById("elevenlabs-v3"),
      out,
    );
    expect(readFileSync(out).subarray(0, 4).toString()).toBe("RIFF");
  });

  test("provider failures retry twice then throw with status only", async () => {
    vi.stubEnv("INWORLD_API_KEY", "k");
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("secret body k", { status: 500 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      providerFor(voiceById("inworld-max")).synthesize(
        "x",
        voiceById("inworld-max"),
        join(dir, "in.wav"),
      ),
    ).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(
      providerFor(voiceById("inworld-max")).synthesize(
        "x",
        voiceById("inworld-max"),
        join(dir, "in.wav"),
      ),
    ).rejects.not.toThrow(/secret body/);
  });

  test("network errors retry the same way and surface without the url or headers", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gem-key");
    const fetchMock = vi.fn(() =>
      Promise.reject(new TypeError("fetch failed")),
    );
    vi.stubGlobal("fetch", fetchMock);
    const attempt = providerFor(voiceById("gemini-flash-tts")).synthesize(
      "x",
      voiceById("gemini-flash-tts"),
      join(dir, "gem.wav"),
    );
    await expect(attempt).rejects.toThrow(/TTS request failed/);
    await expect(attempt).rejects.not.toThrow(
      /gem-key|status \d|generateContent/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
