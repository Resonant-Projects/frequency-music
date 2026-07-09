"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { generateLlmText } from "./llmNode";

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
  handler: (_ctx, args) =>
    generateLlmText({
      task: "brief_v2",
      // Eval baselines reference this exact LangSmith run name; the budget
      // key (brief_v2) and the trace name differ by design.
      traceName: "brief_v2.phase3",
      model: args.model,
      system: args.system,
      prompt: args.prompt,
      metadata: {
        weekOf: args.weekOf,
        promptVersion: args.promptVersion,
        numHypotheses: args.numHypotheses,
        numRecipes: args.numRecipes,
        ...(args.campaignId ? { campaignId: args.campaignId } : {}),
      },
    }),
});
