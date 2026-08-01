import { describe, expect, test, vi } from "vite-plus/test";

// Declared before the module under test is imported: `judge` transitively pulls
// in `varlock/auto-load`, which would otherwise resolve secrets from
// `.env.local`/1Password and make these tests environment-dependent.
vi.mock("varlock/auto-load", () => ({}));

import { aggregateJudgeScore, parseJudgeResponse } from "./judge";

describe("parseJudgeResponse", () => {
  test("parses a raw JSON object with all four dimensions", () => {
    const s = parseJudgeResponse(
      '{"grounding": 0.8, "actionability": 0.6, "stakeClarity": 1, "nonRepetition": 0.4, "rationale": "solid but abstract"}',
    );
    expect(s.grounding).toBe(0.8);
    expect(s.actionability).toBe(0.6);
    expect(s.stakeClarity).toBe(1);
    expect(s.nonRepetition).toBe(0.4);
    expect(s.rationale).toBe("solid but abstract");
  });

  test("parses a fenced ```json block with surrounding prose", () => {
    const text = [
      "Here is my assessment:",
      "```json",
      '{"grounding": 0.5, "actionability": 0.5, "stakeClarity": 0.5, "nonRepetition": 0.5, "rationale": "middling"}',
      "```",
      "Hope that helps.",
    ].join("\n");
    const s = parseJudgeResponse(text);
    expect(s.grounding).toBe(0.5);
    expect(s.rationale).toBe("middling");
  });

  test("clamps out-of-range and coerces string numbers", () => {
    const s = parseJudgeResponse(
      '{"grounding": 1.7, "actionability": -3, "stakeClarity": "0.25", "nonRepetition": "not a number", "rationale": ""}',
    );
    expect(s.grounding).toBe(1);
    expect(s.actionability).toBe(0);
    expect(s.stakeClarity).toBe(0.25);
    expect(s.nonRepetition).toBe(0);
    expect(s.rationale).toBe("");
  });

  test("malformed input falls back to a safe all-zero default", () => {
    for (const bad of ["", "   ", "no json here", "{ broken", "[1,2,3]"]) {
      const s = parseJudgeResponse(bad);
      expect(s.grounding).toBe(0);
      expect(s.actionability).toBe(0);
      expect(s.stakeClarity).toBe(0);
      expect(s.nonRepetition).toBe(0);
    }
  });

  test("aggregateJudgeScore averages the four dimensions", () => {
    const s = parseJudgeResponse(
      '{"grounding": 1, "actionability": 1, "stakeClarity": 0, "nonRepetition": 0, "rationale": "x"}',
    );
    expect(aggregateJudgeScore(s)).toBe(0.5);
  });
});
