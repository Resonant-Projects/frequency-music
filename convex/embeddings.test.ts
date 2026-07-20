import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { fetchEmbeddingBatch } from "./embeddings";

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
});
