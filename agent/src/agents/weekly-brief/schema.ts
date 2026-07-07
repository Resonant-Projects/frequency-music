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
  // "What the system learned" (plan 05 task 5). Built from the read-only
  // get_self_improvement_stats tool. Optional and every array defaults to
  // empty so a fresh window (no edits, no decided drafts, no memory recalls)
  // degrades gracefully instead of forcing a fabricated entry. When there is
  // nothing to report, either omit this field or set summaryMd to a short
  // "nothing new this week" line with the (accurate, zero) counts below —
  // never invent numbers not returned by the tool.
  whatTheSystemLearned: z
    .object({
      summaryMd: z.string().min(1),
      editCapturesCount: z.number().int().nonnegative(),
      draftsApproved: z.number().int().nonnegative(),
      draftsRejected: z.number().int().nonnegative(),
      // Themes the model summarizes from the tool's raw rejectionNotes —
      // that synthesis is what the LLM is for, not more Convex plumbing.
      rejectionThemes: z.array(z.string()).default([]),
      // Only populated when the memory store (plan 05 task 3, gated on
      // Proxmox soak) actually produced recalls that changed a decision.
      memoryRecallNotes: z.array(z.string()).default([]),
      // No queryable store exists yet for prompt/policy promotions (they
      // live in docs/eval-baselines.md + the decision log via
      // scripts/langsmith/promote.ts) — this stays empty until one does.
      promptPromotions: z.array(z.string()).default([]),
    })
    .optional(),
});

export type WeeklyBriefOutput = z.infer<typeof weeklyBriefOutputSchema>;
