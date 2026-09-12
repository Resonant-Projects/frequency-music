import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { callConvex } from "../src/tools/convexTools";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Convex HTTP request cancellation", () => {
  test("forwards an optional signal to fetch and propagates cancellation", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "https://synthetic.invalid");
    vi.stubEnv("AGENT_TOOL_SECRET", "synthetic-test-secret");
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new Error("synthetic abort")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const request = callConvex("appendAgentRunEvent", {}, controller.signal);
    const rejected = expect(request).rejects.toThrow("synthetic abort");
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    controller.abort();
    await rejected;
  });

  test("leaves existing callers without a signal or timeout", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "https://synthetic.invalid");
    vi.stubEnv("AGENT_TOOL_SECRET", "synthetic-test-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: "completed" })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callConvex("markAgentRunCompleted", {})).resolves.toEqual({
      status: "completed",
    });
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("signal");
  });
});
