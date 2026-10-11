import { createRequire } from "node:module";
import { describe, expect, test } from "vite-plus/test";

const require = createRequire(import.meta.url);
const braces = require("braces") as {
  compile(input: unknown): string;
  expand(input: unknown): string[];
  stringify(input: unknown): string;
  parse(input: string): unknown;
};

// CVE-2026-93687: below the upstream 10,000-character limit, this input
// exhausts compile/expand's call stack in the unpatched production Node image.
const nestedPattern = "{".repeat(4999) + "x" + "}".repeat(4999);

function nestedAst(depth: number): unknown {
  let node: unknown = { type: "text", value: "x" };
  for (let i = 0; i < depth; i++)
    node = { type: "brace", nodes: [node], commas: 0, ranges: 0 };
  return { type: "root", nodes: [node] };
}

describe("patched braces nesting limits", () => {
  test.each(["compile", "expand", "stringify", "parse"] as const)(
    "%s rejects deeply nested input with a bounded syntax error",
    (method) => {
      expect(() => braces[method](nestedPattern)).toThrow(SyntaxError);
      expect(() => braces[method](nestedPattern)).toThrow("nesting depth");
    },
  );

  test.each(["compile", "expand", "stringify"] as const)(
    "%s also bounds caller-supplied ASTs",
    (method) => {
      expect(() => braces[method](nestedAst(5000))).toThrow(SyntaxError);
      expect(() => braces[method](nestedAst(5000))).toThrow("nesting depth");
    },
  );

  test("preserves filesystem patterns, nested alternatives, ranges and escaped literals", () => {
    expect(braces.expand("src/{graphs,{tools,models}}/*.{ts,js}")).toEqual([
      "src/graphs/*.ts",
      "src/graphs/*.js",
      "src/tools/*.ts",
      "src/tools/*.js",
      "src/models/*.ts",
      "src/models/*.js",
    ]);
    expect(braces.expand("chunk-{1..3}.wav")).toEqual([
      "chunk-1.wav",
      "chunk-2.wav",
      "chunk-3.wav",
    ]);
    expect(braces.compile("x/\\{literal\\}.ts")).toBe("x/{literal}.ts");
    expect(() => braces.parse("\\{".repeat(1000))).not.toThrow();
    expect(() =>
      braces.compile("{".repeat(63) + "x" + "}".repeat(63)),
    ).not.toThrow();
  });
});
