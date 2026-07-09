"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { generateLlmText } from "./llmNode";

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
  handler: (_ctx, args) =>
    generateLlmText({
      task: "hypothesis_v1",
      model: args.model,
      system: args.system,
      prompt: args.prompt,
      metadata: {
        extractionId: args.extractionId,
        sourceId: args.sourceId,
        promptVersion: args.promptVersion,
      },
    }),
});
