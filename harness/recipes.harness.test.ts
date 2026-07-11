import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

// Regression: validateGeneratedRecipePayload always emits parameters with a
// `kind` field; before plan 02 the create args validator rejected it as an
// unknown field, so every AI recipe generation failed at the create seam.
describe("recipes.create accepts generated parameter shape", () => {
  test("a parameters array including kind passes arg validation and persists", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });

    const hypothesisId = await t.run((ctx) =>
      ctx.db.insert("hypotheses", {
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
      }),
    );

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
