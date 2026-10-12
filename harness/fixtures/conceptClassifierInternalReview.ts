"use node";
import { v } from "convex/values";
import { internalAction } from "../../convex/_generated/server";
import { parseConceptClassificationItems } from "../../convex/conceptClassification";

export const generateClassifications = internalAction({
  args: {
    system: v.string(),
    prompt: v.string(),
    model: v.string(),
    expectedCount: v.number(),
  },
  handler: (_ctx, args) => ({
    ...parseConceptClassificationItems(
      {
        classifications: Array.from(
          { length: args.expectedCount },
          (_, index) => ({
            domains: index % 2 === 0 ? ["invented-domain"] : [],
            missionRelevance: "on",
            rationale: "This concept needs a domain review before assignment.",
          }),
        ),
      },
      args.expectedCount,
    ),
    inputTokens: 10,
    outputTokens: 5,
  }),
});
