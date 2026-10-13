// General human audio ratings for ready episodes and litmus renders. Voice
// shootout ratings keep their own blind contract in voiceRatings. Machine
// analysis stays on audioArtifacts.analysis and is never accepted here.
import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";
import { listeningConditionsZ } from "./listeningConditions";
import {
  AUDIO_RATING_KINDS,
  AUDIO_RATING_NOTES_MAX,
  SCORE_KEYS_BY_KIND,
  type AudioRatingKind,
  type AudioScoreKey,
} from "./audioRatingKeys";

export * from "./audioRatingKeys";
export const audioRatingKindZ = z.enum(AUDIO_RATING_KINDS);

const score = z.number().finite().min(0).max(5).optional();
/** Absent means "not given"; zero is a real rating and is preserved. */
export const audioRatingScoresZ = z
  .object({
    overall: score,
    clarity: score,
    naturalness: score,
    pacing: score,
    bodilyPleasantness: score,
    goosebumps: score,
    perceivedConsonance: score,
    musicality: score,
    easeOfComposability: score,
    expandability: score,
  })
  .strict();
export type AudioRatingScores = z.infer<typeof audioRatingScoresZ>;
export const audioRatingScoresValidator = zodToConvex(audioRatingScoresZ);

export const audioRatingPayloadZ = z
  .object({
    scores: audioRatingScoresZ,
    conditions: listeningConditionsZ.optional(),
    notes: z.string().trim().min(1).max(AUDIO_RATING_NOTES_MAX).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.notes !== undefined ||
      Object.values(value.scores).some((entry) => entry !== undefined),
    "Give at least one score or a note",
  );
export type AudioRatingPayload = z.infer<typeof audioRatingPayloadZ>;
export const audioRatingPayloadValidator = zodToConvex(audioRatingPayloadZ);

/** Kind-specific dimensions: an episode is not scored for goosebumps, a render not for pacing. */
export function scoreKeysOutsideKind(
  kind: AudioRatingKind,
  scores: AudioRatingScores,
): AudioScoreKey[] {
  const allowed = new Set<string>(SCORE_KEYS_BY_KIND[kind]);
  return (Object.keys(scores) as AudioScoreKey[]).filter(
    (key) => scores[key] !== undefined && !allowed.has(key),
  );
}

export const audioRatingSourceZ = z.enum(["web", "discord", "telegram"]);
export const audioRatingFieldsZ = z.object({
  artifactId: zid("audioArtifacts"),
  artifactKind: audioRatingKindZ,
  // The rated version. A later content change never inherits this rating.
  artifactContentHash: z.string(),
  artifactValidation: z.enum(["unvalidated", "validated"]).optional(),
  scores: audioRatingScoresZ,
  conditions: listeningConditionsZ.optional(),
  notes: z.string().optional(),
  createdBy: zid("users"),
  source: audioRatingSourceZ,
  decisionIntentId: zid("decisionIntents").optional(),
  // `${userId}:${clientRequestId}` for web, `intent:${intentId}` when signed.
  requestKey: z.string(),
  createdAt: z.number(),
});
export const audioRatingValidator = zodToConvex(audioRatingFieldsZ);

export const AUDIO_CLIENT_REQUEST_ID_MAX = 200;
export const audioClientRequestIdZ = z
  .string()
  .trim()
  .min(8)
  .max(AUDIO_CLIENT_REQUEST_ID_MAX)
  .regex(/^[A-Za-z0-9._:-]+$/);

// Blind-safe web projection: no storage IDs, refs, voice or blind membership.
export const audioFeedbackQueueItemZ = z.object({
  artifactId: zid("audioArtifacts"),
  kind: audioRatingKindZ,
  title: z.string(),
  durationSecs: z.number().optional(),
  engineName: z.string().optional(),
  validation: z.enum(["unvalidated", "validated"]).optional(),
  contentHash: z.string(),
  // The matching docket card version, for deferring from Listen.
  docketContentHash: z.string(),
  // The web defer would be admitted now: unrated and not already deferred.
  deferrable: z.boolean(),
  createdAt: z.number(),
});
export const audioFeedbackQueueItemValidator = zodToConvex(
  audioFeedbackQueueItemZ,
);
export const AUDIO_FEEDBACK_QUEUE_LIMIT = 25;
