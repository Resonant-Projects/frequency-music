import { expect, test, vi } from "vite-plus/test";

const { runEval } = vi.hoisted(() => ({ runEval: vi.fn() }));
vi.mock("./eval-helper", () => ({
  runEval,
  stringifyPromptValue: (value: unknown) => String(value),
}));
vi.mock("./evaluators/judge", () => ({
  makeJudgeEvaluator: () =>
    async function judge() {
      return { key: "judge", score: 0 };
    },
}));

test("the hypothesis runner designs on the Opus hypothesis task", async () => {
  runEval.mockClear();
  await import("./eval-hypothesis");
  const options = runEval.mock.calls[0]?.[0];
  expect(options.defaultVersion).toBe("v1");
  expect(options.prompts.v1.task).toBe("hypothesis_v1");
  expect(options).not.toHaveProperty("maxOutputTokens");
});

test("the weekly-brief runner uses the brief task and keeps its judge", async () => {
  runEval.mockClear();
  await import("./eval-weekly-brief");
  const options = runEval.mock.calls[0]?.[0];
  expect(options.prompts.v1.task).toBe("brief_v2");
  expect(options.evaluators.map((e: { name: string }) => e.name)).toEqual([
    "briefSchemaLite",
    "thesisReferenceCheck",
    "contradictionMentionCheck",
    "judge",
  ]);
});
