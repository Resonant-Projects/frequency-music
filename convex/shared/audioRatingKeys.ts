// Dependency-free rating vocabulary. The web app imports this module at
// runtime, and its Vercel build installs only web/ dependencies, so nothing
// here may import zod, convex-helpers or any other root-only package.

export const AUDIO_RATING_KINDS = ["episode", "litmusRender"] as const;
export type AudioRatingKind = (typeof AUDIO_RATING_KINDS)[number];
export function isAudioRatingKind(kind: string): kind is AudioRatingKind {
  return (AUDIO_RATING_KINDS as readonly string[]).includes(kind);
}

/** General feedback rates what a listener hears: the delivery, never a master. */
export function isGeneralFeedbackAudio(row: {
  kind: string;
  role: string;
  status: string;
  storageId?: unknown;
}): boolean {
  return (
    isAudioRatingKind(row.kind) &&
    row.role === "delivery" &&
    row.status === "ready" &&
    row.storageId !== undefined
  );
}

export const EPISODE_SCORE_KEYS = [
  "overall",
  "clarity",
  "naturalness",
  "pacing",
] as const;
export const RENDER_SCORE_KEYS = [
  "overall",
  "bodilyPleasantness",
  "goosebumps",
  "perceivedConsonance",
  "musicality",
  "easeOfComposability",
  "expandability",
] as const;
export const AUDIO_SCORE_KEYS = [
  "overall",
  "clarity",
  "naturalness",
  "pacing",
  "bodilyPleasantness",
  "goosebumps",
  "perceivedConsonance",
  "musicality",
  "easeOfComposability",
  "expandability",
] as const;
export type AudioScoreKey = (typeof AUDIO_SCORE_KEYS)[number];
export const SCORE_KEYS_BY_KIND: Record<
  AudioRatingKind,
  readonly AudioScoreKey[]
> = { episode: EPISODE_SCORE_KEYS, litmusRender: RENDER_SCORE_KEYS };

export const AUDIO_RATING_NOTES_MAX = 4000;
