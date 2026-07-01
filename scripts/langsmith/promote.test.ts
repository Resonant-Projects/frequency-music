import { describe, expect, test } from "bun:test";
import {
  averageMeans,
  evaluateRubric,
  extractMeans,
  parseArgs,
  parseBaselinesDoc,
  parseExperimentName,
  renderBaselineDiff,
} from "./promote";

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

describe("parseExperimentName", () => {
  test("extracts the langsmith experiment name", () => {
    expect(
      parseExperimentName(
        "Starting evaluation of experiment: hypothesis-v2-1a2b3c4d\nmore logs",
      ),
    ).toBe("hypothesis-v2-1a2b3c4d");
  });

  test("returns null when absent", () => {
    expect(parseExperimentName("no experiment here")).toBeNull();
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
