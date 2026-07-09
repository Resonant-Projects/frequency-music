import { describe, expect, test } from "bun:test";
import { recipeParameterValidator } from "./validators";
import { validateGeneratedRecipePayload } from "./recipes";

const generatedPayload = {
  title: "Test 432Hz drone bed",
  bodyMd: "Layer a drone at 432Hz.",
  parameters: [{ kind: "frequency", type: "frequency", value: "432Hz" }],
  dawChecklist: ["Set project tuning"],
};

describe("generated recipe payload vs create args validator", () => {
  test("validated parameters always carry kind", () => {
    const parsed = validateGeneratedRecipePayload(generatedPayload);
    for (const param of parsed.parameters) {
      expect(param.kind).toBeDefined();
    }
  });

  test("every produced parameter key is accepted by the canonical parameter validator", () => {
    const parsed = validateGeneratedRecipePayload(generatedPayload);
    const allowed = new Set(Object.keys(recipeParameterValidator.fields));
    for (const param of parsed.parameters) {
      for (const key of Object.keys(param)) {
        expect(allowed.has(key)).toBe(true);
      }
    }
  });
});
