import { describe, expect, test } from "vite-plus/test";
import type { Run } from "langsmith";
import {
  describeFailure,
  EvalInfrastructureError,
  formatCompletionMarker,
  guardEvaluators,
  parseCompletionMarker,
  validateExperimentRows,
} from "./run-guard";

const row = (
  id: string,
  results: Array<{ key: string; score: unknown }>,
  run: { error?: unknown; outputs?: unknown } = { outputs: { a: 1 } },
) => ({ run, example: { id }, evaluationResults: { results } });

describe("describeFailure", () => {
  test("keeps the name, status and a bounded redacted message", () => {
    const error = Object.assign(
      new Error("bad key sk-ant-abc123 " + "x".repeat(400)),
      {
        name: "AI_APICallError",
        statusCode: 401,
        requestBodyValues: { prompt: "private" },
      },
    );
    const text = describeFailure(error);
    expect(text).toMatch(/^AI_APICallError \(HTTP 401\): bad key \[redacted\]/);
    expect(text).not.toContain("private");
    expect(text.length).toBeLessThan(260);
  });

  test("passes an infrastructure error's safe message through", () => {
    expect(describeFailure(new EvalInfrastructureError("truncated"))).toBe(
      "truncated",
    );
  });
});

describe("validateExperimentRows", () => {
  test("passes complete rows, including valid zero scores", () => {
    const report = validateExperimentRows({
      rows: [
        row("a", [{ key: "k", score: 0 }]),
        row("b", [{ key: "k", score: 1 }]),
      ],
      expectedExampleIds: ["a", "b"],
      evaluatorCount: 1,
      evaluatorFailures: [],
    });
    expect(report).toEqual({ ok: true, problems: [], evaluatorKeys: ["k"] });
  });

  test.each([
    ["no rows", [], ["a"]],
    ["a missing row", [row("a", [{ key: "k", score: 1 }])], ["a", "b"]],
    [
      "a duplicate row",
      [row("a", [{ key: "k", score: 1 }]), row("a", [{ key: "k", score: 1 }])],
      ["a"],
    ],
    ["an empty dataset", [], []],
    ["a target error", [row("a", [], { error: "Error: boom" })], ["a"]],
    ["no outputs", [row("a", [], {})], ["a"]],
    ["a missing score", [row("a", [])], ["a"]],
    ["a null score", [row("a", [{ key: "k", score: null }])], ["a"]],
  ])("fails on %s", (_name, rows, expectedExampleIds) => {
    const report = validateExperimentRows({
      rows,
      expectedExampleIds,
      evaluatorCount: 1,
      evaluatorFailures: [],
    });
    expect(report.ok).toBe(false);
  });

  test("fails on inconsistent evaluator keys across rows", () => {
    const report = validateExperimentRows({
      rows: [
        row("a", [{ key: "k", score: 1 }]),
        row("b", [{ key: "j", score: 1 }]),
      ],
      expectedExampleIds: ["a", "b"],
      evaluatorCount: 1,
      evaluatorFailures: [],
    });
    expect(report.ok).toBe(false);
  });

  test("fails on a recorded evaluator failure", () => {
    const report = validateExperimentRows({
      rows: [row("a", [{ key: "k", score: 1 }])],
      expectedExampleIds: ["a"],
      evaluatorCount: 1,
      evaluatorFailures: [{ exampleId: "a", evaluator: "j", reason: "boom" }],
    });
    expect(report.ok).toBe(false);
    expect(report.problems.join("\n")).toContain("evaluator j: boom");
  });
});

describe("guardEvaluators", () => {
  const ok = { outputs: { a: 1 } } as unknown as Run;

  test("does not score a failed target run", async () => {
    let called = false;
    const { evaluators } = guardEvaluators([
      () => {
        called = true;
        return { key: "k", score: 0 };
      },
    ]);
    await expect(
      evaluators[0]!({ error: "boom" } as unknown as Run),
    ).rejects.toBeInstanceOf(EvalInfrastructureError);
    expect(called).toBe(false);
  });

  test("records and sanitizes an evaluator exception", async () => {
    const { evaluators, failures } = guardEvaluators([
      function judge() {
        throw Object.assign(new Error("down"), { statusCode: 503 });
      },
    ]);
    await expect(evaluators[0]!(ok, { id: "ex" } as never)).rejects.toThrow(
      "judge failed: Error (HTTP 503): down",
    );
    expect(failures).toEqual([
      { exampleId: "ex", evaluator: "judge", reason: "Error (HTTP 503): down" },
    ]);
  });

  test("rejects results without a finite 0..1 score", async () => {
    const { evaluators, failures } = guardEvaluators([
      () => ({ key: "k", score: 2 }),
      () => ({ key: "k" }),
    ]);
    await expect(evaluators[0]!(ok)).rejects.toThrow();
    await expect(evaluators[1]!(ok)).rejects.toThrow();
    expect(failures).toHaveLength(2);
  });

  test("passes valid results through, keeping the evaluator name", async () => {
    const named = function parameterSpecificity() {
      return { key: "k", score: 0 };
    };
    const { evaluators, failures } = guardEvaluators([named]);
    expect(evaluators[0]!.name).toBe("parameterSpecificity");
    await expect(evaluators[0]!(ok)).resolves.toEqual({ key: "k", score: 0 });
    expect(failures).toEqual([]);
  });
});

describe("completion marker", () => {
  test("round-trips and uses the last marker", () => {
    const first = { experiment: "x-1", examples: 2, evaluatorKeys: ["a"] };
    const last = { experiment: "x-2", examples: 3, evaluatorKeys: ["a", "b"] };
    const out = `noise\n${formatCompletionMarker(first)}\n${formatCompletionMarker(last)}\n`;
    expect(parseCompletionMarker(out)).toEqual(last);
  });

  test.each([
    "",
    "EVAL_RUN_COMPLETE {bad json}",
    'EVAL_RUN_COMPLETE {"experiment":"x","examples":0,"evaluatorKeys":["a"]}',
    'EVAL_RUN_COMPLETE {"experiment":"x","examples":2,"evaluatorKeys":[]}',
    'prefix EVAL_RUN_COMPLETE {"experiment":"x","examples":2,"evaluatorKeys":["a"]}',
  ])("rejects %j", (output) => {
    expect(parseCompletionMarker(output)).toBeNull();
  });
});
