import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
import { modules } from "./modules";
import { recordOperationFailure } from "../convex/operationFailures";
import { generateDedupeKey } from "../convex/sourceUtils";

async function setup(transactionLimits = false) {
  const t = convexTest({ schema, modules, transactionLimits });
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
  test("capture investigations keep transient and authentication failures on one host independent", async () => {
    const { t, runId, input } = await setup(true);
    const ids: Id<"operationFailures">[] = [];
    for (const [i, diagnostic] of [
      "HTTP 429: page A rate limited",
      "HTTP 429: page B rate limited",
      "HTTP 403: authentication forbidden",
    ].entries()) {
      const id = await t.mutation(
        internal.operationFailures.reportCaptureFailure,
        {
          agentRunId: runId,
          input: { ...input, url: `https://example.org/cause-${i}` },
          stage: "capture",
          diagnostic,
        },
      );
      await t.run((ctx) => ctx.db.patch(id, { attempts: 2, nextAttemptAt: 0 }));
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: id,
      });
      ids.push(id);
    }
    const rows = await t.run((ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id))),
    );
    expect(rows[0]?.investigationRunId).toBe(rows[1]?.investigationRunId);
    expect(rows[2]?.investigationRunId).not.toBe(rows[0]?.investigationRunId);
    for (const [i, recover] of [
      [0, true],
      [2, false],
    ] as const) {
      const agentRunId = rows[i]!.investigationRunId!;
      await t.run((ctx) => ctx.db.patch(agentRunId, { status: "running" }));
      const evidence = await t.query(
        internal.operationFailures.getInvestigation,
        { agentRunId },
      );
      expect(evidence.every((row) => row.evidence.stage === "capture")).toBe(
        true,
      );
      await t.mutation(internal.operationFailures.submitDiagnosis, {
        agentRunId,
        result: {
          diagnosis: recover
            ? "Retry transient rejection"
            : "Authentication requires review",
          recover,
        },
      });
    }
    expect((await t.run((ctx) => ctx.db.get(ids[0]!)))?.status).toBe(
      "recorded",
    );
    expect((await t.run((ctx) => ctx.db.get(ids[1]!)))?.status).toBe(
      "recorded",
    );
    expect((await t.run((ctx) => ctx.db.get(ids[2]!)))?.status).toBe(
      "needsReview",
    );
  });

  test("a queued capture sees no recovery input while bounded settlement is still draining", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(50_000);
    try {
      const { t, runId, input, failureId, due } = await setup(true);
      const source = await t.mutation(internal.sources.createScoutedSource, {
        ...input,
        rawText: undefined,
        agentRunId: runId,
      });
      await due();
      await t.mutation(internal.operationFailures.claimRecovery, { failureId });
      await t.mutation(internal.operationFailures.dispatch, {
        failureId,
        attempt: 1,
      });
      const nextRunId = await t.run((ctx) =>
        ctx.db.insert("agentRuns", {
          graphName: "source-scout",
          input: {},
          status: "running",
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      const nextFailure = await t.mutation(
        internal.operationFailures.reportCaptureFailure,
        { agentRunId: nextRunId, input, stage: "capture" },
      );
      await t.run((ctx) => ctx.db.patch(nextFailure, { nextAttemptAt: 0 }));
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: nextFailure,
      });
      await t.mutation(internal.operationFailures.dispatch, {
        failureId: nextFailure,
        attempt: 1,
      });
      await t.mutation(internal.sources.createScoutedSource, {
        ...input,
        rawText: "Captured information is already available. ".repeat(5),
        contentProvider: "crawl4ai",
        agentRunId: runId,
      });
      const rows = await t.run((ctx) =>
        Promise.all([failureId, nextFailure].map((id) => ctx.db.get(id))),
      );
      const pending = rows.find((row) => row?.status === "recovering")!;
      expect(pending).toBeDefined();
      await t.run((ctx) =>
        ctx.db.patch(pending.recoveryRunId!, { status: "running" }),
      );
      expect(
        await t.query(internal.operationFailures.getCaptureRecovery, {
          agentRunId: pending.recoveryRunId!,
        }),
      ).toBeNull();
      // The read guard works before the next settlement mutation closes the row.
      expect((await t.run((ctx) => ctx.db.get(pending._id)))?.status).toBe(
        "recovering",
      );
      expect(
        (await t.run((ctx) => ctx.db.get(source.id)))?.rawText,
      ).toBeTruthy();
      await t.mutation(internal.operationFailures.settleCaptured, {
        dedupeKey: generateDedupeKey("url", { canonicalUrl: input.url }),
        capturedAt: 50_000,
      });
      expect((await t.run((ctx) => ctx.db.get(pending._id)))?.status).toBe(
        "resolved",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test("a settlement continuation cannot close a capture failure after a same-millisecond operator reset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const { t, runId, input } = await setup(true);
      const source = await t.mutation(internal.sources.createScoutedSource, {
        ...input,
        rawText: "Retained capture awaiting operator inspection. ".repeat(5),
        contentProvider: "crawl4ai",
        agentRunId: runId,
      });
      await t
        .withIdentity({ subject: "operator" })
        .mutation(api.sources.resetScoutCapture, {
          id: source.id,
          reason: "Capture requires replacement",
        });
      const nextFailure = await t.mutation(
        internal.operationFailures.reportCaptureFailure,
        {
          agentRunId: runId,
          input: { ...input, url: "https://EXAMPLE.org/paper/" },
          stage: "capture",
        },
      );
      await t.mutation(internal.operationFailures.settleCaptured, {
        dedupeKey: generateDedupeKey("url", { canonicalUrl: input.url }),
        capturedAt: 10_000,
      });
      expect((await t.run((ctx) => ctx.db.get(nextFailure)))?.status).toBe(
        "recorded",
      );
      expect(
        (await t.run((ctx) => ctx.db.get(source.id)))?.rawText,
      ).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  test.each([
    "recorded",
    "recovering",
    "investigating",
    "needsReview",
  ] as const)(
    "ordinary recapture resolves a prior %s failure and fences queued recovery or late diagnosis",
    async (status) => {
      const { t, runId, input, failureId, due } = await setup();
      const source = await t.mutation(internal.sources.createScoutedSource, {
        ...input,
        rawText: undefined,
        agentRunId: runId,
      });
      if (status === "recovering") {
        await due();
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        });
        await t.mutation(internal.operationFailures.dispatch, {
          failureId,
          attempt: 1,
        });
      } else if (status === "investigating") {
        await t.run((ctx) =>
          ctx.db.patch(failureId, { attempts: 2, nextAttemptAt: 0 }),
        );
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        });
      } else await t.run((ctx) => ctx.db.patch(failureId, { status }));
      const assigned = (await t.run((ctx) => ctx.db.get(failureId)))!;
      const success = await t.mutation(internal.sources.createScoutedSource, {
        ...input,
        url: "https://EXAMPLE.org/paper/",
        rawText:
          "A successful page capture with sufficient source text. ".repeat(5),
        contentProvider: "crawl4ai",
        agentRunId: runId,
      });
      expect(success).toEqual({
        id: source.id,
        created: false,
        enriched: true,
      });
      expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
        "resolved",
      );
      await due();
      expect(
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        }),
      ).toBeNull();
      if (assigned.recoveryRunId) {
        await t.run((ctx) =>
          ctx.db.patch(assigned.recoveryRunId!, { status: "running" }),
        );
        expect(
          await t.query(internal.operationFailures.getCaptureRecovery, {
            agentRunId: assigned.recoveryRunId,
          }),
        ).toBeNull();
        await t.mutation(internal.operationFailures.finishCaptureRecovery, {
          agentRunId: assigned.recoveryRunId,
          failureId,
          success: false,
        });
      }
      if (assigned.investigationRunId) {
        await t.run((ctx) =>
          ctx.db.patch(assigned.investigationRunId!, { status: "running" }),
        );
        await t.mutation(internal.operationFailures.submitDiagnosis, {
          agentRunId: assigned.investigationRunId,
          result: { diagnosis: "Stale diagnosis", recover: false },
        });
      }
      expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
        "resolved",
      );
    },
  );

  test("initial successful intake resolves its earlier intake failure", async () => {
    const { t, runId, input, failureId } = await setup();
    await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      rawText: "Source text retained before an intake failure. ".repeat(5),
      contentProvider: "crawl4ai",
      agentRunId: runId,
    });
    expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
      "resolved",
    );
    const late = await t.mutation(
      internal.operationFailures.reportCaptureFailure,
      {
        agentRunId: runId,
        input: { ...input, url: "https://EXAMPLE.org/paper/" },
        stage: "capture",
        diagnostic: "An older concurrent crawl failed after intake succeeded",
      },
    );
    expect(late).not.toBe(failureId);
    expect((await t.run((ctx) => ctx.db.get(late)))?.status).toBe("resolved");
    expect((await t.run((ctx) => ctx.db.get(late)))?.attempts).toBe(0);
  });

  test("capture settlement drains bounded indexed pages without closing later or unrelated failures", async () => {
    const { t, runId, input: originalInput, failureId } = await setup(true);
    const input = {
      ...originalInput,
      rawText: "Private retained source text. ".repeat(900),
    };
    const ids = [failureId];
    for (let i = 0; i < 4; i++) {
      const nextRunId = await t.run((ctx) =>
        ctx.db.insert("agentRuns", {
          graphName: "source-scout",
          input: {},
          status: "running",
          createdAt: i,
          updatedAt: i,
        }),
      );
      ids.push(
        await t.mutation(internal.operationFailures.reportCaptureFailure, {
          agentRunId: nextRunId,
          input,
          stage: "capture",
        }),
      );
    }
    const other = await t.mutation(
      internal.operationFailures.reportCaptureFailure,
      {
        agentRunId: runId,
        input: { ...input, url: "https://example.org/other" },
        stage: "capture",
      },
    );
    const source = await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      rawText: "Successfully retained captured source text. ".repeat(5),
      contentProvider: "crawl4ai",
      agentRunId: runId,
    });
    const capturedAt = (await t.run((ctx) => ctx.db.get(source.id)))!.updatedAt;
    const dedupeKey = generateDedupeKey("url", { canonicalUrl: input.url });
    const later = await t.run((ctx) =>
      ctx.db.insert("operationFailures", {
        operationId: "later-capture",
        causeKey: "capture:example.org:capture",
        captureDedupeKey: dedupeKey,
        target: { kind: "capture", input },
        status: "recorded",
        attempts: 0,
        message: "Later capture failed",
        createdAt: capturedAt + 1,
        updatedAt: capturedAt + 1,
        nextAttemptAt: capturedAt + 1,
      }),
    );
    expect(
      (
        await t.run((ctx) => Promise.all(ids.map((id) => ctx.db.get(id))))
      ).filter((row) => row?.status === "resolved"),
    ).toHaveLength(1);
    expect(
      (
        await t.run((ctx) =>
          ctx.db.system.query("_scheduled_functions").collect(),
        )
      ).some(
        (row) =>
          (row.args[0] as { dedupeKey?: string }).dedupeKey === dedupeKey,
      ),
    ).toBe(true);
    for (let i = 0; i < 4; i++)
      await t.mutation(internal.operationFailures.settleCaptured, {
        dedupeKey,
        capturedAt,
      });
    expect(
      (
        await t.run((ctx) => Promise.all(ids.map((id) => ctx.db.get(id))))
      ).every((row) => row?.status === "resolved"),
    ).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(other)))?.status).toBe("recorded");
    expect((await t.run((ctx) => ctx.db.get(later)))?.status).toBe("recorded");
  });

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
