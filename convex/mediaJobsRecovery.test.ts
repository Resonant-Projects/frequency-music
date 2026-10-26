import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { probe, narrationInput, probePair } from "../harness/mediaJobFixtures";

describe("mediaJobs recovery", () => {
  async function approvedMediaRecovery() {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    for (let i = 0; i < 3; i++) {
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "initial",
        kinds: ["probe"],
      });
      await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error: "TTS HTTP 429",
      });
    }
    const failure = await t.run((ctx) =>
      ctx.db
        .query("operationFailures")
        .withIndex("by_operation", (q) => q.eq("operationId", `media:${jobId}`))
        .unique(),
    );
    const failureId = failure!._id;
    await t.run((ctx) => ctx.db.patch(failureId, { nextAttemptAt: 0 }));
    await t.mutation(internal.operationFailures.claimRecovery, { failureId });
    const investigating = await t.run((ctx) => ctx.db.get(failureId));
    const runId = investigating!.investigationRunId!;
    await t.run((ctx) => ctx.db.patch(runId, { status: "running" }));
    await t.mutation(internal.operationFailures.submitDiagnosis, {
      agentRunId: runId,
      result: { diagnosis: "Retry transient rejection", recover: true },
    });
    const attempt = await t.mutation(internal.operationFailures.claimRecovery, {
      failureId,
    });
    expect(attempt).toBe(1);
    await t.mutation(internal.operationFailures.dispatch, {
      failureId,
      attempt: attempt!,
    });
    return { t, jobId, failureId, runId };
  }

  test("media recovery dispatch schedules a near-term outcome check", async () => {
    const { t, failureId } = await approvedMediaRecovery();
    const row = await t.run((ctx) => ctx.db.get(failureId));
    expect(row!.nextAttemptAt - row!.updatedAt).toBe(60_000);
    expect(row!.status).toBe("recovering");
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(
      scheduled.some(
        (entry) =>
          entry.name === "operationFailures:reconcile" &&
          entry.scheduledTime === row!.nextAttemptAt,
      ),
    ).toBe(true);
  });

  test("media completion settles its operational recovery in the same transaction", async () => {
    const { t, jobId, failureId } = await approvedMediaRecovery();
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "recovery",
      kinds: ["probe"],
    });
    const { result } = await probePair(t, jobId);
    await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result,
    });
    expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
      "resolved",
    );
  });

  test.each([
    "Retained job checkpoint missing",
    "GEMINI_API_KEY is not configured",
    "TTS HTTP 503",
  ])(
    "a failed media recovery discards its old diagnosis and investigates the current cause: %s",
    async (error) => {
      const { t, jobId, failureId, runId } = await approvedMediaRecovery();
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "recovery",
        kinds: ["probe"],
      });
      await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error,
      });
      const failed = await t.run((ctx) => ctx.db.get(failureId));
      expect(failed?.status).toBe("recorded");
      expect(failed?.diagnosis).toBeUndefined();
      expect(failed?.causeKey).not.toBe("media:probe:rate_limit");
      expect(failed?.attempts).toBe(1);
      await t.run((ctx) => ctx.db.patch(failureId, { nextAttemptAt: 0 }));
      expect(
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        }),
      ).toBeNull();
      const next = await t.run((ctx) => ctx.db.get(failureId));
      expect(next?.status).toBe("investigating");
      expect(next?.investigationRunId).not.toBe(runId);
      await t.run((ctx) =>
        ctx.db.patch(next!.investigationRunId!, { status: "running" }),
      );
      const evidence = await t.query(
        internal.operationFailures.getInvestigation,
        { agentRunId: next!.investigationRunId! },
      );
      expect(evidence[0]?.evidence.error).toBe(error);
      if (error.includes("checkpoint")) {
        await t.mutation(internal.operationFailures.submitDiagnosis, {
          agentRunId: next!.investigationRunId!,
          result: {
            diagnosis: "Stale approval cannot bypass prerequisites",
            recover: true,
          },
        });
        expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
          "needsReview",
        );
        expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe(
          "parked",
        );
      }
    },
  );

  test("new media prerequisites block an already approved retry", async () => {
    const { t, jobId, failureId } = await approvedMediaRecovery();
    await t.run(async (ctx) => {
      await ctx.db.patch(jobId, {
        status: "parked",
        error: "Retained job checkpoint missing",
      });
      await ctx.db.patch(failureId, { status: "recorded", nextAttemptAt: 0 });
    });
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, { failureId }),
    ).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
      "investigating",
    );
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("parked");
  });

  test("media investigations group the actual cause and keep independent recovery decisions", async () => {
    const t = convexTest(schema, modules);
    const failures: Id<"operationFailures">[] = [];
    for (const [i, error] of [
      "TTS HTTP 429: too many requests for voice A",
      "TTS HTTP 429: too many requests for voice B",
      "GEMINI_API_KEY is not configured",
    ].entries()) {
      const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
        input: narrationInput(undefined, `Distinct script ${i}`),
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        const claim = await t.mutation(internal.mediaJobs.claimNext, {
          workerId: "w",
          kinds: ["narrate"],
        });
        await t.mutation(internal.mediaJobs.fail, {
          jobId,
          leaseToken: claim!.leaseToken,
          error,
        });
      }
      const failure = await t.run((ctx) =>
        ctx.db
          .query("operationFailures")
          .withIndex("by_operation", (q) =>
            q.eq("operationId", `media:${jobId}`),
          )
          .unique(),
      );
      failures.push(failure!._id);
      await t.run((ctx) => ctx.db.patch(failure!._id, { nextAttemptAt: 0 }));
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: failure!._id,
      });
    }
    const rows = await t.run(async (ctx) =>
      Promise.all(failures.map((id) => ctx.db.get(id))),
    );
    expect(rows[0]?.causeKey).toBe(rows[1]?.causeKey);
    expect(rows[0]?.investigationRunId).toBe(rows[1]?.investigationRunId);
    expect(rows[2]?.causeKey).not.toBe(rows[0]?.causeKey);
    expect(rows[2]?.investigationRunId).not.toBe(rows[0]?.investigationRunId);
    for (const [i, recover] of [
      [0, true],
      [2, false],
    ] as const) {
      const runId = rows[i]!.investigationRunId!;
      await t.run((ctx) => ctx.db.patch(runId, { status: "running" }));
      await t.mutation(internal.operationFailures.submitDiagnosis, {
        agentRunId: runId,
        result: {
          diagnosis: recover ? "Transient rejection" : "Missing key",
          recover,
        },
      });
    }
    expect((await t.run((ctx) => ctx.db.get(failures[0]!)))?.status).toBe(
      "recorded",
    );
    expect((await t.run((ctx) => ctx.db.get(failures[1]!)))?.status).toBe(
      "recorded",
    );
    expect((await t.run((ctx) => ctx.db.get(failures[2]!)))?.status).toBe(
      "needsReview",
    );
  });

  test("media failure diagnostics preserve Unicode while exhausting the existing retry budget", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w",
        kinds: ["probe"],
      });
      await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error: `${"x".repeat(1999)}🧠 detail`,
      });
      expect((await t.run((ctx) => ctx.db.get(jobId)))?.error).toBe(
        "x".repeat(1999),
      );
    }
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("parked");
    const failure = await t.run((ctx) =>
      ctx.db
        .query("operationFailures")
        .withIndex("by_operation", (q) => q.eq("operationId", `media:${jobId}`))
        .unique(),
    );
    expect(failure?.status).toBe("recorded");
  });

  test("a capped media job still receives one complete execution per operational recovery attempt", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const failureId = await t.run(async (ctx) => {
      await ctx.db.patch(jobId, { status: "parked", attempts: 3 });
      return ctx.db.insert("operationFailures", {
        operationId: `audio:${jobId}`,
        causeKey: "audio:upload",
        target: { kind: "audioUpload", jobId },
        message: "Upload failed",
        status: "retrying",
        attempts: 1,
        nextAttemptAt: 0,
        createdAt: 1,
        updatedAt: 1,
      });
    });
    expect(
      await t.mutation(internal.operationFailures.dispatch, {
        failureId,
        attempt: 1,
      }),
    ).toBe(true);
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "recovery",
      kinds: ["probe"],
    });
    expect(claim?.jobId).toBe(jobId);
    expect(claim?.attempts).toBe(3);
    const { result } = await probePair(t, jobId);
    await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result,
    });
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("done");
  });
});
