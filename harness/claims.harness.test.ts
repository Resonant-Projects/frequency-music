/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

describe("extractions.backfillClaims", () => {
  test("dry-runs, backfills lifecycle state, and converges idempotently", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    const { olderExtractionId, newerExtractionId } = await t.run(
      async (ctx) => {
        const sourceId = await ctx.db.insert("sources", {
          type: "url",
          title: "Backfill source",
          status: "extracted",
          dedupeKey: "url:example.com/backfill",
          visibility: "private",
          createdBy: "system",
          createdAt: 500,
          updatedAt: 500,
        });
        const insertExtraction = (
          inputHash: string,
          createdAt: number,
          claimTexts: string[],
        ) =>
          ctx.db.insert("extractions", {
            sourceId,
            model: "test-model",
            promptVersion: "extract_v2",
            inputHash,
            summary: inputHash,
            claims: claimTexts.map((text) => ({
              text,
              evidenceLevel: "peer_reviewed" as const,
              citations: [],
            })),
            compositionParameters: [],
            topics: [],
            openQuestions: [],
            confidence: 0.8,
            createdBy: "system" as const,
            createdAt,
          });
        return {
          olderExtractionId: await insertExtraction("older", 1000, [
            "Older one",
            "Older two",
          ]),
          newerExtractionId: await insertExtraction("newer", 2000, [
            "Newer one",
          ]),
        };
      },
    );

    const firstDryPage = await asSystem.mutation(
      api.extractions.backfillClaims,
      {
        cursor: null,
        batchSize: 1,
        apply: false,
      },
    );
    expect(firstDryPage.processed).toBe(1);
    expect(firstDryPage.isDone).toBe(false);
    expect(firstDryPage.continueCursor).not.toBe("");

    const secondDryPage = await asSystem.mutation(
      api.extractions.backfillClaims,
      {
        cursor: firstDryPage.continueCursor,
        batchSize: 1,
        apply: false,
      },
    );
    expect(secondDryPage.processed).toBe(1);
    expect(secondDryPage.isDone).toBe(true);
    expect(firstDryPage.claimsInserted + secondDryPage.claimsInserted).toBe(3);
    expect(firstDryPage.skippedExisting + secondDryPage.skippedExisting).toBe(
      0,
    );
    expect(await t.run((ctx) => ctx.db.query("claims").collect())).toEqual([]);

    const dryRun = await asSystem.mutation(api.extractions.backfillClaims, {
      cursor: null,
      batchSize: 10,
      apply: false,
    });
    expect(dryRun).toMatchObject({
      processed: 2,
      claimsInserted: 3,
      skippedExisting: 0,
      isDone: true,
    });

    const applied = await asSystem.mutation(api.extractions.backfillClaims, {
      cursor: null,
      batchSize: 10,
      apply: true,
    });
    expect(applied).toMatchObject({
      processed: 2,
      claimsInserted: 3,
      skippedExisting: 0,
      isDone: true,
    });

    const { olderClaims, newerClaims } = await t.run(async (ctx) => ({
      olderClaims: await ctx.db
        .query("claims")
        .withIndex("by_extractionId_ordinal", (q) =>
          q.eq("extractionId", olderExtractionId),
        )
        .collect(),
      newerClaims: await ctx.db
        .query("claims")
        .withIndex("by_extractionId_ordinal", (q) =>
          q.eq("extractionId", newerExtractionId),
        )
        .collect(),
    }));
    expect(olderClaims.map((claim) => claim.status)).toEqual([
      "superseded",
      "superseded",
    ]);
    expect(newerClaims.map((claim) => claim.status)).toEqual(["active"]);
    expect(olderClaims.map((claim) => claim.ordinal)).toEqual([0, 1]);

    const convergence = await asSystem.mutation(
      api.extractions.backfillClaims,
      { cursor: null, batchSize: 10, apply: false },
    );
    expect(convergence).toMatchObject({
      processed: 2,
      claimsInserted: 0,
      skippedExisting: 2,
      isDone: true,
    });
    const idempotentApply = await asSystem.mutation(
      api.extractions.backfillClaims,
      { cursor: null, batchSize: 10, apply: true },
    );
    expect(idempotentApply.claimsInserted).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("claims").collect())).toHaveLength(
      3,
    );
  });
});

