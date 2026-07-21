import { describe, expect, test, vi } from "vite-plus/test";
import fixture from "./fixtures/tavily-search.json";
import { createWebSearch } from "../src/tools/searchTool";

describe("Tavily web_search", () => {
  test("maps a recorded response and logs the motivating gap", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const callTool = vi.fn(async () => ({ ok: true }));
    const search = createWebSearch({
      apiKey: "fixture-key",
      fetchImpl,
      callTool,
    });

    await expect(
      search(
        { query: fixture.query, maxResults: 2 },
        { agentRunId: "run-scout", targetGap: "thin domain: cymatics" },
      ),
    ).resolves.toEqual([
      {
        title: "Modal analysis of Chladni figures",
        url: "https://example.org/chladni-modal-analysis",
        snippet:
          "Measured plate modes connect forcing frequency to nodal geometry.",
        publishedAt: "2025-11-04",
      },
      {
        title: "Acoustic visualization review",
        url: "https://example.org/acoustic-visualization",
        snippet: "A review of physical methods for visualizing resonant modes.",
      },
    ]);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    const request = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(request).toEqual({
      api_key: "fixture-key",
      query: fixture.query,
      max_results: 2,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
    });
    expect(callTool).toHaveBeenCalledWith("appendAgentRunEvent", {
      runId: "run-scout",
      kind: "tool_call",
      message: "Searched Tavily for source-scout candidates",
      payload: {
        query: fixture.query,
        targetGap: "thin domain: cymatics",
        requested: 2,
        returned: 2,
        status: "ok",
      },
    });
  });

  test("warns, audits, and skips a failed provider call", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("temporary token=private provider failure");
    });
    const callTool = vi.fn(async () => ({ ok: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const search = createWebSearch({
      apiKey: "fixture-key",
      fetchImpl,
      callTool,
    });

    await expect(
      search(
        { query: "resonance evidence" },
        { agentRunId: "run-scout", targetGap: "starved conjecture: a:b" },
      ),
    ).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "[source-scout] Tavily search failed; skipping query:",
      "temporary token=[REDACTED] provider failure",
    );
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        runId: "run-scout",
        kind: "tool_call",
        payload: expect.objectContaining({
          query: "resonance evidence",
          targetGap: "starved conjecture: a:b",
          returned: 0,
          status: "failed",
          error: "temporary token=[REDACTED] provider failure",
        }),
      }),
    );
    warn.mockRestore();
  });
});
