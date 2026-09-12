import type { FunctionReturnType } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import { buildAgentRunStatusCounts, opsStatusCountsPage } from "./agentRuns";
import schema from "./schema";
import { AGENT_RUN_STATUSES } from "./shared/agentContract";

afterEach(() => vi.unstubAllEnvs());

async function seed(
  t: ReturnType<typeof convexTest>,
  count: number,
  bytes = 0,
) {
  return t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("agentRuns", {
        graphName: "synthetic-private-graph",
        status: AGENT_RUN_STATUSES[i % AGENT_RUN_STATUSES.length],
        input: { privatePayload: "x".repeat(bytes) },
        workerId: "private-worker",
        createdAt: i,
        updatedAt: count - i,
      });
    }
  });
}

describe("internal migration queue counts", () => {
  test("counts every row beyond the recent-100 window without exposing jobs", async () => {
    const t = convexTest(schema, modules);
    await seed(t, 321);
    const before = await t.run((ctx) => ctx.db.query("agentRuns").collect());
    const counts = buildAgentRunStatusCounts([]);
    let cursor: string | null = null;
    let pages = 0;
    let rows = 0;
    for (;;) {
      const page: FunctionReturnType<
        typeof internal.agentRuns.opsStatusCountsPage
      > = await t.query(internal.agentRuns.opsStatusCountsPage, {
        cursor,
        pageSize: 37,
      });
      expect(Object.keys(page).toSorted()).toEqual([
        "claimsPaused",
        "counts",
        "cursor",
        "isDone",
        "pageStatus",
        "rowsRead",
        "scannedAt",
      ]);
      expect(page.rowsRead).toBeLessThanOrEqual(37);
      expect(page.pageStatus).not.toBe("SplitRequired");
      expect(JSON.stringify(page)).not.toMatch(
        /privatePayload|private-worker|synthetic-private-graph/,
      );
      for (const status of AGENT_RUN_STATUSES)
        counts[status] += page.counts[status];
      rows += page.rowsRead;
      pages++;
      if (page.isDone) break;
      expect(page.cursor).not.toBe(cursor);
      cursor = page.cursor;
      expect(pages).toBeLessThan(20);
    }
    expect(rows).toBe(321);
    expect(pages).toBe(9);
    expect(counts).toEqual(buildAgentRunStatusCounts(before));
    expect(await t.run((ctx) => ctx.db.query("agentRuns").collect())).toEqual(
      before,
    );
  });

  test("empty queue returns all zero counts and completion", async () => {
    const t = convexTest(schema, modules);
    expect(
      await t.query(internal.agentRuns.opsStatusCountsPage, { cursor: null }),
    ).toMatchObject({
      counts: buildAgentRunStatusCounts([]),
      rowsRead: 0,
      isDone: true,
    });
  });

  test.each([
    0,
    -1,
    201,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("rejects invalid page size %s", async (pageSize) => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(internal.agentRuns.opsStatusCountsPage, {
        cursor: null,
        pageSize,
      }),
    ).rejects.toThrow();
  });

  test.each([
    "",
    "x".repeat(16385),
    "not-a-valid-cursor",
  ])("rejects invalid cursor (case %#)", async (cursor) => {
    const t = convexTest(schema, modules);
    await seed(t, 2);
    await expect(
      t.query(internal.agentRuns.opsStatusCountsPage, { cursor }),
    ).rejects.toThrow();
  });

  test("reports byte-limited incomplete pages so aggregation can fail closed", async () => {
    const t = convexTest(schema, modules);
    await seed(t, 12, 600_000);
    const page = await t.query(internal.agentRuns.opsStatusCountsPage, {
      cursor: null,
    });
    expect(page.pageStatus).toBe("SplitRequired");
    expect(page.isDone).toBe(false);
    expect(page.rowsRead).toBeLessThan(12);
    expect(JSON.stringify(page).length).toBeLessThan(2000);
  });

  test.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["true", true],
    ["false ", true],
  ] as const)("reports effective claim pause for %j", async (value, paused) => {
    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", value);
    const t = convexTest(schema, modules);
    expect(
      (await t.query(internal.agentRuns.opsStatusCountsPage, { cursor: null }))
        .claimsPaused,
    ).toBe(paused);
  });

  test("is registered internal-only, with no public function grant", () => {
    expect(opsStatusCountsPage.isInternal).toBe(true);
    expect("isPublic" in opsStatusCountsPage).toBe(false);
  });
});
