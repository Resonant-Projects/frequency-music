// Zod-first source of truth for agent draft payloads crossing the
// Convex-to-agent seam. Convex validators are derived from these schemas.
import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { v } from "convex/values";
import { z } from "zod";

const registryStatusZ = z.union([
  z.literal("known"),
  z.literal("provisional"),
  z.literal("experimental"),
  z.literal("deprecated"),
]);

export const compositionParameterZ = z.object({
  kind: z.string().optional(),
  type: z.string().optional(),
  value: z.string(),
  details: z.any().optional(),
  registryStatus: registryStatusZ.optional(),
  canonicalKind: z.string().optional(),
});

export const hypothesisDraftPayloadZ = z.object({
  title: z.string().min(1),
  question: z.string().min(1),
  statement: z.string().min(1),
  rationale: z.string().min(1),
  whyThisMatters: z.string().min(1),
  concepts: z.array(z.string()).optional(),
  sourceIds: z.array(zid("sources")),
  extractionIds: z.array(zid("extractions")),
  correspondenceId: zid("correspondences").optional(),
  thesisId: zid("theses").optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const recipeProtocolZ = z.object({
  studyType: z.union([z.literal("litmus"), z.literal("comparison")]),
  durationSecs: z.number().positive(),
  panelPlanned: z.array(z.string()),
  listeningContext: z.string().optional(),
  listeningMethod: z.string().optional(),
  baselineArtifactId: zid("compositions").optional(),
  whatVaries: z.array(z.string()),
  whatStaysConstant: z.array(z.string()),
});

export const recipeDraftPayloadZ = z.object({
  hypothesisId: zid("hypotheses").optional(),
  title: z.string().min(1),
  parameters: z.array(compositionParameterZ),
  protocol: recipeProtocolZ.optional(),
  whyThisMatters: z.string().min(1),
  bodyMd: z.string().optional(),
  dawChecklist: z.array(z.string()).optional(),
  instrumentationNotes: z.string().optional(),
});

export type HypothesisDraftPayload = z.infer<typeof hypothesisDraftPayloadZ>;
export type RecipeDraftPayload = z.infer<typeof recipeDraftPayloadZ>;

export const agentDraftHypothesisPayloadValidator = zodToConvex(
  hypothesisDraftPayloadZ,
);
export const recipeProtocolValidator = zodToConvex(recipeProtocolZ);
export const agentDraftRecipePayloadValidator =
  zodToConvex(recipeDraftPayloadZ);
export const agentReviewDraftPayloadValidator = v.union(
  agentDraftHypothesisPayloadValidator,
  agentDraftRecipePayloadValidator,
);
