import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

const text =
  "Pure fifths have a frequency ratio of three to two. A chain of twelve pure fifths does not equal seven octaves. This difference is called the Pythagorean comma. ";
const result = {
  summary: "Pure fifths",
  claims: [
    {
      text: "Fifths use 3:2",
      evidenceLevel: "peer_reviewed" as const,
      citations: [],
    },
  ],
  compositionParameters: [],
  topics: [],
  openQuestions: [],
};
async function setup() {
  const t = convexTest(schema, modules);
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "url",
      title: "Fifths",
      rawText: text,
      status: "text_ready",
      dedupeKey: "url:fifths",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const begin = async () => {
    const started = await t.mutation(internal.extractInternal.beginExtraction, {
      sourceId,
      model: "test",
      force: true,
    });
    if (!started.attemptId) throw new Error("Expected attempt");
    return started.attemptId;
  };
  return { t, sourceId, begin };
}
describe("Extraction completion", () => {
  test("recovery completes concept links using the retained extraction result", async () => {
    const { t, sourceId, begin } = await setup();
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result: { ...result, topics: ["Pythagorean comma"] },
    });
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "commit interrupted",
    });
    const failure = await t.run((ctx) =>
      ctx.db.query("operationFailures").first(),
    );
    await t.run((ctx) => ctx.db.patch(failure!._id, { nextAttemptAt: 0 }));
    const attempt = await t.mutation(internal.operationFailures.claimRecovery, {
      failureId: failure!._id,
    });
    await t.action(internal.recoveryWorkflows.execute, {
      failureId: failure!._id,
      attempt: attempt!,
    });
    expect(
      (
        await t.query(internal.operationFailures.getForRecovery, {
          failureId: failure!._id,
        })
      )?.status,
    ).toBe("resolved");
    const edges = await t.run((ctx) => ctx.db.query("edges").collect());
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: sourceId,
          toId: "pythagorean comma",
          relationship: "mentions",
        }),
      ]),
    );
    const completed = await t.mutation(
      internal.extractInternal.completeExtraction,
      { attemptId },
    );
    await t.action(internal.graph.linkExtractionConcepts, {
      extractionId: completed.extractionId,
    });
    expect(
      (await t.run((ctx) => ctx.db.query("concepts").collect()))[0]
        ?.mentionCount,
    ).toBe(1);
  });

  test("retry admission reuses the failed attempt instead of creating a new failure budget", async () => {
    const { t, begin } = await setup();
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "temporary",
    });
    expect(await begin()).toBe(attemptId);
    expect(
      await t.run((ctx) => ctx.db.query("extractionAttempts").collect()),
    ).toHaveLength(1);
  });

  test.each([
    false,
    true,
  ])("saving unchanged text re-admits the owned attempt as current, retained output=%s", async (retained) => {
    const { t, sourceId, begin } = await setup();
    const attemptId = await begin();
    if (retained)
      await t.mutation(internal.extractInternal.retainExtractionResult, {
        attemptId,
        result,
      });
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "interrupted",
    });
    await t
      .withIdentity({ subject: "operator" })
      .mutation(api.sources.updateText, {
        id: sourceId,
        rawText: text,
      });
    expect(await begin()).toBe(attemptId);
    expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
      "extracting",
    );
    if (!retained)
      await t.mutation(internal.extractInternal.retainExtractionResult, {
        attemptId,
        result,
      });
    expect(
      await t.mutation(internal.extractInternal.completeExtraction, {
        attemptId,
      }),
    ).toMatchObject({ current: true });
    expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
      "extracted",
    );
    expect(
      await t.mutation(internal.extractInternal.beginExtraction, {
        sourceId,
        model: "test",
      }),
    ).toMatchObject({ skipped: true, reason: "already extracted" });
    expect(
      await t.run((ctx) => ctx.db.query("extractionAttempts").collect()),
    ).toHaveLength(1);
  });

  test("concurrent generation is fenced and a lost action becomes recoverable", async () => {
    const { t, begin } = await setup();
    const attemptId = await begin();
    expect(
      await t.mutation(internal.extractInternal.claimGeneration, {
        attemptId,
        lease: "first",
      }),
    ).toBe(true);
    expect(
      await t.mutation(internal.extractInternal.claimGeneration, {
        attemptId,
        lease: "second",
      }),
    ).toBe(false);
    await expect(
      t.mutation(internal.extractInternal.retainExtractionResult, {
        attemptId,
        result,
        generationLease: "second",
      }),
    ).rejects.toThrow("lease changed");
    await t.run((ctx) =>
      ctx.db.patch(attemptId, { updatedAt: 0, generationLeaseUntil: 0 }),
    );
    await t.mutation(internal.extractInternal.reconcileAttempts, {});
    const attempt = await t.query(internal.extractInternal.getAttempt, {
      attemptId,
    });
    expect(attempt?.status).toBe("failed");
    expect(
      await t.run((ctx) => ctx.db.query("operationFailures").collect()),
    ).toHaveLength(1);
    expect(
      await t.mutation(internal.extractInternal.claimGeneration, {
        attemptId,
        lease: "third",
      }),
    ).toBe(true);
  });

  test("commits Claims and Source status together, with exact input and idempotent retry", async () => {
    const { t, sourceId, begin } = await setup();
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    const first = await t.mutation(
      internal.extractInternal.completeExtraction,
      { attemptId },
    );
    expect(first.current).toBe(true);
    expect(
      await t.mutation(internal.extractInternal.completeExtraction, {
        attemptId,
      }),
    ).toEqual(first);
    await t.run(async (ctx) => {
      expect((await ctx.db.get(sourceId))?.status).toBe("extracted");
      expect((await ctx.db.get(attemptId))?.prompt).toContain(text);
      expect(await ctx.db.query("claims").collect()).toMatchObject([
        { status: "active", extractionId: first.extractionId },
      ]);
      expect(await ctx.db.query("extractions").collect()).toHaveLength(1);
    });
  });
  test("a late old result does not supersede a newer reading", async () => {
    const { t, sourceId, begin } = await setup();
    const old = await begin();
    await t.run((ctx) =>
      ctx.db.patch(sourceId, {
        rawText: text + "New research revises this reading.",
        status: "text_ready",
      }),
    );
    const recent = await begin();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId: recent,
      result,
    });
    const latest = await t.mutation(
      internal.extractInternal.completeExtraction,
      { attemptId: recent },
    );
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId: old,
      result,
    });
    const late = await t.mutation(internal.extractInternal.completeExtraction, {
      attemptId: old,
    });
    expect(late.current).toBe(false);
    expect(
      (await t.query(api.extractions.getBySourceId, { sourceId })).map(
        (row) => row._id,
      ),
    ).toEqual([latest.extractionId]);
    expect(
      await t.query(api.extractions.getBySourceId, {
        sourceId,
        includeHistorical: true,
      }),
    ).toHaveLength(2);
    await t.run(async (ctx) => {
      const active = await ctx.db
        .query("claims")
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();
      expect(active.map((c) => c.extractionId)).toEqual([latest.extractionId]);
      expect((await ctx.db.get(late.extractionId))?.historical).toBe(true);
    });
  });
  test("an archived Source stays archived while its result is retained", async () => {
    const { t, sourceId, begin } = await setup();
    const attemptId = await begin();
    await t.run((ctx) => ctx.db.patch(sourceId, { status: "archived" }));
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    expect(
      (
        await t.mutation(internal.extractInternal.completeExtraction, {
          attemptId,
        })
      ).current,
    ).toBe(false);
    expect(
      await t.run(async (ctx) => (await ctx.db.get(sourceId))?.status),
    ).toBe("archived");
  });
  test("a commit retry reuses a retained result without model generation", async () => {
    const { t, begin } = await setup();
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "transient",
    });
    expect(await begin()).toBe(attemptId);
    expect(
      (
        await t.mutation(internal.extractInternal.completeExtraction, {
          attemptId,
        })
      ).current,
    ).toBe(true);
  });
});
