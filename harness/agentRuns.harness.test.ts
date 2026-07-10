import { describe, expect, test } from "bun:test";
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
