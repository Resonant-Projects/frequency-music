import type { FunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import type { ActionCtx } from "./_generated/server";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import { agentToolByName } from "./agentToolRegistry";
import schema from "./schema";

afterEach(() => vi.unstubAllEnvs());

test("direct API never exposes its audit row to a polling worker between mutations", async () => {
  vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "false");
  const t = convexTest(schema, modules);
  const claims: unknown[] = [];
  const ctx = {
    runMutation: async (ref, args) => {
      const result = await t.mutation(
        ref as FunctionReference<"mutation">,
        args,
      );
      // Adversarial scheduling: poll immediately after every committed mutation
      // in the direct API. The former create + markRunning path lost this race.
      claims.push(
        await t.mutation(internal.agentRuns.claimNextPending, {
          workerId: "synthetic-poller",
        }),
      );
      return result;
    },
  } satisfies Pick<ActionCtx, "runMutation">;
  const result = (await agentToolByName.createAgentRun.run(ctx as ActionCtx, {
    graphName: "research-pipeline",
    input: { smokeMode: true },
  })) as {
    runId: string;
    status: string;
    createdAt: number;
    startedAt: number;
    updatedAt: number;
  };
  expect(claims).toEqual([null]);
  expect(result.status).toBe("running");
  expect(result.createdAt).toBeTypeOf("number");
  expect(result.startedAt).toBeTypeOf("number");
  expect(result.updatedAt).toBeTypeOf("number");
  const rows = await t.run(async (dbctx) => ({
    runs: await dbctx.db.query("agentRuns").collect(),
    events: await dbctx.db.query("agentRunEvents").collect(),
  }));
  expect(rows.runs).toHaveLength(1);
  expect(rows.runs[0]?._id).toBe(result.runId);
  expect(rows.runs[0]?.workerId).toBeUndefined();
  expect(rows.events.map((event) => event.message)).toEqual([
    "Agent run queued",
    "Agent run started",
  ]);
  const queued = await t.mutation(internal.agentRuns.enqueue, {
    graphName: "research-pipeline",
    input: { smokeMode: true },
  });
  expect(
    await t.mutation(internal.agentRuns.claimNextPending, {
      workerId: "synthetic-poller",
    }),
  ).toMatchObject({ runId: queued.runId });
});
