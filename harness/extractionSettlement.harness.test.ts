import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
import { modules } from "./modules";
import { extractionInputHash } from "../convex/shared/extractionPrompt";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
const text = "Music research about resonance and perception. ".repeat(20);
const result = {
  summary: "Reading",
  claims: [],
  compositionParameters: [],
  topics: [],
  openQuestions: [],
};
async function setup() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "url",
      rawText: text,
      status: "text_ready",
      dedupeKey: "settlement",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const begin = async (operator = false) => {
    const prepared = await t.mutation(
      internal.extractInternal.beginExtraction,
      {
        sourceId,
        model: "test",
        ...(operator
          ? { expectedInputHash: await extractionInputHash(text) }
          : {}),
      },
    );
    if ("skipped" in prepared) throw new Error(prepared.reason);
    return prepared.attemptId;
  };
  const attemptId = await begin();
  await t.mutation(internal.extractInternal.failExtraction, {
    attemptId,
    error: "Timeout",
  });
  const failure = (await t.run((ctx) =>
    ctx.db.query("operationFailures").first(),
  ))!;
  return { t, sourceId, begin, attemptId, failure };
}

async function drainSettlements(t: ReturnType<typeof convexTest>) {
  const drained = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const jobs = await t.run((ctx) =>
      ctx.db.system
        .query("_scheduled_functions")
        .filter((q) =>
          q.eq(q.field("name"), "operationFailures:settleExtractionChain"),
        )
        .collect(),
    );
    const job = jobs.find((job) => !drained.has(job._id));
    if (!job) return;
    await t.mutation(
      internal.operationFailures.settleExtractionChain,
      job.args[0],
    );
    drained.add(job._id);
  }
  throw new Error("Settlement did not drain");
}

test("snapshot import settles displaced failure only after covering output completes", async () => {
  const { t, sourceId, begin, attemptId, failure } = await setup();
  await t
    .withIdentity({ subject: "reader" })
    .mutation(api.sources.updateText, { id: sourceId, rawText: text });
  const replacement = await begin(true);
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "recorded",
  );
  await t.run((ctx) => ctx.db.patch(failure._id, { status: "investigating" }));
  await t.mutation(internal.extractInternal.retainExtractionResult, {
    attemptId: replacement,
    result,
  });
  await t.action(internal.extractInternal.completeExtraction, {
    attemptId: replacement,
  });
  await drainSettlements(t);
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "resolved",
  );
  await t.mutation(internal.extractInternal.failExtraction, {
    attemptId,
    error: "Late timeout",
  });
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "resolved",
  );
});

test.each(["recorded", "investigating", "recovering"] as const)(
  "archive settles %s extraction recovery and releases ownership",
  async (status) => {
    const { t, sourceId, attemptId, failure } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(failure._id, { status, nextAttemptAt: 0 }),
    );
    await t
      .withIdentity({ subject: "reader" })
      .mutation(api.sources.archive, { id: sourceId });
    expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
      "resolved",
    );
    expect(
      (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
    ).toBeUndefined();
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: failure._id,
      }),
    ).toBeNull();
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "Late timeout",
    });
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    const completed = await t.action(
      internal.extractInternal.completeExtraction,
      { attemptId },
    );
    expect(completed.current).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
      "archived",
    );
    expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
      "resolved",
    );
  },
);

