import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";
import { SCOUTED_CONTENT_PROVIDERS } from "./agentContract";

export const captureInputZ = z.object({
  url: z.string().url(),
  title: z.string().max(1000).optional(),
  publishedAt: z.number().optional(),
  query: z.string().max(4000),
  rationale: z.string().max(4000),
  rawText: z.string().max(30000).optional(),
  contentProvider: z.enum(SCOUTED_CONTENT_PROVIDERS).optional(),
});
export type CaptureInput = z.infer<typeof captureInputZ>;
export const recoveryTargetZ = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("capture"), input: captureInputZ }),
  z.object({
    kind: z.literal("extraction"),
    attemptId: zid("extractionAttempts"),
  }),
  z.object({ kind: z.literal("audioUpload"), jobId: zid("mediaJobs") }),
]);
export const recoveryTargetValidator = zodToConvex(recoveryTargetZ);
export type RecoveryTarget = z.infer<typeof recoveryTargetZ>;
export const failureStatusZ = z.enum([
  "recorded",
  "retrying",
  "investigating",
  "recovering",
  "resolved",
  "needsReview",
]);
export const failureStatusValidator = zodToConvex(failureStatusZ);
export const diagnosisZ = z.object({
  diagnosis: z.string().min(1).max(4000),
  recover: z.boolean(),
});
export const MAX_RECOVERY_ATTEMPTS = 3;
// Evidence and diagnosis load full prerequisites under one transaction budget.
export const MAX_GROUP_FAILURES = 3;
