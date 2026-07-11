"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import {
  conceptClassificationLlmSchema,
  parseConceptClassificationOutput,
} from "./conceptClassification";
import { generateLlmObject } from "./llmNode";

export const generateClassifications = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    expectedCount: v.number(),
  },
  returns: v.object({
    classifications: v.array(
      v.object({
        domains: v.array(v.string()),
        missionRelevance: v.union(v.literal("on"), v.literal("off")),
        rationale: v.string(),
      }),
    ),
    inputTokens: v.number(),
    outputTokens: v.number(),
  }),
  handler: async (_ctx, args) => {
    const generated = await generateLlmObject({
      task: "concept_classifier_v1",
      model: args.model,
      system: args.system,
      prompt: args.prompt,
      schema: conceptClassificationLlmSchema,
      schemaName: "concept_classifications",
      schemaDescription:
        "One registry-constrained domain and mission-relevance classification per input concept, in input order.",
      metadata: { conceptCount: args.expectedCount },
    });
    const classifications = parseConceptClassificationOutput(
      generated.object,
      args.expectedCount,
    );
    return {
      classifications,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
    };
  },
});
