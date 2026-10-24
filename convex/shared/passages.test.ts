import { defaultChunker } from "@convex-dev/rag";
import { describe, expect, test } from "vite-plus/test";
import {
  boundPassages,
  packPassages,
  clampPassageLimit,
  estimatePassageEmbedding,
  PASSAGE_RESPONSE_MAX_CHARS,
  PASSAGE_TRUNCATION_MARKER,
  type PassageHit,
  embeddingBatches,
  PASSAGE_BATCH_MAX_BYTES,
  PASSAGE_CHUNK_MAX_BYTES,
  passageSourceText,
  passageContextWindow,
  PASSAGE_WINDOW_MAX_CHARS,
  splitChunksByBytes,
  supersededEntryId,
  wellFormedChunks,
} from "./passages";

const hit = (score: number, chars: number): PassageHit => ({
  sourceId: `source-${score}`,
  status: "text_ready",
  text: "x".repeat(chars),
  score,
  order: 0,
});

describe("passage search bounds", () => {
  test("packs distinct sources before higher-scoring repeated evidence", () => {
    const article = { ...hit(0.9, 5_000), sourceId: "article" };
    const transcript = { ...hit(0.7, 6_000), sourceId: "transcript" };
    const repeated = { ...hit(0.8, 4_000), sourceId: "article", order: 1 };
    const result = packPassages([article, transcript, repeated]);
    expect(result.passages.map((passage) => passage.sourceId)).toEqual([
      "article",
      "transcript",
    ]);
    expect(result.omitted).toBe(1);
  });

  test("keeps the matching chunk while bounding long neighboring context", () => {
    const match = `precise temperament ${"m".repeat(7_900)}`;
    const result = passageContextWindow(
      match,
      "b".repeat(8_000),
      "a".repeat(8_000),
    );
    expect(result.text).toContain(match);
    expect(result.text.length).toBeLessThanOrEqual(PASSAGE_WINDOW_MAX_CHARS);
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith(PASSAGE_TRUNCATION_MARKER)).toBe(true);
  });

  test("keeps short context verbatim and preserves Unicode at trimmed edges", () => {
    expect(passageContextWindow("match", "before", "after")).toEqual({
      text: "before\nmatch\nafter",
    });
    const result = passageContextWindow(
      "m".repeat(8_000),
      "🎵".repeat(4_000),
      "🎵".repeat(4_000),
    );
    expect(result.text.isWellFormed()).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(PASSAGE_WINDOW_MAX_CHARS);
  });

  test("limit defaults to 5 and clamps to 1..8", () => {
    expect(clampPassageLimit(undefined)).toBe(5);
    expect(clampPassageLimit(0)).toBe(1);
    expect(clampPassageLimit(-3)).toBe(1);
    expect(clampPassageLimit(3.9)).toBe(3);
    expect(clampPassageLimit(50)).toBe(8);
    expect(clampPassageLimit(Number.NaN)).toBe(5);
  });

  test("keeps every passage that fits, highest score first", () => {
    const result = boundPassages([hit(0.2, 100), hit(0.9, 100)]);
    expect(result.passages.map((passage) => passage.score)).toEqual([0.9, 0.2]);
    expect(result).toMatchObject({ truncated: false, omitted: 0 });
  });

  test("drops lowest-scored passages whole and marks the response", () => {
    const result = boundPassages([
      hit(0.9, 6000),
      hit(0.8, 5000),
      hit(0.7, 2000),
      hit(0.6, 500),
    ]);
    expect(result.passages.map((passage) => passage.score)).toEqual([
      0.9, 0.8, 0.6,
    ]);
    expect(result.passages.every((passage) => !passage.truncated)).toBe(true);
    expect(result).toMatchObject({ truncated: true, omitted: 1 });
    const total = result.passages.reduce((sum, p) => sum + p.text.length, 0);
    expect(total).toBeLessThanOrEqual(PASSAGE_RESPONSE_MAX_CHARS);
  });

  test("skips a non-fitting passage so a later short hit is retained", () => {
    const result = boundPassages([
      hit(0.9, 6_000),
      hit(0.8, 7_000),
      hit(0.7, 500),
    ]);
    expect(result.passages.map((passage) => passage.score)).toEqual([0.9, 0.7]);
    expect(result).toMatchObject({ truncated: true, omitted: 1 });
  });

  test("cuts only an oversized first passage, visibly", () => {
    const result = boundPassages([hit(0.9, 30_000), hit(0.5, 10)]);
    expect(result.passages).toHaveLength(1);
    const [first] = result.passages;
    expect(first?.truncated).toBe(true);
    expect(first?.text.endsWith(PASSAGE_TRUNCATION_MARKER)).toBe(true);
    expect(first?.text.length).toBe(PASSAGE_RESPONSE_MAX_CHARS);
    expect(result).toMatchObject({ truncated: true, omitted: 1 });
  });

  test("never leaves a lone surrogate where an oversized passage is cut", () => {
    const room = PASSAGE_RESPONSE_MAX_CHARS - PASSAGE_TRUNCATION_MARKER.length;
    const text = `${"x".repeat(room - 1)}🎵${"y".repeat(100)}`;
    const [first] = boundPassages([{ ...hit(0.9, 0), text }]).passages;
    const kept = first?.text.slice(0, -PASSAGE_TRUNCATION_MARKER.length) ?? "";
    expect(kept).toBe("x".repeat(room - 1));
    expect(kept.isWellFormed()).toBe(true);
  });

  test("rejoins a surrogate pair the default chunker split on a long line", () => {
    const line = `${"a".repeat(5999)}🎵${"b".repeat(5999)}`;
    const raw = defaultChunker(line);
    expect(raw.some((chunk) => !chunk.isWellFormed())).toBe(true);
    const chunks = wellFormedChunks(raw);
    expect(chunks.every((chunk) => chunk.isWellFormed())).toBe(true);
    expect(chunks.join("")).toBe(line);
  });

  test("replaces surrogates that cannot be rejoined", () => {
    expect(wellFormedChunks(["a\uD83C", "b", "\uDFB5c"])).toEqual([
      "a",
      "\uFFFDb",
      "\uFFFDc",
    ]);
    expect(wellFormedChunks(["end\uD83C"])).toEqual(["end\uFFFD"]);
  });

  test("deletes a superseded run's own entry, else the entry it replaced", () => {
    expect(
      supersededEntryId({
        entryId: "mine",
        status: "replaced",
        replacedEntry: null,
      }),
    ).toBe("mine");
    expect(
      supersededEntryId({
        entryId: "mine",
        status: "ready",
        replacedEntry: { entryId: "old" },
      }),
    ).toBe("old");
    expect(
      supersededEntryId({
        entryId: "mine",
        status: "ready",
        replacedEntry: { entryId: "mine" },
      }),
    ).toBe("mine");
    expect(
      supersededEntryId({
        entryId: "mine",
        status: "ready",
        replacedEntry: null,
      }),
    ).toBeNull();
  });

  test("splits chunks so no embedding input can exceed the token limit", () => {
    const bytes = (text: string) => new TextEncoder().encode(text).length;
    // A 10,000-character CJK line is 30,000 UTF-8 bytes.
    const cjk = "音".repeat(10_000);
    const pieces = splitChunksByBytes([cjk, "short", "🎵".repeat(3000)]);
    expect(pieces.join("")).toBe(`${cjk}short${"🎵".repeat(3000)}`);
    for (const piece of pieces) {
      expect(bytes(piece)).toBeLessThanOrEqual(PASSAGE_CHUNK_MAX_BYTES);
      expect(piece.isWellFormed()).toBe(true);
    }
    expect(splitChunksByBytes(["plain"])).toEqual(["plain"]);
  });

  test("bounds each embedding request by chunk count and bytes", () => {
    const chunks = Array.from({ length: 250 }, () => "x".repeat(4000));
    const batches = embeddingBatches(chunks);
    expect(batches.flat()).toEqual(chunks);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(100);
      expect(batch.join("").length).toBeLessThanOrEqual(
        PASSAGE_BATCH_MAX_BYTES,
      );
    }
    expect(
      embeddingBatches(Array.from({ length: 150 }, () => "y")),
    ).toHaveLength(2);
  });

  test("indexes rawText before transcript, matching rawTextSha256", () => {
    expect(passageSourceText({ rawText: "a", transcript: "b" })).toBe("a");
    expect(passageSourceText({ rawText: "", transcript: "b" })).toBe("b");
    expect(passageSourceText({})).toBe("");
  });

  test("estimates 3-large cost at about four characters per token", () => {
    expect(estimatePassageEmbedding(4_000_000)).toEqual({
      tokens: 1_000_000,
      usd: 0.13,
    });
    expect(estimatePassageEmbedding(0)).toEqual({ tokens: 0, usd: 0 });
  });
});
