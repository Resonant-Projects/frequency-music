import { v } from "convex/values";
import {
  agentOriginFields,
  campaignStatusValidator,
  compositionParameterValidator,
  editorialArtifactKindValidator,
  editorialArtifactStatusValidator,
  editorialEvidenceStatusValidator,
  hypothesisStatusValidator,
  recipeProtocolValidator,
  recipeStarterKitValidator,
  recipeStatusValidator,
  recipeVerificationValidator,
  recommendedActionValidator,
  registryStatusValidator,
  sourceBlockedReasonValidator,
  sourceStatusValidator,
  studioPromptVariantsValidator,
  visibilityValidator,
} from "./schema";
import {
  claimCitationValidator,
  claimStatusValidator,
  claimValidator,
  confidenceBandValidator,
  evidenceLevelValidator,
} from "./shared/claims";
import {
  correspondenceStatusValidator,
  evidenceStanceValidator,
} from "./shared/correspondences";
export { correspondenceStatusValidator } from "./shared/correspondences";
import {
  failureActionValidator,
  failureReasonValidator,
  yieldBandValidator,
} from "./phase2";

// ============================================================================
// SHARED SUB-VALIDATORS
// ============================================================================

const createdByValidator = v.union(v.id("users"), v.literal("system"));

// ============================================================================
// SOURCE
// ============================================================================

const sourceTypeValidator = v.union(
  v.literal("notion"),
  v.literal("rss"),
  v.literal("url"),
  v.literal("youtube"),
  v.literal("pdf"),
  v.literal("podcast"),
);

