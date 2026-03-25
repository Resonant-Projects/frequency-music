import { v } from "convex/values";
import {
  compositionParameterValidator,
  registryStatusValidator,
  visibilityValidator,
} from "./schema";

// ============================================================================
// SHARED SUB-VALIDATORS
// ============================================================================

const evidenceLevelValidator = v.union(
  v.literal("peer_reviewed"),
  v.literal("preprint"),
  v.literal("anecdotal"),
  v.literal("speculative"),
  v.literal("personal"),
);

const confidenceBandValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

const claimValidator = v.object({
  text: v.string(),
  evidenceLevel: evidenceLevelValidator,
  truthConfidence: v.optional(confidenceBandValidator),
  interestLevel: v.optional(confidenceBandValidator),
  citations: v.array(
    v.object({
      label: v.optional(v.string()),
      url: v.optional(v.string()),
      quote: v.optional(v.string()),
    }),
  ),
});

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

const sourceStatusValidator = v.union(
  v.literal("ingested"),
  v.literal("text_ready"),
  v.literal("extracting"),
  v.literal("extracted"),
  v.literal("review_needed"),
  v.literal("triaged"),
  v.literal("promoted_followers"),
  v.literal("promoted_public"),
  v.literal("archived"),
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
  blockedReason: v.optional(
    v.union(
      v.literal("no_text"),
      v.literal("copyright"),
      v.literal("needs_metadata"),
      v.literal("needs_tagging"),
      v.literal("ai_error"),
      v.literal("needs_human_review"),
      v.literal("duplicate"),
    ),
  ),
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

const hypothesisStatusValidator = v.union(
  v.literal("draft"),
  v.literal("queued"),
  v.literal("active"),
  v.literal("evaluated"),
  v.literal("revised"),
  v.literal("retired"),
);

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
  visibility: visibilityValidator,
  createdBy: createdByValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// RECIPE
// ============================================================================

export const recipeParameterValidator = compositionParameterValidator;

export const recipeProtocolValidator = v.object({
  studyType: v.union(v.literal("litmus"), v.literal("comparison")),
  durationSecs: v.number(),
  panelPlanned: v.array(v.string()),
  listeningContext: v.optional(v.string()),
  listeningMethod: v.optional(v.string()),
  baselineArtifactId: v.optional(v.id("compositions")),
  whatVaries: v.array(v.string()),
  whatStaysConstant: v.array(v.string()),
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
  status: v.union(
    v.literal("draft"),
    v.literal("in_use"),
    v.literal("archived"),
  ),
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
  recommendedHypothesisIds: v.array(v.id("hypotheses")),
  recommendedRecipeIds: v.array(v.id("recipes")),
  todo: v.optional(v.array(v.string())),
  visibility: visibilityValidator,
  publishedAt: v.optional(v.number()),
  notionPageId: v.optional(v.string()),
  createdBy: createdByValidator,
  createdAt: v.number(),
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
  wikipedia: v.optional(v.string()),
  definitionSource: v.optional(v.id("sources")),
  mentionCount: v.number(),
  hypothesisCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
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
