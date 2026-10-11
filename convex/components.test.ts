import aggregate from "@convex-dev/aggregate/test";
import workflow from "@convex-dev/workflow/test";
import { convexTest } from "convex-test";
import {
  anyApi,
  type ApiFromModules,
  makeFunctionReference,
} from "convex/server";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internalAction } from "./_generated/server";
import { conceptsAggregate } from "./aggregates";
import { workflowManager } from "./components";
import schema from "./schema";

afterEach(() => vi.useRealTimers());

test("the installed aggregate preserves synchronous counts and sums", async () => {
  const t = convexTest(schema, modules);
  aggregate.register(t);

  const id = await t.run(async (ctx) => {
    const id = await ctx.db.insert("concepts", {
      name: "interval ratios",
      displayName: "Interval ratios",
      aliases: [],
      domain: "music",
      mentionCount: 2,
      hypothesisCount: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    const doc = await ctx.db.get(id);
    await conceptsAggregate.insert(ctx, doc!);
    expect(await conceptsAggregate.count(ctx)).toBe(1);
    expect(await conceptsAggregate.sum(ctx)).toBe(2);
    return id;
  });

  await t.run(async (ctx) => {
    const previous = await ctx.db.get(id);
    await ctx.db.patch(id, { mentionCount: 5 });
    const updated = await ctx.db.get(id);
    await conceptsAggregate.replace(ctx, previous!, updated!);
    expect(await conceptsAggregate.count(ctx)).toBe(1);
    expect(await conceptsAggregate.sum(ctx)).toBe(5);

    await conceptsAggregate.delete(ctx, updated!);
    await ctx.db.delete(id);
    expect(await conceptsAggregate.count(ctx)).toBe(0);
    expect(await conceptsAggregate.sum(ctx)).toBe(0);
  });
});

test("the installed workflow retries an opted-in action at most three times", async () => {
  vi.useFakeTimers();
  const actionRef = makeFunctionReference<"action", {}, null>(
    "dependencySmoke:fail",
  );
  let attempts = 0;
  const fail = internalAction({
    args: {},
    handler: async () => {
      attempts += 1;
      throw new Error("Dependency compatibility test failure");
    },
  });
  const run = workflowManager.define({
    args: {},
    handler: async (step) => {
      await step.runAction(actionRef, {}, { retry: true });
    },
  });
  // The virtual test module is intentionally absent from generated app types.
  const testApi = anyApi as unknown as ApiFromModules<{
    dependencySmoke: { fail: typeof fail; run: typeof run };
  }>;
  const t = convexTest(schema, {
    ...modules,
    "./dependencySmoke.ts": async () => ({ fail, run }),
  });
  workflow.register(t);

  const workflowId = await t.run((ctx) =>
    workflowManager.start(ctx, testApi.dependencySmoke.run, {}),
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(attempts).toBe(3);
  expect(
    await t.run((ctx) => workflowManager.status(ctx, workflowId)),
  ).toMatchObject({ type: "failed" });
});
