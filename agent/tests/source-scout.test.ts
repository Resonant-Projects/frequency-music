import { describe, expect, test, vi } from "vite-plus/test";
import {
  createIngestSourcesNode,
  createJudgeResultsNode,
  createProposeFeedsNode,
  createRecaptureSourcesNode,
  createSearchLoopNode,
  createSummarizeNode,
  queryPlanOutputSchema,
  routeAfterQueries,
  routeAfterTargets,
  routeAtStart,
  scoutVerdictSchema,
} from "../src/graphs/source-scout/nodes";
import {
  MAX_FEED_PROPOSALS_PER_RUN,
  MAX_INGESTS_PER_RUN,
  MAX_SEARCH_CALLS,
} from "../src/graphs/source-scout/config";
import type {
  ScoutJudgment,
  ScoutSearchHit,
  SourceScoutState,
} from "../src/state/sourceScoutState";

const searchHit = (index: number): ScoutSearchHit => ({
  query: {
    query: `query ${index}`,
    targetGap: "thin-domain:cymatics",
    rationale: "The domain has too few source links.",
  },
  result: {
    title: `Candidate ${index}`,
    url: `https://example.org/${index}`,
    snippet: `Candidate snippet ${index}`,
    publishedAt: "2026-06-01",
  },
});

function judgment(
  index: number,
  kind: "source" | "feed" | "discard",
): ScoutJudgment {
  return {
    searchHit: searchHit(index),
    verdict: {
      kind,
      relevanceNote: `Candidate ${index} addresses measured modal behavior.`,
      targetGap: "thin-domain:cymatics",
      evidenceLevelGuess: "peer-reviewed",
    },
  };
}

describe("source scout structured outputs", () => {
  test("round-trips every relevance verdict kind", () => {
    for (const kind of ["source", "feed", "discard"] as const) {
      expect(
        scoutVerdictSchema.parse({
          kind,
          relevanceNote: "Grounded relevance decision.",
          targetGap: "thin-domain:cymatics",
          evidenceLevelGuess: "peer-reviewed",
        }),
      ).toEqual({
        kind,
        relevanceNote: "Grounded relevance decision.",
        targetGap: "thin-domain:cymatics",
        evidenceLevelGuess: "peer-reviewed",
      });
    }
  });

  test("rejects query plans above the ten-call courtesy cap", () => {
    expect(() =>
      queryPlanOutputSchema.parse({
        queries: Array.from({ length: MAX_SEARCH_CALLS + 1 }, (_, index) => ({
          query: `query ${index}`,
          targetGap: "thin-domain:cymatics",
          rationale: "Need-directed query.",
        })),
      }),
    ).toThrow();
  });
});

describe("source scout routing", () => {
  test("summarizes immediately when the census has no targets", () => {
    expect(
      routeAfterTargets({
        targets: { thinDomains: [], starvedConjectures: [] },
      }),
    ).toBe("summarize");
    expect(
      routeAfterTargets({
        targets: {
          thinDomains: [
            { domain: "cymatics", onMissionConceptCount: 1, sourceCount: 0 },
          ],
          starvedConjectures: [],
        },
      }),
    ).toBe("plan_queries");
  });

  test("summarizes when planning returns no queries", () => {
    expect(routeAfterQueries({ plannedQueries: [] })).toBe("summarize");
    expect(routeAfterQueries({ plannedQueries: [searchHit(0).query] })).toBe(
      "search_loop",
    );
  });
});

