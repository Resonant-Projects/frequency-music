import { describe, expect, test, vi } from "vite-plus/test";

// Declared before the module under test is imported: `eval-helper` pulls in
// `varlock/auto-load`, which would otherwise resolve secrets from
// `.env.local`/1Password and make these tests environment-dependent.
vi.mock("varlock/auto-load", () => ({}));

import type { Example, Run } from "langsmith";
import { ANTHROPIC_MODELS } from "../../convex/shared/llmPolicy";
import {
  type EvalPrompt,
  evalInferenceConfig,
  generateModelText,
  type GenerateTextFn,
  parseJsonObjectFromText,
  requireAnthropicApiKey,
  runEval,
  type RunEvalDeps,
  selectPromptVersion,
} from "./eval-helper";
import { makeJudgeEvaluator } from "./evaluators/judge";
import { COMPLETION_MARKER, parseCompletionMarker } from "./run-guard";

const PRIVATE_SOURCE = "PRIVATE-SOURCE-TEXT-should-never-be-logged";
const SECRET = "sk-ant-test-secret-value";

describe("eval helper", () => {
  test("selects the requested prompt version from argv", () => {
    expect(
      selectPromptVersion(["node", "eval.ts", "--version", "v2"], "v1"),
    ).toBe("v2");
  });

  test("falls back to the default prompt version", () => {
    expect(selectPromptVersion(["node", "eval.ts"], "v1")).toBe("v1");
  });

  test("requires an Anthropic API key before building the provider", () => {
    expect(() => requireAnthropicApiKey({})).toThrow(
      "ANTHROPIC_API_KEY is not set",
    );
    expect(requireAnthropicApiKey({ ANTHROPIC_API_KEY: "ak-test" })).toBe(
      "ak-test",
    );
  });

  test("parses the first JSON object from model output", () => {
    expect(parseJsonObjectFromText('prefix {"answer": true} suffix')).toEqual({
      answer: true,
    });
    expect(parseJsonObjectFromText("{}")).toEqual({});
  });

  test("returns null, not an empty object, for unparseable model output", () => {
    expect(parseJsonObjectFromText("prefix {not json} suffix")).toBeNull();
    expect(parseJsonObjectFromText("no braces")).toBeNull();
    expect(parseJsonObjectFromText('{"cut": "mid')).toBeNull();
  });
});

describe("shared inference policy", () => {
  test("extraction uses Sonnet 5.5 at the production cap with medium adaptive thinking", () => {
    for (const task of ["extract_v3", "extract_v2"] as const) {
      expect(evalInferenceConfig(task)).toEqual({
        task,
        model: ANTHROPIC_MODELS.sonnet,
        maxOutputTokens: 8000,
        providerOptions: {
          anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
        },
      });
    }
  });

  test("hypothesis design uses Opus 5.5 with high effort", () => {
    expect(evalInferenceConfig("hypothesis_v1")).toEqual({
      task: "hypothesis_v1",
      model: ANTHROPIC_MODELS.opus,
      maxOutputTokens: 6000,
      providerOptions: {
        anthropic: { thinking: { type: "adaptive" }, effort: "high" },
      },
    });
  });

  test("weekly briefs use the deployed brief task's Sonnet 5.5 route", () => {
    expect(evalInferenceConfig("brief_v2")).toMatchObject({
      model: ANTHROPIC_MODELS.sonnet,
      maxOutputTokens: 8000,
      providerOptions: { anthropic: { effort: "medium" } },
    });
  });
});

type GenerateArgs = Parameters<GenerateTextFn>[0];

function fakeGenerate(
  respond: (args: GenerateArgs) => { text: string; finishReason: string },
) {
  const calls: GenerateArgs[] = [];
  const generate: GenerateTextFn = async (args) => {
    calls.push(args);
    return respond(args);
  };
  return { generate, calls };
}

function modelIdOf(args: GenerateArgs): string {
  return (args.model as { modelId: string }).modelId;
}

