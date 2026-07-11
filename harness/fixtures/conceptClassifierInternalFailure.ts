"use node";
import { v } from "convex/values";
import { z } from "zod";
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
        domains: v.array(v.string()),
        missionRelevance: v.union(v.literal("on"), v.literal("off")),
        rationale: v.string(),
      }),
    ),
    inputTokens: v.number(),
    outputTokens: v.number(),
  }),
  handler: (_ctx, args) => {
    if (args.expectedCount > 1) {
      z.object({ classifications: z.array(z.never()) }).parse({
        classifications: [{ invalid: true }],
      });
    }
    return {
      classifications: [
        {
          domains: ["cymatics"],
          missionRelevance: "on" as const,
          rationale: "This valid trailing batch should still be assigned.",
        },
      ],
      inputTokens: 10,
      outputTokens: 5,
    };
  },
});
