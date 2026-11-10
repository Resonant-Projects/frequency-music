/* eslint-disable no-underscore-dangle */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { linkedExtractionIds } from "./hypothesisLinks";
import schema from "./schema";

const claim = {
  text: "A testable claim",
  evidenceLevel: "peer_reviewed" as const,
  citations: [],
};

/** One Source with one current extraction that meets `minClaims: 2`. */
async function insertExtraction(ctx: MutationCtx, key: string) {
  const sourceId = await ctx.db.insert("sources", {
    type: "url",
    title: `Source ${key}`,
    canonicalUrl: `https://example.com/${key}`,
    status: "extracted",
    dedupeKey: `url:example.com/${key}`,
    visibility: "private",
    createdBy: "system",
    createdAt: 1000,
    updatedAt: 1000,
  });
  const extractionId = await ctx.db.insert("extractions", {
    sourceId,
    model: "test-model",
    promptVersion: "test-v1",
    inputHash: key,
    summary: `Extraction ${key}`,
    claims: [claim, claim],
    compositionParameters: [{ kind: "tuning", type: "tuning", value: "432Hz" }],
    topics: ["tuning"],
    openQuestions: [],
    confidence: 0.8,
    createdBy: "system",
    createdAt: 1000,
  });
  return { sourceId, extractionId };
}

/** Extractions a and b share one hypothesis; c is cited by none. */
async function seedTwoExtractionHypothesis() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const a = await insertExtraction(ctx, "a");
    const b = await insertExtraction(ctx, "b");
    const c = await insertExtraction(ctx, "c");
    await ctx.db.insert("hypotheses", {
      title: "Synthesis across two Sources",
      question: "Do both Sources agree?",
      hypothesis: "Yes",
      rationaleMd: "Fixture",
      sourceIds: [a.sourceId, b.sourceId],
      extractionIds: [a.extractionId, b.extractionId],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1100,
      updatedAt: 1100,
    });
    return { a: a.extractionId, b: b.extractionId, c: c.extractionId };
  });
  return { t, ...ids };
}

describe("hypothesis extraction links", () => {
  test("every extraction a multi-extraction hypothesis cites counts as linked", async () => {
    const { t, a, b, c } = await seedTwoExtractionHypothesis();
    // A Set is not a Convex value, so it leaves t.run as a sorted array.
    const linked = await t.run(async (ctx) =>
      [...(await linkedExtractionIds(ctx.db))].toSorted(),
    );
    expect(linked).toEqual([a, b].toSorted());
    expect(linked).not.toContain(c);
  });

  test("the batch skips extractions cited inside a multi-extraction hypothesis", async () => {
    const { t, c } = await seedTwoExtractionHypothesis();
    const candidates = await t.query(
      internal.hypotheses.listUnlinkedBatchCandidates,
      { limit: 5, minClaims: 2 },
    );
    expect(candidates.map((candidate) => candidate._id)).toEqual([c]);
  });
});
