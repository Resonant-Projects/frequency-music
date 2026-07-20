import { z } from "zod";
import { KNOWN_GRAPH_NAMES } from "./agentContract";

// Cross-workspace response returned when a worker atomically claims a queued
// run. Keep this zod-first so Convex and the agent cannot drift independently.
export const claimedAgentRunZ = z.object({
  runId: z.string(),
  graphName: z.enum(KNOWN_GRAPH_NAMES),
  input: z.unknown().nullable(),
  traceUrl: z.string().optional(),
  status: z.literal("running"),
  workerId: z.string(),
  startedAt: z.number(),
});

export type ClaimedRun = z.infer<typeof claimedAgentRunZ>;