describe("generateModelText", () => {
  const call = {
    apiKey: "ak-test",
    model: ANTHROPIC_MODELS.sonnet,
    system: "sys",
    prompt: PRIVATE_SOURCE,
    maxOutputTokens: 8000,
  };

  test("calls Anthropic directly with adaptive thinking and no sampling params", async () => {
    const { generate, calls } = fakeGenerate(() => ({
      text: '{"ok":true}',
      finishReason: "stop",
    }));
    await expect(generateModelText(call, generate)).resolves.toBe(
      '{"ok":true}',
    );
    const args = calls[0]!;
    expect(modelIdOf(args)).toBe("claude-sonnet-5-5");
    expect(
      (args.model as { provider: string }).provider.startsWith("anthropic"),
    ).toBe(true);
    expect(args.maxOutputTokens).toBe(8000);
    expect(args.providerOptions).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
    });
    for (const sampling of ["temperature", "topP", "topK"]) {
      expect(args).not.toHaveProperty(sampling);
    }
  });

  test.each([
    ["truncated", { text: '{"a":', finishReason: "length" }, "truncated"],
    ["empty", { text: "  ", finishReason: "stop" }, "empty response"],
    [
      "filtered",
      { text: "", finishReason: "content-filter" },
      "content-filter",
    ],
  ])("throws on a %s response", async (_name, response, message) => {
    const { generate } = fakeGenerate(() => response);
    await expect(generateModelText(call, generate)).rejects.toThrow(message);
  });

  test("a transport failure throws without the request body or secrets", async () => {
    const generate: GenerateTextFn = async () => {
      const error = new Error(`overloaded; key ${SECRET}`) as Error & {
        statusCode: number;
        requestBodyValues: unknown;
      };
      error.name = "AI_APICallError";
      error.statusCode = 529;
      error.requestBodyValues = { prompt: PRIVATE_SOURCE };
      throw error;
    };
    const failure = await generateModelText(call, generate).catch(
      (error: Error) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    const text = `${(failure as Error).message} ${JSON.stringify(failure)}`;
    expect(text).toContain("HTTP 529");
    expect(text).not.toContain(PRIVATE_SOURCE);
    expect(text).not.toContain(SECRET);
  });
});

// A faithful stand-in for LangSmith `evaluate()` (langsmith 0.10.11,
// lib/evaluation/_runner.mjs): `_forward` catches a target error, logs it and
// records it on `run.error`; `_runEvaluators` calls each evaluator with the run
// spread into the first argument, and catches and logs any evaluator error so
// the row simply lacks that feedback. Neither path rejects.
function fakeEvaluate(opts: { dropFeedbackFor?: string } = {}) {
  const logged: string[] = [];
  const evaluate: RunEvalDeps["evaluate"] = async (target, options) => {
    const examples = options.data as Example[];
    const evaluators = options.evaluators as Array<
      (run: Run, example?: Example) => Promise<{ key: string; score: number }>
    >;
    const results = [];
    for (const example of examples) {
      let run: Record<string, unknown> = { id: `run-${example.id}` };
      try {
        run = { ...run, outputs: await target(example.inputs) };
      } catch (error) {
        logged.push(`Error running target function: ${String(error)}`);
        run = { ...run, error: String(error) };
      }
      const feedback: Array<{ key: string; score: number }> = [];
      for (const evaluator of evaluators) {
        try {
          const result = await evaluator(
            { ...run, run, example, outputs: run.outputs } as unknown as Run,
            example,
          );
          if (result.key !== opts.dropFeedbackFor) feedback.push(result);
        } catch (error) {
          logged.push(`Error running evaluator: ${String(error)}`);
        }
      }
      results.push({ run, example, evaluationResults: { results: feedback } });
    }
    return {
      experimentName: `${options.experimentPrefix as string}-abc`,
      results,
    };
  };
  return { evaluate, logged };
}

const examples = [
  { id: "ex-1", inputs: { rawText: PRIVATE_SOURCE } },
  { id: "ex-2", inputs: { rawText: PRIVATE_SOURCE } },
] as unknown as Example[];

const prompts: Record<string, EvalPrompt> = {
  v1: {
    system: "Return JSON.",
    user: (input) => String(input.rawText),
    task: "extract_v3",
  },
};

const scoreField = (run: Run) => {
  const value = (run.outputs as Record<string, unknown> | undefined)?.quality;
  return { key: "quality", score: typeof value === "number" ? value : 0 };
};

