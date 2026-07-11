import { describe, expect, test } from "vite-plus/test";
import { normalizeConceptDomainSlug } from "./conceptDomainNormalization";

describe("normalizeConceptDomainSlug", () => {
  test.each([
    [" Mathematical Music Theory ", "mathematical-music-theory"],
    ["signal   processing", "signal-processing"],
    ["AI---Music", "ai-music"],
  ])("normalizes %s to the registry slug %s", (input, expected) => {
    expect(normalizeConceptDomainSlug(input)).toBe(expected);
  });
});
