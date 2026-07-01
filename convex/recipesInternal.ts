"use node";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { tracedGenerate } from "./tracing";

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
  handler: async (_ctx, args) => {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured");
    const openrouter = createOpenRouter({ apiKey: openRouterKey });

    const { text } = await tracedGenerate(
      "recipe_v1",
      () =>
        generateText({
          model: openrouter(args.model),
          system: args.system,
          prompt: args.prompt,
          // Fixed from the dead `maxTokens` param (ignored under AI SDK v6).
          maxOutputTokens: 3000,
        }),
      {
        hypothesisId: args.hypothesisId,
        model: args.model,
        promptVersion: args.promptVersion,
      },
    );

    return { text };
  },
});
