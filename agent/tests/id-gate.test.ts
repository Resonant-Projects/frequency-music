import { describe, expect, test } from "vite-plus/test";

import {
  collectPayloadIds,
  findHallucinatedIds,
  hallucinatedIdError,
} from "../src/graphs/research-pipeline/idGate";
import type {
  HypothesisDraftPayload,
  RecipeDraftPayload,
} from "../src/state/researchPipelineState";

const hypothesisPayload: HypothesisDraftPayload = {
  title: "Astrolabe consonance",
  question: "Does polygon-angle tuning raise perceived consonance?",
  statement: "Polygon-angle temperament increases consonance ratings.",
  rationale: "Grounded in the geometric-temperament extraction.",
  whyThisMatters: "Bridges geometry and psychoacoustics for the workbench.",
  sourceIds: ["src_1", "src_2"],
  extractionIds: ["ext_1"],
  thesisId: "thesis_1",
};

const recipePayload: RecipeDraftPayload = {
  hypothesisId: "hyp_1",
  title: "Litmus study for astrolabe tuning",
  parameters: [{ value: "440Hz base" }],
  whyThisMatters: "Validates the hypothesis empirically.",
};

describe("hallucinated-ID gate", () => {
  test("collects every id-like field from a hypothesis payload", () => {
    expect(collectPayloadIds(hypothesisPayload).toSorted()).toEqual(
      ["ext_1", "src_1", "src_2", "thesis_1"].toSorted(),
    );
  });

  test("collects hypothesisId from a recipe payload", () => {
    expect(collectPayloadIds(recipePayload)).toEqual(["hyp_1"]);
  });

  test("passes when every payload id was read during the run", () => {
    const seenIds = ["src_1", "src_2", "ext_1", "thesis_1", "unrelated_id"];
    expect(findHallucinatedIds(hypothesisPayload, seenIds)).toEqual([]);
  });

  test("flags a hallucinated id that was never read", () => {
    const seenIds = ["src_1", "ext_1", "thesis_1"]; // src_2 missing
    expect(findHallucinatedIds(hypothesisPayload, seenIds)).toEqual(["src_2"]);
  });

  test("flags a hallucinated recipe hypothesisId", () => {
    expect(findHallucinatedIds(recipePayload, ["other_hyp"])).toEqual([
      "hyp_1",
    ]);
    expect(findHallucinatedIds(recipePayload, ["hyp_1"])).toEqual([]);
  });

  test("empty seenIds flags all referenced ids, de-duplicated", () => {
    const dupePayload: HypothesisDraftPayload = {
      ...hypothesisPayload,
      sourceIds: ["src_1", "src_1"],
      extractionIds: [],
      thesisId: undefined,
    };
    expect(findHallucinatedIds(dupePayload, [])).toEqual(["src_1"]);
  });

  test("produces a loud, descriptive error string", () => {
    const message = hallucinatedIdError(["src_2", "ext_9"]);
    expect(message).toContain("Hallucinated-ID gate");
    expect(message).toContain("src_2");
    expect(message).toContain("ext_9");
    expect(message).toContain("Refusing to persist draft");
  });
});
