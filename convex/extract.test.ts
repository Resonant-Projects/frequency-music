import { describe, expect, test, vi } from "vite-plus/test";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { parseConfidenceBand, resumeAttempt } from "./extract";
import { parseExtractionJson } from "./llm";

const extraction = {
  summary: "A compact reading of the source.",
  claims: [],
  compositionParameters: [],
  topics: ["resonance"],
  openQuestions: [],
};

test("extraction action sends valid Unicode to failure mutation and preserves its original error", async () => {
  const original = new Error(`${"x".repeat(999)}🧠 detail`);
  const attemptId = "attempt" as Id<"extractionAttempts">;
  const runMutation = vi.fn(async (ref, args) => {
    if (getFunctionName(ref).endsWith(":claimGeneration")) throw original;
    expect(getFunctionName(ref)).toBe("extractInternal:failExtraction");
    if (!args.error.isWellFormed())
      throw new Error("Convex rejects invalid Unicode");
    expect(args.error).toBe("x".repeat(999));
    expect(args.attemptId).toBe(attemptId);
    expect(args.generationLease).toBeTypeOf("string");
    return null;
  });
  const ctx = {
    runMutation,
    runQuery: vi.fn(async () => ({ _id: attemptId })),
  } as unknown as ActionCtx;
  const handler = (
    resumeAttempt as unknown as {
      _handler: (
        ctx: ActionCtx,
        args: { attemptId: Id<"extractionAttempts"> },
      ) => Promise<unknown>;
    }
  )._handler;
  await expect(handler(ctx, { attemptId })).rejects.toBe(original);
  expect(runMutation).toHaveBeenCalledTimes(2);
});

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