export const sourceReturnValidator = v.object({
  _id: v.id("sources"),
  _creationTime: v.number(),
  type: sourceTypeValidator,
  title: v.optional(v.string()),
  author: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  canonicalUrl: v.optional(v.string()),
  notionPageId: v.optional(v.string()),
  rssGuid: v.optional(v.string()),
  feedUrl: v.optional(v.string()),
  youtubeVideoId: v.optional(v.string()),
  uploadThingUrl: v.optional(v.string()),
  rawText: v.optional(v.string()),
  rawTextSha256: v.optional(v.string()),
  transcript: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  topics: v.optional(v.array(v.string())),
  metadata: v.optional(v.any()),
  status: sourceStatusValidator,
  blockedReason: v.optional(sourceBlockedReasonValidator),
  blockedDetails: v.optional(v.string()),
  openQuestions: v.optional(v.array(v.string())),
  confidence: v.optional(v.number()),
  dedupeKey: v.string(),
  visibility: visibilityValidator,
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// FEED
// ============================================================================

const feedTypeValidator = v.union(
  v.literal("rss"),
  v.literal("podcast"),
  v.literal("youtube"),
);

export const feedReturnValidator = v.object({
  _id: v.id("feeds"),
  _creationTime: v.number(),
  name: v.string(),
  url: v.string(),
  type: feedTypeValidator,
  category: v.optional(v.string()),
  enabled: v.boolean(),
  lastPolledAt: v.optional(v.number()),
  lastItemAt: v.optional(v.number()),
  pollIntervalMs: v.optional(v.number()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// EXTRACTION
// ============================================================================

export const extractionReturnValidator = v.object({
  _id: v.id("extractions"),
  _creationTime: v.number(),
  sourceId: v.id("sources"),
  model: v.string(),
  promptVersion: v.string(),
  inputHash: v.string(),
  summary: v.string(),
  claims: v.array(claimValidator),
  compositionParameters: v.array(compositionParameterValidator),
  topics: v.array(v.string()),
  openQuestions: v.array(v.string()),
  confidence: v.number(),
  createdBy: createdByValidator,
  createdAt: v.number(),
});

export const claimReturnValidator = v.object({
  _id: v.id("claims"),
  _creationTime: v.number(),
  extractionId: v.id("extractions"),
  sourceId: v.id("sources"),
  ordinal: v.number(),
  text: v.string(),
  evidenceLevel: evidenceLevelValidator,
  truthConfidence: v.optional(confidenceBandValidator),
  interestLevel: v.optional(confidenceBandValidator),
  citations: v.array(claimCitationValidator),
  status: claimStatusValidator,
  supersededBy: v.optional(v.id("claims")),
  embedding: v.optional(v.array(v.float64())),
  embeddingModel: v.optional(v.string()),
  createdBy: createdByValidator,
  createdAt: v.number(),
});

export const correspondenceEvidenceValidator = v.object({
  claimId: v.id("claims"),
  stance: evidenceStanceValidator,
  note: v.optional(v.string()),
  addedBy: v.union(v.literal("agent"), v.literal("human")),
  addedAt: v.number(),
});

export const correspondenceReturnValidator = v.object({
  _id: v.id("correspondences"),
  _creationTime: v.number(),
  conceptAId: v.id("concepts"),
  conceptBId: v.id("concepts"),
  pairKey: v.string(),
  statement: v.string(),
  rationaleMd: v.string(),
  relationship: v.optional(v.string()),
  evidence: v.array(correspondenceEvidenceValidator),
  status: correspondenceStatusValidator,
  statusReason: v.optional(v.string()),
  statusChangedAt: v.optional(v.number()),
  similarityScore: v.optional(v.number()),
  noveltyScore: v.optional(v.number()),
  ...agentOriginFields,
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// HYPOTHESIS
// ============================================================================

export const thesisReturnValidator = v.object({
  _id: v.id("theses"),
  _creationTime: v.number(),
  title: v.string(),
  statement: v.string(),
  descriptionMd: v.optional(v.string()),
  status: v.union(
    v.literal("active"),
    v.literal("paused"),
    v.literal("retired"),
  ),
  visibility: visibilityValidator,
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const campaignReturnValidator = v.object({
  _id: v.id("campaigns"),
  _creationTime: v.number(),
  title: v.string(),
  question: v.string(),
  descriptionMd: v.optional(v.string()),
  status: campaignStatusValidator,
  thesisIds: v.array(v.id("theses")),
  startedAt: v.optional(v.number()),
  endedAt: v.optional(v.number()),
  summaryMd: v.optional(v.string()),
  visibility: visibilityValidator,
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const hypothesisReturnValidator = v.object({
  _id: v.id("hypotheses"),
  _creationTime: v.number(),
  title: v.string(),
  question: v.string(),
  hypothesis: v.string(),
  whyThisMatters: v.optional(v.string()),
  rationaleMd: v.string(),
  thesisId: v.optional(v.id("theses")),
  sourceIds: v.array(v.id("sources")),
  extractionIds: v.optional(v.array(v.id("extractions"))),
  concepts: v.optional(v.array(v.string())),
  status: hypothesisStatusValidator,
  resolution: v.optional(
    v.union(
      v.literal("supported"),
      v.literal("inconclusive"),
      v.literal("contradicted"),
    ),
  ),
  versionOfId: v.optional(v.id("hypotheses")),
  openQuestions: v.optional(v.array(v.string())),
  ...agentOriginFields,
  visibility: visibilityValidator,
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// RECIPE
// ============================================================================

export const recipeParameterValidator = compositionParameterValidator;

export {
  recipeProtocolValidator,
  recommendedActionValidator,
  studioPromptVariantsValidator,
};

/**
 * Shape of an AI-generated recipe payload as the generator actions return it.
 * Referenced by BOTH recipes.generateFromHypothesis and recipes.generateBatch
 * so their return validators cannot drift apart again (plan 012's root cause).
 */
export const generatedRecipeValidator = v.object({
  title: v.string(),
  whyThisMatters: v.optional(v.string()),
  bodyMd: v.string(),
  parameters: v.array(recipeParameterValidator),
  dawChecklist: v.array(v.string()),
  protocol: v.optional(recipeProtocolValidator),
});

export const recipeReturnValidator = v.object({
  _id: v.id("recipes"),
  _creationTime: v.number(),
  hypothesisId: v.id("hypotheses"),
  title: v.string(),
  whyThisMatters: v.optional(v.string()),
  bodyMd: v.string(),
  parameters: v.array(recipeParameterValidator),
  dawChecklist: v.array(v.string()),
  protocol: v.optional(recipeProtocolValidator),
  verification: v.optional(recipeVerificationValidator),
  starterKit: v.optional(recipeStarterKitValidator),
  status: recipeStatusValidator,
  ...agentOriginFields,
  visibility: visibilityValidator,
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// COMPOSITION
// ============================================================================

export const compositionReturnValidator = v.object({
  _id: v.id("compositions"),
  _creationTime: v.number(),
  title: v.string(),
  recipeId: v.id("recipes"),
  artifactType: v.union(
    v.literal("microStudy"),
    v.literal("expandedStudy"),
    v.literal("fullTrack"),
  ),
  projectNotesMd: v.optional(v.string()),
  links: v.optional(
    v.array(
      v.object({
        label: v.string(),
        url: v.string(),
      }),
    ),
  ),
  version: v.string(),
  diffNote: v.optional(v.string()),
  versionOfId: v.optional(v.id("compositions")),
  revisionParentId: v.optional(v.id("compositions")),
  revisionVariable: v.optional(v.string()),
  status: v.union(
    v.literal("idea"),
    v.literal("in_progress"),
    v.literal("rendered"),
    v.literal("published"),
  ),
  visibility: visibilityValidator,
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// LISTENING SESSION
// ============================================================================

const ratingsValidator = v.object({
  bodilyPleasantness: v.optional(v.number()),
  goosebumps: v.optional(v.number()),
  perceivedConsonance: v.optional(v.number()),
  musicality: v.optional(v.number()),
  easeOfComposability: v.optional(v.number()),
  consonanceComputed: v.optional(v.number()),
  expandability: v.optional(v.number()),
});

export const listeningSessionReturnValidator = v.object({
  _id: v.id("listeningSessions"),
  _creationTime: v.number(),
  compositionId: v.id("compositions"),
  participants: v.array(
    v.object({
      name: v.optional(v.string()),
      userId: v.optional(v.id("users")),
      role: v.optional(v.string()),
    }),
  ),
  contextMd: v.optional(v.string()),
  ratings: ratingsValidator,
  feedbackMd: v.string(),
  bodyMapNotes: v.optional(v.string()),
  feltQualities: v.optional(v.array(v.string())),
  bodyMapTags: v.optional(v.array(v.string())),
  standoutMoments: v.optional(v.array(v.string())),
  expandVerdict: v.optional(
    v.union(v.literal("yes"), v.literal("maybe"), v.literal("no")),
  ),
  visibility: visibilityValidator,
  createdBy: createdByValidator,
  createdAt: v.number(),
});

// ============================================================================
// WEEKLY BRIEF
// ============================================================================

export const weeklyBriefReturnValidator = v.object({
  _id: v.id("weeklyBriefs"),
  _creationTime: v.number(),
  weekOf: v.string(),
  model: v.string(),
  promptVersion: v.string(),
  bodyMd: v.string(),
  sourceIds: v.array(v.id("sources")),
  campaignId: v.optional(v.id("campaigns")),
  recommendedHypothesisIds: v.array(v.id("hypotheses")),
  recommendedRecipeIds: v.array(v.id("recipes")),
  activeThesisIds: v.optional(v.array(v.id("theses"))),
  referencedFailureKeys: v.optional(v.array(v.string())),
  studioPrompts: v.optional(studioPromptVariantsValidator),
  recommendedActions: v.optional(v.array(recommendedActionValidator)),
  todo: v.optional(v.array(v.string())),
  visibility: visibilityValidator,
  publishedAt: v.optional(v.number()),
  notionPageId: v.optional(v.string()),
  createdBy: createdByValidator,
  createdAt: v.number(),
});

// ============================================================================
// EDITORIAL ARTIFACT
// ============================================================================

export const editorialPrimaryRefValidator = v.union(
  v.object({
    type: v.literal("weeklyBrief"),
    id: v.id("weeklyBriefs"),
  }),
  v.object({
    type: v.literal("campaign"),
    id: v.id("campaigns"),
  }),
  v.object({
    type: v.literal("thesis"),
    id: v.id("theses"),
  }),
  v.object({
    type: v.literal("hypothesis"),
    id: v.id("hypotheses"),
  }),
);

export const editorialLinkedIdsValidator = v.object({
  thesisIds: v.array(v.id("theses")),
  hypothesisIds: v.array(v.id("hypotheses")),
  recipeIds: v.array(v.id("recipes")),
  compositionIds: v.array(v.id("compositions")),
  listeningSessionIds: v.array(v.id("listeningSessions")),
  failureKeys: v.array(v.string()),
});

export const publicEvidenceCardValidator = v.object({
  sourceTitle: v.string(),
  sourceCanonicalUrl: v.optional(v.string()),
  summary: v.string(),
  evidenceLevel: evidenceLevelValidator,
  truthConfidence: v.optional(confidenceBandValidator),
  interestLevel: v.optional(confidenceBandValidator),
});

export const editorialArtifactReturnValidator = v.object({
  _id: v.id("editorialArtifacts"),
  _creationTime: v.number(),
  kind: editorialArtifactKindValidator,
  slug: v.string(),
  title: v.string(),
  dek: v.string(),
  bodyMd: v.string(),
  whyItMattersMd: v.string(),
  uncertaintyMd: v.string(),
  whatChangedMd: v.optional(v.string()),
  evidenceStatus: editorialEvidenceStatusValidator,
  status: editorialArtifactStatusValidator,
  visibility: visibilityValidator,
  primaryRef: editorialPrimaryRefValidator,
  linkedIds: editorialLinkedIdsValidator,
  publicEvidenceCards: v.array(publicEvidenceCardValidator),
  astro: v.optional(
    v.object({
      exportPath: v.optional(v.string()),
      exportSha: v.optional(v.string()),
      exportedAt: v.optional(v.number()),
    }),
  ),
  notionPageId: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const editorialArtifactExportEntryValidator = v.object({
  slug: v.string(),
  path: v.string(),
  title: v.string(),
  kind: editorialArtifactKindValidator,
  publishedAt: v.number(),
  evidenceStatus: editorialEvidenceStatusValidator,
});

// ============================================================================
// KNOWLEDGE GRAPH: CONCEPT
// ============================================================================

export const conceptReturnValidator = v.object({
  _id: v.id("concepts"),
  _creationTime: v.number(),
  name: v.string(),
  displayName: v.string(),
  description: v.optional(v.string()),
  aliases: v.array(v.string()),
  domain: v.string(),
  domains: v.optional(v.array(v.string())),
  missionRelevance: v.optional(
    v.union(v.literal("on"), v.literal("off"), v.literal("unreviewed")),
  ),
  relevanceRationale: v.optional(v.string()),
  classifiedAt: v.optional(v.number()),
  classifierModel: v.optional(v.string()),
  wikipedia: v.optional(v.string()),
  definitionSource: v.optional(v.id("sources")),
  mentionCount: v.number(),
  hypothesisCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const failureArchiveEntryValidator = v.object({
  key: v.string(),
  reason: failureReasonValidator,
  createdAt: v.number(),
  title: v.string(),
  summary: v.string(),
  thesisId: v.optional(v.id("theses")),
  hypothesisId: v.optional(v.id("hypotheses")),
  recipeId: v.optional(v.id("recipes")),
  compositionId: v.optional(v.id("compositions")),
  latestListeningSessionId: v.optional(v.id("listeningSessions")),
  revisionBranchRootId: v.optional(v.id("compositions")),
  explanation: v.string(),
  recommendedNextAction: failureActionValidator,
  supportingIds: v.object({
    hypothesisIds: v.array(v.id("hypotheses")),
    recipeIds: v.array(v.id("recipes")),
    compositionIds: v.array(v.id("compositions")),
    listeningSessionIds: v.array(v.id("listeningSessions")),
    thesisIds: v.array(v.id("theses")),
  }),
});

export const compositionLineageValidator = v.object({
  composition: compositionReturnValidator,
  ancestry: v.array(compositionReturnValidator),
  children: v.array(compositionReturnValidator),
  recipe: v.union(recipeReturnValidator, v.null()),
  hypothesis: v.union(hypothesisReturnValidator, v.null()),
  thesis: v.union(thesisReturnValidator, v.null()),
  sources: v.array(sourceReturnValidator),
  extractions: v.array(extractionReturnValidator),
  listeningSessions: v.array(listeningSessionReturnValidator),
  summary: v.object({
    depth: v.number(),
    revisionVariable: v.optional(v.string()),
    hasChildren: v.boolean(),
    latestExpandVerdict: v.optional(
      v.union(v.literal("yes"), v.literal("maybe"), v.literal("no")),
    ),
    latestExpandability: v.optional(v.number()),
    localFailureStatus: v.optional(failureReasonValidator),
    branchFailureStatus: v.optional(failureReasonValidator),
  }),
});

export const thesisDetailValidator = v.object({
  thesis: thesisReturnValidator,
  hypotheses: v.array(hypothesisReturnValidator),
  recipes: v.array(recipeReturnValidator),
  compositions: v.array(compositionReturnValidator),
  campaigns: v.array(campaignReturnValidator),
  stats: v.object({
    contradictionCount: v.number(),
    activeCount: v.number(),
    evaluatedCount: v.number(),
    retiredCount: v.number(),
  }),
  recentWeeklyBriefIds: v.array(v.id("weeklyBriefs")),
});

export const editorialSignalValidator = v.object({
  conceptName: v.string(),
  displayName: v.string(),
  domain: v.string(),
  mentionCount: v.number(),
  hypothesisCount: v.number(),
  linkedRecipes: v.number(),
  linkedCompositions: v.number(),
  positiveSignals: v.number(),
  negativeSignals: v.number(),
  netYieldScore: v.number(),
  yieldBand: yieldBandValidator,
});

export const editorialSignalClusterValidator = v.object({
  domain: v.string(),
  conceptNames: v.array(v.string()),
  score: v.number(),
  yieldBand: yieldBandValidator,
});

// ============================================================================
// KNOWLEDGE GRAPH: EDGE
// ============================================================================

const entityTypeValidator = v.union(
  v.literal("source"),
  v.literal("extraction"),
  v.literal("hypothesis"),
  v.literal("recipe"),
  v.literal("concept"),
  v.literal("composition"),
);

export const edgeReturnValidator = v.object({
  _id: v.id("edges"),
  _creationTime: v.number(),
  fromType: entityTypeValidator,
  fromId: v.string(),
  toType: entityTypeValidator,
  toId: v.string(),
  relationship: v.string(),
  weight: v.optional(v.number()),
  context: v.optional(v.string()),
  autoGenerated: v.boolean(),
  createdAt: v.number(),
  createdBy: createdByValidator,
});

export const registryItemValidator = v.object({
  _id: v.union(
    v.id("parameterKinds"),
    v.id("conceptDomains"),
    v.id("relationshipKinds"),
  ),
  _creationTime: v.number(),
  name: v.string(),
  status: registryStatusValidator,
  description: v.optional(v.string()),
  introducedBy: createdByValidator,
  displayLabel: v.optional(v.string()),
  color: v.optional(v.string()),
  notes: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// ACTIVITY FEED ITEM (for dashboard)
// ============================================================================

export const activityFeedItemValidator = v.object({
  kind: v.string(),
  id: v.string(),
  title: v.string(),
  status: v.string(),
  updatedAt: v.number(),
});
