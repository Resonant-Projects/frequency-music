import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";
import { hypothesisDraftPayloadZ, recipeDraftPayloadZ } from "./draftPayloads";

export const DECISION_TTL_MS = 30 * 60 * 1000;
export const DOCKET_DEFERRAL_MS = 14 * 24 * 60 * 60 * 1000;
export const decisionPlatformZ = z.enum(["discord", "telegram"]);
export const decisionSourceZ = z.enum(["discord", "telegram", "web"]);
export const decisionStatusZ = z.enum([
  "proposed",
  "applied",
  "cancelled",
  "expired",
  "rejected",
]);
export const listeningConditionsZ = z
  .object({
    listeningMethod: z.enum(["headphones", "monitors", "car", "phone speaker"]),
    timeOfDay: z.string().trim().min(1).max(100),
  })
  .strict();
const rating = z.number().finite().min(0).max(5).optional();
export const subjectiveRatingsZ = z
  .object({
    bodilyPleasantness: rating,
    goosebumps: rating,
    perceivedConsonance: rating,
    musicality: rating,
    easeOfComposability: rating,
    expandability: rating,
  })
  .strict();
export const listeningIntentPayloadZ = z
  .object({
    conditions: listeningConditionsZ,
    ratings: subjectiveRatingsZ.optional(),
    feltQualities: z.array(z.string()).max(100).optional(),
    standoutMoments: z.array(z.string()).max(100).optional(),
    expandVerdict: z.enum(["yes", "maybe", "no"]).optional(),
  })
  .strict();
const note = z.string().trim().min(1).max(10000);
const approvePayloadZ = z
  .object({
    note: note.optional(),
    amendedPayload: z
      .union([hypothesisDraftPayloadZ, recipeDraftPayloadZ])
      .optional(),
  })
  .strict();
const rejectPayloadZ = z.object({ note }).strict();
const supersedePayloadZ = z
  .object({ note: note.optional(), byDraftId: zid("agentReviewDrafts") })
  .strict();
const deferPayloadZ = z.object({ note: note.optional() }).strict();
const enableFeedPayloadZ = z.object({ note: note.optional() }).strict();
const draftTargetZ = z
  .object({ kind: z.literal("agentReviewDraft"), id: zid("agentReviewDrafts") })
  .strict();
const compositionTargetZ = z
  .object({ kind: z.literal("composition"), id: zid("compositions") })
  .strict();
const feedTargetZ = z
  .object({ kind: z.literal("feedProposal"), id: zid("feeds") })
  .strict();
export const decisionTargetZ = z.discriminatedUnion("kind", [
  draftTargetZ,
  compositionTargetZ,
  feedTargetZ,
]);
export const decisionCommandZ = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("approve"),
      target: draftTargetZ,
      payload: approvePayloadZ,
    })
    .strict(),
  z
    .object({
      action: z.literal("reject"),
      target: draftTargetZ,
      payload: rejectPayloadZ,
    })
    .strict(),
  z
    .object({
      action: z.literal("supersede"),
      target: draftTargetZ,
      payload: supersedePayloadZ,
    })
    .strict(),
  z
    .object({
      action: z.literal("defer"),
      target: decisionTargetZ,
      payload: deferPayloadZ,
    })
    .strict(),
  z
    .object({
      action: z.literal("enableFeed"),
      target: feedTargetZ,
      payload: enableFeedPayloadZ,
    })
    .strict(),
  z
    .object({
      action: z.literal("createListeningSession"),
      target: compositionTargetZ,
      payload: listeningIntentPayloadZ,
    })
    .strict(),
]);
export type DecisionCommand = z.infer<typeof decisionCommandZ>;
export const decisionProposalZ = z
  .object({
    channel: z.string().min(1).max(100),
    conversationId: z.string().min(1).max(1000),
    messageRef: z.string().min(1).max(1000),
    transcript: z.string().min(1).max(30000),
  })
  .strict();
export const signerCardZ = z
  .object({
    platform: decisionPlatformZ,
    chatId: z.string().min(1),
    messageId: z.string().min(1),
  })
  .strict();
export const decisionEventZ = signerCardZ
  .extend({
    intentId: zid("decisionIntents"),
    signerId: z.string().min(1),
    eventId: z.string().min(1),
    verb: z.enum(["confirm", "cancel"]),
    digest8: z.string().optional(),
  })
  .strict();
export type DecisionEvent = z.infer<typeof decisionEventZ>;
export const decisionResultZ = z
  .object({
    status: decisionStatusZ,
    appliedRecordId: z.string().optional(),
    error: z.string().optional(),
  })
  .strict();
export type DecisionResult = z.infer<typeof decisionResultZ>;
export const decisionIntentFieldsZ = z.object({
  code: z.string(),
  target: decisionTargetZ,
  targetRevision: z.number().int().nonnegative().optional(),
  action: z.enum([
    "approve",
    "reject",
    "supersede",
    "defer",
    "enableFeed",
    "createListeningSession",
  ]),
  payload: z.union([
    approvePayloadZ,
    rejectPayloadZ,
    supersedePayloadZ,
    deferPayloadZ,
    enableFeedPayloadZ,
    listeningIntentPayloadZ,
  ]),
  payloadDigest: z.string(),
  proposal: decisionProposalZ,
  signerCard: signerCardZ.optional(),
  signature: z
    .object({
      source: decisionSourceZ,
      signerId: z.string(),
      userId: zid("users"),
      eventId: z.string(),
      messageRef: z.string(),
      receivedAt: z.number(),
    })
    .optional(),
  status: decisionStatusZ,
  result: decisionResultZ.optional(),
  createdAt: z.number(),
  expiresAt: z.number(),
  decidedAt: z.number().optional(),
});
export const decisionIntentValidator = zodToConvex(decisionIntentFieldsZ);
export const decisionIntentReturnValidator = zodToConvex(
  decisionIntentFieldsZ.extend({
    _id: zid("decisionIntents"),
    _creationTime: z.number(),
  }),
);
export const decisionCommandValidator = zodToConvex(decisionCommandZ);
export const decisionProposalValidator = zodToConvex(decisionProposalZ);
export const decisionEventValidator = zodToConvex(decisionEventZ);
export const decisionResultValidator = zodToConvex(decisionResultZ);
export const signerCardValidator = zodToConvex(signerCardZ);
export const listeningConditionsValidator = zodToConvex(listeningConditionsZ);
export const listeningIntentPayloadValidator = zodToConvex(
  listeningIntentPayloadZ,
);
export const webhookEventFieldsZ = z.object({
  platform: decisionSourceZ,
  eventId: z.string(),
  intentId: zid("decisionIntents"),
  result: decisionResultZ,
  createdAt: z.number(),
});
export const webhookEventValidator = zodToConvex(webhookEventFieldsZ);

/** Missing revisions mean zero only during the additive migration. */
export function currentRevision(row: { revision?: number }): number {
  return row.revision ?? 0;
}
export function nextRevision(row: { revision?: number }): number {
  return currentRevision(row) + 1;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function decisionDigestInput(
  action: DecisionCommand["action"],
  payload: DecisionCommand["payload"],
): string {
  return JSON.stringify(canonical({ action, payload }));
}
export async function decisionPayloadDigest(
  action: DecisionCommand["action"],
  payload: DecisionCommand["payload"],
): Promise<string> {
  return await stableContentDigest({ action, payload });
}
export async function stableContentDigest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical(value))),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
