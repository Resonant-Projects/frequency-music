import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { fetchEmbeddingBatch, parseEmbeddingResponse } from "./embeddings";
import { EMBEDDING_DIMENSIONS } from "./shared/embeddingText";

const embedding = (value: number) =>
  Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchEmbeddingBatch", () => {
  test("warns and resolves without throwing after two retries", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.fn();

    await expect(
      fetchEmbeddingBatch({
        texts: ["A claim"],
        apiKey: "test-key",
        sleep: async () => {},
        warn,
      }),
    ).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith(
      "Embedding batch failed after retries; skipping",
      "down",
    );
  });

  test("uses Retry-After for rate limits and caps the delay", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "30" },
        }),
      )
      .mockRejectedValue(new Error("down"));
    const wait = vi.fn(async () => {});

    await fetchEmbeddingBatch({
      texts: ["A claim"],
      apiKey: "test-key",
      fetchImpl: fetchMock,
      sleep: wait,
      warn: vi.fn(),
    });

    expect(wait).toHaveBeenNthCalledWith(1, 10_000);
    expect(wait).toHaveBeenNthCalledWith(2, 500);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("parseEmbeddingResponse", () => {
  test("orders embeddings by response index", () => {
    expect(
      parseEmbeddingResponse(
        {
          data: [
            { index: 1, embedding: embedding(2) },
            { index: 0, embedding: embedding(1) },
          ],
        },
        2,
      ),
    ).toEqual([embedding(1), embedding(2)]);
  });

  test.each([
    {
      name: "wrong item count",
      response: { data: [{ index: 0, embedding: embedding(1) }] },
      expectedCount: 2,
    },
    {
      name: "dimension mismatch",
      response: { data: [{ index: 0, embedding: [1] }] },
      expectedCount: 1,
    },
    {
      name: "non-finite value",
      response: {
        data: [
          {
            index: 0,
            embedding: [...embedding(1).slice(0, -1), Number.NaN],
          },
        ],
      },
      expectedCount: 1,
    },
  ])("rejects $name", ({ response, expectedCount }) => {
    expect(parseEmbeddingResponse(response, expectedCount)).toBeNull();
  });
});
