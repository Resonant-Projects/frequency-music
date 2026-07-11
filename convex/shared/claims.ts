import { v } from "convex/values";

export const evidenceLevelValidator = v.union(
  v.literal("peer_reviewed"),
  v.literal("preprint"),
  v.literal("anecdotal"),
  v.literal("speculative"),
  v.literal("personal"),
);

export const confidenceBandValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const claimCitationValidator = v.object({
  label: v.optional(v.string()),
  url: v.optional(v.string()),
  quote: v.optional(v.string()),
});

export const claimValidator = v.object({
  text: v.string(),
  evidenceLevel: evidenceLevelValidator,
  truthConfidence: v.optional(confidenceBandValidator),
  interestLevel: v.optional(confidenceBandValidator),
  citations: v.array(claimCitationValidator),
});

export const claimStatusValidator = v.union(
  v.literal("active"),
  v.literal("superseded"),
);