describe("source scout execution caps and resilience", () => {
  test("runs no more than ten gap-tagged searches", async () => {
    const search = vi.fn(async () => []);
    await createSearchLoopNode(search)({
      agentRunId: "run-scout",
      plannedQueries: Array.from(
        { length: MAX_SEARCH_CALLS + 3 },
        (_, index) => searchHit(index).query,
      ),
    });

    expect(search).toHaveBeenCalledTimes(MAX_SEARCH_CALLS);
    expect(search).toHaveBeenNthCalledWith(
      1,
      { query: "query 0", maxResults: 5 },
      { agentRunId: "run-scout", targetGap: "thin-domain:cymatics" },
    );
  });

  test("skips one judge error and continues judging remaining results", async () => {
    const judge = {
      invoke: vi
        .fn()
        .mockResolvedValueOnce({
          kind: "source" as const,
          relevanceNote: "Measured source.",
          targetGap: "model-invented-gap",
        })
        .mockRejectedValueOnce(new Error("temporary secret=private failure"))
        .mockResolvedValueOnce({
          kind: "feed" as const,
          relevanceNote: "Recurring journal feed.",
          targetGap: "model-invented-gap",
        }),
    };
    const callTool = vi.fn(async () => ({ ok: true }));
    const node = createJudgeResultsNode({
      judge,
      callTool,
      resolveTraceUrl: async (traceUrl) => traceUrl,
    });

    const result = await node({
      agentRunId: "run-scout",
      searchHits: [searchHit(1), searchHit(2), searchHit(3)],
    });

    expect(result.judgments).toHaveLength(3);
    expect(result.judgeErrorCount).toBe(1);
    expect(result.judgments?.[0]).toMatchObject({
      verdict: { kind: "source", targetGap: "thin-domain:cymatics" },
    });
    expect(result.judgments?.[1]).toMatchObject({
      discardReason: {
        reason: "judge_error",
        message: "temporary secret=[REDACTED] failure",
      },
    });
    expect(result.judgments?.[2]).toMatchObject({
      verdict: { kind: "feed", targetGap: "thin-domain:cymatics" },
    });
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        kind: "decision",
        payload: expect.objectContaining({ reason: "judge_error" }),
      }),
    );
  });
});

