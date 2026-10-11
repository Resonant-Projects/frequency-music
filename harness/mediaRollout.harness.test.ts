import { convexTest } from "convex-test";
import { expect, test } from "vite-plus/test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

test("only consecutive pre-render failures permit a fresh media start", async () => {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("mediaJobs", {
      kind: "probe",
      input: { kind: "probe", rendererVersion: "new", toneHz: 440, seconds: 1 },
      dedupeKey: "rollout",
      status: "queued",
      priority: 0,
      attempts: 0,
      createdAt: 1,
    }),
  );
  const claim = () =>
    t.mutation(internal.mediaJobs.claimNext, {
      workerId: "worker",
      kinds: ["probe"],
    });
  const fail = async (error: string) => {
    const job = (await claim())!;
    await t.mutation(internal.mediaJobs.fail, {
      jobId: job.jobId as never,
      leaseToken: job.leaseToken,
      error,
    });
    return job;
  };
  const mismatch =
    "renderer version mismatch: job requested new, worker is old";
  expect((await fail(mismatch)).freshStartAllowed).toBe(true);
  expect(
    (await fail("connection lost after synthesis")).freshStartAllowed,
  ).toBe(true);
  expect((await claim())?.freshStartAllowed).toBe(false);
});
