import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { validateArtifactForPublish } from "../convex/editorialArtifacts";
import schema from "../convex/schema";
import { extractionInputHash } from "../convex/shared/extractionPrompt";
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
async function setup(transactionLimits = false) {
  const t = convexTest({ schema, modules, transactionLimits });
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
  test("published export refuses incomplete shared privacy coverage instead of returning a partial manifest", async () => {
    const { t, sourceId } = await setup(true);
    const briefId = await t.run(async (ctx) => {
      await ctx.db.patch(sourceId, { visibility: "public" });
      return ctx.db.insert("weeklyBriefs", {
        weekOf: "2026-10-11",
        model: "test",
        promptVersion: "test",
        bodyMd: "Public research",
        sourceIds: [sourceId],
        recommendedRecipeIds: [],
        recommendedHypothesisIds: [],
        visibility: "public",
        createdBy: "system",
        createdAt: 1,
      });
    });
    const addArtifact = (i: number) =>
      t.run((ctx) =>
        ctx.db.insert("editorialArtifacts", {
          kind: "experiment_recap",
          slug: `export-${i}`,
          title: "Public research",
          dek: "New work",
          bodyMd: "Independent public text",
          whyItMattersMd: "A separate finding",
          uncertaintyMd: "Limited evidence",
          evidenceStatus: "mixed",
          status: "published",
          visibility: "public",
          primaryRef: { type: "weeklyBrief", id: briefId },
          linkedIds: {
            thesisIds: [],
            hypothesisIds: [],
            recipeIds: [],
            compositionIds: [],
            listeningSessionIds: [],
            failureKeys: [],
          },
          publicEvidenceCards: [],
          createdBy: "system",
          createdAt: i,
          updatedAt: i,
        }),
      );
    await addArtifact(0);
    const initial = await t.query(
      internal.editorialArtifacts.getExportBundleInternal,
      {},
    );
    expect(initial).toHaveLength(1);
    expect(initial[0]!.validation.canPublish).toBe(true);
    for (let i = 1; i < 70; i++) await addArtifact(i);
    await expect(
      t.query(internal.editorialArtifacts.getExportBundleInternal, {}),
    ).rejects.toThrow("Published export privacy coverage is incomplete");
  });
  test("one reconciliation invocation drains its expired backlog through bounded scheduled transactions", async () => {
    vi.useFakeTimers();
    try {
      const { t, sourceId } = await setup(true);
      const attempts: Id<"extractionAttempts">[] = [];
      for (let i = 0; i < 3; i++) {
        const id =
          i === 0
            ? sourceId
            : await t.run(async (ctx) => {
                const { _id, _creationTime, ...source } = (await ctx.db.get(
                  sourceId,
                ))!;
                return ctx.db.insert("sources", {
                  ...source,
                  dedupeKey: `backlog-${i}`,
                });
              });
        const started = await t.mutation(
          internal.extractInternal.beginExtraction,
          { sourceId: id, model: "test", force: true },
        );
        attempts.push(started.attemptId!);
        await t.run((ctx) =>
          ctx.db.patch(started.attemptId!, { updatedAt: 0 }),
        );
      }
      await t.mutation(internal.extractInternal.reconcileAttempts, {});
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
      for (const id of attempts)
        expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });
  test("reconciliation does not schedule a busy loop for an unexpired generation lease", async () => {
    const { t, begin } = await setup();
    const id = await begin();
    await t.run((ctx) =>
      ctx.db.patch(id, {
        updatedAt: 0,
        generationLeaseUntil: Date.now() + 60_000,
      }),
    );
    await t.mutation(internal.extractInternal.reconcileAttempts, {});
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
      ),
    ).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("pending");
  });
  test.each([false, true])(
    "atomic completion links 300 topics within transaction limits, existing=%s",
    async (existing) => {
      const { t, sourceId, begin } = await setup(true);
      const topics = Array.from({ length: 300 }, (_, i) => `topic ${i}`);
      if (existing)
        await t.run(async (ctx) => {
          for (const topic of topics)
            await ctx.db.insert("edges", {
              fromType: "source",
              fromId: sourceId,
              toType: "concept",
              toId: topic,
              relationship: "mentions",
              autoGenerated: true,
              createdAt: 1,
              createdBy: "system",
            });
        });
      const attemptId = await begin();
      await t.mutation(internal.extractInternal.retainExtractionResult, {
        attemptId,
        result: { ...result, topics },
      });
      expect(
        (
          await t.action(internal.extractInternal.completeExtraction, {
            attemptId,
          })
        ).current,
      ).toBe(true);
      expect(
        await t.run((ctx) =>
          ctx.db
            .query("edges")
            .withIndex("by_from", (q) =>
              q.eq("fromType", "source").eq("fromId", sourceId),
            )
            .collect(),
        ),
      ).toHaveLength(300);
      const extractionId = (await t.run((ctx) => ctx.db.get(attemptId)))
        ?.extractionId;
      if (!extractionId) throw new Error("Expected committed extraction");
      expect(
        await t.mutation(internal.graph.linkExtractionConceptsAtomic, {
          extractionId,
        }),
      ).toMatchObject({ linked: 0 });
      if (!existing)
        for (const concept of await t.run((ctx) =>
          ctx.db.query("concepts").collect(),
        ))
          expect(concept.mentionCount).toBe(1);
    },
  );
  test.each([true, undefined])(
    "admission stays within read limits with large historical or unmarked hash matches: %s",
    async (historical) => {
      const { t, sourceId } = await setup(true);
      const inputHash = await extractionInputHash(text);
      for (let i = 0; i < 20; i++)
        await t.run((ctx) =>
          ctx.db.insert("extractions", {
            ...result,
            summary: "x".repeat(900_000),
            sourceId,
            historical,
            model: "legacy",
            promptVersion: "old",
            inputHash,
            confidence: 0.8,
            createdBy: "system",
            createdAt: i,
          }),
        );
      await t.run((ctx) =>
        ctx.db.insert("extractions", {
          ...result,
          sourceId,
          historical: false,
          model: "legacy",
          promptVersion: "old",
          inputHash: "different-current-input",
          confidence: 0.8,
          createdBy: "system",
          createdAt: 100,
        }),
      );
      const started = await t.mutation(
        internal.extractInternal.beginExtraction,
        {
          sourceId,
          model: "test",
        },
      );
      expect(started).toHaveProperty("attemptId");
      expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
        "extracting",
      );
      if (!started.attemptId) throw new Error("Expected admission");
      expect(
        (await t.run((ctx) => ctx.db.get(started.attemptId)))?.inputHash,
      ).toBe(inputHash);
    },
  );
  test("completion drains large obsolete readings while preserving the latest reading until atomic commit", async () => {
    const { t, sourceId, begin } = await setup(true);
    const summary = "x".repeat(900_000);
    const ids: Id<"extractions">[] = [];
    for (let i = 0; i < 20; i++)
      ids.push(
        await t.run((ctx) =>
          ctx.db.insert("extractions", {
            ...result,
            summary,
            sourceId,
            model: "legacy",
            promptVersion: "old",
            inputHash: "old",
            confidence: 0.8,
            createdBy: "system",
            createdAt: i,
          }),
        ),
      );
    for (let i = 0; i < 20; i++)
      await t.run((ctx) =>
        ctx.db.insert("claims", {
          extractionId: ids[0]!,
          sourceId,
          ordinal: i,
          text: summary,
          evidenceLevel: "peer_reviewed",
          citations: [],
          status: "active",
          createdBy: "system",
          createdAt: 1,
        }),
      );
    const latestClaim = await t.run((ctx) =>
      ctx.db.insert("claims", {
        extractionId: ids.at(-1)!,
        sourceId,
        ordinal: 0,
        text: "Current fifths",
        evidenceLevel: "peer_reviewed",
        citations: [],
        status: "active",
        createdBy: "system",
        createdAt: 1,
      }),
    );
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    expect(
      await t.mutation(internal.extractInternal.prepareRetirementBatch, {
        attemptId,
      }),
    ).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(latestClaim)))?.status).toBe(
      "active",
    );
    expect(
      (await t.query(api.extractions.getBySourceId, { sourceId }))[0]?._id,
    ).toBe(ids.at(-1));
    const completed = await t.action(
      internal.extractInternal.completeExtraction,
      { attemptId },
    );
    expect(completed.current).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(latestClaim)))?.status).toBe(
      "superseded",
    );
    for (const id of ids)
      expect((await t.run((ctx) => ctx.db.get(id)))?.historical).toBe(true);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("claims")
          .withIndex("by_extractionId_status", (q) =>
            q.eq("extractionId", ids[0]!).eq("status", "active"),
          )
          .first(),
      ),
    ).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
      "extracted",
    );
  });
  test("oversized current Claims require review without retiring evidence or losing retained output", async () => {
    const { t, sourceId, begin } = await setup(true);
    const extractionId = await t.run((ctx) =>
      ctx.db.insert("extractions", {
        ...result,
        sourceId,
        model: "legacy",
        promptVersion: "old",
        inputHash: "old",
        confidence: 0.8,
        createdBy: "system",
        createdAt: 1,
      }),
    );
    const claimIds: Id<"claims">[] = [];
    for (let ordinal = 0; ordinal < 2; ordinal++)
      claimIds.push(
        await t.run((ctx) =>
          ctx.db.insert("claims", {
            extractionId,
            sourceId,
            ordinal,
            text: "x".repeat(600_000),
            evidenceLevel: "peer_reviewed",
            citations: [],
            status: "active",
            createdBy: "system",
            createdAt: 1,
          }),
        ),
      );
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    await expect(
      t.action(internal.extractInternal.completeExtraction, { attemptId }),
    ).rejects.toThrow("Current Claim retirement requires review");
    for (const claimId of claimIds)
      expect((await t.run((ctx) => ctx.db.get(claimId)))?.status).toBe(
        "active",
      );
    expect(
      (await t.run((ctx) => ctx.db.get(extractionId)))?.historical,
    ).not.toBe(true);
    const attempt = await t.run((ctx) => ctx.db.get(attemptId));
    expect(attempt?.result).toEqual(result);
    expect(attempt?.extractionId).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
      "extracting",
    );
  });
  test("ownership changes between retirement batches preserve the latest Claims", async () => {
    const { t, sourceId, begin } = await setup();
    const ids: Id<"extractions">[] = [];
    for (let i = 0; i < 3; i++)
      ids.push(
        await t.run((ctx) =>
          ctx.db.insert("extractions", {
            ...result,
            sourceId,
            model: "legacy",
            promptVersion: "old",
            inputHash: "old",
            confidence: 0.8,
            createdBy: "system",
            createdAt: i,
          }),
        ),
      );
    const claimId = await t.run((ctx) =>
      ctx.db.insert("claims", {
        extractionId: ids[2]!,
        sourceId,
        ordinal: 0,
        text: "Original current reading",
        evidenceLevel: "peer_reviewed",
        citations: [],
        status: "active",
        createdBy: "system",
        createdAt: 1,
      }),
    );
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    await t.mutation(internal.extractInternal.prepareRetirementBatch, {
      attemptId,
    });
    const newer = await t.mutation(internal.extractInternal.beginExtraction, {
      sourceId,
      model: "newer",
      force: true,
    });
    expect(
      (
        await t.action(internal.extractInternal.completeExtraction, {
          attemptId,
        })
      ).current,
    ).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(claimId)))?.status).toBe("active");
    expect((await t.run((ctx) => ctx.db.get(ids[2]!)))?.historical).not.toBe(
      true,
    );
    expect(
      (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
    ).toBe(newer.attemptId);
  });
  test("large legacy normalization advances and drains oversized obsolete Claims across ticks", async () => {
    const { t, sourceId } = await setup(true);
    const summary = "x".repeat(900_000);
    const ids: Id<"extractions">[] = [];
    for (let i = 0; i < 20; i++)
      ids.push(
        await t.run((ctx) =>
          ctx.db.insert("extractions", {
            ...result,
            summary,
            sourceId,
            model: "legacy",
            promptVersion: "old",
            inputHash: "old",
            confidence: 0.8,
            createdBy: "system",
            createdAt: i,
          }),
        ),
      );
    for (let i = 0; i < 20; i++)
      await t.run((ctx) =>
        ctx.db.insert("claims", {
          extractionId: ids[0]!,
          sourceId,
          ordinal: i,
          text: summary,
          evidenceLevel: "peer_reviewed",
          citations: [],
          status: "active",
          createdBy: "system",
          createdAt: 1,
        }),
      );
    await t.mutation(internal.extractions.normalizeLegacyHistory, {});
    expect(
      (await t.run((ctx) => ctx.db.get(ids[0]!)))?.historical,
    ).toBeUndefined();
    vi.useFakeTimers();
    try {
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    } finally {
      vi.useRealTimers();
    }
    for (const id of ids)
      expect((await t.run((ctx) => ctx.db.get(id)))?.historical).toBe(
        id !== ids.at(-1),
      );
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("claims")
          .withIndex("by_extractionId_status", (q) =>
            q.eq("extractionId", ids[0]!).eq("status", "active"),
          )
          .first(),
      ),
    ).toBeNull();
  });
  test("large same-cause failures form readable investigation groups and accept diagnoses", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const rawText = text
      .repeat(Math.ceil(900_000 / text.length))
      .slice(0, 900_000);
    const failures = [];
    for (let i = 0; i < 20; i++) {
      const sourceId = await t.run((ctx) =>
        ctx.db.insert("sources", {
          type: "url",
          title: `Large:${i}`,
          rawText,
          dedupeKey: `Large:${i}`,
          status: "text_ready",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      const { attemptId } = await t.mutation(
        internal.extractInternal.beginExtraction,
        { sourceId, model: "test", force: true },
      );
      await t.mutation(internal.extractInternal.failExtraction, {
        attemptId: attemptId!,
        error: "429 rate limit",
      });
      const failure = (await t.run((ctx) =>
        ctx.db
          .query("operationFailures")
          .withIndex("by_operation", (q) =>
            q.eq("operationId", `extraction:${attemptId}`),
          )
          .unique(),
      ))!;
      await t.run((ctx) =>
        ctx.db.patch(failure._id, { attempts: 2, nextAttemptAt: 0 }),
      );
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: failure._id,
      });
      failures.push((await t.run((ctx) => ctx.db.get(failure._id)))!);
    }
    const runs = new Set(failures.map((row) => row.investigationRunId!));
    expect(runs.size).toBe(7);
    for (const agentRunId of runs) {
      await t.run((ctx) => ctx.db.patch(agentRunId, { status: "running" }));
      const evidence = await t.query(
        internal.operationFailures.getInvestigation,
        { agentRunId },
      );
      expect(evidence.length).toBeLessThanOrEqual(3);
      expect(
        evidence.every(
          (row) =>
            !row.unsupportedReason &&
            row.evidence.sourceStatus === "review_needed",
        ),
      ).toBe(true);
      await t.mutation(internal.operationFailures.submitDiagnosis, {
        agentRunId,
        result: { diagnosis: "Transient rate limit", recover: true },
      });
    }
    for (const row of failures)
      expect((await t.run((ctx) => ctx.db.get(row._id)))?.status).toBe(
        "recorded",
      );
  });
  test("concurrent identical-text completion preserves the duplicate archive", async () => {
    const { t, sourceId } = await setup();
    const otherId = await t.run(async (ctx) => {
      const {
        _id: _ignoredId,
        _creationTime: _ignoredTime,
        ...source
      } = (await ctx.db.get(sourceId))!;
      return ctx.db.insert("sources", { ...source, dedupeKey: "other:fifths" });
    });
    const attempts = [];
    for (const id of [sourceId, otherId]) {
      const started = await t.mutation(
        internal.extractInternal.beginExtraction,
        { sourceId: id, model: id === sourceId ? "test" : "different-model" },
      );
      attempts.push(started.attemptId!);
      await t.mutation(internal.extractInternal.retainExtractionResult, {
        attemptId: started.attemptId!,
        result:
          id === sourceId
            ? result
            : {
                ...result,
                summary: "Different retained output",
                claims: [],
                compositionParameters: [
                  { kind: "frequency", type: "frequency", value: "440" },
                ],
              },
      });
    }
    const first = await t.action(internal.extractInternal.completeExtraction, {
      attemptId: attempts[0]!,
    });
    const duplicate = await t.action(
      internal.extractInternal.completeExtraction,
      { attemptId: attempts[1]! },
    );
    expect(duplicate).toMatchObject({ ...first, current: false });
    expect(
      await t.action(internal.extractInternal.completeExtraction, {
        attemptId: attempts[1]!,
      }),
    ).toEqual(duplicate);
    expect(await t.run((ctx) => ctx.db.get(otherId))).toMatchObject({
      status: "archived",
      blockedReason: "duplicate",
    });
  });
  test("metadata-only edits release obsolete ownership after generation failure", async () => {
    const { t, sourceId, begin } = await setup();
    const attemptId = await begin();
    await t.run((ctx) => ctx.db.patch(sourceId, { title: "Changed fifths" }));
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "429 rate limit",
    });
    const source = await t.run((ctx) => ctx.db.get(sourceId));
    expect(source?.status).toBe("text_ready");
    expect(source?.activeExtractionAttemptId).toBeUndefined();
    expect(await begin()).not.toBe(attemptId);
  });
  test("reconciliation stays within read limits across large worker, operator and generated queues", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const transcript = text
      .repeat(Math.ceil(400_000 / text.length))
      .slice(0, 400_000);
    for (const origin of ["worker", "operator", "generated"] as const) {
      for (let i = 0; i < 20; i++) {
        const sourceId = await t.run((ctx) =>
          ctx.db.insert("sources", {
            type: "youtube",
            title: `${origin}:${i}`,
            transcript,
            dedupeKey: `${origin}:${i}`,
            status: "text_ready",
            visibility: "private",
            createdBy: "system",
            createdAt: 1,
            updatedAt: 1,
          }),
        );
        const started = await t.mutation(
          internal.extractInternal.beginExtraction,
          {
            sourceId,
            model: "test",
            force: true,
            ...(origin === "operator"
              ? { expectedInputHash: await extractionInputHash(transcript) }
              : {}),
          },
        );
        if (origin === "generated")
          await t.mutation(internal.extractInternal.retainExtractionResult, {
            attemptId: started.attemptId!,
            result,
          });
        await t.run((ctx) =>
          ctx.db.patch(started.attemptId!, {
            updatedAt: Date.now() - 25 * 60 * 60_000,
          }),
        );
      }
    }
    await t.mutation(internal.extractInternal.reconcileAttempts, {});
    const attempts = await t.run((ctx) =>
      ctx.db.query("extractionAttempts").collect(),
    );
    expect(attempts.filter((row) => row.error)).toHaveLength(3);
    expect(
      attempts.filter(
        (row) => row.origin === "operator" && row.status === "failed",
      ),
    ).toHaveLength(1);
    expect(
      attempts.filter(
        (row) => row.origin === "worker" && row.status === "failed",
      ),
    ).toHaveLength(1);
    expect(
      attempts.filter((row) => row.status === "generated" && row.error),
    ).toHaveLength(1);
  });
  test("manual success resolves an investigating failure before a late diagnosis", async () => {
    const { t, begin } = await setup();
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "429 rate limit",
    });
    const failure = (await t.run((ctx) =>
      ctx.db.query("operationFailures").first(),
    ))!;
    await t.run((ctx) =>
      ctx.db.patch(failure._id, { attempts: 2, nextAttemptAt: 0 }),
    );
    await t.mutation(internal.operationFailures.claimRecovery, {
      failureId: failure._id,
    });
    const investigating = (await t.run((ctx) => ctx.db.get(failure._id)))!;
    expect(investigating.status).toBe("investigating");
    await t.run((ctx) =>
      ctx.db.patch(investigating.investigationRunId!, { status: "running" }),
    );
    expect(await begin()).toBe(attemptId);
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    await t.action(internal.extractInternal.completeExtraction, {
      attemptId,
    });
    expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
      "resolved",
    );
    await t.mutation(internal.operationFailures.submitDiagnosis, {
      agentRunId: investigating.investigationRunId!,
      result: { diagnosis: "Already completed", recover: false },
    });
    expect((await t.run((ctx) => ctx.db.get(failure._id)))?.status).toBe(
      "resolved",
    );
  });
  test("one model's transient and authentication failures receive separate investigations", async () => {
    const { t, sourceId } = await setup();
    const failures = [];
    for (const error of ["429 rate limit", "401 invalid API key"]) {
      const { attemptId } = await t.mutation(
        internal.extractInternal.beginExtraction,
        {
          sourceId,
          model: "same-model",
          force: true,
        },
      );
      await t.mutation(internal.extractInternal.failExtraction, {
        attemptId: attemptId!,
        error,
      });
      const failure = (await t.run((ctx) =>
        ctx.db
          .query("operationFailures")
          .withIndex("by_operation", (q) =>
            q.eq("operationId", `extraction:${attemptId}`),
          )
          .unique(),
      ))!;
      await t.run((ctx) =>
        ctx.db.patch(failure._id, { attempts: 2, nextAttemptAt: 0 }),
      );
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: failure._id,
      });
      failures.push((await t.run((ctx) => ctx.db.get(failure._id)))!);
      // A new snapshot needs changed metadata instead of reusing the failed one.
      await t.run((ctx) => ctx.db.patch(sourceId, { title: "Changed fifths" }));
    }
    expect(failures[0]!.causeKey).not.toBe(failures[1]!.causeKey);
    expect(failures[0]!.investigationRunId).not.toBe(
      failures[1]!.investigationRunId,
    );
  });
  test("metadata-only edits release an owned historical completion for another admission", async () => {
    const t = convexTest(schema, modules);
    const operator = t.withIdentity({ subject: "system" });
    const url = "https://example.org/fifths";
    const { id: sourceId } = await operator.mutation(
      api.sources.createFromUrlInput,
      {
        url,
        title: "Fifths",
        rawText: text,
      },
    );
    const { attemptId } = await t.mutation(
      internal.extractInternal.beginExtraction,
      {
        sourceId,
        model: "test",
        force: true,
      },
    );
    expect(
      await operator.action(api.sources.createFromUrlAndQueue, {
        url,
        title: "Renamed fifths",
        rawText: text,
      }),
    ).toMatchObject({ id: sourceId, contentChanged: false, queued: false });
    expect(await t.run((ctx) => ctx.db.get(sourceId))).toMatchObject({
      status: "extracting",
      activeExtractionAttemptId: attemptId,
    });
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId: attemptId!,
      result,
    });
    const completed = await t.action(
      internal.extractInternal.completeExtraction,
      {
        attemptId: attemptId!,
      },
    );
    expect(completed.current).toBe(false);
    expect(
      await t.run((ctx) => ctx.db.get(completed.extractionId)),
    ).toMatchObject({ historical: true });
    const source = await t.run((ctx) => ctx.db.get(sourceId));
    expect(source?.status).toBe("text_ready");
    expect(source?.activeExtractionAttemptId).toBeUndefined();
    const next = await t.mutation(internal.extractInternal.beginExtraction, {
      sourceId,
      model: "test",
      force: true,
    });
    expect(next.attemptId).toBeDefined();
    expect(next.attemptId).not.toBe(attemptId);
  });
  test("completion and current readers skip more than 16 MiB of retained history", async () => {
    const { t, sourceId, begin } = await setup(true);
    const summary = "x".repeat(400_000);
    for (let batch = 0; batch < 6; batch++) {
      await t.run(async (ctx) => {
        for (let i = 0; i < 8; i++)
          await ctx.db.insert("extractions", {
            ...result,
            summary,
            sourceId,
            historical: true,
            model: "old",
            promptVersion: "old",
            inputHash: "old",
            confidence: 0.8,
            createdBy: "system",
            createdAt: 1000 + batch * 8 + i,
          });
      });
    }
    const previous = await t.run((ctx) =>
      ctx.db.insert("extractions", {
        ...result,
        sourceId,
        model: "legacy",
        promptVersion: "old",
        inputHash: "old",
        confidence: 0.8,
        createdBy: "system",
        createdAt: 1,
      }),
    );
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    const completed = await t.action(
      internal.extractInternal.completeExtraction,
      { attemptId },
    );
    expect(completed.current).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(previous)))?.historical).toBe(true);
    expect(
      (await t.query(api.extractions.getBySourceId, { sourceId })).map(
        (row) => row._id,
      ),
    ).toEqual([completed.extractionId]);
    expect(
      (await t.query(api.extractions.listRecent, {})).map((row) => row._id),
    ).toEqual([completed.extractionId]);
    const { validation, independent } = await t.run(async (ctx) => {
      const briefId = await ctx.db.insert("weeklyBriefs", {
        weekOf: "2026-10-11",
        model: "test",
        promptVersion: "test",
        bodyMd: "Independent public material",
        recommendedRecipeIds: [],
        visibility: "private",
        createdBy: "system",
        recommendedHypothesisIds: [],
        sourceIds: [sourceId],
        createdAt: 1,
      });
      const artifactId = await ctx.db.insert("editorialArtifacts", {
        kind: "experiment_recap",
        slug: "history-check",
        title: "Unrelated public material",
        dek: "New work",
        bodyMd: "Independent public text",
        whyItMattersMd: "A separate finding",
        uncertaintyMd: "Limited evidence",
        evidenceStatus: "mixed",
        status: "approved",
        visibility: "public",
        primaryRef: { type: "weeklyBrief", id: briefId },
        linkedIds: {
          thesisIds: [],
          hypothesisIds: [],
          recipeIds: [],
          compositionIds: [],
          listeningSessionIds: [],
          failureKeys: [],
        },
        publicEvidenceCards: [],
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const artifact = (await ctx.db.get(artifactId))!;
      const budget = { bytes: 4_000_000, rows: 128, complete: true };
      const validation = await validateArtifactForPublish(
        ctx.db,
        artifact,
        budget,
      );
      const campaignId = await ctx.db.insert("campaigns", {
        title: "Independent campaign",
        question: "What changes?",
        status: "active",
        thesisIds: [],
        visibility: "public",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const independent = await validateArtifactForPublish(
        ctx.db,
        {
          ...artifact,
          primaryRef: { type: "campaign", id: campaignId },
        },
        budget,
      );
      return { validation, independent };
    });
    expect(validation.canPublish).toBe(false);
    expect(
      validation.checks.find((check) => check.key === "privacyCoverage")?.ok,
    ).toBe(false);
    expect(independent.canPublish).toBe(true);
  });
  test("an interrupted claimed retry returns to reconciliation after its lease expires", async () => {
    const { t, sourceId, begin } = await setup();
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "transient generation failure",
    });
    expect(await begin()).toBe(attemptId);
    expect(
      await t.mutation(internal.extractInternal.claimGeneration, {
        attemptId,
        lease: "retry",
      }),
    ).toBe(true);
    expect(await t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
      status: "pending",
      generationLease: "retry",
    });
    await t.run((ctx) =>
      ctx.db.patch(attemptId, {
        updatedAt: Date.now() - 16 * 60_000,
        generationLeaseUntil: Date.now() - 1,
      }),
    );
    await t.mutation(internal.extractInternal.reconcileAttempts, {});
    expect(await t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
      status: "failed",
      error: "Extraction interrupted before completion",
    });
    expect(await t.run((ctx) => ctx.db.get(sourceId))).toMatchObject({
      status: "review_needed",
      blockedReason: "ai_error",
    });
  });
  test("current lists advance through legacy duplicate rows to fill distinct Source readings", async () => {
    const { t, sourceId } = await setup();
    const expected = await t.run(async (ctx) => {
      const {
        _id: _ignoredId,
        _creationTime: _ignoredTime,
        ...source
      } = (await ctx.db.get(sourceId))!;
      const otherIds = [];
      for (let i = 0; i < 2; i++)
        otherIds.push(
          await ctx.db.insert("sources", {
            ...source,
            dedupeKey: `current-list:${i}`,
          }),
        );
      const base = {
        model: "legacy",
        promptVersion: "old",
        inputHash: "old",
        ...result,
        confidence: 0.8,
        createdBy: "system" as const,
      };
      const old = await ctx.db.insert("extractions", {
        ...base,
        sourceId: otherIds[0]!,
        createdAt: 20,
      });
      const mixed = await ctx.db.insert("extractions", {
        ...base,
        sourceId: otherIds[1]!,
        historical: false,
        createdAt: 450,
      });
      let newest;
      for (let i = 0; i < 600; i++)
        newest = await ctx.db.insert("extractions", {
          ...base,
          sourceId,
          createdAt: 100 + i,
        });
      return [newest, mixed, old];
    });
    expect(
      (await t.query(api.extractions.listRecent, { limit: 3 })).map(
        (row) => row._id,
      ),
    ).toEqual(expected);
  });
  test("operator snapshots expire admission but late paid output remains importable as history", async () => {
    const { t, sourceId } = await setup();
    const admitted = await t.mutation(
      internal.extractInternal.beginExtraction,
      {
        sourceId,
        model: "test",
        expectedInputHash: await extractionInputHash(text),
      },
    );
    const attemptId = admitted.attemptId!;
    await t.run((ctx) =>
      ctx.db.patch(attemptId, { updatedAt: Date.now() - 25 * 60 * 60_000 }),
    );
    await t.mutation(internal.extractInternal.reconcileAttempts, {});
    expect(await t.run((ctx) => ctx.db.get(sourceId))).toMatchObject({
      status: "text_ready",
    });
    expect(
      (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
    ).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
      status: "failed",
    });
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
    });
    expect(
      (
        await t.action(internal.extractInternal.completeExtraction, {
          attemptId,
        })
      ).current,
    ).toBe(false);
  });
  test("legacy normalization keeps only the newest reading and excludes large history from bounded lists", async () => {
    const { t, sourceId } = await setup();
    const ids = await t.run(async (ctx) => {
      const ids = [];
      for (let i = 0; i < 25; i++)
        ids.push(
          await ctx.db.insert("extractions", {
            sourceId,
            model: "legacy",
            promptVersion: "old",
            inputHash: "old",
            ...result,
            confidence: 0.8,
            createdBy: "system",
            createdAt: i,
          }),
        );
      for (let i = 0; i < 500; i++)
        await ctx.db.insert("extractions", {
          sourceId,
          historical: true,
          model: "old",
          promptVersion: "old",
          inputHash: "old",
          ...result,
          confidence: 0.8,
          createdBy: "system",
          createdAt: 1000 + i,
        });
      return ids;
    });
    vi.useFakeTimers();
    try {
      await t.mutation(internal.extractions.normalizeLegacyHistory, {});
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    } finally {
      vi.useRealTimers();
    }
    expect(
      (await t.query(api.extractions.listRecent, { limit: 10000 })).map(
        (row) => row._id,
      ),
    ).toEqual([ids[24]]);
    for (const id of ids)
      expect((await t.run((ctx) => ctx.db.get(id)))?.historical).toBe(
        id !== ids[24],
      );
  });
  test("saving identical text during an in-flight call still completes current without re-admission", async () => {
    const { t, sourceId } = await setup();
    const started = await t.mutation(internal.extractInternal.beginExtraction, {
      sourceId,
      model: "test",
    });
    const attemptId = started.attemptId!;
    expect(
      await t.mutation(internal.extractInternal.claimGeneration, {
        attemptId,
        lease: "running",
      }),
    ).toBe(true);
    await t
      .withIdentity({ subject: "operator" })
      .mutation(api.sources.updateText, { id: sourceId, rawText: text });
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
      generationLease: "running",
    });
    expect(
      await t.action(internal.extractInternal.completeExtraction, {
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

  test.each([false, true])(
    "a legacy import retires worker ownership before another identical-text save, force=%s",
    async (force) => {
      const { t, sourceId } = await setup();
      const original = await t.mutation(
        internal.extractInternal.beginExtraction,
        { sourceId, model: "test", force },
      );
      const attemptId = original.attemptId!;
      await t.mutation(internal.extractInternal.failExtraction, {
        attemptId,
        error: "temporary",
      });
      await t
        .withIdentity({ subject: "operator" })
        .mutation(api.sources.updateText, { id: sourceId, rawText: text });
      expect(
        await t.mutation(internal.extractInternal.storeOperatorExtraction, {
          sourceId,
          model: "operator",
          inputHash: await extractionInputHash(text),
          ...result,
        }),
      ).toMatchObject({ success: true });
      expect(
        (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
      ).toBeUndefined();
      await t
        .withIdentity({ subject: "operator" })
        .mutation(api.sources.updateText, { id: sourceId, rawText: text });
      // Scheduled resume bypasses beginExtraction, so its lease admission must refuse too.
      await expect(
        t.mutation(internal.extractInternal.claimGeneration, {
          attemptId,
          lease: "scheduled",
        }),
      ).rejects.toThrow("Only retained output");
      expect(
        await t.mutation(internal.extractInternal.beginExtraction, {
          sourceId,
          model: "test",
        }),
      ).toMatchObject({ skipped: true, reason: "already extracted" });
      expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
        "extracted",
      );
      await expect(
        t.mutation(internal.extractInternal.claimGeneration, {
          attemptId,
          lease: "retry",
        }),
      ).rejects.toThrow("Only retained output");
      expect(
        await t.run((ctx) => ctx.db.query("extractionAttempts").collect()),
      ).toHaveLength(1);
    },
  );

  test("recovery cannot start generation after diagnosis loses snapshot ownership", async () => {
    const { t, sourceId, begin } = await setup();
    const attemptId = await begin();
    await t.mutation(internal.extractInternal.failExtraction, {
      attemptId,
      error: "temporary",
    });
    const failure = (await t.run((ctx) =>
      ctx.db.query("operationFailures").first(),
    ))!;
    await t.run((ctx) =>
      ctx.db.patch(failure._id, {
        diagnosis: "Transient, retry",
        nextAttemptAt: 0,
      }),
    );
    const recoveryAttempt = await t.mutation(
      internal.operationFailures.claimRecovery,
      { failureId: failure._id },
    );
    // Another request takes ownership between the recovery claim and its action.
    const newer = await t.mutation(internal.extractInternal.beginExtraction, {
      sourceId,
      model: "newer",
      force: true,
    });
    await expect(
      t.mutation(internal.extractInternal.claimGeneration, {
        attemptId,
        lease: "obsolete",
      }),
    ).rejects.toThrow("Only retained output");
    await t.action(internal.recoveryWorkflows.execute, {
      failureId: failure._id,
      attempt: recoveryAttempt!,
    });
    const old = await t.query(internal.extractInternal.getAttempt, {
      attemptId,
    });
    expect(old?.generationLease).toBeUndefined();
    expect(old?.result).toBeUndefined();
    expect(
      (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
    ).toBe(newer.attemptId);
  });

  test("generation already in flight can finish its original snapshot after ownership changes", async () => {
    const { t, sourceId, begin } = await setup();
    const attemptId = await begin();
    expect(
      await t.mutation(internal.extractInternal.claimGeneration, {
        attemptId,
        lease: "in-flight",
      }),
    ).toBe(true);
    const newer = await t.mutation(internal.extractInternal.beginExtraction, {
      sourceId,
      model: "newer",
      force: true,
    });
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId,
      result,
      generationLease: "in-flight",
    });
    expect(
      await t.action(internal.extractInternal.completeExtraction, {
        attemptId,
      }),
    ).toMatchObject({ current: false });
    expect(
      (await t.run((ctx) => ctx.db.get(sourceId)))?.activeExtractionAttemptId,
    ).toBe(newer.attemptId);
  });

  test("legacy history and late snapshots stay out of current readers and dashboard projections", async () => {
    const { t, sourceId, begin } = await setup();
    const legacyIds = await t.run(async (ctx) => {
      const ids = [];
      for (const createdAt of [10, 20, 30])
        ids.push(
          await ctx.db.insert("extractions", {
            sourceId,
            model: "legacy",
            promptVersion: "old",
            inputHash: "old",
            ...result,
            topics: ["geometry"],
            compositionParameters: [{ kind: "frequency", value: "440" }],
            confidence: 0.8,
            createdBy: "system",
            createdAt,
          }),
        );
      return ids;
    });
    expect(
      (await t.query(api.extractions.getBySourceId, { sourceId })).map(
        (row) => row._id,
      ),
    ).toEqual([legacyIds[2]]);
    expect(
      (await t.query(api.extractions.listRecent, {})).map((row) => row._id),
    ).toEqual([legacyIds[2]]);
    expect(
      (
        await t.query(internal.hypotheses.listUnlinkedBatchCandidates, {
          limit: 50,
          minClaims: 1,
        })
      ).map((row) => row._id),
    ).toEqual([legacyIds[2]]);
    const old = await begin();
    const newer = await t.mutation(internal.extractInternal.beginExtraction, {
      sourceId,
      model: "newer",
      force: true,
    });
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId: newer.attemptId!,
      result: { ...result, topics: ["music"] },
    });
    const current = await t.action(
      internal.extractInternal.completeExtraction,
      { attemptId: newer.attemptId! },
    );
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId: old,
      result: { ...result, topics: ["geometry"] },
    });
    await t.action(internal.extractInternal.completeExtraction, {
      attemptId: old,
    });
    const pipeline = await t.query(api.dashboard.pipelineItems, {});
    expect(pipeline.extractions.map((row) => row._id)).toEqual([
      current.extractionId,
    ]);
    const sectors = await t.query(api.dashboard.zodiacSectors, {});
    expect(sectors.find((row) => row.id === "music")).toMatchObject({
      sources: 1,
      claims: 1,
    });
    expect(sectors.find((row) => row.id === "geometry")).toMatchObject({
      sources: 0,
      claims: 0,
    });
    for (const id of legacyIds)
      expect((await t.run((ctx) => ctx.db.get(id)))?.historical).toBe(true);
  });

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
    const completed = await t.action(
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

  test.each([false, true])(
    "attempt reuse preserves the requested force policy, original force=%s",
    async (force) => {
      const { t, sourceId } = await setup();
      const original = await t.mutation(
        internal.extractInternal.beginExtraction,
        {
          sourceId,
          model: "test",
          force,
        },
      );
      expect(
        await t.mutation(internal.extractInternal.beginExtraction, {
          sourceId,
          model: "test",
          force,
        }),
      ).toEqual(original);
      const changed = await t.mutation(
        internal.extractInternal.beginExtraction,
        {
          sourceId,
          model: "test",
          force: !force,
        },
      );
      expect(changed).not.toEqual(original);
      expect(
        (
          await t.run((ctx) => ctx.db.query("extractionAttempts").collect())
        ).map((attempt) => attempt.force),
      ).toEqual([force, !force]);
    },
  );

  test.each([false, true])(
    "saving unchanged text re-admits the owned attempt as current, retained output=%s",
    async (retained) => {
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
        await t.action(internal.extractInternal.completeExtraction, {
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
    },
  );

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
    const first = await t.action(internal.extractInternal.completeExtraction, {
      attemptId,
    });
    expect(first.current).toBe(true);
    expect(
      await t.action(internal.extractInternal.completeExtraction, {
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
    const latest = await t.action(internal.extractInternal.completeExtraction, {
      attemptId: recent,
    });
    await t.mutation(internal.extractInternal.retainExtractionResult, {
      attemptId: old,
      result,
    });
    const late = await t.action(internal.extractInternal.completeExtraction, {
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
        await t.action(internal.extractInternal.completeExtraction, {
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
        await t.action(internal.extractInternal.completeExtraction, {
          attemptId,
        })
      ).current,
    ).toBe(true);
  });
});
