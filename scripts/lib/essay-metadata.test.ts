import { describe, expect, test } from "vite-plus/test";
import { normalizeExcerpt } from "./essay-metadata";

describe("normalizeExcerpt", () => {
  test("normalizes whitespace without changing a short excerpt", () => {
    expect(normalizeExcerpt("  A short\n\nexcerpt.  ")).toBe(
      "A short excerpt.",
    );
  });

  test("keeps the first complete sentence when the full excerpt is too long", () => {
    const firstSentence = "A concise first sentence.";
    const result = normalizeExcerpt(
      `${firstSentence} ${"A long continuation ".repeat(20)}`,
    );

    expect(result).toBe(firstSentence);
  });

  test("truncates a long single sentence at a word boundary", () => {
    const result = normalizeExcerpt("musical representation ".repeat(20));

    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith("…")).toBe(true);
    expect(result.at(-2)).not.toBe(" ");
  });

  test("trims dangling punctuation left by a word-boundary cut", () => {
    const result = normalizeExcerpt(`${"tuning systems, ".repeat(30)}end`);

    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/[,:;—-]…$/);
  });
});
