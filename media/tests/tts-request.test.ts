import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  fetchAudioWithRetry,
  sleep,
  SynthesisRejectedError,
} from "../src/tts/types";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TTS request lifetime", () => {
  test("a failing custom backoff preserves proof that all requests were rejected", async () => {
    const fetchMock = vi.fn(
      async () => new Response("private", { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchAudioWithRetry(
        "https://synthetic.invalid",
        {},
        {
          backoffMs: () => {
            throw new Error("invalid provider wait");
          },
        },
      ),
    ).rejects.toBeInstanceOf(SynthesisRejectedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a successful header followed by a stuck body cannot trigger another paid request", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: () => new Promise<ArrayBuffer>(() => {}),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const failure = await fetchAudioWithRetry(
      "https://synthetic.invalid",
      {},
      {
        timeoutMs: 10,
        backoffMs: () => 0,
      },
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(SynthesisRejectedError);
    expect((failure as Error).message).toContain("ambiguous transport failure");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("rejection bodies are released without reading text that can echo secrets", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }), {
      status: 429,
    });
    const read = vi.spyOn(response, "text");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    await expect(
      fetchAudioWithRetry(
        "https://synthetic.invalid",
        {},
        {
          attempts: 1,
        },
      ),
    ).rejects.toBeInstanceOf(SynthesisRejectedError);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
  });

  test("a settled wait releases the external abort listener", async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await sleep(0, controller.signal);
    expect(add).toHaveBeenCalledWith("abort", expect.any(Function), {
      once: true,
    });
    expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0]![1]);
  });
});
