import { z } from "zod";

// Kept separate from agentContract.ts so lifecycle constants remain
// runtime-pure while the source scout and Convex share this Zod contract.
export const feedProposalZ = z.object({
  agentRunId: z.string(),
  rationale: z.string(),
  sampleItems: z.array(z.unknown()),
});

export type FeedProposal = z.infer<typeof feedProposalZ>;
