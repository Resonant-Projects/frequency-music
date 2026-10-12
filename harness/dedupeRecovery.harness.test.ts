import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { generateDedupeKey } from "../convex/sourceUtils";
import { modules } from "./modules";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test.each([false, true])(
  "dedupe collision archives and settles the %s winning-row case",
  async (incomingWins) => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const url = "https://example.org/collision";
    const key = generateDedupeKey("url", { canonicalUrl: url });
    const ids: Id<"sources">[] = [];
    for (const [dedupeKey, status] of [
      ["legacy-key", incomingWins ? "triaged" : "text_ready"],
      [key, incomingWins ? "text_ready" : "triaged"],
    ] as const) {
      ids.push(
        await t.run((ctx) =>
          ctx.db.insert("sources", {
            type: "url",
            canonicalUrl: url,
            rawText: "Resonance in music research. ".repeat(10),
            status,
            dedupeKey,
            visibility: "private",
            createdBy: "system",
            createdAt: 1,
            updatedAt: 1,
          }),
        ),
      );
    }
    const archivedId = ids[incomingWins ? 1 : 0]!;
    const winnerId = ids[incomingWins ? 0 : 1]!;
    const admitted = await t.mutation(
      internal.extractInternal.beginExtraction,
      { sourceId: archivedId, model: "test" },
    );
    if ("skipped" in admitted) throw new Error(admitted.reason);
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId: admitted.attemptId,
      error: "Provider timeout",
    });
    const extractionFailure = (await t.run((ctx) =>
      ctx.db.query("operationFailures").first(),
    ))!;
    // Neither canonical body nor archive lookup can settle capture after a holder key moves.
    for (const id of ids)
      await t.run((ctx) => ctx.db.patch(id, { rawText: undefined }));
    const captureFailures: Id<"operationFailures">[] = [];
    for (let i = 0; i < 8; i++)
      captureFailures.push(
        await t.run((ctx) =>
          ctx.db.insert("operationFailures", {
            operationId: `capture:migration-${i}`,
            captureDedupeKey: key,
            causeKey: "capture",
            target: {
              kind: "capture",
              input: { url, query: "q", rationale: "r" },
            },
            message: "failed",
            status: "investigating",
            attempts: 2,
            createdAt: 1,
            updatedAt: 1,
            nextAttemptAt: 0,
          }),
        ),
      );
    const dry = await t
      .withIdentity({ subject: "operator" })
      .mutation(api.sources.recomputeDedupeKeys, {
        cursor: null,
        batchSize: 1,
        apply: false,
      });
    expect(dry.collisionsArchived).toBe(0);
    expect(
      (await t.run((ctx) => ctx.db.get(archivedId)))?.activeExtractionAttemptId,
    ).toBe(admitted.attemptId);
    const result = await t
      .withIdentity({ subject: "operator" })
      .mutation(api.sources.recomputeDedupeKeys, {
        cursor: null,
        batchSize: 1,
        apply: true,
      });
    expect(result.collisionsArchived).toBe(1);
    const archived = (await t.run((ctx) => ctx.db.get(archivedId)))!;
    expect(archived.status).toBe("archived");
    expect(archived.activeExtractionAttemptId).toBeUndefined();
    expect(archived.lastExtractionAttemptId).toBe(admitted.attemptId);
    const visited = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const jobs = await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
      );
      const job = jobs.find(
        (row) =>
          !visited.has(row._id) &&
          [
            "operationFailures:settleArchivedSource",
            "operationFailures:settleCaptured",
            "operationFailures:settleExtractionChain",
          ].includes(row.name),
      );
      if (!job) break;
      const ref =
        job.name === "operationFailures:settleArchivedSource"
          ? internal.operationFailures.settleArchivedSource
          : job.name === "operationFailures:settleCaptured"
            ? internal.operationFailures.settleCaptured
            : internal.operationFailures.settleExtractionChain;
      await t.mutation(ref, job.args[0]);
      visited.add(job._id);
    }
    expect(
      (await t.run((ctx) => ctx.db.get(extractionFailure._id)))?.status,
    ).toBe("resolved");
    for (const id of captureFailures)
      expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("resolved");
    expect((await t.run((ctx) => ctx.db.get(winnerId)))?.status).toBe(
      "triaged",
    );
  },
);

test("a queued migration settlement cannot close capture recovery after the surviving Source changes", async () => {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const url = "https://example.org/reset";
  const dedupeKey = generateDedupeKey("url", { canonicalUrl: url });
  const archivedId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "url",
      canonicalUrl: url,
      status: "archived",
      dedupeKey: "retired",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const winnerId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "url",
      canonicalUrl: url,
      status: "triaged",
      dedupeKey,
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  await t
    .withIdentity({ subject: "operator" })
    .mutation(api.sources.updateStatus, { id: winnerId, status: "ingested" });
  const failureId = await t.run((ctx) =>
    ctx.db.insert("operationFailures", {
      operationId: "capture:reset",
      captureDedupeKey: dedupeKey,
      causeKey: "capture",
      target: { kind: "capture", input: { url, query: "q", rationale: "r" } },
      message: "failed",
      status: "recorded",
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nextAttemptAt: 0,
    }),
  );
  const args = {
    sourceId: archivedId,
    dedupeKeys: [dedupeKey],
    capturedAt: Date.now(),
    winnerId,
    winnerUpdatedAt: 1,
  };
  await t.mutation(internal.operationFailures.settleArchivedSource, args);
  await t.mutation(internal.operationFailures.settleCaptured, {
    dedupeKey,
    capturedAt: Date.now(),
    archiveFence: { sourceId: archivedId, winnerId, winnerUpdatedAt: 1 },
  });
  expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
    "recorded",
  );
});
