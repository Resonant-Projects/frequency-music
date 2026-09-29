// Zod-first contracts for stored audio. Convex validators derive from these
// schemas; the media package and web import the zod types.
import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";

export const AUDIO_ARTIFACT_KINDS = [
  "narration",
  "shootoutTake",
  "episode",
  "litmusRender",
  "voiceNote",
  "blurb",
  "probe",
] as const;
export type AudioArtifactKind = (typeof AUDIO_ARTIFACT_KINDS)[number];

export const audioArtifactKindZ = z.enum(AUDIO_ARTIFACT_KINDS);
export const audioArtifactRoleZ = z.enum([
  "masterRaw",
  "masterNormalized",
  "delivery",
]);
export const audioArtifactStatusZ = z.enum(["pending", "ready", "failed"]);
export const audioAccessZ = z.enum(["feed", "private"]);
export const normalizationZ = z.enum(["applied", "skipped"]);

export const audioEncodingZ = z.object({
  codec: z.enum(["wav", "mp3", "opus"]),
  bitrateKbps: z.number().int().positive().optional(),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().min(1).max(2),
});
export type AudioEncoding = z.infer<typeof audioEncodingZ>;

export const audioAnalysisZ = z.object({
  version: z.string().min(1),
  roughnessMedian: z.number().optional(),
  roughnessP90: z.number().optional(),
  lufs: z.number().optional(),
  truePeakDbtp: z.number().optional(),
  spectralCentroidHz: z.number().optional(),
});

export const audioChapterZ = z.object({
  title: z.string().min(1),
  startSecs: z.number().min(0),
});

export const audioRefsZ = z.object({
  weeklyBriefId: zid("weeklyBriefs").optional(),
  agentReviewDraftId: zid("agentReviewDrafts").optional(),
  recipeId: zid("recipes").optional(),
  compositionId: zid("compositions").optional(),
  listeningSessionId: zid("listeningSessions").optional(),
  docketCardId: z.string().optional(),
  mediaJobId: zid("mediaJobs").optional(),
});

export const audioArtifactFieldsZ = z.object({
  kind: audioArtifactKindZ,
  role: audioArtifactRoleZ,
  masterArtifactId: zid("audioArtifacts").optional(),
  metadataStripped: z.boolean(),
  status: audioArtifactStatusZ,
  storageId: zid("_storage").optional(),
  mimeType: z.string().optional(),
  encoding: audioEncodingZ,
  durationSecs: z.number().nonnegative().optional(),
  loudnessLufs: z.number().optional(),
  truePeakDbtp: z.number().optional(),
  normalization: normalizationZ,
  access: audioAccessZ.default("private"),
  validation: z.enum(["unvalidated", "validated"]).optional(),
  title: z.string().min(1),
  scriptMd: z.string().optional(),
  chapters: z.array(audioChapterZ).optional(),
  engine: z
    .object({
      name: z.string(),
      version: z.string(),
      // z.any(), not z.unknown(): zodToConvex must yield a Convex Value type for defineTable
      params: z.record(z.string(), z.any()),
    })
    .optional(),
  voice: z
    .object({ catalogId: z.string(), promptVersion: z.string() })
    .optional(),
  analysis: audioAnalysisZ.optional(),
  refs: audioRefsZ,
  blindGroupId: zid("blindGroups").optional(),
  contentHash: z.string().min(1),
  error: z.string().optional(),
  createdBy: z.union([z.literal("system"), z.literal("agent"), zid("users")]),
  uploadIssuedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type AudioArtifactFields = z.infer<typeof audioArtifactFieldsZ>;

// Callers of createPending supply everything except the server-stamped timestamps.
export const audioArtifactInputZ = audioArtifactFieldsZ.omit({
  createdAt: true,
  updatedAt: true,
  uploadIssuedAt: true,
});
export type AudioArtifactInput = z.infer<typeof audioArtifactInputZ>;

export const audioArtifactFieldsValidator = zodToConvex(audioArtifactFieldsZ);
export const audioArtifactInputValidator = zodToConvex(audioArtifactInputZ);
export const audioEncodingValidator = zodToConvex(audioEncodingZ);
export const audioAnalysisValidator = zodToConvex(audioAnalysisZ);
export const audioRefsValidator = zodToConvex(audioRefsZ);
