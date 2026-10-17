import { describe, expect, test, vi } from "vite-plus/test";

// Declared before the module under test is imported: `promote` pulls in
// `varlock/auto-load`, which would otherwise resolve secrets from
// `.env.local`/1Password and make these tests environment-dependent.
vi.mock("varlock/auto-load", () => ({}));

import type { SpawnSyncReturns } from "node:child_process";
import {
  averageMeans,
  completeMeans,
  evaluateRubric,
  extractMeans,
  parseArgs,
  parseBaselinesDoc,
  readMeansForExperiment,
  renderBaselineDiff,
  runExperiment,
  runnerCommand,
  TARGETS,
} from "./promote";
import { formatCompletionMarker } from "./run-guard";

describe("parseArgs", () => {
  test("parses target/candidate and applies defaults", () => {
    const a = parseArgs(["--target", "hypothesis", "--candidate", "v2"]);
    expect(a.target).toBe("hypothesis");
    expect(a.candidate).toBe("v2");
    expect(a.trials).toBe(2);
    expect(a.threshold).toBe(0.02);
    expect(a.help).toBe(false);
  });

  test("enforces a minimum of two trials", () => {
    expect(parseArgs(["--trials", "1"]).trials).toBe(2);
    expect(parseArgs(["--trials", "5"]).trials).toBe(5);
  });

  test("recognizes --help", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });
});

describe("extractMeans", () => {
  test("reads avg per evaluator key", () => {
    expect(
      extractMeans({
        why_this_matters: { n: 10, avg: 0.8 },
        judge: { n: 10, avg: 0.72 },
        bogus: { n: 0 },
      }),
    ).toEqual({ why_this_matters: 0.8, judge: 0.72 });
  });

  test("tolerates null/undefined", () => {
    expect(extractMeans(null)).toEqual({});
    expect(extractMeans(undefined)).toEqual({});
  });
});

describe("parseBaselinesDoc", () => {
  const md = `# Eval Baselines

## hypothesis

| evaluator | mean |
| --- | --- |
| why_this_matters | 0.80 |
| judge | 0.70 |

## extraction

| evaluator | mean |
| --- | --- |
| schema_valid | 1.0 |
`;

  test("scopes to the target section", () => {
    expect(parseBaselinesDoc(md, "hypothesis")).toEqual({
      why_this_matters: 0.8,
      judge: 0.7,
    });
    expect(parseBaselinesDoc(md, "extraction")).toEqual({ schema_valid: 1.0 });
  });

  test("returns empty when the target is not present", () => {
    expect(parseBaselinesDoc(md, "recipe")).toEqual({});
  });
});

describe("evaluateRubric", () => {
  test("PASS when candidate holds or improves everything", () => {
    const r = evaluateRubric({
      baselineMeans: { why_this_matters: 0.8, judge: 0.7 },
      candidateMeans: { why_this_matters: 0.82, judge: 0.75 },
      judgeKey: "judge",
      threshold: 0.02,
    });
    expect(r.pass).toBe(true);
    expect(r.judgeEvaluated).toBe(true);
  });

  test("FAIL when a non-judge evaluator regresses beyond threshold", () => {
    const r = evaluateRubric({
      baselineMeans: { why_this_matters: 0.8, judge: 0.7 },
      candidateMeans: { why_this_matters: 0.7, judge: 0.75 },
      judgeKey: "judge",
      threshold: 0.02,
    });
    expect(r.pass).toBe(false);
    const row = r.rows.find((x) => x.key === "why_this_matters");
    expect(row?.regressed).toBe(true);
  });

  test("tolerates a small regression within threshold", () => {
    const r = evaluateRubric({
      baselineMeans: { schema_valid: 1.0 },
      candidateMeans: { schema_valid: 0.99 },
      judgeKey: "judge",
      threshold: 0.02,
    });
    expect(r.pass).toBe(true);
  });

  test("FAIL when the judge score drops at all", () => {
    const r = evaluateRubric({
      baselineMeans: { judge: 0.7 },
      candidateMeans: { judge: 0.69 },
      judgeKey: "judge",
      threshold: 0.02,
    });
    expect(r.pass).toBe(false);
  });

  test("FAIL when an evaluator is missing on one side", () => {
    const r = evaluateRubric({
      baselineMeans: { why_this_matters: 0.8, judge: 0.7 },
      candidateMeans: { why_this_matters: 0.9 },
      judgeKey: "judge",
      threshold: 0.02,
    });
    expect(r.pass).toBe(false);
  });

  test("degrades gracefully when the judge evaluator did not run", () => {
    const r = evaluateRubric({
      baselineMeans: { why_this_matters: 0.8 },
      candidateMeans: { why_this_matters: 0.85 },
      judgeKey: "judge",
      threshold: 0.02,
    });
    expect(r.pass).toBe(true);
    expect(r.judgeEvaluated).toBe(false);
    expect(r.notes.some((n) => n.includes("judge"))).toBe(true);
  });
});

