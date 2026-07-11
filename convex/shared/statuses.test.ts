import { describe, expect, test } from "vite-plus/test";
import {
  HYPOTHESIS_STATUSES,
  RECIPE_STATUSES,
  SOURCE_BLOCKED_REASONS,
  SOURCE_STATUSES,
} from "./statuses";

describe("shared status arrays", () => {
  test("source statuses match the schema pipeline order", () => {
    expect(SOURCE_STATUSES).toEqual([
      "ingested",
      "text_ready",
      "extracting",
      "extracted",
      "review_needed",
      "triaged",
      "promoted_followers",
      "promoted_public",
      "archived",
    ]);
  });

  test("all arrays are duplicate-free", () => {
    for (const arr of [
      SOURCE_STATUSES,
      SOURCE_BLOCKED_REASONS,
      HYPOTHESIS_STATUSES,
      RECIPE_STATUSES,
    ]) {
      expect(new Set(arr).size).toBe(arr.length);
    }
  });
});
