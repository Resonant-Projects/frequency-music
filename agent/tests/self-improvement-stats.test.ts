import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { convexTools } from "../src/tools/convexTools";

const getSelfImprovementStats = convexTools.find(
  (candidate) => candidate.name === "get_self_improvement_stats",
);
if (!getSelfImprovementStats) {
  throw new Error("get_self_improvement_stats is missing from convexTools");
}

const originalFetch = globalThis.fetch;
const originalUrl = process.env.CONVEX_SITE_URL;
const originalSecret = process.env.AGENT_TOOL_SECRET;

function mockFetchOnce(responseBody: unknown) {
  let capturedUrl: string | undefined;
  let capturedBody: Record<string, unknown> | undefined;
  globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
    capturedUrl = String(url);
    // oxlint-disable-next-line typescript/no-base-to-string -- Preserve the mock's legacy RequestInit body coercion.
    capturedBody = JSON.parse(String(init?.body ?? "{}"));
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return {
    getCapturedUrl: () => capturedUrl,
    getCapturedBody: () => capturedBody,
  };
}

const emptyStatsResponse = {
  windowStart: 1_000,
  windowEnd: 2_000,
  editCaptures: { count: 0 },
  drafts: { approved: 0, rejected: 0, rejectionNotes: [] },
  memoryRecalls: { count: 0, notes: [] },
};

const populatedStatsResponse = {
  windowStart: 1_000,
  windowEnd: 2_000,
  editCaptures: { count: 4 },
  drafts: {
    approved: 3,
    rejected: 2,
    rejectionNotes: ["Not grounded in an extraction", "Duplicate hypothesis"],
  },
  memoryRecalls: {
    count: 1,
    notes: ["skipped Schumann×D-root: contradicted in run abc"],
  },
};

describe("get_self_improvement_stats tool", () => {
  beforeEach(() => {
    process.env.CONVEX_SITE_URL = "https://example.convex.site";
    process.env.AGENT_TOOL_SECRET = "test-secret";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) {
      Reflect.deleteProperty(process.env, "CONVEX_SITE_URL");
    }
    else process.env.CONVEX_SITE_URL = originalUrl;
    if (originalSecret === undefined)
      Reflect.deleteProperty(process.env, "AGENT_TOOL_SECRET");
    else process.env.AGENT_TOOL_SECRET = originalSecret;
  });

  test("is registered on the weekly-brief agent's tool list", () => {
    expect(
      convexTools.some((t) => t.name === "get_self_improvement_stats"),
    ).toBe(true);
  });

  test("posts to the agent-tools HTTP path with the secret and daysBack", async () => {
    const { getCapturedUrl, getCapturedBody } =
      mockFetchOnce(emptyStatsResponse);

    await getSelfImprovementStats.invoke({ daysBack: 7 });

    expect(getCapturedUrl()).toBe(
      "https://example.convex.site/agent-tools/getSelfImprovementStats",
    );
    expect(getCapturedBody()?.secret).toBe("test-secret");
    expect(getCapturedBody()?.daysBack).toBe(7);
  });

  test("returns the raw empty-window response unchanged (graceful degradation)", async () => {
    mockFetchOnce(emptyStatsResponse);

    const result = await getSelfImprovementStats.invoke({});

    expect(result).toEqual(emptyStatsResponse);
  });

  test("returns the raw populated-window response unchanged", async () => {
    mockFetchOnce(populatedStatsResponse);

    const result = await getSelfImprovementStats.invoke({ daysBack: 14 });

    expect(result).toEqual(populatedStatsResponse);
  });

  test("daysBack is optional and omitted from the body when absent", async () => {
    const { getCapturedBody } = mockFetchOnce(emptyStatsResponse);

    await getSelfImprovementStats.invoke({});

    // callConvex spreads {daysBack: undefined} into the JSON body; JSON.stringify
    // drops undefined-valued keys, so the field should not appear at all.
    expect(getCapturedBody()?.daysBack).toBeUndefined();
  });
});
