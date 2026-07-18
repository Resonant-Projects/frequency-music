import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { internalAction } from "./_generated/server";
import schema from "./schema";
import { recipeParameterValidator } from "./validators";
import { validateGeneratedRecipePayload } from "./recipes";
import { modules } from "../harness/modules";

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

describe("recipes.generateBatch", () => {
  test("preserves whyThisMatters from a generated recipe", async () => {
    const whyThisMatters =
      "It tests whether a small tuning shift changes perceived warmth.";
    const recipeModules = {
      ...modules,
      "./recipesInternal.ts": async () => ({
        generateRecipeText: internalAction({
          args: {
            system: v.string(),
            prompt: v.string(),
            model: v.string(),
            hypothesisId: v.id("hypotheses"),
            promptVersion: v.string(),
          },
          returns: v.object({ text: v.string() }),
          handler: async () => ({
            text: JSON.stringify({
              title: "432Hz warmth litmus",
              whyThisMatters,
              bodyMd: "Render the same phrase at 440Hz and 432Hz.",
              parameters: [
                { kind: "tuning", type: "tuning", value: "432Hz reference" },
              ],
              dawChecklist: ["Set master tuning to 432Hz"],
            }),
          }),
        }),
      }),
    };
    const t = convexTest(schema, recipeModules);
    const asSystem = t.withIdentity({ subject: "system" });

    await t.run((ctx) =>
      ctx.db.insert("hypotheses", {
        title: "Test tuning warmth",
        question: "Does 432Hz tuning change perceived warmth?",
        hypothesis: "Retuning to 432Hz increases perceived warmth.",
        rationaleMd: "Seeded for batch return validation.",
        sourceIds: [],
        status: "queued",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    const result = await asSystem.action(api.recipes.generateBatch, { limit: 1 });

    expect(result[0]?.success).toBe(true);
    if (result[0]?.success) {
      expect(result[0].generated.whyThisMatters).toBe(whyThisMatters);
    }
  });
});
