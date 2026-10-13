import { describe, expect, test } from "vite-plus/test";
import {
  DOCKET_EXCERPT_MARKER,
  DOCKET_MAX_RESULT_BYTES,
  docketListResultZ,
  mcpTextResult,
  projectDocketCard,
  serializedUtf8Bytes,
} from "./docketTools";

const row = {
  _id: "card",
  kind: "recipeNoComposition",
  targetId: "recipe",
  title: "Recipe",
  blurbMd: "Full body",
  spokenBlurb: "",
  pageUrl: "/recipes/recipe",
  decisions: [],
  contentHash: "a".repeat(64),
};
describe("bounded docket excerpts", () => {
  test("preserves small text and identity and excerpts oversized source before validation", () => {
    expect(projectDocketCard(row).blurbMd).toBe(row.blurbMd);
    const source = {
      ...row,
      blurbMd: "Body ".repeat(50000),
      title: "Title".repeat(1000),
      spokenBlurb: "Speech ".repeat(10000),
    };
    const card = projectDocketCard(source);
    for (const field of ["title", "blurbMd", "spokenBlurb"] as const) {
      expect(card[field].endsWith(DOCKET_EXCERPT_MARKER)).toBe(true);
      expect(
        source[field].startsWith(
          card[field].slice(0, -DOCKET_EXCERPT_MARKER.length),
        ),
      ).toBe(true);
    }
    expect(card.cardId).toBe(source._id);
    expect(card.targetId).toBe(source.targetId);
    expect(card.contentHash).toBe(source.contentHash);
    expect(card.pageUrl).toBe(source.pageUrl);
    expect(source.blurbMd.length).toBe(250000);
  });
  test.each(["a", "音😀", '\\"\n\t\u0000', "😀"])(
    "bounds ten cards including UTF-8 and both JSON escaping layers: %j",
    (text) => {
      const cards = Array.from({ length: 10 }, (_, i) =>
        projectDocketCard({
          ...row,
          _id: `card${i}`,
          blurbMd: text.repeat(30000),
          spokenBlurb: text.repeat(10000),
        }),
      );
      expect(docketListResultZ.parse(cards)).toHaveLength(10);
      expect(serializedUtf8Bytes(mcpTextResult(cards))).toBeLessThan(
        DOCKET_MAX_RESULT_BYTES,
      );
      for (const card of cards) {
        expect(card.blurbMd.endsWith(DOCKET_EXCERPT_MARKER)).toBe(true);
        expect(card.blurbMd.isWellFormed()).toBe(true);
      }
    },
  );
  test("rejects aggregate results that bypass projection even when individual fields fit", () => {
    const { _id, ...rest } = row;
    const cards = Array(10).fill({
      ...rest,
      cardId: _id,
      blurbMd: "a".repeat(30000),
    });
    expect(docketListResultZ.safeParse(cards).success).toBe(false);
  });
});
