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
});
