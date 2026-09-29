import { describe, expect, test, vi } from "vite-plus/test";
import { createCrawlPage } from "../src/tools/crawlTool";

describe("self-hosted Crawl4AI source text", () => {
  test("returns bounded markdown from a successful public HTML crawl", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            results: [
              {
                url: "https://example.org/paper",
                success: true,
                status_code: 200,
                markdown: {
                  raw_markdown: "# Measured modes\n" + "e".repeat(35_000),
                  // Crawl4AI's default generator returns "" without a filter.
                  fit_markdown: "",
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl,
    });
    const result = await crawl("https://example.org/paper");
    expect(result).toEqual({
      text: expect.stringMatching(/^# Measured modes/),
      provider: "crawl4ai",
    });
    expect(result?.text.length).toBe(30_000);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://crawl4ai.rproj.art/crawl",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: expect.objectContaining({
          authorization: "Bearer fixture-token",
        }),
      }),
    );
    expect(
      JSON.parse((fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string),
    ).toEqual({
      urls: ["https://example.org/paper"],
      crawler_config: {
        type: "CrawlerRunConfig",
        params: { cache_mode: "bypass" },
      },
    });
  });

  test("does not submit untrusted URLs unless crawler egress is explicitly certified", async () => {
    const fetchImpl = vi.fn(async () => new Response());
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: false,
      fetchImpl,
    });
    await expect(
      crawl("https://public.example/redirect-to-metadata"),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("refuses private targets before any request", async () => {
    const fetchImpl = vi.fn(async () => new Response());
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl,
    });
    await expect(crawl("http://127.0.0.1/admin")).resolves.toBeNull();
    await expect(crawl("http://localhost./internal")).resolves.toBeNull();
    await expect(crawl("file:///etc/passwd")).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("rejects unsuccessful and empty results rather than persisting an interstitial", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            results: [
              { success: false, error_message: "blocked", markdown: "" },
            ],
          }),
          { status: 200 },
        ),
    );
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl,
    });
    await expect(crawl("https://example.org/paper")).resolves.toBeNull();
  });

  test("rejects too-short pages that cannot enter the extraction workflow", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                success: true,
                status_code: 200,
                markdown: "A short landing page",
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl,
    });
    await expect(crawl("https://example.org/paper")).resolves.toBeNull();
  });

  test("missing credentials do not make a network call", async () => {
    const fetchImpl = vi.fn(async () => new Response());
    const crawl = createCrawlPage({ apiToken: "", fetchImpl });
    await expect(crawl("https://example.org/paper")).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
