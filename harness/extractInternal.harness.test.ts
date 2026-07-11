import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

describe("extractInternal.storeExtraction", () => {
  test("inserts an extraction with normalized composition parameters", async () => {
    const t = convexTest(schema, modules);

    const sourceId = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        title: "Cymatics overview",
        status: "extracting",
        dedupeKey: "url:example.com/cymatics",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    const extractionId = await t.mutation(
      internal.extractInternal.storeExtraction,
      {
        sourceId,
        model: "anthropic/claude-sonnet-4-6",
        promptVersion: "extract_v2",
        inputHash: "hash-1",
        summary:
          "Chladni patterns depend on plate geometry and drive frequency.",
        claims: [
          {
            text: "Nodal line count increases with drive frequency",
            evidenceLevel: "peer_reviewed",
            citations: [{ label: "Jenny 1967" }],
          },
        ],
        compositionParameters: [
          // kind omitted: handler derives it from type
          { type: "drive_frequency", value: "432 Hz" },
        ],
        topics: ["cymatics"],
        openQuestions: [],
        confidence: 0.8,
      },
    );

    const extraction = await t.run((ctx) => ctx.db.get(extractionId));
    expect(extraction?.sourceId).toBe(sourceId);
    expect(extraction?.claims).toHaveLength(1);
    // The handler backfills kind from type and consults the vocabulary registry.
    expect(extraction?.compositionParameters[0]!.kind).toBe("drive_frequency");
    expect(extraction?.createdBy).toBe("system");

    const kinds = await t.run((ctx) =>
      ctx.db.query("parameterKinds").collect(),
    );
    expect(kinds).toHaveLength(1);
    expect(kinds[0]!.name).toBe("drive_frequency");
  });

  test("emits ordered claim rows and supersedes them on re-extraction", async () => {
    const t = convexTest(schema, modules);

    const sourceId = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        title: "Claim provenance source",
        status: "extracting",
        dedupeKey: "url:example.com/claim-provenance",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    const store = (inputHash: string, texts: string[]) =>
      t.mutation(internal.extractInternal.storeExtraction, {
        sourceId,
        model: "test-model",
        promptVersion: "extract_v2",
        inputHash,
        summary: `Extraction ${inputHash}`,
        claims: texts.map((text) => ({
          text,
          evidenceLevel: "peer_reviewed" as const,
          truthConfidence: "high" as const,
          interestLevel: "medium" as const,
          citations: [{ url: `https://example.com/${inputHash}` }],
        })),
        compositionParameters: [],
        topics: ["cymatics"],
        openQuestions: [],
        confidence: 0.9,
      });

    const firstExtractionId = await store("first", [
      "First claim",
      "Second claim",
      "Third claim",
    ]);

    const firstRows = await t.run((ctx) =>
      ctx.db
        .query("claims")
        .withIndex("by_extractionId_ordinal", (q) =>
          q.eq("extractionId", firstExtractionId),
        )
        .collect(),
    );
    const firstExtraction = await t.run((ctx) => ctx.db.get(firstExtractionId));
    expect(
      firstRows.map(({ ordinal, text, status }) => ({
        ordinal,
        text,
        status,
      })),
    ).toEqual([
      { ordinal: 0, text: "First claim", status: "active" },
      { ordinal: 1, text: "Second claim", status: "active" },
      { ordinal: 2, text: "Third claim", status: "active" },
    ]);
    expect(firstRows.every((row) => row.sourceId === sourceId)).toBe(true);
    expect(
      firstRows.every(
        (row) =>
          row.extractionId === firstExtractionId &&
          row.createdBy === "system" &&
          row.createdAt === firstExtraction?.createdAt,
      ),
    ).toBe(true);

    const secondExtractionId = await store("second", ["Replacement claim"]);
    const { superseded, active } = await t.run(async (ctx) => ({
      superseded: await ctx.db
        .query("claims")
        .withIndex("by_extractionId_ordinal", (q) =>
          q.eq("extractionId", firstExtractionId),
        )
        .collect(),
      active: await ctx.db
        .query("claims")
        .withIndex("by_extractionId_ordinal", (q) =>
          q.eq("extractionId", secondExtractionId),
        )
        .collect(),
    }));

    expect(superseded.map((row) => row.status)).toEqual([
      "superseded",
      "superseded",
      "superseded",
    ]);
    expect(superseded.every((row) => row.supersededBy === undefined)).toBe(
      true,
    );
    expect(active.map(({ ordinal, status }) => ({ ordinal, status }))).toEqual([
      { ordinal: 0, status: "active" },
    ]);
  });
});
