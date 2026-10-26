import { Effect, Exit } from "effect";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { callConvex, ConvexToolHttpError } from "../src/tools/convexTools";
import { convexRequest } from "../src/tools/convexHttp";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configure() {
  vi.stubEnv("CONVEX_SITE_URL", "https://synthetic.invalid");
  vi.stubEnv("AGENT_TOOL_SECRET", "synthetic-test-secret");
}

describe("Effect transport compatibility", () => {
  test("keeps the HTTP error class and status without retrying a write", async () => {
    configure();
    const fetchMock = vi.fn(
      async () => new Response("rejected", { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const error = await callConvex("createAgentDraft", {}).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(ConvexToolHttpError);
    expect((error as ConvexToolHttpError).status).toBe(429);
    expect((error as Error).message).toBe(
      "Convex tool createAgentDraft failed: 429 rejected",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("preserves retained recovery input while stripping model-visible large fields", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          nested: {
            rawText: "retained",
            transcript: "private",
            title: "Source",
          },
        }),
      ),
    );
    expect(await callConvex("getCaptureRecovery", {})).toEqual({
      nested: { rawText: "retained", transcript: "private", title: "Source" },
    });
    expect(await callConvex("getSource", {})).toEqual({
      nested: { title: "Source" },
    });
  });

  test("fiber interruption aborts HTTP body consumption and releases its request scope", async () => {
    configure();
    let signal: AbortSignal | undefined;
    let headers!: () => void;
    const ready = new Promise<void>((resolve) => {
      headers = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        signal = init.signal!;
        return new Response(
          new ReadableStream({
            start(controller) {
              signal!.addEventListener(
                "abort",
                () => controller.error(signal!.reason),
                { once: true },
              );
              headers();
            },
          }),
        );
      }),
    );
    const abort = new AbortController();
    const running = Effect.runPromiseExit(convexRequest("getSource", {}), {
      signal: abort.signal,
    });
    await ready;
    abort.abort();
    expect(Exit.isFailure(await running)).toBe(true);
    expect(signal?.aborted).toBe(true);
  });
});
