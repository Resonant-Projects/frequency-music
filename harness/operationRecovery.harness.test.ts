import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
import { modules } from "./modules";
import { recordOperationFailure } from "../convex/operationFailures";

async function setup() {
  const t = convexTest(schema, modules);
  const runId = await t.run((ctx) =>
    ctx.db.insert("agentRuns", {
      graphName: "source-scout",
      input: {},
      status: "running",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const input = {
    url: "https://example.org/paper",
    query: "acoustics",
    rationale: "Missing evidence",
    rawText: "Retained capture",
  };
  const failureId = await t.mutation(
    internal.operationFailures.reportCaptureFailure,
    { agentRunId: runId, input, stage: "intake" },
  );
  const due = () =>
    t.run((ctx) => ctx.db.patch(failureId, { nextAttemptAt: 0 }));
  return { t, runId, input, failureId, due };
}
describe("operational recovery", () => {
  test.each(["report", "record"])(
    "%s failure diagnostics retain valid Unicode and schedule recovery",
    async (path) => {
      const { t, runId, input } = await setup();
      const message = `${"x".repeat(999)}🧠 detail`;
      const failureId =
        path === "report"
          ? await t.mutation(internal.operationFailures.reportCaptureFailure, {
              agentRunId: runId,
              input: { ...input, url: "https://example.org/unicode" },
              stage: "intake",
              diagnostic: message,
            })
          : await t.run((ctx) =>
              recordOperationFailure(ctx, {
                operationId: "unicode",
                causeKey: "unicode",
                target: { kind: "capture", input },
                message,
              }),
            );
      expect((await t.run((ctx) => ctx.db.get(failureId)))?.message).toBe(
        "x".repeat(999),
      );
      const scheduled = await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
      );
      expect(
        scheduled.some(
          (row) =>
            (row.args[0] as { failureId?: string }).failureId === failureId,
        ),
      ).toBe(true);
    },
  );

  test("reconciliation advances large media snapshots and an independent queue within transaction limits", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const ids: Id<"operationFailures">[] = [];
    for (let i = 0; i < 22; i++) {
      const jobId = await t.run((ctx) =>
        ctx.db.insert("mediaJobs", {
          kind: "narrate",
          input: {
            kind: "narrate",
            script: { paragraphs: ["x".repeat(900_000)], chapters: [] },
            voiceId: "local",
            promptVersion: "v1",
            target: "spoken",
            title: "Large narration",
            access: "private",
            refs: {},
            assembleOnDone: false,
            rendererVersion: "test",
          },
          dedupeKey: `large-${i}`,
          status: i === 0 ? "queued" : i === 21 ? "done" : "parked",
          priority: 0,
          attempts: 3,
          createdAt: i,
        }),
      );
      ids.push(
        await t.run((ctx) =>
          ctx.db.insert("operationFailures", {
            operationId: `large-${i}`,
            causeKey: "audio:large",
            target: { kind: "audioUpload", jobId },
            message: "Upload interrupted",
            status: "recovering",
            attempts: 1,
            nextAttemptAt: 0,
            createdAt: i,
            updatedAt: i,
          }),
        ),
      );
    }
    const independent = await t.run((ctx) =>
      ctx.db.insert("operationFailures", {
        operationId: "independent-capture",
        causeKey: "capture:intake",
        target: {
          kind: "capture",
          input: {
            url: "https://example.org",
            query: "test",
            rationale: "test",
          },
        },
        message: "Interrupted",
        status: "retrying",
        attempts: 1,
        nextAttemptAt: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await t.mutation(internal.operationFailures.reconcile, {});
    expect((await t.run((ctx) => ctx.db.get(independent)))?.status).toBe(
      "recorded",
    );
    expect(
      (await t.run((ctx) => ctx.db.get(ids[0]!)))?.nextAttemptAt,
    ).toBeGreaterThan(Date.now());
    for (let tick = 0; tick < 21; tick++)
      await t.mutation(internal.operationFailures.reconcile, {});
    for (const id of ids.slice(1, 21))
      expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("recorded");
    expect((await t.run((ctx) => ctx.db.get(ids[21]!)))?.status).toBe(
      "resolved",
    );
  });
  test("capture recovery run pages include assigned failures without duplicate reporter rows", async () => {
    const { t, runId, failureId, due } = await setup();
    await due();
    const attempt = await t.mutation(internal.operationFailures.claimRecovery, {
      failureId,
    });
    await t.mutation(internal.operationFailures.dispatch, {
      failureId,
      attempt: attempt!,
    });
    const failure = (await t.query(internal.operationFailures.getForRecovery, {
      failureId,
    }))!;
    const recoveryRunId = failure.recoveryRunId!;
    const read = (agentRunId: typeof runId) =>
      t
        .withIdentity({ subject: "operator" })
        .query(api.operationFailures.listForRun, { agentRunId });
    expect(await read(recoveryRunId)).toMatchObject([
      { _id: failureId, status: "recovering", attempts: 1 },
    ]);
    await t.run((ctx) =>
      ctx.db.patch(failureId, { agentRunId: recoveryRunId }),
    );
    expect(await read(recoveryRunId)).toHaveLength(1);
  });

  test("100 same-cause failures use bounded groups and running groups accept no new members", async () => {
    const { t, failureId } = await setup();
    const original = (await t.query(internal.operationFailures.getForRecovery, {
      failureId,
    }))!;
    const { _id, _creationTime, ...fields } = original;
    await t.run((ctx) => ctx.db.patch(failureId, { status: "resolved" }));
    for (let i = 0; i < 100; i++) {
      const id = await t.run((ctx) =>
        ctx.db.insert("operationFailures", {
          ...fields,
          operationId: `group-${i}`,
          attempts: 2,
          nextAttemptAt: 0,
        }),
      );
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: id,
      });
    }
    const runs = await t.run((ctx) =>
      ctx.db
        .query("agentRuns")
        .filter((q) => q.eq(q.field("graphName"), "failure-investigation"))
        .collect(),
    );
    expect(runs).toHaveLength(34);
    for (const run of runs)
      expect(
        await t.run((ctx) =>
          ctx.db
            .query("operationFailures")
            .withIndex("by_investigation", (q) =>
              q.eq("investigationRunId", run._id),
            )
            .collect(),
        ),
      ).toHaveLength(run === runs.at(-1) ? 1 : 3);
    const id = await t.run((ctx) =>
      ctx.db.insert("operationFailures", {
        ...fields,
        operationId: "running-group",
        attempts: 2,
        nextAttemptAt: 0,
      }),
    );
    await t.mutation(internal.operationFailures.claimRecovery, {
      failureId: id,
    });
    const runId = (await t.query(internal.operationFailures.getForRecovery, {
      failureId: id,
    }))!.investigationRunId!;
    await t.run((ctx) => ctx.db.patch(runId, { status: "running" }));
    const next = await t.run((ctx) =>
      ctx.db.insert("operationFailures", {
        ...fields,
        operationId: "after-group-start",
        attempts: 2,
        nextAttemptAt: 0,
      }),
    );
    await t.mutation(internal.operationFailures.claimRecovery, {
      failureId: next,
    });
    expect(
      (
        await t.query(internal.operationFailures.getForRecovery, {
          failureId: next,
        })
      )?.investigationRunId,
    ).not.toBe(runId);
  });

  test("overdue active recoveries do not shadow later terminal recoveries", async () => {
    const { t, failureId } = await setup();
    const original = (await t.query(internal.operationFailures.getForRecovery, {
      failureId,
    }))!;
    const { _id, _creationTime, ...fields } = original;
    await t.run((ctx) => ctx.db.patch(failureId, { status: "resolved" }));
    const rows = await t.run(async (ctx) => {
      const ids = [];
      for (let i = 0; i < 21; i++) {
        const runId = await ctx.db.insert("agentRuns", {
          graphName: "source-scout",
          status: i < 20 ? "running" : "failed",
          input: {},
          createdAt: 1,
          updatedAt: 1,
        });
        ids.push(
          await ctx.db.insert("operationFailures", {
            ...fields,
            operationId: `reconcile-${i}`,
            status: "recovering",
            attempts: 1,
            recoveryRunId: runId,
            nextAttemptAt: 0,
          }),
        );
      }
      return ids;
    });
    await t.mutation(internal.operationFailures.reconcile, {});
    expect(
      (await t.query(internal.operationFailures.getForRecovery, {
        failureId: rows[0]!,
      }))!.nextAttemptAt,
    ).toBeGreaterThan(Date.now());
    for (let tick = 0; tick < 20; tick++)
      await t.mutation(internal.operationFailures.reconcile, {});
    expect(
      (
        await t.query(internal.operationFailures.getForRecovery, {
          failureId: rows[20]!,
        })
      )?.status,
    ).toBe("recorded");
  });

  test("delivery is idempotent and a stale attempt cannot finish a newer recovery", async () => {
    const { t, runId, input, failureId, due } = await setup();
    expect(
      await t.mutation(internal.operationFailures.reportCaptureFailure, {
        agentRunId: runId,
        input,
        stage: "intake",
      }),
    ).toBe(failureId);
    await due();
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, { failureId }),
    ).toBe(1);
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, { failureId }),
    ).toBeNull();
    await t.mutation(internal.operationFailures.finish, {
      failureId,
      attempt: 1,
      success: false,
    });
    await due();
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, { failureId }),
    ).toBe(2);
    await t.mutation(internal.operationFailures.finish, {
      failureId,
      attempt: 1,
      success: true,
    });
    expect(
      (await t.query(internal.operationFailures.getForRecovery, { failureId }))
        ?.status,
    ).toBe("retrying");
    expect(
      await t.mutation(internal.operationFailures.dispatch, {
        failureId,
        attempt: 1,
      }),
    ).toBe(false);
  });
  test("recovery is assigned to one run and reuses retained capture", async () => {
    const { t, runId, input, failureId, due } = await setup();
    await due();
    await t.mutation(internal.operationFailures.claimRecovery, { failureId });
    await t.mutation(internal.operationFailures.dispatch, {
      failureId,
      attempt: 1,
    });
    const row = await t.query(internal.operationFailures.getForRecovery, {
      failureId,
    });
    const recoveryRunId = row!.recoveryRunId!;
    expect(
      await t.query(internal.operationFailures.getCaptureRecovery, {
        agentRunId: runId,
      }),
    ).toBeNull();
    await t.run((ctx) => ctx.db.patch(recoveryRunId, { status: "running" }));
    expect(
      await t.query(internal.operationFailures.getCaptureRecovery, {
        agentRunId: recoveryRunId,
      }),
    ).toEqual({ failureId, input });
    await expect(
      t.mutation(internal.operationFailures.finishCaptureRecovery, {
        agentRunId: runId,
        failureId,
        success: true,
      }),
    ).rejects.toThrow("does not own");
    await t.mutation(internal.operationFailures.finishCaptureRecovery, {
      agentRunId: recoveryRunId,
      failureId,
      success: true,
    });
    expect(
      (await t.query(internal.operationFailures.getForRecovery, { failureId }))
        ?.status,
    ).toBe("resolved");
  });
  test("persistent failures enter investigation and cannot exceed the recovery cap", async () => {
    const { t, failureId, due } = await setup();
    for (const attempt of [1, 2]) {
      await due();
      expect(
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        }),
      ).toBe(attempt);
      await t.mutation(internal.operationFailures.finish, {
        failureId,
        attempt,
        success: false,
      });
    }
    await due();
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, { failureId }),
    ).toBeNull();
    const row = await t.query(internal.operationFailures.getForRecovery, {
      failureId,
    });
    expect(row?.status).toBe("investigating");
    const agentRunId = row!.investigationRunId!;
    await expect(
      t.mutation(internal.operationFailures.submitDiagnosis, {
        agentRunId,
        result: { diagnosis: "Transient", recover: true },
      }),
    ).rejects.toThrow("Active investigation");
    await t.run((ctx) => ctx.db.patch(agentRunId, { status: "running" }));
    const evidence = await t.query(
      internal.operationFailures.getInvestigation,
      { agentRunId },
    );
    expect(evidence[0]?.evidence).toMatchObject({
      retainedText: true,
      stage: "intake",
    });
    await t.mutation(internal.operationFailures.submitDiagnosis, {
      agentRunId,
      result: { diagnosis: "Retry retained intake", recover: true },
    });
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, { failureId }),
    ).toBe(3);
    await t.mutation(internal.operationFailures.finish, {
      failureId,
      attempt: 3,
      success: false,
    });
    await due();
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, { failureId }),
    ).toBeNull();
    expect(
      (await t.query(internal.operationFailures.getForRecovery, { failureId }))
        ?.status,
    ).toBe("needsReview");
  });
  test("an investigator failure goes to review without recursive investigation", async () => {
    const { t, failureId, due } = await setup();
    await t.run((ctx) => ctx.db.patch(failureId, { attempts: 2 }));
    await due();
    await t.mutation(internal.operationFailures.claimRecovery, { failureId });
    const row = await t.query(internal.operationFailures.getForRecovery, {
      failureId,
    });
    await t.run((ctx) =>
      ctx.db.patch(row!.investigationRunId!, { status: "failed" }),
    );
    await due();
    await t.mutation(internal.operationFailures.reconcile, {});
    expect(
      (await t.query(internal.operationFailures.getForRecovery, { failureId }))
        ?.status,
    ).toBe("needsReview");
  });
});
