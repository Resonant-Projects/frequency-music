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
// assertions cast-free. Hosted providers send a JSON string; Breeze sends a
// multipart form.
type CapturedInit = {
  headers?: Record<string, string>;
  body: string | FormData;
  redirect?: RequestRedirect;
  signal?: AbortSignal;
};

function jsonBody(init: CapturedInit): unknown {
  if (typeof init.body !== "string") throw new Error("expected a JSON body");
  return JSON.parse(init.body);
}

function formBody(init: CapturedInit): FormData {
  if (!(init.body instanceof FormData)) throw new Error("expected a form body");
  return init.body;
}

const dir = mkdtempSync(join(tmpdir(), "tts-"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("tts providers", () => {
  test("isConfigured needs the key for hosted voices and only the base url for local ones", () => {
    expect(isConfigured(voiceById("inworld-max"))).toBe(false);
    vi.stubEnv("INWORLD_API_KEY", "k");
    expect(isConfigured(voiceById("inworld-max"))).toBe(true);
    // The bundled Breeze server takes no key: a key alone configures nothing,
    // the base url alone is enough.
    vi.stubEnv("BREEZE_TTS_API_KEY", "k");
    expect(isConfigured(voiceById("breeze-2"))).toBe(false);
    vi.unstubAllEnvs();
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://ai-5090-02:8881");
    expect(isConfigured(voiceById("breeze-2"))).toBe(true);
  });

  test("elevenlabs provider posts text with the model id and writes the audio bytes", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "el-key");
    const fetchMock = vi.fn((url: string, init: CapturedInit) => {
      expect(url).toContain("/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb");
      expect(init.headers?.["xi-api-key"]).toBe("el-key");
      expect(init.redirect).toBe("error");
      expect(jsonBody(init)).toMatchObject({
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

  test("breeze provider posts a multipart form with the design instruction and wraps the PCM stream as WAV", async () => {
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://tts-local:8881/");
    const voice = voiceById("breeze-2");
    const pcm = new Uint8Array([1, 0, 2, 0, 3, 0]);
    const fetchMock = vi.fn((url: string, init: CapturedInit) => {
      expect(url).toBe("http://tts-local:8881/v1/audio/speech");
      expect(init.redirect).toBe("error");
      // No key is configured, so no Authorization header is sent; the
      // multipart boundary is fetch's job, so no content-type either.
      expect(init.headers?.authorization).toBeUndefined();
      expect(init.headers?.["content-type"]).toBeUndefined();
      const form = formBody(init);
      expect(form.get("text")).toBe("Hello there.");
      expect(form.get("instruction")).toBe(
        voice.voiceId.slice("design:".length),
      );
      expect(form.get("cfg_scale")).toBe("4");
      expect(form.get("seed")).toBe("42");
      expect(form.has("ref_audio")).toBe(false);
      return Promise.resolve(
        new Response(pcm, {
          status: 200,
          headers: { "content-type": "audio/pcm" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = join(dir, "breeze.wav");
    await providerFor(voice).synthesize("Hello there.", voice, out);
    const written = readFileSync(out);
    expect(written.subarray(0, 4).toString()).toBe("RIFF");
    expect(written.length).toBe(44 + pcm.length);
    expect(written.readUInt16LE(22)).toBe(1); // mono
    expect(written.readUInt32LE(24)).toBe(24000); // sample rate
    expect(written.readUInt32LE(40)).toBe(pcm.length); // data chunk size
    expect([...written.subarray(44)]).toEqual([...pcm]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("breeze provider sends a bearer token only when a key is set and rejects non-design voice ids", async () => {
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://tts-local:8881");
    vi.stubEnv("BREEZE_TTS_API_KEY", "shh");
    const fetchMock = vi.fn((_url: string, init: CapturedInit) => {
      expect(init.headers?.authorization).toBe("Bearer shh");
      expect(formBody(init).has("instruction")).toBe(false);
      return Promise.resolve(new Response(new Uint8Array(2), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const plain = { ...voiceById("breeze-2"), voiceId: "" };
    await providerFor(plain).synthesize("x", plain, join(dir, "plain.wav"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const referenced = { ...voiceById("breeze-2"), voiceId: "ref:some-clip" };
    await expect(
      providerFor(referenced).synthesize("x", referenced, join(dir, "ref.wav")),
    ).rejects.toThrow(/design:/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("breeze provider waits out a 409 from the single-concurrency server and then succeeds", async () => {
    vi.useFakeTimers();
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://tts-local:8881");
    const voice = voiceById("breeze-2");
    const pcm = new Uint8Array([9, 0, 8, 0]);
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      return Promise.resolve(
        calls === 1
          ? new Response("busy", { status: 409 })
          : new Response(pcm, { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = join(dir, "busy.wav");
    const attempt = providerFor(voice).synthesize("x", voice, out);
    // The busy backoff is longer than the ordinary one; nothing fires before it.
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    await attempt;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const written = readFileSync(out);
    expect(written.subarray(0, 4).toString()).toBe("RIFF");
    expect(written.length).toBe(44 + pcm.length);
  });

  test("every provider passes the job signal to fetch", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    vi.stubEnv("INWORLD_API_KEY", "k");
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://breeze.test");
    const bodies: Record<string, string> = {
      "elevenlabs-v3": "RIFF",
      "inworld-max": JSON.stringify({ audioContent: "AAAA" }),
      "gemini-flash-tts": JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: "AAAA",
                    mimeType: "audio/L16;rate=24000",
                  },
                },
              ],
            },
          },
        ],
      }),
      "breeze-2": "\0\0\0\0",
    };
    for (const [id, body] of Object.entries(bodies)) {
      const signal = new AbortController().signal;
      const fetchMock = vi.fn((_url: string, init: CapturedInit) => {
        expect(init.signal, id).toBe(signal);
        return Promise.resolve(new Response(body, { status: 200 }));
      });
      vi.stubGlobal("fetch", fetchMock);
      const voice = voiceById(id);
      await providerFor(voice).synthesize(
        "x",
        voice,
        join(dir, `${id}.wav`),
        signal,
      );
      expect(fetchMock, id).toHaveBeenCalledTimes(1);
    }
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
