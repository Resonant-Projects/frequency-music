"use node";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { tracedGenerate } from "./tracing";

// See hypothesesInternal.ts for the split rationale. weeklyBriefs.generateBriefCore
// delegates its traced AI call here so weeklyBriefs.ts stays a mixed V8 module
// (its DB reads run in the loadBriefContext internalQuery).
export const generateBriefText = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    weekOf: v.string(),
    promptVersion: v.string(),
    numHypotheses: v.number(),
    numRecipes: v.number(),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({ text: v.string() }),
  handler: async (_ctx, args) => {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured");
    const openrouter = createOpenRouter({ apiKey: openRouterKey });

    const { text } = await tracedGenerate(
      "brief_v2.phase3",
      () =>
        generateText({
          model: openrouter(args.model),
          system: args.system,
          prompt: args.prompt,
          maxOutputTokens: 4000,
        }),
      {
        weekOf: args.weekOf,
        model: args.model,
        promptVersion: args.promptVersion,
        numHypotheses: args.numHypotheses,
        numRecipes: args.numRecipes,
        ...(args.campaignId ? { campaignId: args.campaignId } : {}),
      },
    );

    return { text };
  },
});
