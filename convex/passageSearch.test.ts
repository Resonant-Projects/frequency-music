import { MockEmbeddingModelV4 } from "ai/test";
import { expect, test, vi } from "vite-plus/test";
import type { ActionCtx } from "./_generated/server";
import { searchPassages } from "./passageSearch";

test("considers later candidates after a top hit exceeds the remaining budget", async () => {
  const sourceIds = ["article", "transcript", "short-article"];
  // Pin component ranking and live provenance at the retrieval boundary. The
  // real caller must pack before applying its requested result count.
  const ctx = {
    runQuery: vi.fn(async () =>
      sourceIds.map((sourceId) => ({ sourceId, status: "text_ready" })),
    ),
    runAction: vi.fn(async () => ({
      entries: sourceIds.map((key, index) => ({
        entryId: `entry-${index}`,
        key,
        status: "ready",
      })),
      results: [6_000, 7_000, 500].map((chars, index) => ({
        entryId: `entry-${index}`,
        score: 1 - index / 10,
        order: 0,
        startOrder: 0,
        content: [{ text: "x".repeat(chars) }],
      })),
    })),
  } as unknown as ActionCtx;
  const rag = {
    getNamespace: vi.fn(async () => ({ namespaceId: "local-test" })),
    options: {
      textEmbeddingModel: new MockEmbeddingModelV4({
        doEmbed: async ({ values }) => ({
          embeddings: values.map(() => [0]),
          warnings: [],
        }),
      }),
    },
  } as unknown as Parameters<typeof searchPassages>[2];

  const result = await searchPassages(ctx, { query: "packing", limit: 2 }, rag);
  expect(result.passages.map((passage) => passage.sourceId)).toEqual([
    "article",
    "short-article",
  ]);
  expect(result).toMatchObject({ truncated: true, omitted: 1 });
  const one = await searchPassages(ctx, { query: "packing", limit: 1 }, rag);
  expect(one.passages.map((passage) => passage.sourceId)).toEqual(["article"]);
  expect(one).toMatchObject({ truncated: true, omitted: 2 });
});
