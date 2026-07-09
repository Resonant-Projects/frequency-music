// Pure cross-runtime contract module: imported by convex functions, web, and
// scripts. May import only convex/values, convex-helpers/validators, or zod —
// never convex/server or ./_generated/*.

// Order matches the pipeline flow in convex/schema.ts (sources.status).
export const SOURCE_STATUSES = [
  "ingested",
  "text_ready",
  "extracting",
  "extracted",
  "review_needed",
  "triaged",
  "promoted_followers",
  "promoted_public",
  "archived",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SOURCE_BLOCKED_REASONS = [
  "no_text",
  "copyright",
  "needs_metadata",
  "needs_tagging",
  "ai_error",
  "needs_human_review",
  "duplicate",
] as const;
export type SourceBlockedReason = (typeof SOURCE_BLOCKED_REASONS)[number];

export const HYPOTHESIS_STATUSES = [
  "draft",
  "queued",
  "active",
  "evaluated",
  "revised",
  "retired",
] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

export const RECIPE_STATUSES = ["draft", "in_use", "archived"] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export const AGENT_RUN_STATUSES = [
  "queued",
  "running",
  "needs_review",
  "completed",
  "failed",
  "cancelled",
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];
