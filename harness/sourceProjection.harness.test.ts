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
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./modules";

describe("Source recovery and projection", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test.each(["recorded", "investigating", "recovering"] as const)(
    "archiving settles a %s capture failure and fences queued work",
    async (status) => {
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
      const input = {
        url: "https://example.org/unavailable",
        query: "q",
        rationale: "r",
      };
      const source = await t.mutation(internal.sources.createScoutedSource, {
        ...input,
        agentRunId: runId,
      });
      await t
        .withIdentity({ subject: "reader" })
        .mutation(api.sources.updateStatus, {
          id: source.id,
          status: "review_needed",
          blockedReason: "no_text",
        });
      const failureId = await t.mutation(
        internal.operationFailures.reportCaptureFailure,
        { agentRunId: runId, input, stage: "capture" },
      );
      await t.run((ctx) =>
        ctx.db.patch(failureId, {
          nextAttemptAt: 0,
          attempts: status === "investigating" ? 2 : 0,
        }),
      );
      let assigned: Id<"agentRuns"> | undefined;
      if (status !== "recorded") {
        const attempt = await t.mutation(
          internal.operationFailures.claimRecovery,
          { failureId },
        );
        if (status === "recovering")
          await t.mutation(internal.operationFailures.dispatch, {
            failureId,
            attempt: attempt!,
          });
        const failure = (await t.run((ctx) => ctx.db.get(failureId)))!;
        assigned = failure.investigationRunId ?? failure.recoveryRunId;
      }
      const original = (await t.run((ctx) => ctx.db.get(source.id)))!;
      await t
        .withIdentity({ subject: "reader" })
        .mutation(api.sources.archiveRecoverySource, {
          id: source.id,
          expectedUpdatedAt: original.updatedAt,
        });
      expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
        "resolved",
      );
      expect(
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        }),
      ).toBeNull();
      if (assigned) {
        await t.run((ctx) => ctx.db.patch(assigned!, { status: "running" }));
        if (status === "recovering")
          expect(
            await t.query(internal.operationFailures.getCaptureRecovery, {
              agentRunId: assigned,
            }),
          ).toBeNull();
        else {
          expect(
            await t.query(internal.operationFailures.getInvestigation, {
              agentRunId: assigned,
            }),
          ).toEqual([]);
          await t.mutation(internal.operationFailures.submitDiagnosis, {
            agentRunId: assigned,
            result: { diagnosis: "Retry stale capture", recover: true },
          });
        }
      }
      // Covers a queued row while bounded settlement has not reached it yet.
      await t.run((ctx) =>
        ctx.db.patch(failureId, { status: "recorded", nextAttemptAt: 0 }),
      );
      expect(
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        }),
      ).toBeNull();
      expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
        "resolved",
      );
      expect((await t.run((ctx) => ctx.db.get(source.id)))?.status).toBe(
        "archived",
      );
    },
  );

  test("replacement topics withdraw obsolete automatic mentions while preserving shared and manual evidence", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const sourceId = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        rawText: "Music research about resonance. ".repeat(10),
        status: "text_ready",
        dedupeKey: "projection",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    async function complete(topics: string[]) {
      const prepared = await t.mutation(
        internal.extractInternal.beginExtraction,
        { sourceId, model: "test", force: true },
      );
      if ("skipped" in prepared) throw new Error(prepared.reason);
      await t.mutation(internal.extractInternal.retainExtractionResult, {
        attemptId: prepared.attemptId,
        result: {
          summary: "Current reading",
          claims: [],
          topics,
          openQuestions: [],
          compositionParameters: [],
        },
      });
      return t.action(internal.extractInternal.completeExtraction, {
        attemptId: prepared.attemptId,
      });
    }
    const first = await complete(["old", "shared"]);
    const other = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        status: "extracted",
        dedupeKey: "other",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await t.mutation(internal.graph.createEdge, {
      fromType: "source",
      fromId: other,
      toType: "concept",
      toId: "old",
      relationship: "mentions",
      autoGenerated: true,
    });
    const oldConcept = (await t.run((ctx) =>
      ctx.db
        .query("concepts")
        .withIndex("by_name", (q) => q.eq("name", "old"))
        .unique(),
    ))!;
    await t.mutation(internal.graph.incrementMentions, {
      conceptId: oldConcept._id,
    });
    await t.mutation(internal.graph.createEdge, {
      fromType: "source",
      fromId: sourceId,
      toType: "concept",
      toId: "manual",
      relationship: "mentions",
      autoGenerated: false,
    });
    const second = await complete(["new", " SHARED "]);
    // Execute only cleanup continuations; classifier jobs remain inspection fixtures.
    let job = await t.run((ctx) =>
      ctx.db.system
        .query("_scheduled_functions")
        .filter((q) =>
          q.eq(q.field("name"), "graph:reconcileExtractionConcepts"),
        )
        .order("desc")
        .first(),
    );
    for (let tick = 0; job && tick < 20; tick++) {
      await t.mutation(internal.graph.reconcileExtractionConcepts, job.args[0]);
      const previous = job._id;
      job = await t.run((ctx) =>
        ctx.db.system
          .query("_scheduled_functions")
          .filter((q) =>
            q.eq(q.field("name"), "graph:reconcileExtractionConcepts"),
          )
          .order("desc")
          .first(),
      );
      if (job?._id === previous) break;
    }
    const edges = await t
      .withIdentity({ subject: "reader" })
      .query(api.graph.getEdgesFrom, {
        fromType: "source",
        fromId: sourceId,
        relationship: "mentions",
      });
    expect(edges.map((e) => e.toId).sort()).toEqual([
      "manual",
      "new",
      "shared",
    ]);
    expect(
      (await t.run((ctx) => ctx.db.get(oldConcept._id)))?.mentionCount,
    ).toBe(1);
    const shared = (await t.run((ctx) =>
      ctx.db
        .query("concepts")
        .withIndex("by_name", (q) => q.eq("name", "shared"))
        .unique(),
    ))!;
    expect(shared.mentionCount).toBe(1);
    expect(
      (await t.run((ctx) => ctx.db.get(first.extractionId)))?.historical,
    ).toBe(true);
    await t.mutation(internal.graph.reconcileExtractionConcepts, {
      extractionId: first.extractionId,
    });
    await t.mutation(internal.graph.linkExtractionConceptsAtomic, {
      extractionId: second.extractionId,
    });
    expect((await t.run((ctx) => ctx.db.get(shared._id)))?.mentionCount).toBe(
      1,
    );
  });
  test("obsolete projection cleanup drains large Concept documents through separate transactions", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const sourceId = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        status: "extracted",
        dedupeKey: "large-projection",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const extractionId = await t.run((ctx) =>
      ctx.db.insert("extractions", {
        sourceId,
        inputHash: "current",
        summary: "Current reading",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        model: "test",
        promptVersion: "extract_v3",
        confidence: 1,
        historical: false,
        createdBy: "system",
        createdAt: 2,
      }),
    );
    const conceptIds: Id<"concepts">[] = [];
    for (let i = 0; i < 20; i++) {
      conceptIds.push(
        await t.run((ctx) =>
          ctx.db.insert("concepts", {
            name: `obsolete-${i}`,
            displayName: `Obsolete ${i}`,
            aliases: [],
            description: "x".repeat(900_000),
            domain: "science",
            mentionCount: 1,
            hypothesisCount: 0,
            createdAt: 1,
            updatedAt: 1,
          }),
        ),
      );
      await t.mutation(internal.graph.createEdge, {
        fromType: "source",
        fromId: sourceId,
        toType: "concept",
        toId: `obsolete-${i}`,
        relationship: "mentions",
        autoGenerated: true,
      });
    }
    let args: {
      extractionId: typeof extractionId;
      cursor?: string;
      topicsHash?: string;
    } = { extractionId };
    for (let tick = 0; tick < 21; tick++) {
      const previous = await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").order("desc").first(),
      );
      await t.mutation(internal.graph.reconcileExtractionConcepts, args);
      const next = await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").order("desc").first(),
      );
      if (next?._id === previous?._id) break;
      expect(next?.name).toBe("graph:reconcileExtractionConcepts");
      args = next!.args[0];
    }
    expect(
      await t
        .withIdentity({ subject: "reader" })
        .query(api.graph.getEdgesFrom, {
          fromType: "source",
          fromId: sourceId,
        }),
    ).toEqual([]);
    for (const id of conceptIds)
      expect((await t.run((ctx) => ctx.db.get(id)))?.mentionCount).toBe(0);
    await t.mutation(internal.graph.reconcileExtractionConcepts, {
      extractionId,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(conceptIds[0]!)))?.mentionCount,
    ).toBe(0);
  });
});
