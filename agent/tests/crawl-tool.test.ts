import { describe, expect, test, vi } from "vite-plus/test";
import {
  createCrawl4aiPage,
  createCrawlPage,
  createFirecrawlPage,
  createOpenAlexAbstract,
  doiForUrl,
  normalizedTitle,
  titleSearchTerms,
} from "../src/tools/crawlTool";

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
        params: { cache_mode: "bypass", exclude_all_images: true },
      },
    });
  });

  test("refuses crawler responses beyond the byte cap before parsing", async () => {
    const chunk = new TextEncoder().encode("x".repeat(1024 * 1024));
    let sent = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
      },
      cancel,
    });
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl: async () => new Response(body, { status: 200 }),
    });
    await expect(crawl("https://example.org/huge")).resolves.toBeNull();
    expect(cancel).toHaveBeenCalled();
    expect(sent).toBeLessThanOrEqual(18);
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

const jstorChallenge =
  "A required part of this site couldn’t load. This may be due to a browser extension, network issues, or browser settings. Please check your connection, disable any ad blockers, or try using a different browser. \nis verifying your browser...";
const article =
  "# Measured modes\n" + "The plate resonated at 440 Hz. ".repeat(20);

function crawl4aiReturning(markdown: string) {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          results: [{ success: true, status_code: 200, markdown }],
        }),
        { status: 200 },
      ),
  );
}

