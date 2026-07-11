/* eslint-disable no-underscore-dangle */
import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

describe("batch hypothesis candidates", () => {
  test("uses extraction provenance to skip an already-linked extraction", async () => {
    const t = convexTest(schema, modules);
    const { unlinkedId } = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        title: "Candidate source",
        canonicalUrl: "https://example.com/candidate",
        status: "extracted",
        dedupeKey: "url:example.com/candidate",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      });
      const insertExtraction = (inputHash: string) =>
        ctx.db.insert("extractions", {
          sourceId,
          model: "test-model",
          promptVersion: "test-v1",
          inputHash,
          summary: "Candidate extraction",
          claims: [
            {
              text: "A testable claim",
              evidenceLevel: "peer_reviewed" as const,
              citations: [],
            },
            {
              text: "Another testable claim",
              evidenceLevel: "peer_reviewed" as const,
              citations: [],
            },
          ],
          compositionParameters: [
            { kind: "tuning", type: "tuning", value: "432Hz" },
          ],
          topics: ["tuning"],
          openQuestions: [],
          confidence: 0.8,
          createdBy: "system",
          createdAt: 1000,
        });

      const unlinkedId = await insertExtraction("unlinked");
      const linkedId = await insertExtraction("linked");
      await ctx.db.insert("hypotheses", {
        title: "Existing hypothesis",
        question: "Already generated?",
        hypothesis: "Yes",
        rationaleMd: "Harness fixture",
        sourceIds: [sourceId],
        extractionIds: [linkedId],
        status: "draft",
        visibility: "private",
        createdBy: "system",
        createdAt: 1100,
        updatedAt: 1100,
      });
      return { unlinkedId };
    });

    const candidates = await t.query(
      internal.hypotheses.listUnlinkedBatchCandidates,
      { limit: 1, minClaims: 2 },
    );

    expect(candidates.map((candidate) => candidate._id)).toEqual([unlinkedId]);
  });
});
