"use node";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { tracedGenerate } from "./tracing";

// V8-runtime queries/mutations stay in hypotheses.ts; only the traced AI call is
// split out here so hypotheses.ts can remain a mixed (query+mutation+action)
// module while the generateText call runs in the Node runtime tracedGenerate
// needs. hypotheses.generateFromExtraction delegates to this via ctx.runAction,
// keeping the api.hypotheses.* namespace stable for all existing call sites.
export const generateHypothesisText = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    extractionId: v.id("extractions"),
    sourceId: v.id("sources"),
    promptVersion: v.string(),
  },
  returns: v.object({ text: v.string() }),
  handler: async (_ctx, args) => {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured");
    const openrouter = createOpenRouter({ apiKey: openRouterKey });

    const { text } = await tracedGenerate(
      "hypothesis_v1",
      () =>
        generateText({
          model: openrouter(args.model),
          system: args.system,
          prompt: args.prompt,
          maxOutputTokens: 2000,
        }),
      {
        extractionId: args.extractionId,
        sourceId: args.sourceId,
        model: args.model,
        promptVersion: args.promptVersion,
      },
    );

    return { text };
  },
});
