import { convexTest } from "convex-test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
import { modules } from "./modules";
import {
  LEASE_MS,
  RENDERER_VERSION_FOR_JOBS,
} from "../convex/shared/mediaJobs";

describe("recovery admission", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("the media cron parks obsolete queued snapshots and drains large inputs in bounded transactions", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const ids: Id<"mediaJobs">[] = [];
    for (let i = 0; i < 20; i++) {
      ids.push(
        await t.run((ctx) =>
          ctx.db.insert("mediaJobs", {
            kind: "narrate",
            input: {
              kind: "narrate",
              script: { paragraphs: ["x".repeat(900_000)], chapters: [] },
              voiceId: "voice",
              promptVersion: "v1",
              target: "spoken",
              title: "Old narration",
              access: "private",
              refs: {},
              assembleOnDone: false,
              rendererVersion: "old",
            },
            dedupeKey: `old-${i}`,
            status: "queued",
            priority: 0,
            attempts: 0,
            createdAt: 1,
          }),
        ),
      );
    }
    const protectedIds: Id<"mediaJobs">[] = [];
    for (const [rendererVersion, createdAt] of [
      [RENDERER_VERSION_FOR_JOBS, 1],
      ["essay-local", 1],
      ["old", Date.now()],
    ] as const) {
      protectedIds.push(
        await t.run((ctx) =>
          ctx.db.insert("mediaJobs", {
            kind: "probe",
            input: { kind: "probe", toneHz: 440, seconds: 1, rendererVersion },
            dedupeKey: `${rendererVersion}-${createdAt}`,
            status: "queued",
            priority: 0,
            attempts: 0,
            createdAt,
          }),
        ),
      );
    }
    await t.mutation(internal.mediaSweeper.sweep, { now: Date.now() });
    let next = await t.run((ctx) =>
      ctx.db.system
        .query("_scheduled_functions")
        .filter((q) =>
          q.eq(q.field("name"), "mediaJobs:parkIncompatibleQueued"),
        )
        .order("desc")
        .first(),
    );
    expect(next).not.toBeNull();
    for (let i = 0; next && i < 30; i++) {
      await t.mutation(internal.mediaJobs.parkIncompatibleQueued, next.args[0]);
      const previous = next._id;
      next = await t.run((ctx) =>
        ctx.db.system
          .query("_scheduled_functions")
          .filter((q) =>
            q.eq(q.field("name"), "mediaJobs:parkIncompatibleQueued"),
          )
          .order("desc")
          .first(),
      );
      if (next?._id === previous) break;
    }
    for (const id of ids) {
      const job = await t.run((ctx) => ctx.db.get(id));
      expect(job).toMatchObject({
        status: "parked",
        attempts: 0,
        input: { rendererVersion: "old" },
      });
      expect(job?.error).toContain("renderer version mismatch");
      const failure = await t.run((ctx) =>
        ctx.db
          .query("operationFailures")
          .withIndex("by_operation", (q) => q.eq("operationId", `media:${id}`))
          .unique(),
      );
      expect(failure?.target).toEqual({ kind: "audioUpload", jobId: id });
    }
    for (const id of protectedIds)
      expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("queued");
    expect(Date.now() - LEASE_MS).toBeGreaterThan(1);
  });

  test("investigation evidence excludes settled group members and is empty when all have settled", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const runId = await t.run((ctx) =>
      ctx.db.insert("agentRuns", {
        graphName: "source-scout",
        status: "running",
        input: {},
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const ids: Id<"operationFailures">[] = [];
    for (let i = 0; i < 2; i++) {
      const id = await t.mutation(
        internal.operationFailures.reportCaptureFailure,
        {
          agentRunId: runId,
          input: {
            url: `https://example.org/${i}`,
            query: "q",
            rationale: "r",
          },
          stage: "capture",
          diagnostic: "HTTP 429",
        },
      );
      await t.run((ctx) => ctx.db.patch(id, { attempts: 2, nextAttemptAt: 0 }));
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: id,
      });
      ids.push(id);
    }
    const agentRunId = (await t.run((ctx) => ctx.db.get(ids[0]!)))!
      .investigationRunId!;
    expect(
      (await t.run((ctx) => ctx.db.get(ids[1]!)))?.investigationRunId,
    ).toBe(agentRunId);
    await t.run((ctx) => ctx.db.patch(agentRunId, { status: "running" }));
    for (let i = 0; i < 2; i++) {
      await t.mutation(internal.sources.createScoutedSource, {
        agentRunId: runId,
        url: `https://example.org/${i}`,
        query: "q",
        rationale: "r",
        rawText: "Recovered source text with enough evidence. ".repeat(6),
        contentProvider: "crawl4ai",
      });
      const evidence = await t.query(
        internal.operationFailures.getInvestigation,
        { agentRunId },
      );
      expect(evidence.map((row) => row.id)).toEqual(ids.slice(i + 1));
    }
  });

  test("diagnosis of a Source edited during queued investigation releases obsolete ownership", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const operator = t.withIdentity({ subject: "system" });
    const url = "https://example.org/investigation-edit";
    const rawText = "Source evidence about musical intervals. ".repeat(10);
    const { id: sourceId } = await operator.mutation(
      api.sources.createFromUrlInput,
      { url, title: "Original", rawText },
    );
    const prepared = await t.mutation(
      internal.extractInternal.beginExtraction,
      { sourceId, model: "anthropic/claude-sonnet-5.5" },
    );
    if ("skipped" in prepared) throw new Error(prepared.reason);
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId: prepared.attemptId,
      error: "Network failure",
    });
    const failure = (await t.run((ctx) =>
      ctx.db
        .query("operationFailures")
        .withIndex("by_operation", (q) =>
          q.eq("operationId", `extraction:${prepared.attemptId}`),
        )
        .unique(),
    ))!;
    await t.run((ctx) =>
      ctx.db.patch(failure._id, { attempts: 2, nextAttemptAt: 0 }),
    );
    await t.mutation(internal.operationFailures.claimRecovery, {
      failureId: failure._id,
    });
    const agentRunId = (await t.run((ctx) => ctx.db.get(failure._id)))!
      .investigationRunId!;
    await operator.action(api.sources.createFromUrlAndQueue, {
      url,
      title: "Replacement",
      rawText,
    });
    await t.run((ctx) => ctx.db.patch(agentRunId, { status: "running" }));
    expect(
      (
        await t.query(internal.operationFailures.getInvestigation, {
          agentRunId,
        })
      )[0]?.unsupportedReason,
    ).toContain("Only retained output");
    await t.mutation(internal.operationFailures.submitDiagnosis, {
      agentRunId,
      result: { diagnosis: "Transient, retry", recover: true },
    });
    expect(await t.run((ctx) => ctx.db.get(sourceId))).toMatchObject({
      status: "text_ready",
    });
    expect(
      (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
    ).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.get(failure._id))).toMatchObject({
      status: "needsReview",
      attempts: 2,
    });
    const next = await t.mutation(internal.extractInternal.beginExtraction, {
      sourceId,
      model: "anthropic/claude-sonnet-5.5",
    });
    expect("attemptId" in next && next.attemptId).not.toBe(prepared.attemptId);
  });

  test("retaining output fences an outstanding stale investigation diagnosis", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const operator = t.withIdentity({ subject: "system" });
    const url = "https://example.org/retention-diagnosis-race";
    const rawText = "Source evidence about musical intervals. ".repeat(10);
    const { id: sourceId } = await operator.mutation(
      api.sources.createFromUrlInput,
      { url, title: "Original", rawText },
    );
    const prepared = await t.mutation(
      internal.extractInternal.beginExtraction,
      { sourceId, model: "anthropic/claude-sonnet-5.5" },
    );
    if ("skipped" in prepared) throw new Error(prepared.reason);
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId: prepared.attemptId,
      error: "Network failure",
    });
    const failure = (await t.run((ctx) =>
      ctx.db
        .query("operationFailures")
        .withIndex("by_operation", (q) =>
          q.eq("operationId", `extraction:${prepared.attemptId}`),
        )
        .unique(),
    ))!;
    await t.run((ctx) =>
      ctx.db.patch(failure._id, { attempts: 2, nextAttemptAt: 0 }),
    );
    await t.mutation(internal.operationFailures.claimRecovery, {
      failureId: failure._id,
    });
    const agentRunId = (await t.run((ctx) => ctx.db.get(failure._id)))!
      .investigationRunId!;
    await operator.action(api.sources.createFromUrlAndQueue, {
      url,
      title: "Replacement",
      rawText,
    });
    await t.run((ctx) => ctx.db.patch(agentRunId, { status: "running" }));
    const evidence = await t.query(
      internal.operationFailures.getInvestigation,
      { agentRunId },
    );
    expect(evidence[0]?.unsupportedReason).toContain("Only retained output");
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId: prepared.attemptId,
      result: {
        summary: "Original paid result",
        claims: [],
        topics: [],
        openQuestions: [],
        compositionParameters: [],
      },
    });
    await t.mutation(internal.operationFailures.submitDiagnosis, {
      agentRunId,
      result: { diagnosis: "Obsolete source; do not retry", recover: false },
    });
    expect(await t.run((ctx) => ctx.db.get(failure._id))).toMatchObject({
      status: "recorded",
      attempts: 2,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(failure._id)))?.investigationRunId,
    ).toBeUndefined();
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: failure._id,
      }),
    ).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(failure._id)))?.attempts).toBe(2);
    await t.action(internal.extractInternal.completeExtraction, {
      attemptId: prepared.attemptId,
    });
    const completed = (await t.query(internal.extractInternal.getAttempt, {
      attemptId: prepared.attemptId,
    }))!;
    expect(completed).toMatchObject({ status: "completed", current: false });
    expect(
      (await t.run((ctx) => ctx.db.get(completed.extractionId!)))?.historical,
    ).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
      "resolved",
    );
  });

  test.each(["text", "title", "url"])(
    "stale %s snapshots cannot admit recovery or investigation without retained output",
    async (change) => {
      const t = convexTest({ schema, modules, transactionLimits: true });
      const sourceId = await t.run((ctx) =>
        ctx.db.insert("sources", {
          type: "url",
          rawText: "Original music research evidence. ".repeat(10),
          title: "Original",
          canonicalUrl: "https://example.org/original",
          status: "text_ready",
          dedupeKey: `snapshot-${change}`,
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      const prepared = await t.mutation(
        internal.extractInternal.beginExtraction,
        { sourceId, model: "anthropic/claude-sonnet-5.5" },
      );
      if ("skipped" in prepared) throw new Error(prepared.reason);
      await t.mutation(internal.extractInternal.failExtraction, {
        attemptId: prepared.attemptId,
        error: "Network failure",
      });
      if (change === "text")
        await t
          .withIdentity({ subject: "operator" })
          .mutation(api.sources.updateText, {
            id: sourceId,
            rawText: "Replacement music research evidence. ".repeat(10),
          });
      else
        await t.run((ctx) =>
          ctx.db.patch(
            sourceId,
            change === "title"
              ? { title: "Replacement" }
              : { canonicalUrl: "https://example.org/replacement" },
          ),
        );
      const failure = (await t.run((ctx) =>
        ctx.db
          .query("operationFailures")
          .withIndex("by_operation", (q) =>
            q.eq("operationId", `extraction:${prepared.attemptId}`),
          )
          .unique(),
      ))!;
      await t.run((ctx) => ctx.db.patch(failure._id, { nextAttemptAt: 0 }));
      expect(
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId: failure._id,
        }),
      ).toBeNull();
      const blocked = await t.run((ctx) => ctx.db.get(failure._id));
      expect(blocked).toMatchObject({ status: "needsReview", attempts: 0 });
      expect(blocked?.investigationRunId).toBeUndefined();
      // Late retained output remains admissible after the same metadata/text edit.
      await t.mutation(internal.extractInternal.retainExtractionResult, {
        attemptId: prepared.attemptId,
        result: {
          summary: "Original snapshot result",
          claims: [],
          topics: [],
          openQuestions: [],
          compositionParameters: [],
        },
      });
      expect(await t.run((ctx) => ctx.db.get(failure._id))).toMatchObject({
        status: "recorded",
        attempts: 0,
      });
      expect(
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId: failure._id,
        }),
      ).toBeNull();
      expect((await t.run((ctx) => ctx.db.get(failure._id)))?.attempts).toBe(0);
      const { queuedRecovery, now } = await t.run(async (ctx) => ({
        queuedRecovery: await ctx.db.system
          .query("_scheduled_functions")
          .filter((q) =>
            q.eq(q.field("name"), "extractInternal:completeExtraction"),
          )
          .order("desc")
          .first(),
        now: Date.now(),
      }));
      expect(queuedRecovery?.args).toEqual([{ attemptId: prepared.attemptId }]);
      expect(queuedRecovery?.scheduledTime).toBeLessThanOrEqual(now);
      await t.action(internal.extractInternal.completeExtraction, {
        attemptId: prepared.attemptId,
      });
      const completed = (await t.query(internal.extractInternal.getAttempt, {
        attemptId: prepared.attemptId,
      }))!;
      expect(completed.current).toBe(false);
      expect(completed.status).toBe("completed");
      expect(
        (await t.run((ctx) => ctx.db.get(completed.extractionId!)))?.historical,
      ).toBe(true);
      expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
        "resolved",
      );
    },
  );
});