describe("source scout canonical write nodes", () => {
  test("persists fetched source text with provider provenance through the guarded ingest tool", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "ingestScoutedSource"
        ? { id: "source-1", created: true }
        : { ok: true },
    );
    const crawl = vi.fn(async () => ({
      text: "# Measured modes\n" + "A reproducible experiment. ".repeat(5),
      provider: "crawl4ai" as const,
    }));
    await createIngestSourcesNode(
      callTool,
      crawl,
    )({
      agentRunId: "run-scout",
      judgments: [judgment(0, "source")],
    });
    expect(crawl).toHaveBeenCalledWith("https://example.org/0", {
      title: "Candidate 0",
    });
    expect(callTool).toHaveBeenCalledWith(
      "ingestScoutedSource",
      expect.objectContaining({
        rawText: "# Measured modes\n" + "A reproducible experiment. ".repeat(5),
        contentProvider: "crawl4ai",
      }),
    );
  });

  test("skips page capture for candidates that already have a canonical source", async () => {
    let writes = 0;
    const callTool = vi.fn(async (name: string) => {
      if (name === "findExistingSourceUrls")
        return [{ url: "https://example.org/0", needsText: false }];
      if (name === "ingestScoutedSource") {
        writes += 1;
        return { id: `source-${writes}`, created: writes !== 1 };
      }
      return { ok: true };
    });
    const crawl = vi.fn(async () => ({
      text: "# Measured modes\n" + "A reproducible experiment. ".repeat(5),
      provider: "crawl4ai" as const,
    }));
    await createIngestSourcesNode(
      callTool,
      crawl,
    )({
      agentRunId: "run-scout",
      judgments: [judgment(0, "source"), judgment(1, "source")],
    });

    expect(callTool).toHaveBeenCalledWith("findExistingSourceUrls", {
      urls: ["https://example.org/0", "https://example.org/1"],
    });
    expect(crawl.mock.calls).toEqual([
      ["https://example.org/1", { title: "Candidate 1" }],
    ]);
    const ingestArgs = callTool.mock.calls
      .filter(([name]) => name === "ingestScoutedSource")
      .map(([, args]) => args as Record<string, unknown>);
    expect(ingestArgs[0]).not.toHaveProperty("rawText");
    expect(ingestArgs[1]).toMatchObject({ contentProvider: "crawl4ai" });
  });

  test("ingests under the provider's spelling when a Source already keys on it", async () => {
    const callTool = vi.fn(async (name: string) => {
      if (name === "findExistingSourceUrls")
        return [
          { url: "https://example.org/0?utm_source=rss", needsText: false },
        ];
      return name === "ingestScoutedSource"
        ? { id: "source-1", created: false }
        : { ok: true };
    });
    const crawl = vi.fn(async () => null);
    const aliased = judgment(0, "source");
    aliased.searchHit.result.providerUrl =
      "https://example.org/0?utm_source=rss";
    await createIngestSourcesNode(
      callTool,
      crawl,
    )({ agentRunId: "run-scout", judgments: [aliased] });

    expect(callTool).toHaveBeenCalledWith("findExistingSourceUrls", {
      urls: ["https://example.org/0", "https://example.org/0?utm_source=rss"],
    });
    expect(crawl).not.toHaveBeenCalled();
    expect(callTool).toHaveBeenCalledWith(
      "ingestScoutedSource",
      expect.objectContaining({ url: "https://example.org/0?utm_source=rss" }),
    );
  });

  test("recaptures a known URL-only source and audits the enrichment", async () => {
    const callTool = vi.fn(async (name: string) => {
      if (name === "findExistingSourceUrls")
        return [{ url: "https://example.org/0", needsText: true }];
      return name === "ingestScoutedSource"
        ? { id: "source-1", created: false, enriched: true }
        : { ok: true };
    });
    const crawl = vi.fn(async () => ({
      text: `# Measured modes\n${"A reproducible experiment. ".repeat(5)}`,
      provider: "crawl4ai" as const,
    }));
    await createIngestSourcesNode(
      callTool,
      crawl,
    )({ agentRunId: "run-scout", judgments: [judgment(0, "source")] });

    expect(crawl).toHaveBeenCalledWith("https://example.org/0", {
      title: "Candidate 0",
    });
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        kind: "tool_call",
        message: "Source scout captured text for URL-only source",
        payload: expect.objectContaining({ enriched: true, created: false }),
      }),
    );
  });

  test("reports captured URL-only sources separately from duplicates", async () => {
    const write = (created: boolean, enriched?: boolean) => ({
      id: "source",
      url: "https://example.org/0",
      title: "Candidate",
      targetGap: "thin-domain:cymatics",
      rationale: "Gap",
      created,
      ...(enriched ? { enriched } : {}),
    });
    const { summary } = await createSummarizeNode(
      vi.fn(async () => ({ ok: true })),
    )({
      agentRunId: "run-scout",
      targets: {
        thinDomains: [{ domain: "cymatics" }],
        starvedConjectures: [],
      },
      sourceWrites: [write(true), write(false, true), write(false)],
      feedWrites: [],
      judgeErrorCount: 0,
    } as unknown as SourceScoutState);
    expect(summary).toMatch(
      /^source-scout completed: 1 sources ingested, 1 URL-only sources captured, 0 feeds proposed, 1 duplicates skipped,/,
    );
  });

  test("names planner and total judge failures in the summary", async () => {
    const callTool = vi.fn(async () => ({ ok: true }));
    const base = {
      agentRunId: "run-scout",
      targets: {
        thinDomains: [{ domain: "cymatics" }],
        starvedConjectures: [],
      },
      sourceWrites: [],
      feedWrites: [],
    };
    const errored = (index: number): ScoutJudgment => ({
      searchHit: searchHit(index),
      discardReason: { reason: "judge_error", message: "model rejected" },
    });
    const planner = await createSummarizeNode(callTool)({
      ...base,
      judgments: [],
      plannerErrorCount: 1,
      judgeErrorCount: 0,
    } as unknown as SourceScoutState);
    expect(planner.summary).toBe(
      "source-scout completed: query planning failed for 1 research gaps; no searches run (planner error)",
    );
    const judges = await createSummarizeNode(callTool)({
      ...base,
      judgments: [errored(0), errored(1)],
      plannerErrorCount: 0,
      judgeErrorCount: 2,
    } as unknown as SourceScoutState);
    expect(judges.summary).toBe(
      "source-scout completed: zero judgments; 2 judge errors discarded",
    );
    const partial = await createSummarizeNode(callTool)({
      ...base,
      judgments: [
        errored(0),
        { searchHit: searchHit(1), verdict: { kind: "skip" } },
      ],
      plannerErrorCount: 0,
      judgeErrorCount: 1,
    } as unknown as SourceScoutState);
    expect(partial.summary).toMatch(/1 judge errors/);
  });

  test("still captures candidates when the existing-source preflight fails", async () => {
    const callTool = vi.fn(async (name: string) => {
      if (name === "findExistingSourceUrls")
        throw new Error("Convex tool findExistingSourceUrls failed: 404");
      return name === "ingestScoutedSource"
        ? { id: "source-1", created: true }
        : { ok: true };
    });
    const crawl = vi.fn(async () => null);
    await createIngestSourcesNode(
      callTool,
      crawl,
    )({
      agentRunId: "run-scout",
      judgments: [judgment(0, "source")],
    });
    expect(crawl).toHaveBeenCalledWith("https://example.org/0", {
      title: "Candidate 0",
    });
  });

  test("ingests at most five judged sources with provenance and logs dedupe as a decision", async () => {
    let writes = 0;
    const callTool = vi.fn(async (name: string) => {
      if (name === "ingestScoutedSource") {
        writes += 1;
        return { id: `source-${writes}`, created: writes !== 2 };
      }
      return { ok: true };
    });
    const result = await createIngestSourcesNode(callTool)({
      agentRunId: "run-scout",
      judgments: Array.from({ length: MAX_INGESTS_PER_RUN + 2 }, (_, index) =>
        judgment(index, "source"),
      ),
    });

    const ingestCalls = callTool.mock.calls.filter(
      ([name]) => name === "ingestScoutedSource",
    );
    expect(ingestCalls).toHaveLength(MAX_INGESTS_PER_RUN);
    expect(ingestCalls[0]?.[1]).toEqual({
      url: "https://example.org/0",
      title: "Candidate 0",
      publishedAt: Date.parse("2026-06-01"),
      query: "query 0",
      rationale:
        "Candidate 0 addresses measured modal behavior. Gap: thin-domain:cymatics",
      agentRunId: "run-scout",
    });
    expect(result.sourceWrites).toHaveLength(MAX_INGESTS_PER_RUN);
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        kind: "decision",
        message: "Source scout skipped duplicate source",
        payload: expect.objectContaining({ created: false }),
      }),
    );
  });

  test("dedupes source URLs before applying the per-run ingest cap", async () => {
    let writes = 0;
    const callTool = vi.fn(async (name: string) => {
      if (name === "ingestScoutedSource") {
        writes += 1;
        return { id: `source-${writes}`, created: true };
      }
      return { ok: true };
    });
    const duplicate = judgment(99, "source");
    duplicate.searchHit.result.url = searchHit(0).result.url;

    await createIngestSourcesNode(callTool)({
      agentRunId: "run-scout",
      judgments: [
        judgment(0, "source"),
        duplicate,
        ...Array.from({ length: MAX_INGESTS_PER_RUN - 1 }, (_, index) =>
          judgment(index + 1, "source"),
        ),
      ],
    });

    const ingestUrls = callTool.mock.calls
      .filter(([name]) => name === "ingestScoutedSource")
      .map(([, args]) => (args as { url: string }).url);
    expect(ingestUrls).toEqual(
      Array.from(
        { length: MAX_INGESTS_PER_RUN },
        (_, index) => `https://example.org/${index}`,
      ),
    );
  });

  test("proposes judged feeds without an enabled field and records exact provenance inputs", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "proposeFeed" ? { id: "feed-1", created: true } : { ok: true },
    );
    const feedJudgment = judgment(8, "feed");
    feedJudgment.searchHit.result.url =
      "https://www.youtube.com/feeds/videos.xml?channel_id=channel";
    const result = await createProposeFeedsNode(callTool)({
      agentRunId: "run-scout",
      judgments: [feedJudgment, judgment(9, "discard")],
    });

    const proposalArgs = callTool.mock.calls.find(
      ([name]) => name === "proposeFeed",
    )?.[1] as Record<string, unknown>;
    expect(proposalArgs).toEqual({
      name: "Candidate 8",
      url: "https://www.youtube.com/feeds/videos.xml?channel_id=channel",
      type: "youtube",
      rationale:
        "Candidate 8 addresses measured modal behavior. Gap: thin-domain:cymatics",
      sampleItems: [feedJudgment.searchHit.result],
      agentRunId: "run-scout",
    });
    expect(proposalArgs).not.toHaveProperty("enabled");
    expect(result.feedWrites).toEqual([
      expect.objectContaining({ id: "feed-1", created: true }),
    ]);
  });

  test("proposes no more than five unique feeds per run", async () => {
    let writes = 0;
    const callTool = vi.fn(async (name: string) => {
      if (name === "proposeFeed") {
        writes += 1;
        return { id: `feed-${writes}`, created: true };
      }
      return { ok: true };
    });
    const duplicate = judgment(99, "feed");
    duplicate.searchHit.result.url = searchHit(0).result.url;

    await createProposeFeedsNode(callTool)({
      agentRunId: "run-scout",
      judgments: [
        judgment(0, "feed"),
        duplicate,
        ...Array.from({ length: MAX_FEED_PROPOSALS_PER_RUN }, (_, index) =>
          judgment(index + 1, "feed"),
        ),
      ],
    });

    const proposalUrls = callTool.mock.calls
      .filter(([name]) => name === "proposeFeed")
      .map(([, args]) => (args as { url: string }).url);
    expect(proposalUrls).toEqual(
      Array.from(
        { length: MAX_FEED_PROPOSALS_PER_RUN },
        (_, index) => `https://example.org/${index}`,
      ),
    );
  });
});

