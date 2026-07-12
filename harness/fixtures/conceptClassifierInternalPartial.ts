"use node";
import { v } from "convex/values";
import { internalAction } from "../../convex/_generated/server";

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
        index: v.number(),
        classification: v.object({
          domains: v.array(v.string()),
          missionRelevance: v.union(v.literal("on"), v.literal("off")),
          rationale: v.string(),
        }),
      }),
    ),
    failed: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  }),
  handler: () => ({
    classifications: [
      {
        index: 0,
        classification: {
          domains: ["cymatics"],
          missionRelevance: "on" as const,
          rationale: "The first valid neighbor should be persisted.",
        },
      },
      {
        index: 2,
        classification: {
          domains: ["cymatics"],
          missionRelevance: "on" as const,
          rationale: "The second valid neighbor should be persisted.",
        },
      },
    ],
    failed: 1,
    inputTokens: 10,
    outputTokens: 5,
  }),
});
