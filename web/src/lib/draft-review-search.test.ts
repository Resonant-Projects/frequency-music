// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { parseDraftReviewSearch } from "./draft-review-search";

describe("draft review search", () => {
  it("keeps explicit targets independent of queue membership", () => {
    expect(parseDraftReviewSearch({ draft: "terminal-draft" })).toEqual({
      draft: "terminal-draft",
    });
    expect(parseDraftReviewSearch({ intent: "intent-1" })).toEqual({
      intent: "intent-1",
    });
    expect(parseDraftReviewSearch({ unrelated: "value" })).toEqual({});
  });
  it("does not silently select the queue for malformed or ambiguous links", () => {
    for (const draft of [
      "",
      " ",
      [],
      ["one", "two"],
      1,
      null,
      "x".repeat(129),
      "<script>",
    ]) {
      expect(parseDraftReviewSearch({ draft }).invalidReviewLink).toBe(true);
    }
    expect(
      parseDraftReviewSearch({ draft: "one", intent: "two" }).invalidReviewLink,
    ).toBe(true);
  });
});
