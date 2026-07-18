"use node";
import { v } from "convex/values";
import { internalAction } from "../../convex/_generated/server";

export const RECIPE_WHY_THIS_MATTERS =
  "It tests whether a small tuning shift changes perceived warmth.";

export const generateRecipeText = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    hypothesisId: v.id("hypotheses"),
    promptVersion: v.string(),
  },
  returns: v.object({ text: v.string() }),
  handler: () => ({
    text: JSON.stringify({
      title: "432Hz warmth litmus",
      whyThisMatters: RECIPE_WHY_THIS_MATTERS,
      bodyMd: "Render the same phrase at 440Hz and 432Hz.",
      parameters: [
        { kind: "tuning", type: "tuning", value: "432Hz reference" },
      ],
      dawChecklist: ["Set master tuning to 432Hz"],
    }),
  }),
});
