import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import { modules } from "../harness/modules";
import { recipeParameterValidator } from "./validators";
import { validateGeneratedRecipePayload } from "./recipes";
import schema from "./schema";

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

describe("recipe starter-kit linkage", () => {
  test("auth-guarded recipe updates persist and return starter-kit metadata", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await t.run(async (ctx) => {
      const hypothesisId = await ctx.db.insert("hypotheses", {
        title: "Test hypothesis",
        question: "Does the tuning change perception?",
        hypothesis: "The tuning changes perception.",
        rationaleMd: "A controlled comparison can reveal the effect.",
        sourceIds: [],
        status: "active",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("recipes", {
        hypothesisId,
        title: "Starter kit test",
        bodyMd: "Build the comparison.",
        parameters: [],
        dawChecklist: [],
        status: "draft",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const starterKit = {
      generatedAt: 1234,
      path: "exports/starter-kits/starter-kit-test",
      manifest: ["tuning.scl", "tuning.kbm", "seed.mid", "card.md"],
    };

    await t.withIdentity({ subject: "user-1", tokenIdentifier: "test" }).mutation(
      api.recipes.update,
      { id: recipeId, starterKit },
    );

    const recipe = await t.query(api.recipes.get, { id: recipeId });
    expect(recipe?.starterKit).toEqual(starterKit);
  });
});
