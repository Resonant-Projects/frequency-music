import { describe, expect, test } from "vite-plus/test";
import {
  EXTRACT_SYSTEM_PROMPT,
  extractionInputHash,
} from "../../convex/shared/extractionPrompt.ts";
import { buildChunks, parseResults } from "./operator-extraction.ts";

const text = (topic: string) =>
  `${topic} is studied here with measurements, a model of the effect and a discussion of what the results mean for tuning and timbre. `.repeat(
    3,
  );

describe("operator extraction chunks", () => {
  test("chunks extractable Sources with their prompt and inputHash", async () => {
    const sources = ["A", "B", "C"].map((id) => ({
      _id: `source-${id}`,
      title: `Paper ${id}`,
      canonicalUrl: `https://example.org/${id}`,
      type: "rss",
      rawText: text(`Topic ${id}`),
    }));
    const { chunks, unextractable } = await buildChunks(sources, {
      model: "anthropic/claude-opus-5.5",
      chunkSize: 2,
    });
    expect(unextractable).toEqual([]);
    expect(chunks.map((chunk) => chunk.items.length)).toEqual([2, 1]);
    const [first] = chunks;
    expect(first).toMatchObject({
      promptVersion: "extract_v2",
      model: "anthropic/claude-opus-5.5",
      system: EXTRACT_SYSTEM_PROMPT,
    });
    expect(first?.items[0]).toMatchObject({
      sourceId: "source-A",
      title: "Paper A",
      url: "https://example.org/A",
      inputHash: await extractionInputHash(text("Topic A")),
    });
    expect(first?.items[0]?.prompt).toContain("Title: Paper A");
    expect(first?.items[0]?.prompt).toContain("Topic A is studied");
  });

  test("uses a transcript when there is no raw text, and sets aside unextractable text", async () => {
    const { chunks, unextractable } = await buildChunks(
      [
        { _id: "video", title: "Talk", transcript: text("Cymatics") },
        { _id: "teaser", rawText: "Read more at the link." },
        { _id: "empty" },
      ],
      { model: "m", chunkSize: 20 },
    );
    expect(chunks[0]?.items.map((item) => item.sourceId)).toEqual(["video"]);
    expect(unextractable.map((entry) => entry.sourceId)).toEqual([
      "teaser",
      "empty",
    ]);
  });
});

describe("operator extraction results", () => {
  const hash = "a".repeat(64);
  const file = (results: unknown, model = "anthropic/claude-opus-5.5") =>
    JSON.stringify({ model, results });

  test("reads well-formed results", () => {
    expect(
      parseResults(
        file([
          { sourceId: "s1", inputHash: hash, extraction: { summary: "x" } },
        ]),
        "anthropic/claude-opus-5.5",
      ).results,
    ).toEqual([
      { sourceId: "s1", inputHash: hash, extraction: { summary: "x" } },
    ]);
  });

  test("rejects another model, malformed entries and repeated Sources", () => {
    const expected = "anthropic/claude-opus-5.5";
    expect(() =>
      parseResults(file([], "openai/gpt-6.1-sol"), expected),
    ).toThrow("is not anthropic/claude-opus-5.5");
    expect(() =>
      parseResults(
        file([{ sourceId: "s1", inputHash: "short", extraction: {} }]),
        expected,
      ),
    ).toThrow("results[0]");
    expect(() =>
      parseResults(file([{ sourceId: "s1", inputHash: hash }]), expected),
    ).toThrow("results[0]");
    const entry = { sourceId: "s1", inputHash: hash, extraction: {} };
    expect(() => parseResults(file([entry, entry]), expected)).toThrow(
      "repeats source s1",
    );
    expect(() => parseResults("[]", expected)).toThrow();
  });
});
