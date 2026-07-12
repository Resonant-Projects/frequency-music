import { describe, expect, test } from "vite-plus/test";
import { pairKey } from "./shared/correspondenceKey";

describe("pairKey", () => {
  test("is symmetric and orders the concept ids lexicographically", () => {
    expect(pairKey("concept-z", "concept-a")).toBe("concept-a:concept-z");
    expect(pairKey("concept-z", "concept-a")).toBe(
      pairKey("concept-a", "concept-z"),
    );
  });
});
