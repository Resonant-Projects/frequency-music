import { describe, expect, test } from "bun:test";
import { parseConfidenceBand } from "./extract";
import { parseExtractionJson } from "./llm";

const extraction = {
  summary: "A compact reading of the source.",
  claims: [],
  compositionParameters: [],
  topics: ["resonance"],
  openQuestions: [],
};

describe("LLM extraction response parsing", () => {
  test("round-trips a pure JSON extraction", () => {
    expect(parseExtractionJson(JSON.stringify(extraction))).toEqual(extraction);
  });

  test("parses an extraction wrapped in prose", () => {
    const response = `Here is the extraction: ${JSON.stringify(extraction)} Hope that helps`;

    // NOTE: Prose around an extraction is tolerated when it adds no braces.
    expect(parseExtractionJson(response)).toEqual(extraction);
  });

  test("rejects prose with a closing brace after the extraction", () => {
    const response = `Here is the extraction: ${JSON.stringify(extraction)} This } is trailing prose`;

    // NOTE: Greedy matching includes a trailing prose brace and makes JSON.parse throw.
    expect(() => parseExtractionJson(response)).toThrow(SyntaxError);
  });

  test("parses an extraction from a Markdown JSON fence", () => {
    const response = `\`\`\`json\n${JSON.stringify(extraction)}\n\`\`\``;

    // NOTE: Markdown fences are tolerated because matching starts at the first brace.
    expect(parseExtractionJson(response)).toEqual(extraction);
  });

  test("throws the parser error when no JSON object is present", () => {
    expect(() =>
      parseExtractionJson("No structured extraction available."),
    ).toThrow("Could not parse JSON from response");
  });

  test("accepts an empty object without schema validation", () => {
    // NOTE: Empty objects are accepted; extraction shape validation happens nowhere here.
    expect(Object.keys(parseExtractionJson("{}"))).toEqual([]);
  });
});

describe("extraction confidence bands", () => {
  test("preserves every supported confidence band", () => {
    expect(parseConfidenceBand("low")).toBe("low");
    expect(parseConfidenceBand("medium")).toBe("medium");
    expect(parseConfidenceBand("high")).toBe("high");
  });

  test("maps unknown, empty, and missing confidence bands to undefined", () => {
    // NOTE: Invalid confidence bands silently fall back to undefined.
    expect(parseConfidenceBand("certain")).toBeUndefined();
    expect(parseConfidenceBand("")).toBeUndefined();
    expect(parseConfidenceBand(undefined)).toBeUndefined();
  });
});
