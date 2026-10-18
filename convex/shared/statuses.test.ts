import { describe, expect, test } from "vite-plus/test";
import {
  HYPOTHESIS_STATUSES,
  isMissingTextBlock,
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

  test("blocked reasons include pdf_parse_error after the existing reasons", () => {
    expect(SOURCE_BLOCKED_REASONS).toEqual([
      "no_text",
      "copyright",
      "needs_metadata",
      "needs_tagging",
      "ai_error",
      "needs_human_review",
      "duplicate",
      "pdf_parse_error",
    ]);
  });

  test("text recovery resolves no_text and pdf_parse_error blocks only", () => {
    expect(isMissingTextBlock("no_text")).toBe(true);
    expect(isMissingTextBlock("pdf_parse_error")).toBe(true);
    expect(isMissingTextBlock("ai_error")).toBe(false);
    expect(isMissingTextBlock(undefined)).toBe(false);
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
