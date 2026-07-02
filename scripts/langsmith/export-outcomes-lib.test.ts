import { describe, expect, test } from "bun:test";
import {
  type LineageLike,
  deriveOutcome,
  formatOutcomeTable,
  groupByPromptVersion,
  outcomeRowFromLineage,
  outcomeToExample,
} from "./export-outcomes-lib";

describe("deriveOutcome", () => {
  test("failure status wins over expand verdict", () => {
    expect(
      deriveOutcome({
        latestExpandVerdict: "yes",
        localFailureStatus: "low_expandability_composition",
      }),
    ).toEqual({ outcome: "failure_archived", failureReason: "low_expandability_composition" });
  });

  test("falls back to branch failure status", () => {
    expect(
      deriveOutcome({ branchFailureStatus: "repeat_no_expand_composition" }),
    ).toEqual({ outcome: "failure_archived", failureReason: "repeat_no_expand_composition" });
  });

  test("maps expand verdicts", () => {
    expect(deriveOutcome({ latestExpandVerdict: "yes" })).toEqual({
      outcome: "expand",
      failureReason: null,
    });
    expect(deriveOutcome({ latestExpandVerdict: "maybe" })).toEqual({
      outcome: "repeat",
      failureReason: null,
    });
    expect(deriveOutcome({ latestExpandVerdict: "no" })).toEqual({
      outcome: "no_expand",
      failureReason: null,
    });
  });

  test("returns null when there is no signal", () => {
    expect(deriveOutcome({})).toBeNull();
  });
});

describe("outcomeRowFromLineage", () => {
  const base: LineageLike = {
    composition: { _id: "comp1" },
    recipe: { _id: "rec1" },
    hypothesis: { _id: "hyp1" },
    extractions: [
      { model: "anthropic/claude-sonnet-4-6", promptVersion: "extract_v2" },
      { model: "old", promptVersion: "extract_v1" },
    ],
    summary: { latestExpandVerdict: "yes" },
  };

  test("pulls promptVersion/model from the most-recent extraction, provider null", () => {
    const row = outcomeRowFromLineage(base);
    expect(row).toEqual({
      compositionId: "comp1",
      hypothesisId: "hyp1",
      recipeId: "rec1",
      outcome: "expand",
      failureReason: null,
      promptVersion: "extract_v2",
      model: "anthropic/claude-sonnet-4-6",
      provider: null,
    });
  });

  test("returns null for unlabeled compositions", () => {
    expect(outcomeRowFromLineage({ ...base, summary: {} })).toBeNull();
  });

  test("tolerates missing recipe/hypothesis/extractions", () => {
    const row = outcomeRowFromLineage({
      composition: { _id: "comp2" },
      recipe: null,
      hypothesis: null,
      summary: { latestExpandVerdict: "no" },
    });
    expect(row).toMatchObject({
      compositionId: "comp2",
      hypothesisId: null,
      recipeId: null,
      outcome: "no_expand",
      promptVersion: null,
      model: null,
    });
  });
});

describe("groupByPromptVersion", () => {
  test("counts per outcome and computes expand rate", () => {
    const rows = [
      outcomeRowFromLineage({
        composition: { _id: "c1" },
        extractions: [{ promptVersion: "v1", model: "m" }],
        summary: { latestExpandVerdict: "yes" },
      })!,
      outcomeRowFromLineage({
        composition: { _id: "c2" },
        extractions: [{ promptVersion: "v1", model: "m" }],
        summary: { latestExpandVerdict: "no" },
      })!,
      outcomeRowFromLineage({
        composition: { _id: "c3" },
        summary: { latestExpandVerdict: "maybe" },
      })!,
    ];
    const groups = groupByPromptVersion(rows);
    expect(groups).toHaveLength(2);
    const v1 = groups.find((g) => g.promptVersion === "v1")!;
    expect(v1.counts).toEqual({ expand: 1, repeat: 0, no_expand: 1, failure_archived: 0 });
    expect(v1.total).toBe(2);
    expect(v1.expandRate).toBeCloseTo(0.5);
    const unknown = groups.find((g) => g.promptVersion === "unknown")!;
    expect(unknown.counts.repeat).toBe(1);
  });
});

describe("formatOutcomeTable", () => {
  test("renders a header and one row per group", () => {
    const table = formatOutcomeTable(
      groupByPromptVersion([
        outcomeRowFromLineage({
          composition: { _id: "c1" },
          extractions: [{ promptVersion: "v1", model: "m" }],
          summary: { latestExpandVerdict: "yes" },
        })!,
      ]),
    );
    expect(table).toContain("promptVersion");
    expect(table).toContain("v1");
    expect(table).toContain("100.0%");
  });
});

describe("outcomeToExample", () => {
  test("shapes inputs/outputs/metadata for LangSmith", () => {
    const row = outcomeRowFromLineage({
      composition: { _id: "c1" },
      recipe: { _id: "r1" },
      hypothesis: { _id: "h1" },
      extractions: [{ promptVersion: "v1", model: "m" }],
      summary: { localFailureStatus: "archived_recipe" },
    })!;
    expect(outcomeToExample(row)).toEqual({
      inputs: {
        hypothesisId: "h1",
        recipeId: "r1",
        promptVersion: "v1",
        model: "m",
        provider: null,
      },
      outputs: { outcome: "failure_archived", failureReason: "archived_recipe" },
      metadata: { source: "studio_outcome", compositionId: "c1" },
    });
  });
});
