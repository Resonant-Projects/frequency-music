import { describe, expect, test, vi } from "vite-plus/test";
import {
  createIngestSourcesNode,
  createJudgeResultsNode,
  createProposeFeedsNode,
  createSearchLoopNode,
  queryPlanOutputSchema,
  routeAfterQueries,
  routeAfterTargets,
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
