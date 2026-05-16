import { z } from "zod";

export const weeklyBriefOutputSchema = z.object({
  title: z.string().min(1),
  summaryMd: z.string().min(1),
  activeThesisIds: z.array(z.string()).default([]),
  referencedFailureKeys: z.array(z.string()).default([]),
  recommendedHypothesisIds: z.array(z.string()).default([]),
  recommendedRecipeIds: z.array(z.string()).default([]),
  experimentCards: z
    .array(
      z.object({
        title: z.string().min(1),
        whyThisMatters: z.string().min(1),
        sourceIds: z.array(z.string()).default([]),
        recipeId: z.string().optional(),
        durationBucket: z.enum(["10-minute", "30-minute", "90-minute"]),
      }),
    )
    .min(3),
  contradictionsOrWeakPaths: z.array(z.string()).default([]),
  studioPrompts: z.object({
    tenMinuteMd: z.string().min(1),
    thirtyMinuteMd: z.string().min(1),
    ninetyMinuteMd: z.string().min(1),
  }),
  todo: z.array(z.string()).default([]),
});

export type WeeklyBriefOutput = z.infer<typeof weeklyBriefOutputSchema>;
