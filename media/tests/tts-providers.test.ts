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
import { resetBreezeReadiness, waitForBreezeReady } from "../src/tts/breeze";
import { fetchAudioWithRetry } from "../src/tts/types";

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

// The Breeze server as the provider sees it: GET /health answers 200 once
// the model is loaded (`healthStatuses` are consumed first), POST
// /v1/audio/speech is handed to `speech`.
function breezeServer(
  speech: (init: CapturedInit, call: number) => Response,
  healthStatuses: number[] = [],
) {
  const health = [...healthStatuses];
  let speechCalls = 0;
  const fetchMock = vi.fn((url: string, init: CapturedInit) => {
    if (url.endsWith("/health")) {
      const status = health.shift() ?? 200;
      return Promise.resolve(
        new Response(
          status === 200 ? JSON.stringify({ status: "ok" }) : "loading",
          { status },
        ),
      );
    }
    speechCalls += 1;
    return Promise.resolve(speech(init, speechCalls));
  });
  const urls = () => fetchMock.mock.calls.map(([url]) => url);
  return { fetchMock, urls };
}

const dir = mkdtempSync(join(tmpdir(), "tts-"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  resetBreezeReadiness();
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
    const { fetchMock, urls } = breezeServer((init) => {
      expect(init.redirect).toBe("error");
      // No key is configured, so no Authorization header is sent; the
      // multipart boundary is fetch's job, so no content-type either.
      expect(init.headers?.authorization).toBeUndefined();
      expect(init.headers?.["content-type"]).toBeUndefined();
      const form = formBody(init);
      expect(["Hello there.", "Again."]).toContain(form.get("text"));
      expect(form.get("instruction")).toBe(
        voice.voiceId.slice("design:".length),
      );
      expect(form.get("cfg_scale")).toBe("4");
      expect(form.get("seed")).toBe("42");
      expect(form.has("ref_audio")).toBe(false);
      return new Response(pcm, {
        status: 200,
        headers: { "content-type": "audio/pcm" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = join(dir, "breeze.wav");
    await providerFor(voice).synthesize("Hello there.", voice, out);
    // R27: readiness is checked once before the first synthesis; the
    // trailing slash on the base url is dropped from both.
    expect(urls()).toEqual([
      "http://tts-local:8881/health",
      "http://tts-local:8881/v1/audio/speech",
    ]);
    const written = readFileSync(out);
    expect(written.subarray(0, 4).toString()).toBe("RIFF");
    expect(written.length).toBe(44 + pcm.length);
    expect(written.readUInt16LE(22)).toBe(1); // mono
    expect(written.readUInt32LE(24)).toBe(24000); // sample rate
    expect(written.readUInt32LE(40)).toBe(pcm.length); // data chunk size
    expect([...written.subarray(44)]).toEqual([...pcm]);
    // A second synthesis in the same process does not re-check health.
    await providerFor(voice).synthesize("Again.", voice, out);
    expect(urls().filter((url) => url.endsWith("/health"))).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("breeze provider sends a bearer token only when a key is set and rejects non-design voice ids", async () => {
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://tts-local:8881");
    vi.stubEnv("BREEZE_TTS_API_KEY", "shh");
    const { fetchMock, urls } = breezeServer((init) => {
      expect(init.headers?.authorization).toBe("Bearer shh");
      expect(formBody(init).has("instruction")).toBe(false);
      return new Response(new Uint8Array(2), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const plain = { ...voiceById("breeze-2"), voiceId: "" };
    await providerFor(plain).synthesize("x", plain, join(dir, "plain.wav"));
    expect(urls().filter((url) => url.endsWith("/speech"))).toHaveLength(1);

    const referenced = { ...voiceById("breeze-2"), voiceId: "ref:some-clip" };
    await expect(
      providerFor(referenced).synthesize("x", referenced, join(dir, "ref.wav")),
    ).rejects.toThrow(/design:/);
    expect(urls().filter((url) => url.endsWith("/speech"))).toHaveLength(1);
  });

  for (const busy of [409, 503]) {
    test(`breeze provider waits out a ${busy} from the server and then succeeds (R27)`, async () => {
      vi.useFakeTimers();
      vi.stubEnv("BREEZE_TTS_BASE_URL", "http://tts-local:8881");
      const voice = voiceById("breeze-2");
      const pcm = new Uint8Array([9, 0, 8, 0]);
      const { fetchMock, urls } = breezeServer((_init, call) =>
        call === 1
          ? new Response("busy", { status: busy })
          : new Response(pcm, { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const out = join(dir, `busy-${busy}.wav`);
      const attempt = providerFor(voice).synthesize("x", voice, out);
      const speechCalls = () => urls().filter((u) => u.endsWith("/speech"));
      // The busy backoff is longer than the ordinary one; nothing fires
      // before it.
      await vi.advanceTimersByTimeAsync(1000);
      expect(speechCalls()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(5000);
      await attempt;
      expect(speechCalls()).toHaveLength(2);
      const written = readFileSync(out);
      expect(written.subarray(0, 4).toString()).toBe("RIFF");
      expect(written.length).toBe(44 + pcm.length);
    });
  }

  test("R27: the first Breeze synthesis waits for /health to answer 200", async () => {
    vi.useFakeTimers();
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://tts-local:8881");
    const voice = voiceById("breeze-2");
    const pcm = new Uint8Array([1, 0]);
    // Loading for two polls, then ready.
    const { fetchMock, urls } = breezeServer(
      () => new Response(pcm, { status: 200 }),
      [503, 503, 200],
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = join(dir, "cold.wav");
    const attempt = providerFor(voice).synthesize("x", voice, out);
    await vi.advanceTimersByTimeAsync(0);
    expect(urls()).toEqual(["http://tts-local:8881/health"]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(urls()).toHaveLength(2);
    expect(urls().every((url) => url.endsWith("/health"))).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    await attempt;
    expect(urls()).toEqual([
      "http://tts-local:8881/health",
      "http://tts-local:8881/health",
      "http://tts-local:8881/health",
      "http://tts-local:8881/v1/audio/speech",
    ]);
    expect(readFileSync(out).length).toBe(44 + pcm.length);
  });

  test("R27: the health gate gives up after its budget and a later job checks again", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string) =>
      Promise.resolve(new Response("loading", { status: 503 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const wait = waitForBreezeReady("http://tts-local:8881/", undefined, {
      timeoutMs: 60_000,
      intervalMs: 10_000,
    });
    const settled = wait.then(
      () => undefined,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(70_000);
    const error = await settled;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Breeze TTS did not become ready within 1 min",
    );
    // Polls at 0, 10, ..., 60 s (the deadline itself is still tried); none
    // past it.
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://tts-local:8881/health");

    // The provider forgets a failed wait, so a later synthesis polls again
    // instead of failing from a cached rejection.
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://tts-local:8881");
    const voice = voiceById("breeze-2");
    const server = breezeServer(
      () => new Response(new Uint8Array(2), { status: 200 }),
      [503],
    );
    vi.stubGlobal("fetch", server.fetchMock);
    const first = providerFor(voice)
      .synthesize("x", voice, join(dir, "retry-gate.wav"))
      .then(
        () => "ok",
        () => "failed",
      );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await first).toBe("ok");
  });

  test("a hosted attempt that hangs past the per-attempt timeout is retried, then succeeds", async () => {
    const bytes = new Uint8Array([7, 7]);
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_url: string, init: CapturedInit) => {
      signals.push(init.signal!);
      if (signals.length === 1) {
        // Never answers; only the attempt's own timeout ends it.
        return new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        });
      }
      return Promise.resolve(new Response(bytes, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchAudioWithRetry(
      "https://tts.test/speech",
      { method: "POST" },
      { attempts: 2, timeoutMs: 20, backoffMs: () => 0 },
    );
    expect([...new Uint8Array(result)]).toEqual([...bytes]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  test("a job abort during the backoff ends the wait at once", async () => {
    vi.useFakeTimers();
    vi.stubEnv("INWORLD_API_KEY", "k");
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("busy", { status: 500 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const attempt = providerFor(voiceById("inworld-max"))
      .synthesize(
        "x",
        voiceById("inworld-max"),
        join(dir, "aborted.wav"),
        controller.signal,
      )
      .then(
        () => "resolved",
        (error: unknown) => error,
      );
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Mid-backoff (500 ms) the job is abandoned: no second attempt, no wait.
    controller.abort(new Error("deadline"));
    await vi.advanceTimersByTimeAsync(0);
    const outcome = await attempt;
    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toBe("deadline");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("every provider runs each attempt under the job signal plus its own timeout", async () => {
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
      const controller = new AbortController();
      const seen: AbortSignal[] = [];
      const fetchMock = vi.fn((url: string, init: CapturedInit) => {
        seen.push(init.signal!);
        return Promise.resolve(
          url.endsWith("/health")
            ? new Response("{}", { status: 200 })
            : new Response(body, { status: 200 }),
        );
      });
      vi.stubGlobal("fetch", fetchMock);
      const voice = voiceById(id);
      await providerFor(voice).synthesize(
        "x",
        voice,
        join(dir, `${id}.wav`),
        controller.signal,
      );
      // Breeze also polls /health first; every request (including that one)
      // runs under a signal derived from the job's, not the raw job signal,
      // so the per-attempt timeout applies, and aborting the job aborts it.
      expect(seen.length, id).toBeGreaterThan(0);
      for (const signal of seen) {
        expect(signal, id).not.toBe(controller.signal);
        expect(signal.aborted, id).toBe(false);
      }
      controller.abort();
      for (const signal of seen) expect(signal.aborted, id).toBe(true);
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
