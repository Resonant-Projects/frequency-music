import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";

// Declared before the module under test is imported: `promote` pulls in
// `varlock/auto-load`, which would otherwise resolve secrets from
// `.env.local`/1Password and make these tests environment-dependent.
vi.mock("varlock/auto-load", () => ({}));

import type { SpawnSyncReturns } from "node:child_process";
import {
  averageMeans,
  completeMeans,
  DEFAULT_STATS_WAIT,
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

  test("reads --stats-timeout in seconds, defaulting to 900", () => {
    expect(parseArgs([]).statsTimeoutSeconds).toBe(900);
    expect(parseArgs(["--stats-timeout", "1200"]).statsTimeoutSeconds).toBe(
      1200,
    );
    expect(parseArgs(["--stats-timeout", "0"]).statsTimeoutSeconds).toBe(0);
    expect(parseArgs(["--stats-timeout", "-5"]).statsTimeoutSeconds).toBe(900);
    expect(parseArgs(["--stats-timeout", "soon"]).statsTimeoutSeconds).toBe(
      900,
    );
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

/** A sleep that records each wait and resolves at once. */
function recorder() {
  const sleeps: number[] = [];
  const sleep = (ms: number) => {
    sleeps.push(ms);
    return Promise.resolve();
  };
  return { sleeps, sleep };
}

describe("completeMeans / readMeansForExperiment", () => {
  test("returns means only when every key has one score per example", () => {
    expect(
      completeMeans({ why_this_matters: { avg: 0, n: 4 } }, completed),
    ).toEqual({
      means: { why_this_matters: 0 },
    });
    expect(
      completeMeans({ why_this_matters: { avg: 0.5, n: 3 } }, completed),
    ).toEqual({
      missing: ["why_this_matters: 3/4 scores"],
    });
    expect(completeMeans({}, completed)).toEqual({
      missing: ["why_this_matters: no mean"],
    });
  });

  const wait = { timeoutMs: 10, initialDelayMs: 1, maxDelayMs: 4 };
  const partial = { feedback_stats: { why_this_matters: { avg: 0.9, n: 2 } } };
  const full = { feedback_stats: { why_this_matters: { avg: 0.75, n: 4 } } };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("defaults to a 15-minute budget backing off from 2.5 s to 60 s", () => {
    expect(DEFAULT_STATS_WAIT).toEqual({
      timeoutMs: 900_000,
      initialDelayMs: 2_500,
      maxDelayMs: 60_000,
    });
  });

  test("backs off up to the cap and spends exactly the budget before refusing", async () => {
    const readProject = vi.fn().mockResolvedValue(partial);
    const { sleeps, sleep } = recorder();
    await expect(
      readMeansForExperiment({ readProject } as never, completed, wait, sleep),
    ).rejects.toThrow(
      "after 5 reads over 0.0 s of waiting (why_this_matters: 2/4 scores); refusing partial scores",
    );
    expect(sleeps).toEqual([1, 2, 4, 3]);
    expect(readProject).toHaveBeenCalledTimes(5);
  });

  test("the default budget bounds the reads", async () => {
    const readProject = vi.fn().mockResolvedValue(partial);
    const { sleeps, sleep } = recorder();
    await expect(
      readMeansForExperiment(
        { readProject } as never,
        completed,
        DEFAULT_STATS_WAIT,
        sleep,
      ),
    ).rejects.toThrow("refusing partial scores");
    expect(sleeps.reduce((a, b) => a + b, 0)).toBe(900_000);
    expect(Math.max(...sleeps)).toBe(60_000);
    expect(readProject).toHaveBeenCalledTimes(sleeps.length + 1);
  });

  test("waits for complete feedback", async () => {
    const readProject = vi
      .fn()
      .mockResolvedValueOnce({ feedback_stats: {} })
      .mockResolvedValueOnce(partial)
      .mockResolvedValueOnce(full);
    const { sleeps, sleep } = recorder();
    await expect(
      readMeansForExperiment({ readProject }, completed, wait, sleep),
    ).resolves.toEqual({
      why_this_matters: 0.75,
    });
    expect(sleeps).toEqual([1, 2]);
  });

  test("retries a failed read and rethrows one on the final read", async () => {
    const recovering = vi
      .fn()
      .mockRejectedValueOnce(new Error("502"))
      .mockResolvedValueOnce(full);
    await expect(
      readMeansForExperiment(
        { readProject: recovering },
        completed,
        wait,
        recorder().sleep,
      ),
    ).resolves.toEqual({ why_this_matters: 0.75 });

    const failing = vi.fn().mockRejectedValue(new Error("502"));
    await expect(
      readMeansForExperiment(
        { readProject: failing },
        completed,
        wait,
        recorder().sleep,
      ),
    ).rejects.toThrow("502");
    expect(failing).toHaveBeenCalledTimes(5);
  });

  test("a zero budget reads once", async () => {
    const readProject = vi.fn().mockResolvedValue(partial);
    const { sleeps, sleep } = recorder();
    await expect(
      readMeansForExperiment(
        { readProject } as never,
        completed,
        { ...wait, timeoutMs: 0 },
        sleep,
      ),
    ).rejects.toThrow("after 1 reads");
    expect(sleeps).toEqual([]);
  });

  test("rejects a wait that could never advance", async () => {
    const readProject = vi.fn().mockResolvedValue(partial);
    await expect(
      readMeansForExperiment({ readProject } as never, completed, {
        ...wait,
        initialDelayMs: 0,
      }),
    ).rejects.toThrow("Invalid feedback wait");
    expect(readProject).not.toHaveBeenCalled();
  });
});
