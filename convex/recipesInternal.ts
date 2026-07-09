"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { generateLlmText } from "./llmNode";

// See hypothesesInternal.ts for the split rationale. recipes.generateFromHypothesis
// delegates its traced AI call here so recipes.ts stays a mixed V8 module.
export const generateRecipeText = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    hypothesisId: v.id("hypotheses"),
    promptVersion: v.string(),
  },
  returns: v.object({ text: v.string() }),
  handler: (_ctx, args) =>
    generateLlmText({
      task: "recipe_v1",
      model: args.model,
      system: args.system,
      prompt: args.prompt,
      metadata: {
        hypothesisId: args.hypothesisId,
        promptVersion: args.promptVersion,
      },
    }),
});
