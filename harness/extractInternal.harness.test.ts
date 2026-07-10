import { describe, expect, test } from "bun:test";
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
    expect(extraction?.compositionParameters[0].kind).toBe("drive_frequency");
    expect(extraction?.createdBy).toBe("system");

    const kinds = await t.run((ctx) =>
      ctx.db.query("parameterKinds").collect(),
    );
    expect(kinds).toHaveLength(1);
    expect(kinds[0].name).toBe("drive_frequency");
  });
});
