import { describe, expect, test } from "vite-plus/test";
import { chunkForLimit } from "../src/tts/chunk";

describe("chunkForLimit", () => {
  test("returns the paragraph whole when under the limit", () => {
    expect(chunkForLimit("One. Two.", 100)).toEqual(["One. Two."]);
  });
  test("splits at sentence boundaries and never truncates", () => {
    const sentence = "This sentence has exactly forty characters!! ";
    const paragraph = sentence.repeat(200).trim();
    const chunks = chunkForLimit(paragraph, 5000);
    expect(chunks.join(" ")).toBe(paragraph);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(5000);
    expect(chunks.length).toBeGreaterThan(1);
  });
  test("a single sentence over the limit splits on whitespace", () => {
    const long = "word ".repeat(2000).trim();
    const chunks = chunkForLimit(long, 5000);
    expect(chunks.join(" ")).toBe(long);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(5000);
  });
  test("a whitespace-free token over the limit is hard-split, losing no characters", () => {
    const url = `https://example.test/${"abcdefghij".repeat(30)}`;
    const paragraph = `See ${url} for the full table and ${url} again.`;
    const chunks = chunkForLimit(paragraph, 100);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
    // Joining with nothing between the cut pieces reproduces every character
    // (the cuts are inside tokens, so a joiner would add one).
    expect(chunks.join("").replaceAll(" ", "")).toBe(
      paragraph.replaceAll(" ", ""),
    );
    expect(chunks.some((chunk) => chunk.startsWith("https://"))).toBe(true);
  });
});
