import { describe, expect, test } from "bun:test";
import {
  buildMissingExamples,
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

  test("picks configured fields without leaking unrelated values", () => {
    expect(pickKeys({ a: 1, b: 2, ignored: 3 }, ["a", "b"])).toEqual({
      a: 1,
      b: 2,
    });
  });

  test("returns only local rows whose input key is not already uploaded", () => {
    const missing = buildMissingExamples(
      [
        { sourceTitle: "A", rawText: "old", summary: "old summary" },
        { sourceTitle: "B", rawText: "new", summary: "new summary" },
      ],
      [{ inputs: { sourceTitle: "A", rawText: "old" } }],
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
});
