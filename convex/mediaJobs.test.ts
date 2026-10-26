import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOnce } from "../media/src/runner";
import type { callTool } from "../media/src/convex";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { LEASE_MS } from "./shared/mediaJobs";
import {
  probe,
  pendingArtifact,
  measured,
  probePair,
} from "../harness/mediaJobFixtures";

describe("mediaJobs lifecycle", () => {
  test.each([false, true])(
    "lost completion response is acknowledged without repeating rendering, cached=%s",
    async (cached) => {
      const t = convexTest(schema, modules);
      const root = await mkdtemp(join(tmpdir(), "media-completion-"));
      try {
        const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
          input: probe,
        });
        const { result, masterId, deliveryId } = await probePair(t, jobId);
        let denyCompletion = cached;
        let loseResponse = true;
        const completionBodies: unknown[] = [];
        const tool = vi.fn(
          async (name: string, args: Record<string, unknown>) => {
            if (name === "claimNextMediaJob")
              return t.mutation(internal.mediaJobs.claimNext, args as never);
            if (name === "completeMediaJob") {
              completionBodies.push(args);
              if (denyCompletion)
                throw new Error("Completion unavailable before commit");
              const completed = await t.mutation(
                internal.mediaJobs.complete,
                args as never,
              );
              if (loseResponse) {
                loseResponse = false;
                expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe(
                  "done",
                );
                throw new Error("Response lost after committed completion");
              }
              return completed;
            }
            if (name === "failMediaJob")
              return t.mutation(internal.mediaJobs.fail, args as never);
            throw new Error(`Unexpected tool ${name}`);
          },
        );
        const handler = vi.fn(async () => result);
        const config = {
          workerId: "test",
          kinds: ["probe"],
          rendererVersion: probe.rendererVersion,
          workDir: root,
        };
        if (cached) {
          expect(
            await runOnce(config, tool as typeof callTool, { probe: handler }),
          ).toBe("failed");
          expect(await readdir(join(root, "retained"))).toHaveLength(1);
          denyCompletion = false;
        }
        expect(
          await runOnce(config, tool as typeof callTool, { probe: handler }),
        ).toBe("done");
        expect(handler).toHaveBeenCalledTimes(1);
        expect(completionBodies.slice(-2)[0]).toEqual(
          completionBodies.slice(-2)[1],
        );
        expect(
          tool.mock.calls.filter(([name]) => name === "failMediaJob"),
        ).toHaveLength(cached ? 1 : 0);
        expect(await readdir(join(root, "retained"))).toEqual([]);
        expect(
          (await t.run((ctx) => ctx.db.get(jobId)))?.resultArtifactIds,
        ).toEqual([masterId, deliveryId]);
        expect((await t.run((ctx) => ctx.db.get(deliveryId)))?.status).toBe(
          "ready",
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  test("one stale-lease sweep drains a crash backlog through separate bounded transactions", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest({ schema, modules, transactionLimits: true });
      const jobs: Id<"mediaJobs">[] = [];
      for (let i = 0; i < 3; i++) {
        const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
          input: { ...probe, toneHz: 440 + i },
        });
        jobs.push(jobId);
        await t.mutation(internal.mediaJobs.claimNext, {
          workerId: `worker-${i}`,
          kinds: ["probe"],
        });
        await t.run((ctx) => ctx.db.patch(jobId, { leaseExpiresAt: 0 }));
      }
      expect(await t.mutation(internal.mediaJobs.sweepStale, {})).toEqual({
        requeued: 1,
        parked: 0,
      });
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
      for (const id of jobs)
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
          status: "queued",
          attempts: 1,
        });
    } finally {
      vi.useRealTimers();
    }
  });

  test("enqueue dedupes identical snapshots into one row", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const second = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.jobId).toBe(first.jobId);
    const rows = await t.run((ctx) => ctx.db.query("mediaJobs").collect());
    expect(rows).toHaveLength(1);
  });

  test("claim issues a lease; a second claim for the same kinds gets null", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["probe"],
    });
    expect(claim?.kind).toBe("probe");
    expect(claim?.leaseToken).toMatch(/[0-9a-f-]{36}/);
    expect(claim!.leaseExpiresAt - Date.now()).toBeGreaterThan(
      LEASE_MS - 5_000,
    );
    expect(
      await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w2",
        kinds: ["probe"],
      }),
    ).toBeNull();
  });

  test("complete is fenced by lease token and applies probe effects", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["probe"],
    });
    const { masterId, deliveryId, result } = await probePair(t, jobId);
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken: "wrong",
        result,
      }),
    ).rejects.toThrow(/lease/);
    const done = await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result,
    });
    expect(done.status).toBe("done");
    expect(done.resultArtifactIds).toEqual([masterId, deliveryId]);
    const master = await t.run((ctx) => ctx.db.get(masterId));
    expect(master?.status).toBe("ready");
    const delivery = await t.run((ctx) => ctx.db.get(deliveryId));
    expect(delivery?.status).toBe("ready");
    // Repeat completion with the same lease returns the stored result.
    const again = await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result,
    });
    expect(again.resultArtifactIds).toEqual([masterId, deliveryId]);
  });

  test("complete refuses a probe result without a master and its delivery", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["probe"],
    });
    const leaseToken = claim!.leaseToken;
    const masterId = await pendingArtifact(t, jobId, "masterNormalized");
    // Two masters: the roles are wrong even though the count is right.
    const secondMasterId = await pendingArtifact(t, jobId, "masterNormalized");
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "probe",
          artifacts: [
            { ...measured, artifactId: masterId, mimeType: "audio/wav" },
            { ...measured, artifactId: secondMasterId, mimeType: "audio/wav" },
          ],
        },
      }),
    ).rejects.toThrow(/one masterNormalized and one delivery/);
    // A delivery that does not point at the submitted master.
    const strayDeliveryId = await pendingArtifact(t, jobId, "delivery");
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "probe",
          artifacts: [
            { ...measured, artifactId: masterId, mimeType: "audio/wav" },
            {
              ...measured,
              artifactId: strayDeliveryId,
              mimeType: "audio/mpeg",
            },
          ],
        },
      }),
    ).rejects.toThrow(/reference its master/);
    for (const id of [masterId, secondMasterId, strayDeliveryId]) {
      const row = await t.run((ctx) => ctx.db.get(id));
      expect(row?.status).toBe("pending");
    }
    const job = await t.run((ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("claimed");
  });

  test("a stale worker cannot complete after its lease expired and the job was re-claimed", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const stale = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["probe"],
    });
    await t.run((ctx) =>
      ctx.db.patch(jobId, { leaseExpiresAt: Date.now() - 1 }),
    );
    const swept = await t.mutation(internal.mediaJobs.sweepStale, {});
    expect(swept.requeued).toBe(1);
    const fresh = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w2",
      kinds: ["probe"],
    });
    expect(fresh?.attempts).toBe(1);
    const { result } = await probePair(t, jobId);
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken: stale!.leaseToken,
        result,
      }),
    ).rejects.toThrow(/lease/);
    const row = await t.run((ctx) => ctx.db.get(jobId));
    expect(row?.status).toBe("claimed");
    expect(row?.workerId).toBe("w2");
  });

  test("fail re-queues until MAX_ATTEMPTS then parks", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w1",
        kinds: ["probe"],
      });
      const outcome = await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error: `boom ${attempt}`,
      });
      expect(outcome.attempts).toBe(attempt);
      expect(outcome.status).toBe(attempt < 3 ? "queued" : "parked");
    }
    expect(
      await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w1",
        kinds: ["probe"],
      }),
    ).toBeNull();
  });
});
