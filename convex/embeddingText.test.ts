import { describe, expect, test } from "vite-plus/test";
import {
  chunkArray,
  conceptEmbeddingText,
  EMBEDDING_DIMENSIONS,
  needsEmbedding,
  relevanceEmbeddingFields,
} from "./shared/embeddingText";

const validEmbedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1);

describe("conceptEmbeddingText", () => {
  test("combines the display name, description, and aliases", () => {
    expect(
      conceptEmbeddingText({
        displayName: " Chladni patterns ",
        description: " Standing-wave nodal figures on vibrating plates. ",
        aliases: ["Chladni figures", " nodal patterns "],
      }),
    ).toBe(
      "Chladni patterns\nStanding-wave nodal figures on vibrating plates.\nAliases: Chladni figures, nodal patterns",
    );
  });

  test("omits blank optional content", () => {
    expect(
      conceptEmbeddingText({
        displayName: "Cymatics",
        description: "  ",
        aliases: ["", "  "],
      }),
    ).toBe("Cymatics");
  });
});

describe("chunkArray", () => {
  test("preserves order across bounded chunks", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("rejects invalid chunk sizes", () => {
    expect(() => chunkArray([1], 0)).toThrow(
      "Chunk size must be a positive integer",
    );
  });
});

describe("embedding state helpers", () => {
  test("identifies missing, malformed, and stale embeddings", () => {
    expect(needsEmbedding({}, "current")).toBe(true);
    expect(
      needsEmbedding({ embedding: [], embeddingModel: "current" }, "current"),
    ).toBe(true);
    expect(
      needsEmbedding({ embedding: [1], embeddingModel: "current" }, "current"),
    ).toBe(true);
    expect(
      needsEmbedding(
        { embedding: validEmbedding, embeddingModel: "stale" },
        "current",
      ),
    ).toBe(true);
    expect(
      needsEmbedding(
        { embedding: validEmbedding, embeddingModel: "current" },
        "current",
      ),
    ).toBe(false);
  });

  test("preserves embeddings only for on-mission concepts", () => {
    const existing = {
      embedding: validEmbedding,
      embeddingModel: "current",
    };
    expect(relevanceEmbeddingFields("on", existing)).toEqual(existing);
    expect(
      relevanceEmbeddingFields("on", {
        embedding: [],
        embeddingModel: "current",
      }),
    ).toEqual({ embedding: [], embeddingModel: "current" });
    expect(
      relevanceEmbeddingFields("on", {
        embedding: [1],
        embeddingModel: "current",
      }),
    ).toEqual({ embedding: [1], embeddingModel: "current" });
    expect(relevanceEmbeddingFields("off", existing)).toEqual({
      embedding: undefined,
      embeddingModel: undefined,
    });
    expect(relevanceEmbeddingFields("unreviewed", existing)).toEqual({
      embedding: undefined,
      embeddingModel: undefined,
    });
  });
});