function firecrawlReturning(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("bot challenges and the Lab Firecrawl fallback", () => {
  test("drops a browser-check page that Crawl4AI reports as a success", async () => {
    const crawl = createCrawl4aiPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl: crawl4aiReturning(jstorChallenge),
    });
    await expect(
      crawl("https://www.jstor.org/stable/1513178"),
    ).resolves.toBeNull();
  });

  test("falls back to Firecrawl when Crawl4AI has no usable text", async () => {
    const fallback = vi.fn(async () => ({
      text: article,
      provider: "firecrawl" as const,
    }));
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl: crawl4aiReturning(jstorChallenge),
      fallback,
    });
    await expect(crawl("https://example.org/paper")).resolves.toEqual({
      text: article,
      provider: "firecrawl",
    });
    expect(fallback).toHaveBeenCalledWith(
      "https://example.org/paper",
      undefined,
    );
  });

  test("keeps Crawl4AI text without calling the fallback", async () => {
    const fallback = vi.fn();
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl: crawl4aiReturning(article),
      fallback,
    });
    await expect(crawl("https://example.org/paper")).resolves.toMatchObject({
      provider: "crawl4ai",
    });
    expect(fallback).not.toHaveBeenCalled();
  });

  test("sends PDFs straight to the fallback and private URLs nowhere", async () => {
    const fetchImpl = vi.fn(async () => new Response());
    const fallback = vi.fn(async () => null);
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl,
      fallback,
    });
    await crawl("https://mtosmt.org/issues/mto.20.26.3/mto.20.26.3.miller.pdf");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
    await expect(crawl("http://127.0.0.1/paper.pdf")).resolves.toBeNull();
    await expect(crawl("http://169.254.169.254/latest")).resolves.toBeNull();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  test("scrapes the Lab Firecrawl without credentials and returns bounded markdown", async () => {
    const fetchImpl = firecrawlReturning({
      success: true,
      data: {
        markdown: "# Jazz models\n" + "Algorithmic creativity. ".repeat(2_000),
        metadata: { statusCode: 200 },
      },
    });
    const scrape = createFirecrawlPage({
      baseUrl: "http://172.16.10.38:3002/",
      egressGuarded: true,
      fetchImpl,
    });
    const page = await scrape("https://mtosmt.org/paper.pdf");
    expect(page?.provider).toBe("firecrawl");
    expect(page?.text.length).toBe(30_000);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://172.16.10.38:3002/v2/scrape",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).has("authorization")).toBe(false);
    expect(JSON.parse(init.body as string)).toMatchObject({
      url: "https://mtosmt.org/paper.pdf",
      formats: ["markdown"],
      onlyMainContent: true,
      skipTlsVerification: false,
    });
  });

  test("never scrapes through Firecrawl Cloud or without certified egress", async () => {
    const fetchImpl = vi.fn(async () => new Response());
    for (const deps of [
      { baseUrl: "https://api.firecrawl.dev", egressGuarded: true },
      { baseUrl: "", egressGuarded: true },
      { baseUrl: "http://172.16.10.38:3002", egressGuarded: false },
    ]) {
      const scrape = createFirecrawlPage({ ...deps, fetchImpl });
      await expect(scrape("https://example.org/paper")).resolves.toBeNull();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("rejects failed, error-status, and challenge Firecrawl results", async () => {
    for (const [body, status] of [
      [{ success: false, error: "All scraping engines failed" }, 500],
      [
        {
          success: true,
          data: { markdown: article, metadata: { statusCode: 403 } },
        },
        200,
      ],
      [
        {
          success: true,
          data: { markdown: jstorChallenge, metadata: { statusCode: 200 } },
        },
        200,
      ],
      [{ success: true, data: { markdown: "Too short" } }, 200],
    ] as const) {
      const scrape = createFirecrawlPage({
        baseUrl: "http://172.16.10.38:3002",
        egressGuarded: true,
        fetchImpl: firecrawlReturning(body, status),
      });
      await expect(scrape("https://example.org/paper")).resolves.toBeNull();
    }
  });
});

const lSystemsAbstract =
  "Among musical symmetries and self-similarities are those that can be produced using Lindenmayer-system curves to generate melodies.";
function invertedIndex(text: string): Record<string, number[]> {
  const index: Record<string, number[]> = {};
  text.split(" ").forEach((word, offset) => {
    (index[word] ??= []).push(offset);
  });
  return index;
}
const lSystemsWork = {
  id: "https://openalex.org/W2328530878",
  doi: "https://doi.org/10.2307/1513178",
  title: "L-Systems, Melodies and Musical Structure",
  publication_year: 1994,
  abstract_inverted_index: invertedIndex(lSystemsAbstract),
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("OpenAlex abstract fallback", () => {
  test("finds the DOI a candidate URL names", () => {
    expect(doiForUrl("https://www.jstor.org/stable/1513178")).toBe(
      "10.2307/1513178",
    );
    expect(doiForUrl("https://www.jstor.org/stable/pdf/1513178.pdf")).toBe(
      "10.2307/1513178",
    );
    expect(doiForUrl("https://doi.org/10.1353/pnm.2010.0009")).toBe(
      "10.1353/pnm.2010.0009",
    );
    expect(
      doiForUrl(
        "https://www.tandfonline.com/doi/full/10.1080/09298215.2015.1123747",
      ),
    ).toBe("10.1080/09298215.2015.1123747");
    expect(
      doiForUrl(
        "https://onlinelibrary.wiley.com/doi/full/10.1002/1097-0266(200010/11)21:10/11%3C1105::AID-SMJ133%3E3.0.CO;2-E",
      ),
    ).toBe("10.1002/1097-0266(200010/11)21:10/11<1105::AID-SMJ133>3.0.CO;2-E");
    expect(doiForUrl("https://example.org/paper")).toBeNull();
    expect(doiForUrl("not a url")).toBeNull();
  });

  test("returns a labelled abstract found by DOI without following redirects", async () => {
    const fetchImpl = vi.fn(async () => json(lSystemsWork));
    const lookup = createOpenAlexAbstract({ fetchImpl });
    const page = await lookup("https://www.jstor.org/stable/1513178");
    expect(page?.provider).toBe("openalex");
    expect(page?.text).toMatch(
      /^Abstract from OpenAlex \(W2328530878; DOI 10\.2307\/1513178\)\. The full text was not captured\.\n\n# L-Systems, Melodies and Musical Structure \(1994\)\n\nAmong musical symmetries/,
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(
      /^https:\/\/api\.openalex\.org\/works\/doi:10\.2307\/1513178\?select=/,
    );
    expect(init).toMatchObject({ method: "GET", redirect: "error" });
  });

  test("normalizes accented titles without splitting words", async () => {
    expect(normalizedTitle("Étude pour piano")).toBe("etude pour piano");
    expect(normalizedTitle("Klänge, Töne und Resonanz: eine Studie")).toBe(
      "klange tone und resonanz eine studie",
    );
    expect(normalizedTitle("Гармония и резонанс в музыке")).toBe(
      "гармония и резонанс в музыке",
    );
    // OpenAlex does not fold accents, so the query keeps them.
    expect(titleSearchTerms("Klänge, Töne und Resonanz: eine Studie")).toBe(
      "klänge töne und resonanz eine studie",
    );
    // A three-word accented title stays below the four-word safeguard.
    const fetchImpl = vi.fn(async () =>
      json({ meta: { count: 1 }, results: [] }),
    );
    const lookup = createOpenAlexAbstract({ fetchImpl });
    await expect(
      lookup("https://example.org/a", { title: "Étude pour piano" }),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("encodes DOI characters that would otherwise end the request path", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 404 }));
    const lookup = createOpenAlexAbstract({ fetchImpl });
    await lookup("https://doi.org/10.1000/old%23doi%3Fpart");
    expect(fetchImpl.mock.calls[0]?.[0]).toMatch(
      /^https:\/\/api\.openalex\.org\/works\/doi:10\.1000\/old%23doi%3Fpart\?select=/,
    );
  });

  test("falls back to an exact title match when the DOI is unknown", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(
        json({
          meta: { count: 1 },
          results: [
            {
              ...lSystemsWork,
              title: "L-systems: melodies and musical structure",
            },
          ],
        }),
      );
    const lookup = createOpenAlexAbstract({ fetchImpl });
    const page = await lookup("https://www.jstor.org/stable/1513178", {
      title: "L-Systems, Melodies and Musical Structure",
    });
    expect(page?.provider).toBe("openalex");
    const searchUrl = new URL(fetchImpl.mock.calls[1]?.[0] as string);
    expect(searchUrl.searchParams.get("filter")).toBe(
      "title.search:l systems melodies and musical structure",
    );
  });

  test("refuses near, ambiguous, or too-short title matches", async () => {
    const near = createOpenAlexAbstract({
      fetchImpl: async () =>
        json({
          meta: { count: 1 },
          results: [
            { ...lSystemsWork, title: "L-Systems and Musical Structure" },
          ],
        }),
    });
    await expect(
      near("https://example.org/a", {
        title: "L-Systems, Melodies and Musical Structure",
      }),
    ).resolves.toBeNull();
    const ambiguous = createOpenAlexAbstract({
      fetchImpl: async () =>
        json({
          meta: { count: 2 },
          results: [
            lSystemsWork,
            {
              ...lSystemsWork,
              id: "https://openalex.org/W2",
              doi: "https://doi.org/10.1/other",
            },
          ],
        }),
    });
    await expect(
      ambiguous("https://example.org/a", {
        title: "L-Systems, Melodies and Musical Structure",
      }),
    ).resolves.toBeNull();
    // Results without a DOI or id are distinct works, so still ambiguous.
    const unidentified = createOpenAlexAbstract({
      fetchImpl: async () =>
        json({
          meta: { count: 2 },
          results: [
            { ...lSystemsWork, id: undefined, doi: undefined },
            { ...lSystemsWork, id: undefined, doi: undefined },
          ],
        }),
    });
    await expect(
      unidentified("https://example.org/a", {
        title: "L-Systems, Melodies and Musical Structure",
      }),
    ).resolves.toBeNull();
    // A response without a match count cannot prove uniqueness.
    const uncounted = createOpenAlexAbstract({
      fetchImpl: async () => json({ results: [lSystemsWork] }),
    });
    await expect(
      uncounted("https://example.org/a", {
        title: "L-Systems, Melodies and Musical Structure",
      }),
    ).resolves.toBeNull();
    // One exact match on this page, but more matches exist on later pages.
    const paged = createOpenAlexAbstract({
      fetchImpl: async () =>
        json({ meta: { count: 40 }, results: [lSystemsWork] }),
    });
    await expect(
      paged("https://example.org/a", {
        title: "L-Systems, Melodies and Musical Structure",
      }),
    ).resolves.toBeNull();
    const fetchImpl = vi.fn(async () =>
      json({ meta: { count: 1 }, results: [lSystemsWork] }),
    );
    const short = createOpenAlexAbstract({ fetchImpl });
    await expect(
      short("https://example.org/a", { title: "Musical Structure" }),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("returns nothing for thin abstracts, errors, or private URLs", async () => {
    const thin = createOpenAlexAbstract({
      fetchImpl: async () =>
        json({
          ...lSystemsWork,
          abstract_inverted_index: invertedIndex("Too short."),
        }),
    });
    await expect(
      thin("https://www.jstor.org/stable/1513178"),
    ).resolves.toBeNull();
    const failing = createOpenAlexAbstract({
      fetchImpl: async () => new Response("", { status: 503 }),
    });
    await expect(
      failing("https://www.jstor.org/stable/1513178"),
    ).resolves.toBeNull();
    const fetchImpl = vi.fn(async () => json(lSystemsWork));
    const lookup = createOpenAlexAbstract({ fetchImpl });
    await expect(lookup("http://127.0.0.1/stable/1513178")).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("is tried only after both crawlers fail, with the Scout's title", async () => {
    const fallback = vi.fn(async () => null);
    const abstractFallback = vi.fn(async () => ({
      text: article,
      provider: "openalex" as const,
    }));
    const crawl = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl: crawl4aiReturning(jstorChallenge),
      fallback,
      abstractFallback,
    });
    const hint = { title: "L-Systems, Melodies and Musical Structure" };
    await expect(
      crawl("https://www.jstor.org/stable/1513178", hint),
    ).resolves.toMatchObject({
      provider: "openalex",
    });
    expect(fallback).toHaveBeenCalledWith(
      "https://www.jstor.org/stable/1513178",
      hint,
    );
    expect(abstractFallback).toHaveBeenCalledWith(
      "https://www.jstor.org/stable/1513178",
      hint,
    );
    const crawled = createCrawlPage({
      apiToken: "fixture-token",
      egressGuarded: true,
      fetchImpl: crawl4aiReturning(article),
      fallback,
      abstractFallback,
    });
    await crawled("https://example.org/paper", hint);
    expect(abstractFallback).toHaveBeenCalledTimes(1);
  });
});
