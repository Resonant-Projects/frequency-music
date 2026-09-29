import { describe, expect, test, vi } from "vite-plus/test";
import fixture from "./fixtures/firecrawl-search.json";
import { createWebSearch } from "../src/tools/searchTool";

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

describe("federated source-scout search", () => {
  test("discovers papers without a Firecrawl key and audits provider provenance", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = urlOf(input);
      if (url.startsWith("https://api.openalex.org/works?"))
        return json({
          results: [
            {
              id: "https://openalex.org/W123",
              title: "Plate modes",
              doi: "https://doi.org/10.1234/PLATE",
              publication_year: 2024,
              publication_date: "2024-03-15",
              abstract_inverted_index: {
                Plate: [0],
                modes: [1],
                resonate: [2],
              },
              primary_location: {
                landing_page_url: "https://publisher.org/plate",
              },
            },
          ],
        });
      if (
        url.startsWith(
          "https://www.ebi.ac.uk/europepmc/webservices/rest/search?",
        )
      )
        return json({
          resultList: {
            result: [
              {
                title: "Auditory perception",
                doi: "10.2345/audio",
                pubYear: "2023",
                firstPublicationDate: "2023-11-02",
                authorString: "A Researcher",
                abstractText: "Auditory evidence.",
                id: "456",
                source: "MED",
              },
            ],
          },
        });
      throw new Error(`unexpected URL ${url}`);
    });
    const callTool = vi.fn(async () => ({ ok: true }));
    const search = createWebSearch({ apiKey: "", fetchImpl, callTool });

    await expect(
      search(
        { query: "plate modes", maxResults: 2 },
        {
          agentRunId: "run-scout",
          targetGap: "thin domain",
        },
      ),
    ).resolves.toEqual([
      {
        title: "Plate modes",
        url: "https://doi.org/10.1234/plate",
        providerUrl: "https://doi.org/10.1234/PLATE",
        snippet: "Plate modes resonate",
        publishedAt: "2024-03-15",
      },
      {
        title: "Auditory perception",
        url: "https://doi.org/10.2345/audio",
        snippet: "Auditory evidence.",
        publishedAt: "2023-11-02",
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("per_page=2"),
      expect.anything(),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("pageSize=2"),
      expect.anything(),
    );
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        payload: expect.objectContaining({
          query: "plate modes",
          targetGap: "thin domain",
          requested: 2,
          returned: 2,
          status: "ok",
          resultProviders: [
            { url: "https://doi.org/10.1234/plate", provider: "openalex" },
            { url: "https://doi.org/10.2345/audio", provider: "europePmc" },
          ],
          providers: expect.objectContaining({
            openalex: expect.objectContaining({ status: "ok", returned: 1 }),
            europePmc: expect.objectContaining({ status: "ok", returned: 1 }),
          }),
        }),
      }),
    );
  });

  test("starts research providers while Firecrawl is still pending", async () => {
    let resolveWeb!: (response: Response) => void;
    const pendingWeb = new Promise<Response>((resolve) => {
      resolveWeb = resolve;
    });
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      urlOf(input).includes("firecrawl.dev")
        ? pendingWeb
        : json({ results: [], resultList: { result: [] } }),
    );
    const search = createWebSearch({ apiKey: "fixture-key", fetchImpl })({
      query: "plate",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    resolveWeb(json({ data: { web: [] } }));
    await expect(search).resolves.toEqual([]);
  });

  test("keeps scholarly candidates when Firecrawl fills its entire result quota", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = urlOf(input);
      if (url.includes("firecrawl.dev"))
        return json({
          data: {
            web: Array.from({ length: 5 }, (_, i) => ({
              title: `Web ${i}`,
              url: `https://example.org/${i}`,
              description: "Web result",
            })),
          },
        });
      if (url.includes("openalex.org"))
        return json({
          results: [
            {
              title: "Measured research",
              doi: "10.1234/study",
              abstract_inverted_index: { Measured: [0], evidence: [1] },
            },
          ],
        });
      return json({
        resultList: {
          result: [
            {
              title: "Therapy trial",
              doi: "10.5678/trial",
              abstractText: "Controlled trial",
            },
          ],
        },
      });
    });
    const results = await createWebSearch({ apiKey: "fixture-key", fetchImpl })(
      { query: "resonance", maxResults: 5 },
    );
    expect(results).toHaveLength(5);
    expect(results.map((r) => r.url)).toContain(
      "https://doi.org/10.1234/study",
    );
    expect(results.map((r) => r.url)).toContain(
      "https://doi.org/10.5678/trial",
    );
  });

  test("keeps distinct port-specific sources", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      urlOf(input).includes("firecrawl.dev")
        ? json({
            data: {
              web: [
                {
                  title: "Default",
                  url: "https://example.org/paper",
                  description: "A",
                },
                {
                  title: "Alternate",
                  url: "https://example.org:8443/paper",
                  description: "B",
                },
              ],
            },
          })
        : json({ results: [], resultList: { result: [] } }),
    );
    const results = await createWebSearch({ apiKey: "fixture-key", fetchImpl })(
      { query: "paper" },
    );
    expect(results.map((result) => result.url)).toEqual([
      "https://example.org/paper",
      "https://example.org:8443/paper",
    ]);
  });

  test("deduplicates DOI variants and caps the combined results", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = urlOf(input);
      if (url.includes("firecrawl.dev"))
        return json({
          data: {
            web: [
              {
                title: "Web paper",
                url: "https://doi.org/10.1234/PLATE",
                description: "Web summary",
              },
              {
                title: "Another web source",
                url: "https://example.org/other?utm_source=search",
                description: "Summary",
              },
            ],
          },
        });
      if (url.includes("openalex.org"))
        return json({
          results: [
            {
              title: "Paper",
              doi: "https://doi.org/10.1234/plate",
              publication_year: 2024,
              abstract_inverted_index: { Scientific: [0], summary: [1] },
            },
          ],
        });
      return json({
        resultList: {
          result: [
            {
              title: "Same paper",
              doi: "10.1234/plate",
              abstractText: "Other summary",
            },
          ],
        },
      });
    });
    const search = createWebSearch({ apiKey: "fixture-key", fetchImpl });
    await expect(search({ query: "plate", maxResults: 2 })).resolves.toEqual([
      {
        title: "Web paper",
        url: "https://doi.org/10.1234/plate",
        providerUrl: "https://doi.org/10.1234/PLATE",
        snippet: "Web summary",
      },
      {
        title: "Another web source",
        url: "https://example.org/other",
        providerUrl: "https://example.org/other?utm_source=search",
        snippet: "Summary",
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test("one failing research provider does not discard other results", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      if (urlOf(input).includes("openalex.org"))
        throw new Error("token=secret outage");
      return json({
        resultList: {
          result: [
            {
              title: "Surviving paper",
              doi: "10.5678/survive",
              abstractText: "Evidence.",
            },
          ],
        },
      });
    });
    const callTool = vi.fn(async () => ({ ok: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(
        createWebSearch({ apiKey: "", fetchImpl, callTool })(
          { query: "resonance", maxResults: 1 },
          { agentRunId: "run-scout" },
        ),
      ).resolves.toEqual([
        {
          title: "Surviving paper",
          url: "https://doi.org/10.5678/survive",
          snippet: "Evidence.",
        },
      ]);
      expect(callTool).toHaveBeenCalledWith(
        "appendAgentRunEvent",
        expect.objectContaining({
          payload: expect.objectContaining({
            status: "ok",
            providers: expect.objectContaining({
              openalex: {
                status: "failed",
                returned: 0,
                error: "token=[REDACTED] outage",
              },
            }),
          }),
        }),
      );
    } finally {
      warn.mockRestore();
    }
  });
  test("keeps reserved characters inside a DOI suffix as encoded DOI data", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      urlOf(input).includes("openalex.org")
        ? json({
            results: [
              {
                title: "Reserved suffix",
                doi: "https://doi.org/10.5555/Plate%3Fmode%231",
              },
            ],
          })
        : json({
            resultList: {
              result: [
                { title: "Same paper", doi: "10.5555/plate?mode#1" },
                { title: "Sibling paper", doi: "10.5555/plate" },
              ],
            },
          }),
    );
    const results = await createWebSearch({ apiKey: "", fetchImpl })({
      query: "plate",
    });
    expect(results.map((result) => result.url)).toEqual([
      "https://doi.org/10.5555/plate%3fmode%231",
      "https://doi.org/10.5555/plate",
    ]);
  });

  test("retains bibliographic records without abstracts or a full date without inventing either", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      urlOf(input).includes("openalex.org")
        ? json({
            results: [
              {
                title: "Paper without abstract",
                doi: "https://doi.org/10.3333/noabstract",
                publication_year: 2022,
                publication_date: "2022-02-30",
              },
            ],
          })
        : json({
            resultList: {
              result: [
                {
                  title: "Another paper",
                  doi: "10.4444/noabstract",
                  pubYear: "2021",
                },
              ],
            },
          }),
    );
    await expect(
      createWebSearch({ apiKey: "", fetchImpl })({ query: "papers" }),
    ).resolves.toEqual([
      {
        title: "Paper without abstract",
        url: "https://doi.org/10.3333/noabstract",
        snippet: "Paper without abstract",
      },
      {
        title: "Another paper",
        url: "https://doi.org/10.4444/noabstract",
        snippet: "Another paper",
      },
    ]);
  });

  test("normalizes canonical URLs and excludes unidentifiable metadata", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      if (urlOf(input).includes("firecrawl.dev"))
        return json({
          data: {
            web: [
              {
                title: "Landing",
                url: "https://example.org/paper/?utm_source=feed#abstract",
                description: "Source",
              },
            ],
          },
        });
      if (urlOf(input).includes("openalex.org"))
        return json({
          results: [
            {
              title: "Same landing",
              primary_location: {
                landing_page_url: "https://example.org/paper",
              },
              abstract_inverted_index: { Evidence: [0] },
            },
            { title: "Incomplete paper", doi: "not-a-doi" },
          ],
        });
      return json({ resultList: { result: [] } });
    });
    await expect(
      createWebSearch({ apiKey: "fixture-key", fetchImpl })({ query: "paper" }),
    ).resolves.toEqual([
      {
        title: "Landing",
        url: "https://example.org/paper",
        providerUrl: "https://example.org/paper/?utm_source=feed#abstract",
        snippet: "Source",
      },
    ]);
  });

  test("bounds a research fetch that ignores abort and records the timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      if (urlOf(input).includes("openalex.org"))
        return await new Promise<Response>(() => {});
      return json({ resultList: { result: [] } });
    });
    const callTool = vi.fn(async () => ({ ok: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = createWebSearch({ apiKey: "", fetchImpl, callTool })(
        { query: "resonance" },
        { agentRunId: "run-scout" },
      );
      await vi.advanceTimersByTimeAsync(8_000);
      await expect(result).resolves.toEqual([]);
      expect(callTool).toHaveBeenCalledWith(
        "appendAgentRunEvent",
        expect.objectContaining({
          payload: expect.objectContaining({
            providers: expect.objectContaining({
              openalex: {
                status: "failed",
                returned: 0,
                error: "OpenAlex search timed out after 8000ms",
              },
            }),
          }),
        }),
      );
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("Firecrawl web_search", () => {
  test("maps a recorded response and logs the motivating gap", async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
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
      },
      {
        title: "Acoustic visualization review",
        url: "https://example.org/acoustic-visualization",
        snippet: "A review of physical methods for visualizing resonant modes.",
      },
    ]);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v2/search",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer fixture-key",
          "content-type": "application/json",
        },
      }),
    );
    const body = fetchImpl.mock.calls.find(
      ([input]) => urlOf(input) === "https://api.firecrawl.dev/v2/search",
    )?.[1]?.body;
    expect(typeof body).toBe("string");
    const request = JSON.parse(typeof body === "string" ? body : "{}");
    expect(request).toEqual({
      query: fixture.query,
      limit: 2,
      sources: ["web"],
    });
    expect(callTool).toHaveBeenCalledWith("appendAgentRunEvent", {
      runId: "run-scout",
      kind: "tool_call",
      message: "Searched federated providers for source-scout candidates",
      payload: {
        query: fixture.query,
        targetGap: "thin domain: cymatics",
        requested: 2,
        returned: 2,
        status: "ok",
        providers: {
          firecrawl: { status: "ok", returned: 2 },
          openalex: { status: "ok", returned: 0 },
          europePmc: { status: "ok", returned: 0 },
        },
        resultProviders: [
          {
            url: "https://example.org/chladni-modal-analysis",
            provider: "firecrawl",
          },
          {
            url: "https://example.org/acoustic-visualization",
            provider: "firecrawl",
          },
        ],
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
      "[source-scout] Firecrawl search failed; skipping provider:",
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
          providers: expect.objectContaining({
            firecrawl: {
              status: "failed",
              returned: 0,
              error: "temporary token=[REDACTED] provider failure",
            },
          }),
        }),
      }),
    );
    warn.mockRestore();
  });

  test("skips the provider call and warns when the API key is missing", async () => {
    const fetchImpl = vi.fn(async () => json({}));
    const callTool = vi.fn(async () => ({ ok: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const search = createWebSearch({ apiKey: "", fetchImpl, callTool });

    await expect(
      search({ query: "cymatics source" }, { agentRunId: "run-scout" }),
    ).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        runId: "run-scout",
        payload: expect.objectContaining({
          status: "ok",
          providers: expect.objectContaining({
            firecrawl: {
              status: "failed",
              returned: 0,
              error: "FIRECRAWL_API_KEY is required",
            },
          }),
        }),
      }),
    );
    warn.mockRestore();
  });

  test("bounds Firecrawl even when its fetch ignores abort", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      urlOf(input).includes("firecrawl.dev")
        ? await new Promise<Response>(() => {})
        : json({}),
    );
    const callTool = vi.fn(async () => ({ ok: true }));
    try {
      const result = createWebSearch({
        apiKey: "fixture-key",
        fetchImpl,
        callTool,
      })({ query: "hung web" }, { agentRunId: "run-scout" });
      await vi.advanceTimersByTimeAsync(15_000);
      await expect(result).resolves.toEqual([]);
      expect(callTool).toHaveBeenCalledWith(
        "appendAgentRunEvent",
        expect.objectContaining({
          payload: expect.objectContaining({
            providers: expect.objectContaining({
              firecrawl: {
                status: "failed",
                returned: 0,
                error: "Firecrawl search timed out after 15000ms",
              },
            }),
          }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  }, 1000);

  test("aborts a slow provider call and follows the warn-and-skip path", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    );
    const callTool = vi.fn(async () => ({ ok: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const search = createWebSearch({
      apiKey: "fixture-key",
      fetchImpl,
      callTool,
    });

    try {
      const result = search({ query: "slow resonance evidence" });
      await vi.advanceTimersByTimeAsync(23_000);

      await expect(result).resolves.toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        "[source-scout] Firecrawl search failed; skipping provider:",
        "Firecrawl search timed out after 15000ms",
      );
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });
});
