import { join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import { voiceById } from "../../convex/shared/voices";
import { synthesizeRetained } from "../src/jobs/narrate";
import { providerFor } from "../src/tts";
import { BREEZE_READY_TIMEOUT_MS } from "../src/tts/breeze";
import { SynthesisRejectedError, fetchAudioWithRetry } from "../src/tts/types";
import { fakeTools, narrateJob, workDir } from "./jobFixtures";

// vi.waitUntil gives up after 1 second by default, which a loaded CI runner can
// exceed before the first synthesis reaches its provider.
const LOADED_RUNNER_WAIT = { timeout: 30_000 };

describe("synthesizeRetained", () => {
  test.each([429, 409, 503])(
    "cancellation during %i rejection backoff preserves a safe retained retry",
    async (status) => {
      vi.useFakeTimers();
      let waiting = false;
      let ready = false;
      const fetchMock = vi.fn(async () =>
        ready
          ? new Response(new Uint8Array(2), { status: 200 })
          : new Response("rejected", { status }),
      );
      vi.stubGlobal("fetch", fetchMock);
      try {
        const controller = new AbortController();
        const ctx = {
          job: narrateJob,
          workDir: workDir("rejection-"),
          retainedDir: workDir("rejection-retained-"),
          tools: fakeTools().tools,
          rendererVersion: "0.2.0",
          signal: controller.signal,
        };
        const voice = voiceById(narrateJob.input.voiceId);
        const synth = {
          synthesize: async (
            _text: string,
            _voice: unknown,
            output: string,
            signal?: AbortSignal,
          ) => {
            const bytes = await fetchAudioWithRetry(
              "https://tts.test/speech",
              { method: "POST", signal },
              {
                retryableRejections: [status],
                backoffMs: () => {
                  waiting = true;
                  return 10_000;
                },
              },
            );
            const { writeFile } = await import("node:fs/promises");
            await writeFile(output, new Uint8Array(bytes));
          },
        };
        const first = synthesizeRetained(
          ctx,
          synth,
          voice,
          "test",
          join(ctx.workDir, "first.wav"),
        ).catch((error: unknown) => error);
        await vi.waitUntil(() => waiting, LOADED_RUNNER_WAIT);
        controller.abort(new Error("lease lost"));
        expect(await first).toBeInstanceOf(SynthesisRejectedError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        ready = true;
        await synthesizeRetained(
          { ...ctx, signal: new AbortController().signal },
          synth,
          voice,
          "test",
          join(ctx.workDir, "retry.wav"),
        );
        await synthesizeRetained(
          { ...ctx, signal: new AbortController().signal },
          synth,
          voice,
          "test",
          join(ctx.workDir, "cached.wav"),
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
        vi.unstubAllGlobals();
      }
    },
  );
  test.each(["timeout", "abort"])(
    "Breeze readiness %s before POST permits a safe later synthesis",
    async (kind) => {
      vi.useFakeTimers();
      vi.stubEnv("BREEZE_TTS_BASE_URL", "http://breeze.test");
      let ready = false;
      const calls: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          calls.push(url);
          return url.endsWith("/health")
            ? new Response("", { status: ready ? 200 : 503 })
            : new Response(new Uint8Array(2), { status: 200 });
        }),
      );
      try {
        const controller = new AbortController();
        const ctx = {
          job: narrateJob,
          workDir: workDir("breeze-ready-"),
          retainedDir: workDir("breeze-ready-retained-"),
          tools: fakeTools().tools,
          rendererVersion: "0.2.0",
          signal: controller.signal,
        };
        const voice = voiceById("breeze-2");
        const synth = providerFor(voice);
        const first = synthesizeRetained(
          ctx,
          synth,
          voice,
          "test",
          join(ctx.workDir, "first.wav"),
        ).catch((error: unknown) => error);
        await vi.waitUntil(() => calls.length > 0, LOADED_RUNNER_WAIT);
        if (kind === "abort") controller.abort(new Error("lease lost"));
        else
          await vi.advanceTimersByTimeAsync(BREEZE_READY_TIMEOUT_MS + 10_000);
        expect(await first).toBeInstanceOf(SynthesisRejectedError);
        expect(calls.some((url) => url.endsWith("/speech"))).toBe(false);
        ready = true;
        await synthesizeRetained(
          { ...ctx, signal: new AbortController().signal },
          synth,
          voice,
          "test",
          join(ctx.workDir, "retry.wav"),
        );
        expect(calls.filter((url) => url.endsWith("/speech"))).toHaveLength(1);
      } finally {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
      }
    },
  );
  test.each(["abort", "network"])(
    "%s during synthesis preserves unfinished intent and refuses another paid call",
    async (kind) => {
      const controller = new AbortController();
      const ctx = {
        job: narrateJob,
        workDir: workDir("unfinished-"),
        retainedDir: workDir("unfinished-retained-"),
        tools: fakeTools().tools,
        rendererVersion: "0.2.0",
        signal: controller.signal,
      };
      const voice = voiceById(narrateJob.input.voiceId);
      const synthesize = vi.fn(async () => {
        if (kind === "abort") controller.abort(new Error("lease lost"));
        throw new Error(
          kind === "abort" ? "lease lost" : "ambiguous transport failure",
        );
      });
      await expect(
        synthesizeRetained(
          ctx,
          { synthesize },
          voice,
          "test",
          join(ctx.workDir, "chunk.wav"),
        ),
      ).rejects.toThrow();
      await expect(
        synthesizeRetained(
          { ...ctx, signal: new AbortController().signal },
          { synthesize },
          voice,
          "test",
          join(ctx.workDir, "retry.wav"),
        ),
      ).rejects.toThrow("unfinished chunk");
      expect(synthesize).toHaveBeenCalledTimes(1);
    },
  );

  test("a confirmed synthesis rejection permits a later call", async () => {
    const ctx = {
      job: narrateJob,
      workDir: workDir("rejected-"),
      retainedDir: workDir("rejected-retained-"),
      tools: fakeTools().tools,
      rendererVersion: "0.2.0",
      signal: new AbortController().signal,
    };
    const voice = voiceById(narrateJob.input.voiceId);
    const synthesize = vi
      .fn()
      .mockRejectedValueOnce(
        new SynthesisRejectedError("Provider rejected request"),
      )
      .mockImplementationOnce(async (_text, _voice, output) => {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(output, "acknowledged audio");
      });
    await expect(
      synthesizeRetained(
        ctx,
        { synthesize },
        voice,
        "test",
        join(ctx.workDir, "chunk.wav"),
      ),
    ).rejects.toThrow("Provider rejected");
    await synthesizeRetained(
      ctx,
      { synthesize },
      voice,
      "test",
      join(ctx.workDir, "retry.wav"),
    );
    expect(synthesize).toHaveBeenCalledTimes(2);
  });
});