test("legacy normalization withdraws historical topics without a new extraction", async () => {
  const { t, sourceId } = await setup();
  await t.run((ctx) => ctx.db.patch(sourceId, { status: "extracted" }));
  const readings: Id<"extractions">[] = [];
  for (const [createdAt, topics] of [
    [1, ["obsolete"]],
    [2, ["current"]],
  ] as const) {
    readings.push(
      await t.run((ctx) =>
        ctx.db.insert("extractions", {
          sourceId,
          inputHash: `legacy-${createdAt}`,
          ...result,
          topics: [...topics],
          model: "test",
          promptVersion: "extract_v3",
          confidence: 1,
          createdBy: "system",
          createdAt,
        }),
      ),
    );
  }
  const concept = await t.run((ctx) =>
    ctx.db.insert("concepts", {
      name: "obsolete",
      displayName: "Obsolete",
      aliases: [],
      domain: "science",
      mentionCount: 2,
      hypothesisCount: 0,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  await t.mutation(internal.graph.createEdge, {
    fromType: "source",
    fromId: sourceId,
    toType: "concept",
    toId: "obsolete",
    relationship: "mentions",
    autoGenerated: true,
  });
  await t.mutation(internal.extractions.normalizeLegacyHistory, {});
  await t.mutation(internal.extractions.normalizeLegacyHistory, {});
  const job = await t.run((ctx) =>
    ctx.db.system
      .query("_scheduled_functions")
      .filter((q) => q.eq(q.field("name"), "graph:reconcileExtractionConcepts"))
      .first(),
  );
  expect(job).not.toBeNull();
  await t.mutation(internal.graph.reconcileExtractionConcepts, job!.args[0]);
  expect((await t.run((ctx) => ctx.db.get(concept)))?.mentionCount).toBe(1);
  expect((await t.run((ctx) => ctx.db.get(readings[0]!)))?.historical).toBe(
    true,
  );
  expect(await t.run((ctx) => ctx.db.query("edges").collect())).toEqual([]);
});

test("archiving drains a long displaced chain without touching newer ownership", async () => {
  const { t, sourceId, attemptId } = await setup();
  const original = (await t.run((ctx) => ctx.db.get(attemptId)))!;
  let previous = attemptId;
  const failures = [];
  for (let i = 0; i < 20; i++) {
    const next = await t.run((ctx) =>
      ctx.db.insert("extractionAttempts", {
        sourceId,
        origin: "worker",
        inputHash: original.inputHash,
        prompt: "x".repeat(900_000),
        systemPrompt: "s",
        promptVersion: original.promptVersion,
        sourceVersion: 1,
        model: "test",
        force: false,
        status: "failed",
        createdAt: 1,
        updatedAt: 1,
        displacedAttemptId: previous,
      }),
    );
    failures.push(
      await t.run((ctx) =>
        ctx.db.insert("operationFailures", {
          operationId: `extraction:${next}`,
          causeKey: "test",
          target: { kind: "extraction", attemptId: next },
          message: "failed",
          status: "needsReview",
          attempts: 3,
          createdAt: 1,
          updatedAt: 1,
          nextAttemptAt: 0,
        }),
      ),
    );
    previous = next;
  }
  await t.run((ctx) =>
    ctx.db.patch(sourceId, { activeExtractionAttemptId: previous }),
  );
  await t
    .withIdentity({ subject: "reader" })
    .mutation(api.sources.archive, { id: sourceId });
  await t.run((ctx) => ctx.db.patch(sourceId, { status: "text_ready" }));
  const newer = await t.mutation(internal.extractInternal.beginExtraction, {
    sourceId,
    model: "new",
  });
  if ("skipped" in newer) throw new Error(newer.reason);
  await t.mutation(internal.extractInternal.failExtraction, {
    attemptId: newer.attemptId,
    error: "New failure",
  });
  await drainSettlements(t);
  for (const id of failures)
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("resolved");
  expect(
    (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
  ).toBe(newer.attemptId);
  expect(
    (
      await t.run((ctx) =>
        ctx.db
          .query("operationFailures")
          .withIndex("by_operation", (q) =>
            q.eq("operationId", `extraction:${newer.attemptId}`),
          )
          .unique(),
      )
    )?.status,
  ).toBe("recorded");
});

test("a historical replacement cannot settle the displaced failure", async () => {
  const { t, sourceId, begin, failure } = await setup();
  await t
    .withIdentity({ subject: "reader" })
    .mutation(api.sources.updateText, { id: sourceId, rawText: text });
  const replacement = await begin(true);
  await t.mutation(internal.extractInternal.retainExtractionResult, {
    attemptId: replacement,
    result,
  });
  await t.withIdentity({ subject: "reader" }).mutation(api.sources.updateText, {
    id: sourceId,
    rawText: text + "Changed",
  });
  expect(
    (
      await t.action(internal.extractInternal.completeExtraction, {
        attemptId: replacement,
      })
    ).current,
  ).toBe(false);
  await drainSettlements(t);
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "recorded",
  );
});

test("archive fences the first late failure on an attempt with no prior report", async () => {
  const { t, sourceId, begin } = await setup();
  const attemptId = await begin(true);
  await t
    .withIdentity({ subject: "reader" })
    .mutation(api.sources.archive, { id: sourceId });
  await t.mutation(internal.extractInternal.failExtraction, {
    attemptId,
    error: "Late first failure",
  });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("operationFailures")
        .withIndex("by_operation", (q) =>
          q.eq("operationId", `extraction:${attemptId}`),
        )
        .unique(),
    ),
  ).toBeNull();
});

test("operator expiry preserves displaced failure lineage for a later covering import", async () => {
  const { t, sourceId, begin, failure } = await setup();
  const expired = await begin(true);
  await t.run((ctx) =>
    ctx.db.patch(expired, { updatedAt: Date.now() - 25 * 60 * 60_000 }),
  );
  await t.mutation(internal.extractInternal.reconcileAttempts, {});
  expect(
    (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
  ).toBeUndefined();
  const replacement = await begin(true);
  await t.mutation(internal.extractInternal.retainExtractionResult, {
    attemptId: replacement,
    result,
  });
  expect(
    (
      await t.action(internal.extractInternal.completeExtraction, {
        attemptId: replacement,
      })
    ).current,
  ).toBe(true);
  await drainSettlements(t);
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "resolved",
  );
});

test("archive after operator expiry still settles displaced worker recovery", async () => {
  const { t, sourceId, begin, failure } = await setup();
  const expired = await begin(true);
  await t.run((ctx) =>
    ctx.db.patch(expired, { updatedAt: Date.now() - 25 * 60 * 60_000 }),
  );
  await t.mutation(internal.extractInternal.reconcileAttempts, {});
  await t
    .withIdentity({ subject: "reader" })
    .mutation(api.sources.archive, { id: sourceId });
  await drainSettlements(t);
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "resolved",
  );
});