describe("averageMeans", () => {
  test("averages per key across trials", () => {
    expect(
      averageMeans([
        { a: 1.0, b: 0.5 },
        { a: 0.8, b: 0.7 },
      ]),
    ).toEqual({ a: 0.9, b: 0.6 });
  });
});

describe("renderBaselineDiff", () => {
  test("emits a markdown table under a target heading", () => {
    const out = renderBaselineDiff("hypothesis", "v2", {
      why_this_matters: 0.8123,
      judge: 0.75,
    });
    expect(out).toContain("## hypothesis (v2)");
    expect(out).toContain("| judge | 0.7500 |");
    expect(out).toContain("| why_this_matters | 0.8123 |");
  });
});

describe("extraction baseline default", () => {
  test("matches the runner default v3", () => {
    expect(TARGETS.extraction.defaultBaseline).toBe("v3");
  });
});

const completed = {
  experiment: "hypothesis-v2-abc",
  examples: 4,
  evaluatorKeys: ["why_this_matters"],
};

function spawnResult(
  overrides: Partial<SpawnSyncReturns<string>>,
): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
    ...overrides,
  };
}

describe("runExperiment", () => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  test("invokes the runner through vpx tsx with the version flag", () => {
    expect(runnerCommand("/r/eval-hypothesis.ts", "v2")).toEqual({
      command: "vpx",
      args: ["tsx", "/r/eval-hypothesis.ts", "--version", "v2"],
    });
    const spawn = vi.fn(() =>
      spawnResult({ stdout: `${formatCompletionMarker(completed)}\n` }),
    );
    expect(runExperiment("/r/eval-hypothesis.ts", "v2", spawn)).toEqual(
      completed,
    );
    expect(spawn).toHaveBeenCalledWith(
      "vpx",
      ["tsx", "/r/eval-hypothesis.ts", "--version", "v2"],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  test.each([
    ["a nonzero exit", { status: 1 }, "status 1"],
    ["a signal", { status: null, signal: "SIGTERM" as const }, "SIGTERM"],
    [
      "a spawn error",
      { status: null, error: new Error("spawn vpx ENOENT") },
      "ENOENT",
    ],
    [
      "a missing completion marker",
      { status: 0, stdout: "done" },
      "completion marker",
    ],
  ])("throws on %s", (_name, overrides, message) => {
    const spawn = vi.fn(() => spawnResult(overrides));
    expect(() => runExperiment("/r/x.ts", "v2", spawn)).toThrow(message);
  });

  test("a marker on a failed runner is still refused", () => {
    const spawn = vi.fn(() =>
      spawnResult({ status: 1, stdout: formatCompletionMarker(completed) }),
    );
    expect(() => runExperiment("/r/x.ts", "v2", spawn)).toThrow("status 1");
  });
});

describe("completeMeans / readMeansForExperiment", () => {
  test("returns means only when every key has one score per example", () => {
    expect(
      completeMeans({ why_this_matters: { avg: 0, n: 4 } }, completed),
    ).toEqual({ means: { why_this_matters: 0 } });
    expect(
      completeMeans({ why_this_matters: { avg: 0.5, n: 3 } }, completed),
    ).toEqual({ missing: ["why_this_matters: 3/4 scores"] });
    expect(completeMeans({}, completed)).toEqual({
      missing: ["why_this_matters: no mean"],
    });
  });

  test("throws on partial feedback instead of returning partial means", async () => {
    const client = {
      readProject: vi.fn(async () => ({
        feedback_stats: { why_this_matters: { avg: 0.9, n: 2 } },
      })),
    };
    await expect(
      readMeansForExperiment(client as never, completed, 3, 0),
    ).rejects.toThrow("refusing partial scores");
    expect(client.readProject).toHaveBeenCalledTimes(3);
  });

  test("waits for complete feedback", async () => {
    const readProject = vi
      .fn()
      .mockResolvedValueOnce({ feedback_stats: {} })
      .mockResolvedValueOnce({
        feedback_stats: { why_this_matters: { avg: 0.75, n: 4 } },
      });
    await expect(
      readMeansForExperiment({ readProject } as never, completed, 3, 0),
    ).resolves.toEqual({ why_this_matters: 0.75 });
  });
});
