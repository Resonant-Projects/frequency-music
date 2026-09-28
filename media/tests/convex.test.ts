import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { callTool } from "../src/convex";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("callTool", () => {
  test("posts the secret in the body and returns parsed json", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "http://convex.test:3211/");
    vi.stubEnv("AGENT_TOOL_SECRET", "s3cret");
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("http://convex.test:3211/agent-tools/claimNextMediaJob");
      expect(JSON.parse(String(init.body))).toEqual({
        secret: "s3cret",
        workerId: "w",
        kinds: ["probe"],
      });
      return new Response(JSON.stringify({ jobId: "j1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await callTool<{ jobId: string }>("claimNextMediaJob", {
      workerId: "w",
      kinds: ["probe"],
    });
    expect(result).toEqual({ jobId: "j1" });
  });

  test("throws with status but never echoes the secret", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "http://convex.test:3211");
    vi.stubEnv("AGENT_TOOL_SECRET", "s3cret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope s3cret", { status: 403 })),
    );
    await expect(callTool("failMediaJob", {})).rejects.toThrow(/403/);
    await expect(callTool("failMediaJob", {})).rejects.not.toThrow(/s3cret/);
  });
});
