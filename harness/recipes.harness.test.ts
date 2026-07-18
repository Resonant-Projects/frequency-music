import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import type { WithoutSystemFields } from "convex/server";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { RECIPE_WHY_THIS_MATTERS } from "./fixtures/recipesInternalWhyThisMatters";
import { modules } from "./modules";

type HypothesisSeed = WithoutSystemFields<Doc<"hypotheses">>;

const baseHypothesis: HypothesisSeed = {
  title: "Test hypothesis",
  question: "Does 432Hz tuning change perceived warmth?",
  hypothesis: "Retuning to 432Hz increases perceived warmth",
  rationaleMd: "Seeded for harness test",
  sourceIds: [],
  status: "draft",
  visibility: "private",
  createdBy: "system",
  createdAt: 1000,
  updatedAt: 1000,
};

function seedHypothesis(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<HypothesisSeed> = {},
) {
  return t.run((ctx) =>
    ctx.db.insert("hypotheses", { ...baseHypothesis, ...overrides }),
  );
}

// Regression: validateGeneratedRecipePayload always emits parameters with a
// `kind` field; before plan 02 the create args validator rejected it as an
// unknown field, so every AI recipe generation failed at the create seam.
describe("recipes.create accepts generated parameter shape", () => {
  test("a parameters array including kind passes arg validation and persists", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    const hypothesisId = await seedHypothesis(t);

    const recipeId = await asSystem.mutation(api.recipes.create, {
      hypothesisId,
      title: "432Hz warmth litmus",
      bodyMd: "Render the same 8-bar phrase at 440 and 432.",
      parameters: [
        { kind: "tuning", type: "tuning", value: "432Hz reference" },
      ],
      dawChecklist: ["Set master tuning to 432Hz"],
    });

    const stored = await t.run((ctx) => ctx.db.get(recipeId));
    expect(stored?.parameters[0]!.kind).toBe("tuning");
    expect(stored?.parameters[0]!.value).toBe("432Hz reference");
  });
});

// Regression (plan 012): generateBatch's return validator omitted
// whyThisMatters while its results carry it (spread verbatim from
// generateFromHypothesis), so a successful batch failed return validation
// and discarded the whole run's results.
describe("recipes.generateBatch return validation", () => {
  test("preserves whyThisMatters from a generated recipe", async () => {
    const recipeModules = {
      ...modules,
      "./recipesInternal.ts": () =>
        import("./fixtures/recipesInternalWhyThisMatters"),
    };
    const t = convexTest(schema, recipeModules);
    const asSystem = t.withIdentity({ subject: "system" });

    await seedHypothesis(t, { status: "queued" });

    const result = await asSystem.action(api.recipes.generateBatch, {
      limit: 1,
    });

    expect(result[0]?.success).toBe(true);
    if (result[0]?.success) {
      expect(result[0].generated.whyThisMatters).toBe(RECIPE_WHY_THIS_MATTERS);
    }
  });
});
