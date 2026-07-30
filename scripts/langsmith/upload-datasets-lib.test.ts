import { describe, expect, test } from "vite-plus/test";
import {
  assertRowsHaveKeys,
  buildMissingExamples,
  canonicalExampleKey,
  canonicalInputKey,
  parseJsonlRows,
  pickKeys,
} from "./upload-datasets-lib";

describe("upload dataset helpers", () => {
  test("parses JSONL rows", () => {
    expect(parseJsonlRows('{"a":1}\n\n{"a":2}\n', "rows.jsonl")).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  test("reports malformed JSONL with path and line", () => {
    expect(() => parseJsonlRows('{"a":1}\nnope\n', "rows.jsonl")).toThrow(
      "rows.jsonl:2",
    );
  });

  test("builds stable canonical keys from configured input fields", () => {
    expect(canonicalInputKey({ b: 2, a: 1, ignored: 3 }, ["a", "b"])).toBe(
      '[["a",1],["b",2]]',
    );
  });

  test("distinguishes examples with the same inputs and different outputs", () => {
    const first = canonicalExampleKey(
      { prompt: "same" },
      { answer: "first" },
      ["prompt"],
      ["answer"],
    );
    const second = canonicalExampleKey(
      { prompt: "same" },
      { answer: "second" },
      ["prompt"],
      ["answer"],
    );

    expect(first).not.toBe(second);
  });

  test("ignores nested object key order when fingerprinting examples", () => {
    const first = canonicalExampleKey(
      { context: { title: "A", score: 1 } },
      { answer: { text: "yes", confidence: 0.9 } },
      ["context"],
      ["answer"],
    );
    const second = canonicalExampleKey(
      { context: { score: 1, title: "A" } },
      { answer: { confidence: 0.9, text: "yes" } },
      ["context"],
      ["answer"],
    );

    expect(first).toBe(second);
  });

  test("picks configured fields without leaking unrelated values", () => {
    expect(pickKeys({ a: 1, b: 2, ignored: 3 }, ["a", "b"])).toEqual({
      a: 1,
      b: 2,
    });
  });

  test("rejects rows that would silently collapse on missing configured fields", () => {
    expect(() =>
      assertRowsHaveKeys(
        [{ _id: "row-1", summary: "output only" }],
        ["sourceTitle", "rawText", "summary"],
        "golden.jsonl",
      ),
    ).toThrow(
      "golden.jsonl:1: missing configured fields: sourceTitle, rawText",
    );
  });

  test("skips rows matching an uploaded example's configured inputs and outputs", () => {
    const missing = buildMissingExamples(
      [
        { sourceTitle: "A", rawText: "old", summary: "old summary" },
        { sourceTitle: "B", rawText: "new", summary: "new summary" },
      ],
      [
        {
          inputs: { sourceTitle: "A", rawText: "old" },
          outputs: { summary: "old summary" },
        },
      ],
      ["sourceTitle", "rawText"],
      ["summary"],
    );

    expect(missing).toEqual([
      {
        inputs: { sourceTitle: "B", rawText: "new" },
        outputs: { summary: "new summary" },
      },
    ]);
  });

  test("keeps two rows with identical inputs when their outputs differ", () => {
    const missing = buildMissingExamples(
      [
        { prompt: "same", answer: "first" },
        { prompt: "same", answer: "second" },
      ],
      [],
      ["prompt"],
      ["answer"],
    );

    expect(missing).toHaveLength(2);
  });
});
