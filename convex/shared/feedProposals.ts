import { z } from "zod";

// Kept separate from agentContract.ts so lifecycle constants remain
// runtime-pure while the source scout and Convex share this Zod contract.
export const feedProposalSampleItemZ = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  publishedAt: z.string().optional(),
});

export const feedProposalZ = z.object({
  agentRunId: z.string(),
  rationale: z.string(),
  sampleItems: z.array(feedProposalSampleItemZ).max(10),
});

export type FeedProposal = z.infer<typeof feedProposalZ>;
