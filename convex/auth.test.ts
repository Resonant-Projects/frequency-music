import { describe, expect, test } from "vite-plus/test";
import { constantTimeEqual } from "./auth";

describe("constantTimeEqual", () => {
  test("accepts equal strings", () => {
    expect(constantTimeEqual("shared-secret", "shared-secret")).toBe(true);
  });

  test("rejects different strings of the same length", () => {
    expect(constantTimeEqual("shared-secret", "shared-secreu")).toBe(false);
  });

  test("rejects strings of different lengths", () => {
    expect(constantTimeEqual("short", "longer")).toBe(false);
  });

  test("does not conflate a lone surrogate with the replacement character", () => {
    expect(constantTimeEqual("\uD800", "�")).toBe(false);
  });
});
