import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import { DEFAULT_STALE_RUN_MS } from "../convex/agentRuns";
import schema from "../convex/schema";
import { modules } from "./modules";

function seedRun(
  t: ReturnType<typeof convexTest>,
  status: "queued" | "running",
  updatedAt: number,
  graphName = "research-pipeline",
) {
  return t.run((ctx) =>
    ctx.db.insert("agentRuns", {
      graphName,
      status,
      input: null,
      createdAt: updatedAt,
      updatedAt,
    }),
  );
}

describe("agentRuns.claimNextPending", () => {
  test("claims the oldest queued run and stamps workerId + running", async () => {
    const t = convexTest(schema, modules);
    const olderId = await seedRun(t, "queued", 1000);
    await seedRun(t, "queued", 2000);

    const claimed = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-a",
    });

    expect(claimed?.runId).toBe(olderId);
    expect(claimed?.status).toBe("running");
    expect(claimed?.workerId).toBe("worker-a");

    const row = await t.run((ctx) => ctx.db.get(olderId));
    expect(row?.status).toBe("running");
    expect(row?.workerId).toBe("worker-a");
    expect(row?.startedAt).toBeDefined();
  });

  test("returns null when nothing is queued", async () => {
    const t = convexTest(schema, modules);
    await seedRun(t, "running", 1000);

    const claimed = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-a",
    });
    expect(claimed).toBeNull();
  });

  test("returns stored trace provenance to the worker claim", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("agentRuns", {
        graphName: "correspondence-miner",
        status: "queued",
        input: { limit: 20 },
        traceUrl: "https://trace.example/miner",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    const claimed = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-a",
    });

    expect(claimed?.traceUrl).toBe("https://trace.example/miner");
  });

  test("a second claim does not double-claim the same run", async () => {
    const t = convexTest(schema, modules);
    await seedRun(t, "queued", 1000);

    const first = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-a",
    });
    const second = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "worker-b",
    });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});

describe("agentRuns.sweepStaleRuns", () => {
  test("fails a running run whose updatedAt is past the threshold, leaves fresh ones", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const staleId = await seedRun(
      t,
      "running",
      now - DEFAULT_STALE_RUN_MS - 60_000,
    );
    const freshId = await seedRun(t, "running", now);

    const result = await t.mutation(internal.agentRuns.sweepStaleRuns, {});

    expect(result.swept).toBe(1);
    const stale = await t.run((ctx) => ctx.db.get(staleId));
    const fresh = await t.run((ctx) => ctx.db.get(freshId));
    expect(stale?.status).toBe("failed");
    expect(fresh?.status).toBe("running");
  });
});

describe("agentRuns.reconcileReviewedRuns", () => {
  test("completes orphaned review runs and leaves runs with pending drafts", async () => {
    const t = convexTest(schema, modules);
    const { orphanId, pendingId } = await t.run(async (ctx) => {
      const seededOrphanId = await ctx.db.insert("agentRuns", {
        graphName: "research-pipeline",
        status: "needs_review",
        input: null,
        createdAt: 2000,
        updatedAt: 2000,
      });
      const seededPendingId = await ctx.db.insert("agentRuns", {
        graphName: "research-pipeline",
        status: "needs_review",
        input: null,
        createdAt: 1000,
        updatedAt: 1000,
      });
      await ctx.db.insert("agentReviewDrafts", {
        agentRunId: seededPendingId,
        graphName: "research-pipeline",
        kind: "hypothesis_draft",
        title: "Pending draft",
        summary: "Still awaiting review",
        candidateIds: [],
        status: "pending_review",
        createdBy: "agent",
        createdAt: 1000,
        updatedAt: 1000,
      });
      return { orphanId: seededOrphanId, pendingId: seededPendingId };
    });

    const firstPage = await t.mutation(
      internal.agentRuns.reconcileReviewedRuns,
      { limit: 1 },
    );
    expect(firstPage).toMatchObject({
      scanned: 1,
      reconciled: 0,
      stillPending: 1,
      isDone: false,
    });
    expect(firstPage.cursor).not.toBeNull();

    const secondPage = await t.mutation(
      internal.agentRuns.reconcileReviewedRuns,
      { limit: 1, cursor: firstPage.cursor ?? undefined },
    );
    expect(secondPage).toEqual({
      scanned: 1,
      reconciled: 1,
      stillPending: 0,
      cursor: null,
      isDone: true,
    });
    const state = await t.run(async (ctx) => ({
      orphan: await ctx.db.get(orphanId),
      pending: await ctx.db.get(pendingId),
      events: await ctx.db
        .query("agentRunEvents")
        .withIndex("by_runId_createdAt", (q) => q.eq("runId", orphanId))
        .collect(),
    }));
    expect(state.orphan?.status).toBe("completed");
    expect(state.orphan?.finishedAt).toBeDefined();
    expect(state.pending?.status).toBe("needs_review");
    expect(state.events.at(-1)?.message).toBe(
      "Agent run completed after human review",
    );
  });
});
