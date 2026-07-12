import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";

export const correspondenceStatusZ = z.enum([
  "conjectured",
  "evidenced",
  "contradicted",
  "retired",
]);

export const evidenceStanceZ = z.enum(["supports", "contradicts"]);
export const correspondenceStatusValidator = zodToConvex(correspondenceStatusZ);
export const evidenceStanceValidator = zodToConvex(evidenceStanceZ);

const optionalScoreZ = z.number().finite().optional();
const limitZ = z.number().int().positive().max(100).optional();

export const upsertCorrespondenceArgsZ = z.object({
  conceptAId: zid("concepts"),
  conceptBId: zid("concepts"),
  statement: z.string().trim().min(1),
  rationaleMd: z.string().trim().min(1),
  relationship: z.string().trim().min(1).optional(),
  similarityScore: optionalScoreZ,
  noveltyScore: optionalScoreZ,
  agentRunId: zid("agentRuns").optional(),
  traceUrl: z.string().url().optional(),
});

export const addCorrespondenceEvidenceArgsZ = z.object({
  correspondenceId: zid("correspondences"),
  claimId: zid("claims"),
  stance: evidenceStanceZ,
  note: z.string().trim().min(1).optional(),
  agentRunId: zid("agentRuns").optional(),
});

export const getCorrespondenceArgsZ = z.object({
  pairKey: z.string().trim().min(1),
});

export const listCorrespondencesArgsZ = z.object({
  status: correspondenceStatusZ,
  limit: limitZ,
});

export const listConceptCorrespondencesArgsZ = z.object({
  conceptId: zid("concepts"),
  limit: limitZ,
});

export type CorrespondenceStatus = z.infer<typeof correspondenceStatusZ>;
export type EvidenceStance = z.infer<typeof evidenceStanceZ>;
export type UpsertCorrespondenceArgs = z.infer<
  typeof upsertCorrespondenceArgsZ
>;
export type AddCorrespondenceEvidenceArgs = z.infer<
  typeof addCorrespondenceEvidenceArgsZ
>;
