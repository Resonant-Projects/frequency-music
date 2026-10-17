import { describe, expect, test } from "vite-plus/test";
import {
  boundPassages,
  clampPassageLimit,
  estimatePassageEmbedding,
  PASSAGE_RESPONSE_MAX_CHARS,
  PASSAGE_TRUNCATION_MARKER,
  type PassageHit,
  passageSourceText,
} from "./passages";

const hit = (score: number, chars: number): PassageHit => ({
  sourceId: `source-${score}`,
  status: "text_ready",
  text: "x".repeat(chars),
  score,
  order: 0,
});

describe("passage search bounds", () => {
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
    expect(result.passages.map((passage) => passage.score)).toEqual([0.9, 0.8]);
    expect(result.passages.every((passage) => !passage.truncated)).toBe(true);
    expect(result).toMatchObject({ truncated: true, omitted: 2 });
    const total = result.passages.reduce((sum, p) => sum + p.text.length, 0);
    expect(total).toBeLessThanOrEqual(PASSAGE_RESPONSE_MAX_CHARS);
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