function harness(opts: {
  respond?: (args: GenerateArgs) => { text: string; finishReason: string };
  evaluators?: Array<(run: Run, example?: Example) => unknown>;
  examples?: Example[];
  dropFeedbackFor?: string;
}) {
  const { generate, calls } = fakeGenerate(
    opts.respond ?? (() => ({ text: '{"quality": 1}', finishReason: "stop" })),
  );
  const { evaluate, logged } = fakeEvaluate({
    dropFeedbackFor: opts.dropFeedbackFor,
  });
  const out: string[] = [];
  const err: string[] = [];
  const deps: RunEvalDeps = {
    env: { ANTHROPIC_API_KEY: "ak-test" },
    loadExamples: async () => opts.examples ?? examples,
    evaluate,
    generate,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
  };
  const run = () =>
    runEval(
      {
        prompts,
        defaultVersion: "v1",
        data: "golden",
        evaluators: opts.evaluators ?? [scoreField],
        experimentPrefix: "extraction",
        argv: ["node", "eval.ts"],
      },
      deps,
    );
  return { run, out, err, logged, calls };
}

describe("runEval full-run outcome", () => {
  test("a completed run exits 0 and prints the completion marker", async () => {
    const h = harness({});
    await expect(h.run()).resolves.toBe(0);
    expect(parseCompletionMarker(h.out.join("\n"))).toEqual({
      experiment: "extraction-v1-abc",
      examples: 2,
      evaluatorKeys: ["quality"],
    });
    expect(h.err).toEqual([]);
    expect(modelIdOf(h.calls[0]!)).toBe("claude-sonnet-5-5");
  });

  test("valid zero scores are preserved and still pass", async () => {
    const h = harness({
      respond: () => ({ text: '{"quality": 0}', finishReason: "stop" }),
    });
    await expect(h.run()).resolves.toBe(0);
    expect(h.out.join("\n")).toContain(COMPLETION_MARKER);
  });

  test.each([
    [
      "a failed target request",
      () => {
        throw Object.assign(new Error(`rate limited ${SECRET}`), {
          statusCode: 429,
          requestBodyValues: { prompt: PRIVATE_SOURCE },
        });
      },
    ],
    [
      "a malformed response",
      () => ({ text: "not json", finishReason: "stop" }),
    ],
    [
      "a truncated response",
      () => ({ text: '{"quality": 1', finishReason: "length" }),
    ],
    ["an empty response", () => ({ text: "", finishReason: "stop" })],
  ])("%s fails the whole run", async (_name, respond) => {
    const h = harness({ respond });
    await expect(h.run()).resolves.toBe(1);
    expect(h.out.join("\n")).not.toContain(COMPLETION_MARKER);
    expect(h.err.join("\n")).toContain("EVAL RUN FAILED");
    const everything = [...h.err, ...h.logged, ...h.out].join("\n");
    expect(everything).not.toContain(PRIVATE_SOURCE);
    expect(everything).not.toContain(SECRET);
  });

  test("one failed example among successes still fails the run", async () => {
    let n = 0;
    const h = harness({
      respond: () =>
        n++ === 0
          ? { text: '{"quality": 1}', finishReason: "stop" }
          : { text: "oops", finishReason: "stop" },
    });
    await expect(h.run()).resolves.toBe(1);
    expect(h.err.join("\n")).toContain("ex-2");
  });

  test("an evaluator exception the SDK swallows fails the run", async () => {
    const h = harness({
      evaluators: [
        scoreField,
        function brokenEvaluator() {
          throw new Error(`boom ${PRIVATE_SOURCE}`);
        },
      ],
    });
    await expect(h.run()).resolves.toBe(1);
    expect(h.err.join("\n")).toContain("brokenEvaluator");
    expect(h.logged.join("\n")).toContain("Error running evaluator");
    const everything = [...h.err, ...h.logged, ...h.out].join("\n");
    expect(everything).not.toContain(PRIVATE_SOURCE);
  });

  test("a prompt renderer exception fails the run without leaking its message", async () => {
    const h = harness({});
    const code = await runEval(
      {
        prompts: {
          v1: {
            ...prompts.v1!,
            user: () => {
              throw new TypeError(`cannot render ${PRIVATE_SOURCE}`);
            },
          },
        },
        defaultVersion: "v1",
        data: "golden",
        evaluators: [scoreField],
        experimentPrefix: "extraction",
        argv: ["node", "eval.ts"],
      },
      {
        env: { ANTHROPIC_API_KEY: "ak-test" },
        loadExamples: async () => examples,
        evaluate: fakeEvaluate().evaluate,
        generate: async () => ({ text: "{}", finishReason: "stop" }),
        log: (line) => h.out.push(line),
        error: (line) => h.err.push(line),
      },
    );
    expect(code).toBe(1);
    expect(h.err.join("\n")).toContain("target failed: TypeError");
    expect(h.err.join("\n")).not.toContain(PRIVATE_SOURCE);
  });

  test("an evaluator returning a non-finite score fails the run", async () => {
    const h = harness({
      evaluators: [() => ({ key: "nan", score: Number.NaN })],
    });
    await expect(h.run()).resolves.toBe(1);
  });

  test("feedback the SDK failed to log fails the run", async () => {
    const h = harness({ dropFeedbackFor: "quality" });
    await expect(h.run()).resolves.toBe(1);
    expect(h.err.join("\n")).toContain("expected 1 evaluator scores, got 0");
  });

  test("an empty dataset fails instead of passing vacuously", async () => {
    const h = harness({ examples: [] });
    await expect(h.run()).resolves.toBe(1);
  });

  test("a judge transport failure fails the run", async () => {
    const judge = makeJudgeEvaluator({
      env: { ANTHROPIC_API_KEY: "ak-test" },
      generate: async () => {
        throw new Error("judge socket hang up");
      },
    });
    const h = harness({ evaluators: [scoreField, judge] });
    await expect(h.run()).resolves.toBe(1);
    expect(h.err.join("\n")).toContain("judge");
  });

  test("an unparseable judge verdict fails the run", async () => {
    const judge = makeJudgeEvaluator({
      env: { ANTHROPIC_API_KEY: "ak-test" },
      generate: async () => ({ text: "I liked it.", finishReason: "stop" }),
    });
    const h = harness({ evaluators: [scoreField, judge] });
    await expect(h.run()).resolves.toBe(1);
  });

  test("a judge that awards valid zeros passes", async () => {
    const judge = makeJudgeEvaluator({
      env: { ANTHROPIC_API_KEY: "ak-test" },
      generate: async () => ({
        text: '{"grounding":0,"actionability":0,"stakeClarity":0,"nonRepetition":0,"rationale":"weak"}',
        finishReason: "stop",
      }),
    });
    const h = harness({ evaluators: [scoreField, judge] });
    await expect(h.run()).resolves.toBe(0);
    expect(parseCompletionMarker(h.out.join("\n"))?.evaluatorKeys).toEqual([
      "judge",
      "quality",
    ]);
  });

  test("a missing API key fails before any call", async () => {
    const h = harness({});
    const code = await runEval(
      {
        prompts,
        defaultVersion: "v1",
        data: "golden",
        evaluators: [scoreField],
        experimentPrefix: "extraction",
        argv: ["node", "eval.ts"],
      },
      {
        env: {},
        loadExamples: async () => examples,
        evaluate: async () => {
          throw new Error("must not run");
        },
        generate: async () => ({ text: "{}", finishReason: "stop" }),
        log: () => {},
        error: (line) => h.err.push(line),
      },
    );
    expect(code).toBe(1);
    expect(h.err).toContain("ANTHROPIC_API_KEY is not set");
  });

  test("an evaluate() rejection fails the run", async () => {
    const code = await runEval(
      {
        prompts,
        defaultVersion: "v1",
        data: "golden",
        evaluators: [scoreField],
        experimentPrefix: "extraction",
        argv: ["node", "eval.ts"],
      },
      {
        env: { ANTHROPIC_API_KEY: "ak-test" },
        loadExamples: async () => examples,
        evaluate: async () => {
          throw new Error("Run not created by target function.");
        },
        generate: async () => ({ text: "{}", finishReason: "stop" }),
        log: () => {},
        error: () => {},
      },
    );
    expect(code).toBe(1);
  });
});
