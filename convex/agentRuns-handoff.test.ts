import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

afterEach(() => vi.unstubAllEnvs());

async function seedQueue(t: ReturnType<typeof convexTest>) {
  return t.mutation(internal.agentRuns.enqueue, {
    graphName: "research-pipeline",
    input: { smokeMode: true },
  });
}

async function snapshot(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    runs: await ctx.db.query("agentRuns").collect(),
    events: await ctx.db.query("agentRunEvents").collect(),
  }));
}

describe("worker handoff claim admission", () => {
  test("a quiescent handoff executes each synthetic external effect once", async () => {
    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "false");
    const t = convexTest(schema, modules);
    const active = await seedQueue(t);
    const claimed = await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "synthetic-old-worker",
    });
    expect(claimed?.runId).toBe(active.runId);
    const queued = await seedQueue(t);
    const effects: string[] = [];

    const consumeOnce = async (workerId: string) => {
      const run = await t.mutation(internal.agentRuns.claimNextPending, {
        workerId,
      });
      if (!run) return;
      effects.push(run.runId);
      await t.mutation(internal.agentRuns.markCompleted, { runId: run.runId });
    };

    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "true");
    await consumeOnce("synthetic-new-worker");
    expect(effects).toEqual([]);
    // The old owner finishes its already-claimed effect while admission is
    // paused. Real handoff must also verify process exit before resuming.
    effects.push(active.runId);
    await t.mutation(internal.agentRuns.markCompleted, { runId: active.runId });
    await consumeOnce("synthetic-old-worker");
    await consumeOnce("synthetic-new-worker");
    expect(effects).toEqual([active.runId]);

    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "false");
    await consumeOnce("synthetic-new-worker");
    await consumeOnce("synthetic-new-worker");
    expect(effects).toEqual([active.runId, queued.runId]);
    expect(
      (await snapshot(t)).runs.every((run) => run.status === "completed"),
    ).toBe(true);
  });

  test.each([
    "true",
    "1",
    "TRUE",
    "false ",
    "0",
    " ",
    "typo",
  ])("pause value %j preserves queued records and events", async (value) => {
    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", value);
    const t = convexTest(schema, modules);
    await seedQueue(t);
    const before = await snapshot(t);

    expect(
      await t.mutation(internal.agentRuns.claimNextPending, {
        workerId: "synthetic-old-worker",
      }),
    ).toBeNull();
    expect(await snapshot(t)).toEqual(before);
  });

  test.each([
    undefined,
    "",
    "false",
  ])("value %j admits claims without changing the legacy request contract", async (value) => {
    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", value);
    const t = convexTest(schema, modules);
    const queued = await seedQueue(t);
    expect(
      await t.mutation(internal.agentRuns.claimNextPending, {
        workerId: "synthetic-worker",
      }),
    ).toMatchObject({ runId: queued.runId, status: "running" });
  });

  test("graph-filtered claims cannot bypass the pause", async () => {
    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "true");
    const t = convexTest(schema, modules);
    await seedQueue(t);
    const before = await snapshot(t);
    expect(
      await t.mutation(internal.agentRuns.claimNextPending, {
        workerId: "synthetic-filtered-worker",
        graphName: "research-pipeline",
      }),
    ).toBeNull();
    expect(await snapshot(t)).toEqual(before);
  });

  test("a legacy HTTP consumer is paused without a worker upgrade", async () => {
    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "true");
    vi.stubEnv("AGENT_TOOL_SECRET", "synthetic-handoff-secret");
    const t = convexTest(schema, modules);
    await seedQueue(t);
    const before = await snapshot(t);
    const response = await t.fetch("/agent-tools/claimNextPendingRun", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: "synthetic-handoff-secret",
        workerId: "legacy-ct107-shaped-consumer",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(await snapshot(t)).toEqual(before);
  });

  test("pause leaves active work owned, then resume claims queued work once", async () => {
    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "false");
    const t = convexTest(schema, modules);
    const active = await seedQueue(t);
    await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "synthetic-old-worker",
    });
    const queued = await seedQueue(t);
    const before = await snapshot(t);

    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "true");
    for (const workerId of ["synthetic-old-worker", "synthetic-new-worker"]) {
      expect(
        await t.mutation(internal.agentRuns.claimNextPending, { workerId }),
      ).toBeNull();
    }
    expect(await snapshot(t)).toEqual(before);
    expect(await t.run((ctx) => ctx.db.get(active.runId))).toMatchObject({
      status: "running",
      workerId: "synthetic-old-worker",
    });

    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "false");
    expect(
      await t.mutation(internal.agentRuns.claimNextPending, {
        workerId: "synthetic-new-worker",
      }),
    ).toMatchObject({ runId: queued.runId, workerId: "synthetic-new-worker" });
    expect(
      await t.mutation(internal.agentRuns.claimNextPending, {
        workerId: "synthetic-other-worker",
      }),
    ).toBeNull();
    const after = await snapshot(t);
    expect(
      after.events.filter((event) => event.message.startsWith("Claimed")),
    ).toHaveLength(2);
  });
});
