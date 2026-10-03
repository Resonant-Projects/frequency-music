import { describe, expect, test } from "vite-plus/test";
import { EXTRACT_SYSTEM_PROMPT } from "../../convex/shared/extractionPrompt.ts";
import {
  buildChunks,
  extractionProblems,
  parseResults,
} from "./operator-extraction.ts";

const text = (topic: string) =>
  `${topic} is studied here with measurements, a model of the effect and a discussion of what the results mean for tuning and timbre. `.repeat(
    3,
  );

describe("operator extraction chunks", () => {
  const row = (id: string, extra: Record<string, unknown> = {}) => ({
    sourceId: `source-${id}`,
    title: `Paper ${id}`,
    canonicalUrl: `https://example.org/${id}`,
    type: "rss",
    inputHash: id.repeat(64).slice(0, 64),
    content: text(`Topic ${id}`),
    ...extra,
  });

  test("chunks extractable Sources with their prompt and inputHash", () => {
    const { chunks, unextractable } = buildChunks(
      [row("a"), row("b"), row("c")],
      { model: "anthropic/claude-opus-5.5", chunkSize: 2 },
    );
    expect(unextractable).toEqual([]);
    expect(chunks.map((chunk) => chunk.items.length)).toEqual([2, 1]);
    const [first] = chunks;
    expect(first).toMatchObject({
      promptVersion: "extract_v2",
      model: "anthropic/claude-opus-5.5",
      system: EXTRACT_SYSTEM_PROMPT,
    });
    expect(first?.items[0]).toMatchObject({
      sourceId: "source-a",
      title: "Paper a",
      url: "https://example.org/a",
      inputHash: "a".repeat(64),
    });
    expect(first?.items[0]?.prompt).toContain("Title: Paper a");
    expect(first?.items[0]?.prompt).toContain("Topic a is studied");
  });

  test("sets aside text the gate refused, keeping its hash for parking", () => {
    const { chunks, unextractable } = buildChunks(
      [
        row("v"),
        row("t", { unextractable: "Captured text is a feed excerpt" }),
        row("e", {
          inputHash: undefined,
          content: "",
          unextractable: "no text",
        }),
      ],
      { model: "m", chunkSize: 20 },
    );
    expect(chunks[0]?.items.map((item) => item.sourceId)).toEqual(["source-v"]);
    expect(unextractable).toEqual([
      {
        sourceId: "source-t",
        reason: "Captured text is a feed excerpt",
        inputHash: "t".repeat(64),
      },
      { sourceId: "source-e", reason: "no text" },
    ]);
  });
});

describe("extraction body checks", () => {
  const good = {
    summary: "S",
    claims: [
      {
        text: "c",
        evidenceLevel: "preprint",
        truthConfidence: "medium",
        citations: [{ quote: "q" }],
      },
    ],
    compositionParameters: [
      { kind: "tempo", value: "120 BPM", details: { bpm: 120 } },
    ],
    topics: ["t"],
    openQuestions: [],
  };

  test("accepts a body the store action accepts", () => {
    expect(extractionProblems(good)).toEqual([]);
  });

  test("names what the store action would reject", () => {
    expect(extractionProblems({ ...good, summary: " " })).toEqual([
      "summary must be a non-empty string",
    ]);
    expect(
      extractionProblems({
        ...good,
        claims: [
          { ...good.claims[0], evidenceLevel: "rumour", interestLevel: "huge" },
        ],
      }),
    ).toEqual([
      'claims[0].evidenceLevel "rumour"',
      'claims[0].interestLevel "huge"',
    ]);
    expect(
      extractionProblems({
        ...good,
        claims: [{ ...good.claims[0], citations: [{ page: 3 }] }],
      }),
    ).toEqual(["claims[0].citations must be {label?, url?, quote?} strings"]);
    expect(
      extractionProblems({
        ...good,
        compositionParameters: [{ value: 3 }],
        extra: true,
      }),
    ).toEqual(["unknown fields: extra", "compositionParameters[0].value"]);
    expect(extractionProblems([])).toEqual(["extraction must be an object"]);
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
