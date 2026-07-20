import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  needsEmbedding,
} from "../convex/shared/embeddingText";
import { modules } from "./modules";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("embedding failure isolation", () => {
  test("embedClaims warns and leaves the claim unembedded when fetch rejects", async () => {
    const t = convexTest(schema, modules);
    const claimId = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        title: "Failure isolation source",
        status: "extracted",
        dedupeKey: "url:example.com/embedding-failure",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      });
      const extractionId = await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "extract_v2",
        inputHash: "embedding-failure",
        summary: "Failure isolation fixture",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 1000,
      });
      return await ctx.db.insert("claims", {
        extractionId,
        sourceId,
        ordinal: 0,
        text: "This claim must remain writable when embeddings are down.",
        evidenceLevel: "peer_reviewed",
        citations: [],
        status: "active",
        createdBy: "system",
        createdAt: 1000,
      });
    });
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      t.action(internal.embeddings.embedClaims, { claimIds: [claimId] }),
    ).resolves.toEqual({ requested: 1, embedded: 0, skipped: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith(
      "Embedding batch failed after retries; skipping",
      "down",
    );
    expect(
      (await t.run((ctx) => ctx.db.get("claims", claimId)))?.embedding,
    ).toBe(undefined);
  });
});

describe("embedding hygiene selection", () => {
  test("filters current rows before applying the bounded candidate limit", async () => {
    const t = convexTest(schema, modules);
    const { missingClaimId } = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        status: "extracted",
        dedupeKey: "url:example.com/embedding-sweep",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      });
      const extractionId = await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "extract_v2",
        inputHash: "embedding-sweep",
        summary: "Sweep fixture",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 1000,
      });
      const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
      for (let ordinal = 0; ordinal < 2; ordinal++) {
        await ctx.db.insert("claims", {
          extractionId,
          sourceId,
          ordinal,
          text: `Current claim ${ordinal}`,
          evidenceLevel: "peer_reviewed",
          citations: [],
          status: "active",
          embedding,
          embeddingModel: EMBEDDING_MODEL,
          createdBy: "system",
          createdAt: 1000,
        });
      }
      return {
        missingClaimId: await ctx.db.insert("claims", {
          extractionId,
          sourceId,
          ordinal: 2,
          text: "Missing claim",
          evidenceLevel: "peer_reviewed",
          citations: [],
          status: "active",
          createdBy: "system",
          createdAt: 1000,
        }),
      };
    });

    const candidates = await t.query(
      internal.embeddingsStore.getSweepCandidates,
      { limit: 1, model: EMBEDDING_MODEL },
    );
    expect(candidates.claimIds).toEqual([missingClaimId]);
  });

  test("matches the canonical predicate for missing and stale rows", async () => {
    const t = convexTest(schema, modules);
    const fixtures = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        status: "extracted",
        dedupeKey: "url:example.com/embedding-parity",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      });
      const extractionId = await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "extract_v2",
        inputHash: "embedding-parity",
        summary: "Predicate parity fixture",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 1000,
      });
      const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
      const claimRows = await Promise.all(
        [
          { text: "Current", embedding, embeddingModel: EMBEDDING_MODEL },
          { text: "Missing" },
          { text: "Stale", embedding, embeddingModel: "stale-model" },
        ].map(async (row, ordinal) => ({
          id: await ctx.db.insert("claims", {
            extractionId,
            sourceId,
            ordinal,
            text: row.text,
            evidenceLevel: "peer_reviewed",
            citations: [],
            status: "active",
            embedding: row.embedding,
            embeddingModel: row.embeddingModel,
            createdBy: "system",
            createdAt: 1000,
          }),
          row,
        })),
      );
      const conceptRows = await Promise.all(
        [
          { name: "current", embedding, embeddingModel: EMBEDDING_MODEL },
          { name: "missing" },
          { name: "stale", embedding, embeddingModel: "stale-model" },
        ].map(async (row) => ({
          id: await ctx.db.insert("concepts", {
            name: row.name,
            displayName: row.name,
            aliases: [],
            domain: "general",
            missionRelevance: "on",
            embedding: row.embedding,
            embeddingModel: row.embeddingModel,
            mentionCount: 0,
            hypothesisCount: 0,
            createdAt: 1000,
            updatedAt: 1000,
          }),
          row,
        })),
      );
      return { claimRows, conceptRows };
    });

    const candidates = await t.query(
      internal.embeddingsStore.getSweepCandidates,
      { limit: 500, model: EMBEDDING_MODEL },
    );
    expect(new Set(candidates.claimIds)).toEqual(
      new Set(
        fixtures.claimRows
          .filter(({ row }) => needsEmbedding(row, EMBEDDING_MODEL))
          .map(({ id }) => id),
      ),
    );
    expect(new Set(candidates.conceptIds)).toEqual(
      new Set(
        fixtures.conceptRows
          .filter(({ row }) => needsEmbedding(row, EMBEDDING_MODEL))
          .map(({ id }) => id),
      ),
    );
    // Wrong-length vectors are covered in unit tests; Convex filters cannot
    // express that check, so model equality is the deployed-data proxy here.
  });
});