async function runCompletionJobs(t: ReturnType<typeof convexTest>) {
  const jobs = await t.run((ctx) =>
    ctx.db.system
      .query("_scheduled_functions")
      .filter((q) =>
        q.eq(q.field("name"), "extractInternal:completeExtraction"),
      )
      .collect(),
  );
  expect(jobs.length).toBeGreaterThan(0);
  for (const job of jobs)
    await t.action(internal.extractInternal.completeExtraction, job.args[0]);
}

test("settling displaced retained output schedules historical completion and permits bounded cron replay", async () => {
  const { t, sourceId, begin, attemptId, failure } = await setup();
  await t.mutation(internal.extractInternal.retainExtractionResult, {
    attemptId,
    result,
  });
  const replacement = await begin(true);
  await t.mutation(internal.extractInternal.retainExtractionResult, {
    attemptId: replacement,
    result,
  });
  const current = await t.action(internal.extractInternal.completeExtraction, {
    attemptId: replacement,
  });
  await drainSettlements(t);
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "resolved",
  );
  // Simulate loss/failure of the first scheduled completion: cron must retry it.
  const before = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  await t.run((ctx) =>
    ctx.db.patch(attemptId, { updatedAt: Date.now() - 16 * 60_000 }),
  );
  await t.mutation(internal.extractInternal.reconcileAttempts, {});
  const after = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  expect(
    after.some(
      (job) =>
        job.name === "extractInternal:completeExtraction" &&
        !before.some((old) => old._id === job._id),
    ),
  ).toBe(true);
  await runCompletionJobs(t);
  const attempt = (await t.run((ctx) => ctx.db.get(attemptId)))!;
  expect(attempt.status).toBe("completed");
  expect(attempt.current).toBe(false);
  expect(
    (await t.run((ctx) => ctx.db.get(attempt.extractionId!)))?.historical,
  ).toBe(true);
  expect(
    (await t.run((ctx) => ctx.db.get(current.extractionId)))?.historical,
  ).toBe(false);
  expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
    "extracted",
  );
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "resolved",
  );
});

test("late retained output after archive schedules completion without reopening recovery", async () => {
  const { t, sourceId, attemptId, failure } = await setup();
  await t
    .withIdentity({ subject: "reader" })
    .mutation(api.sources.archive, { id: sourceId });
  await t.mutation(internal.extractInternal.retainExtractionResult, {
    attemptId,
    result,
  });
  await runCompletionJobs(t);
  expect((await t.run((ctx) => ctx.db.get(attemptId)))?.current).toBe(false);
  expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
    "resolved",
  );
  expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe("archived");
});

test.each(["import", "archive"] as const)(
  "legacy owner release preserves lineage for later %s",
  async (operation) => {
    const { t, sourceId, begin, attemptId, failure } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(sourceId, {
        title: "Changed title",
        lastExtractionAttemptId: undefined,
      }),
    );
    await t.run((ctx) => ctx.db.patch(failure._id, { nextAttemptAt: 0 }));
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: failure._id,
      }),
    ).toBeNull();
    const source = (await t.run((ctx) => ctx.db.get(sourceId)))!;
    expect(source.activeExtractionAttemptId).toBeUndefined();
    expect(source.lastExtractionAttemptId).toBe(attemptId);
    if (operation === "archive")
      await t
        .withIdentity({ subject: "reader" })
        .mutation(api.sources.archive, { id: sourceId });
    else {
      const replacement = await begin(true);
      await t.mutation(internal.extractInternal.retainExtractionResult, {
        attemptId: replacement,
        result,
      });
      expect(
        (
          await t.action(internal.extractInternal.completeExtraction, {
            attemptId: replacement,
          })
        ).current,
      ).toBe(true);
    }
    await drainSettlements(t);
    expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
      "resolved",
    );
  },
);

test.each(["recorded", "investigating", "recovering"] as const)(
  "updateStatus archive settles %s extraction recovery",
  async (status) => {
    const { t, sourceId, attemptId, failure } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(failure._id, { status, nextAttemptAt: 0 }),
    );
    await t
      .withIdentity({ subject: "reader" })
      .mutation(api.sources.updateStatus, { id: sourceId, status: "archived" });
    expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
      "resolved",
    );
    expect(
      (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
    ).toBeUndefined();
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: failure._id,
      }),
    ).toBeNull();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    await runCompletionJobs(t);
    expect((await t.run((ctx) => ctx.db.get(attemptId)))?.current).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
      "archived",
    );
  },
);
