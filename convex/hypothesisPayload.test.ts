import { describe, expect, test } from "vite-plus/test";
import { projectGeneratedHypothesis } from "./hypothesisPayload";

const valid = {
  title: "Slow tempo and recall",
  question: "Does a slower tempo improve recall?",
  hypothesis: "Listeners recall more lyrics at 60 BPM than at 120 BPM.",
  whyThisMatters: "It sets the tempo range for study playlists.",
  rationaleMd: "Two Claims point the same way.",
  concepts: ["tempo", "memory"],
};

describe("projectGeneratedHypothesis", () => {
  test("returns a valid payload unchanged", () => {
    expect(projectGeneratedHypothesis(valid)).toEqual(valid);
  });

  test("drops a key the return validator does not allow", () => {
    const projected = projectGeneratedHypothesis({ ...valid, confidence: 0.9 });
    expect(projected).toEqual(valid);
    expect(projected).not.toHaveProperty("confidence");
  });

  test("throws when a required field is missing", () => {
    const { title: _title, ...withoutTitle } = valid;
    expect(() => projectGeneratedHypothesis(withoutTitle)).toThrow(
      "generated.title is missing",
    );
  });

  test("throws when a required field is only whitespace", () => {
    expect(() =>
      projectGeneratedHypothesis({ ...valid, hypothesis: "   " }),
    ).toThrow("generated.hypothesis is missing");
  });

  test("rejects a missing whyThisMatters through the shared check", () => {
    const { whyThisMatters: _why, ...withoutWhy } = valid;
    expect(() => projectGeneratedHypothesis(withoutWhy)).toThrow(
      "generated.whyThisMatters is required",
    );
  });

  test("leaves out concepts that are not an array", () => {
    const projected = projectGeneratedHypothesis({
      ...valid,
      concepts: "a, b",
    });
    expect(projected).not.toHaveProperty("concepts");
  });

  test("keeps only the string concepts", () => {
    expect(
      projectGeneratedHypothesis({ ...valid, concepts: ["a", 3, "b"] })
        .concepts,
    ).toEqual(["a", "b"]);
  });

  test.each([
    ["null", null],
    ["an array", [valid]],
    ["a string", JSON.stringify(valid)],
  ])("throws when the payload is %s", (_label, raw) => {
    expect(() => projectGeneratedHypothesis(raw)).toThrow(
      "generated payload is not an object",
    );
  });
});
