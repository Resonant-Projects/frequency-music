import { describe, expect, test, vi } from "vite-plus/test";

// Declared before the module under test is imported: `judge` transitively pulls
// in `varlock/auto-load`, which would otherwise resolve secrets from
// `.env.local`/1Password and make these tests environment-dependent.
vi.mock("varlock/auto-load", () => ({}));

import { ANTHROPIC_MODELS } from "../../../convex/shared/llmPolicy";
import type { GenerateTextFn } from "../eval-helper";
import { EvalInfrastructureError } from "../run-guard";
import {
  aggregateJudgeScore,
  JUDGE_MODEL,
  makeJudgeEvaluator,
  parseJudgeResponse,
} from "./judge";

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
      '{"grounding": 1.7, "actionability": -3, "stakeClarity": "0.25", "nonRepetition": 0, "rationale": ""}',
    );
    expect(s.grounding).toBe(1);
    expect(s.actionability).toBe(0);
    expect(s.stakeClarity).toBe(0.25);
    expect(s.nonRepetition).toBe(0);
    expect(s.rationale).toBe("");
  });

  test("explicit zero scores are a valid verdict", () => {
    const s = parseJudgeResponse(
      '{"grounding": 0, "actionability": 0, "stakeClarity": 0, "nonRepetition": 0, "rationale": "weak"}',
    );
    expect(aggregateJudgeScore(s)).toBe(0);
  });

  test("malformed input throws instead of scoring zero", () => {
    for (const bad of [
      "",
      "   ",
      "no json here",
      "{ broken",
      "[1,2,3]",
      '{"grounding": 0.5}',
      '{"grounding": 0.5, "actionability": 0.5, "stakeClarity": 0.5, "nonRepetition": "not a number"}',
      '{"grounding": null, "actionability": 0.5, "stakeClarity": 0.5, "nonRepetition": 0.5}',
    ]) {
      expect(() => parseJudgeResponse(bad)).toThrow(EvalInfrastructureError);
    }
  });

  test("aggregateJudgeScore averages the four dimensions", () => {
    const s = parseJudgeResponse(
      '{"grounding": 1, "actionability": 1, "stakeClarity": 0, "nonRepetition": 0, "rationale": "x"}',
    );
    expect(aggregateJudgeScore(s)).toBe(0.5);
  });
});

describe("makeJudgeEvaluator", () => {
  const run = { outputs: { bodyMd: "brief" } } as never;

  test("judges with the registered Haiku 5.5 directly, adaptive and without temperature", async () => {
    const calls: Array<Parameters<GenerateTextFn>[0]> = [];
    const judge = makeJudgeEvaluator({
      env: { ANTHROPIC_API_KEY: "ak-test" },
      generate: async (args) => {
        calls.push(args);
        return {
          text: '{"grounding": 1, "actionability": 0.5, "stakeClarity": 0.5, "nonRepetition": 0, "rationale": "ok"}',
          finishReason: "stop",
        };
      },
    });
    const result = await judge(run, { inputs: {} } as never);
    expect(result).toMatchObject({ key: "judge", score: 0.5 });
    expect(JUDGE_MODEL).toBe(ANTHROPIC_MODELS.haiku);
    const args = calls[0]!;
    expect((args.model as { modelId: string }).modelId).toBe(
      "claude-haiku-5-5",
    );
    expect(args.providerOptions).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
    });
    expect(args).not.toHaveProperty("temperature");
    expect(args.abortSignal).toBeInstanceOf(AbortSignal);
  });

  test("a failed judge call throws rather than returning score 0", async () => {
    const judge = makeJudgeEvaluator({
      env: { ANTHROPIC_API_KEY: "ak-test" },
      generate: async () => {
        throw new Error("timeout");
      },
    });
    await expect(judge(run)).rejects.toBeInstanceOf(EvalInfrastructureError);
  });

  test("a truncated judge verdict throws", async () => {
    const judge = makeJudgeEvaluator({
      env: { ANTHROPIC_API_KEY: "ak-test" },
      generate: async () => ({
        text: '{"grounding": 1',
        finishReason: "length",
      }),
    });
    await expect(judge(run)).rejects.toThrow("truncated");
  });

  test("requires the Anthropic key when built", () => {
    expect(() => makeJudgeEvaluator({ env: {} })).toThrow(
      "ANTHROPIC_API_KEY is not set",
    );
  });
});