describe("claims read surface", () => {
  test("returns empty and ordinal-ordered extraction rows", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { emptyExtractionId, populatedExtractionId } = await t.run(
      async (ctx) => {
        const sourceId = await ctx.db.insert("sources", {
          type: "url",
          status: "extracted",
          dedupeKey: "url:example.com/read-order",
          visibility: "private",
          createdBy: "system",
          createdAt: 1000,
          updatedAt: 1000,
        });
        const insertExtraction = (inputHash: string) =>
          ctx.db.insert("extractions", {
            sourceId,
            model: "test-model",
            promptVersion: "extract_v2",
            inputHash,
            summary: inputHash,
            claims: [],
            compositionParameters: [],
            topics: [],
            openQuestions: [],
            confidence: 0.8,
            createdBy: "system" as const,
            createdAt: 1000,
          });
        const seededEmptyExtractionId = await insertExtraction("empty");
        const seededPopulatedExtractionId = await insertExtraction("populated");
        for (const ordinal of [2, 0, 1]) {
          await ctx.db.insert("claims", {
            extractionId: seededPopulatedExtractionId,
            sourceId,
            ordinal,
            text: `Claim ${ordinal}`,
            evidenceLevel: "peer_reviewed",
            citations: [],
            status: "active",
            createdBy: "system",
            createdAt: 1000,
          });
        }
        return {
          emptyExtractionId: seededEmptyExtractionId,
          populatedExtractionId: seededPopulatedExtractionId,
        };
      },
    );

    expect(
      await asSystem.query(api.claims.listByExtraction, {
        extractionId: emptyExtractionId,
      }),
    ).toEqual([]);
    const ordered = await asSystem.query(api.claims.listByExtraction, {
      extractionId: populatedExtractionId,
    });
    expect(ordered.map((claim) => claim.ordinal)).toEqual([0, 1, 2]);
  });

  test("filters superseded source rows and preserves getMany input order", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { sourceId, activeId, supersededId, deletedId } = await t.run(
      async (ctx) => {
        const seededSourceId = await ctx.db.insert("sources", {
          type: "url",
          status: "extracted",
          dedupeKey: "url:example.com/read-filter",
          visibility: "private",
          createdBy: "system",
          createdAt: 1000,
          updatedAt: 1000,
        });
        const extractionId = await ctx.db.insert("extractions", {
          sourceId: seededSourceId,
          model: "test-model",
          promptVersion: "extract_v2",
          inputHash: "read-filter",
          summary: "read-filter",
          claims: [],
          compositionParameters: [],
          topics: [],
          openQuestions: [],
          confidence: 0.8,
          createdBy: "system",
          createdAt: 1000,
        });
        const insertClaim = (text: string, status: "active" | "superseded") =>
          ctx.db.insert("claims", {
            extractionId,
            sourceId: seededSourceId,
            ordinal: status === "active" ? 1 : 0,
            text,
            evidenceLevel: "peer_reviewed",
            citations: [],
            status,
            createdBy: "system",
            createdAt: 1000,
          });
        const seededSupersededId = await insertClaim("Old", "superseded");
        const seededActiveId = await insertClaim("Current", "active");
        const seededDeletedId = await insertClaim("Deleted", "active");
        await ctx.db.delete(seededDeletedId);
        return {
          sourceId: seededSourceId,
          activeId: seededActiveId,
          supersededId: seededSupersededId,
          deletedId: seededDeletedId,
        };
      },
    );

    const active = await asSystem.query(api.claims.listBySource, { sourceId });
    expect(active.map((claim) => claim._id)).toEqual([activeId]);
    const all = await asSystem.query(api.claims.listBySource, {
      sourceId,
      includeSuperseded: true,
    });
    expect(new Set(all.map((claim) => claim._id))).toEqual(
      new Set([activeId, supersededId]),
    );

    const many = await asSystem.query(api.claims.getMany, {
      ids: [activeId, deletedId, supersededId],
    });
    expect(many.map((claim) => claim._id)).toEqual([activeId, supersededId]);
  });
});