describe("source-scout recapture mode", () => {
  test("routes recapture runs past discovery", () => {
    expect(routeAtStart({ mode: "recapture" })).toBe("recapture_sources");
    expect(routeAtStart({ mode: undefined })).toBe("fetch_targets");
  });

  test("recaptures URL-only Sources through ingestScoutedSource", async () => {
    const text = "# Measured modes\n" + "A reproducible experiment. ".repeat(5);
    const callTool = vi.fn(async (name: string, args?: unknown) => {
      if (name === "listScoutCaptureBacklog")
        return [
          {
            id: "source-a",
            url: "https://example.org/a",
            title: "Plate modes",
            query: "measured resonance",
            rationale: "Thin domain",
          },
          {
            id: "source-b",
            url: "https://example.org/b",
            query: "q",
            rationale: "r",
          },
          { id: "malformed" },
        ];
      if (name === "ingestScoutedSource")
        return { id: "source-a", created: false, enriched: true, args };
      return { ok: true };
    });
    const crawl = vi.fn(async (url: string) =>
      url.endsWith("/a") ? { text, provider: "firecrawl" as const } : null,
    );

    const update = await createRecaptureSourcesNode(
      callTool,
      crawl,
    )({ agentRunId: "run-recapture" });

    expect(callTool).toHaveBeenCalledWith("listScoutCaptureBacklog", {
      limit: 50,
    });
    expect(crawl.mock.calls).toEqual([
      ["https://example.org/a", { title: "Plate modes" }],
      ["https://example.org/b", undefined],
    ]);
    const ingests = callTool.mock.calls.filter(
      ([name]) => name === "ingestScoutedSource",
    );
    expect(ingests).toEqual([
      [
        "ingestScoutedSource",
        {
          url: "https://example.org/a",
          title: "Plate modes",
          rawText: text,
          contentProvider: "firecrawl",
          query: "measured resonance",
          rationale: "Thin domain",
          agentRunId: "run-recapture",
        },
      ],
    ]);
    expect(update.recaptureAttempted).toBe(2);
    expect(update.sourceWrites).toEqual([
      expect.objectContaining({ id: "source-a", enriched: true }),
    ]);
  });

  test("summarizes a recapture run", async () => {
    const callTool = vi.fn(async () => ({ ok: true }));
    const update = await createSummarizeNode(callTool)({
      mode: "recapture",
      recaptureAttempted: 2,
      sourceWrites: [
        {
          id: "source-a",
          url: "https://example.org/a",
          title: "Plate modes",
          targetGap: "recapture",
          rationale: "Thin domain",
          created: false,
          enriched: true,
        },
      ],
      feedWrites: [],
      judgments: [],
      plannedQueries: [],
      searchHits: [],
      auditEvents: [],
      plannerErrorCount: 0,
      judgeErrorCount: 0,
      agentRunId: "run-recapture",
    } as unknown as SourceScoutState);
    expect(update.summary).toBe(
      "source-scout recapture completed: 1 of 2 URL-only sources captured: Plate modes",
    );
  });
});

test("a refused recapture write does not stop the run", async () => {
  const text = "# Measured modes\n" + "A reproducible experiment. ".repeat(5);
  let ingests = 0;
  const callTool = vi.fn(async (name: string) => {
    if (name === "listScoutCaptureBacklog")
      return [
        { id: "a", url: "https://example.org/a", query: "q", rationale: "r" },
        { id: "b", url: "https://example.org/b", query: "q", rationale: "r" },
      ];
    if (name === "ingestScoutedSource") {
      ingests += 1;
      if (ingests === 1)
        throw new Error("Convex tool ingestScoutedSource failed: 500");
      return { id: "b", created: false, enriched: true };
    }
    return { ok: true };
  });
  const update = await createRecaptureSourcesNode(callTool, async () => ({
    text,
    provider: "crawl4ai" as const,
  }))({ agentRunId: "run-recapture" });
  expect(update.sourceWrites).toEqual([
    expect.objectContaining({ id: "b", enriched: true }),
  ]);
  expect(callTool).toHaveBeenCalledWith(
    "appendAgentRunEvent",
    expect.objectContaining({ kind: "error" }),
  );
});
