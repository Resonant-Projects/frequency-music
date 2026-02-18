import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================================
// RESONANT PROJECTS - CONVEX SCHEMA v1
// ============================================================================
// Core loop: Ingest → Extract → Synthesize → Hypothesize → Compose → Evaluate
// ============================================================================

// Shared validators
const visibilityValidator = v.union(
  v.literal("private"),
  v.literal("followers"),
  v.literal("public")
);

const evidenceLevelValidator = v.union(
  v.literal("peer_reviewed"),
  v.literal("preprint"),
  v.literal("anecdotal"),
  v.literal("speculative"),
  v.literal("personal")
);

const compositionParameterValidator = v.object({
  type: v.union(
    v.literal("tempo"),
    v.literal("key"),
    v.literal("tuningSystem"),
    v.literal("rootNote"),
    v.literal("chordProgression"),
    v.literal("rhythm"),
    v.literal("instrument"),
    v.literal("synthWaveform"),
    v.literal("harmonicProfile"),
    v.literal("frequency"),
    v.literal("note")
  ),
  value: v.string(),
  details: v.optional(v.any()),
});

const claimValidator = v.object({
  text: v.string(),
  evidenceLevel: evidenceLevelValidator,
  citations: v.array(
    v.object({
      label: v.optional(v.string()),
      url: v.optional(v.string()),
      quote: v.optional(v.string()),
    })
  ),
});

export default defineSchema({
  // ==========================================================================
  // USERS
  // ==========================================================================
  users: defineTable({
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    role: v.union(
      v.literal("admin"),
      v.literal("collaborator"),
      v.literal("follower")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerkUserId", ["clerkUserId"]),

  // ==========================================================================
  // SOURCES - Ingested items from various pipelines
  // ==========================================================================
  sources: defineTable({
    // Type discriminator
    type: v.union(
      v.literal("notion"),
      v.literal("rss"),
      v.literal("url"),
      v.literal("youtube"),
      v.literal("pdf"),
      v.literal("podcast")
    ),

    // Core metadata
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    canonicalUrl: v.optional(v.string()),

    // Type-specific identifiers
    notionPageId: v.optional(v.string()),
    rssGuid: v.optional(v.string()),
    feedUrl: v.optional(v.string()),
    youtubeVideoId: v.optional(v.string()),
    uploadThingUrl: v.optional(v.string()),

    // Content
    rawText: v.optional(v.string()),
    rawTextSha256: v.optional(v.string()),
    transcript: v.optional(v.string()), // For YouTube/podcast

    // Classification
    tags: v.optional(v.array(v.string())),
    topics: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),

    // Pipeline state
    status: v.union(
      v.literal("ingested"),
      v.literal("text_ready"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("review_needed"),
      v.literal("triaged"),
      v.literal("promoted_followers"),
      v.literal("promoted_public"),
      v.literal("archived")
    ),
    blockedReason: v.optional(
      v.union(
        v.literal("no_text"),
        v.literal("copyright"),
        v.literal("needs_metadata"),
        v.literal("needs_tagging"),
        v.literal("ai_error"),
        v.literal("needs_human_review"),
        v.literal("duplicate")
      )
    ),
    blockedDetails: v.optional(v.string()),
    openQuestions: v.optional(v.array(v.string())),
    confidence: v.optional(v.number()),

    // Deduplication
    dedupeKey: v.string(),

    // Visibility & ownership
    visibility: visibilityValidator,
    createdBy: v.union(v.id("users"), v.literal("system")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_updatedAt", ["status", "updatedAt"])
    .index("by_visibility_updatedAt", ["visibility", "updatedAt"])
    .index("by_type_updatedAt", ["type", "updatedAt"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_notionPageId", ["notionPageId"])
    .index("by_canonicalUrl", ["canonicalUrl"])
    .index("by_createdAt", ["createdAt"]),

  // ==========================================================================
  // FEEDS - RSS/Podcast feed configurations
  // ==========================================================================
  feeds: defineTable({
    name: v.string(),
    url: v.string(),
    type: v.union(v.literal("rss"), v.literal("podcast"), v.literal("youtube")),
    category: v.optional(v.string()), // e.g., "journal", "magazine", "lab"
    enabled: v.boolean(),
    lastPolledAt: v.optional(v.number()),
    lastItemAt: v.optional(v.number()),
    pollIntervalMs: v.optional(v.number()), // Default: 6 hours
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_enabled", ["enabled"])
    .index("by_type", ["type"]),

  // ==========================================================================
  // EXTRACTIONS - AI-generated structured output from sources
  // ==========================================================================
  extractions: defineTable({
    sourceId: v.id("sources"),

    // AI metadata
    model: v.string(),
    promptVersion: v.string(),
    inputHash: v.string(),

    // Extracted content
    summary: v.string(),
    claims: v.array(claimValidator),
    compositionParameters: v.array(compositionParameterValidator),
    topics: v.array(v.string()),
    openQuestions: v.array(v.string()),
    confidence: v.number(),

    // Ownership
    createdBy: v.union(v.id("users"), v.literal("system")),
    createdAt: v.number(),
  })
    .index("by_sourceId_createdAt", ["sourceId", "createdAt"])
    .index("by_inputHash", ["inputHash"]),

  // ==========================================================================
  // HYPOTHESES - Testable claims derived from extractions
  // ==========================================================================
  hypotheses: defineTable({
    title: v.string(),
    question: v.string(),
    hypothesis: v.string(),
    rationaleMd: v.string(),
    sourceIds: v.array(v.id("sources")),
    concepts: v.optional(v.array(v.string())),

    // Lifecycle
    status: v.union(
      v.literal("draft"),
      v.literal("queued"),
      v.literal("active"),
      v.literal("evaluated"),
      v.literal("revised"),
      v.literal("retired")
    ),
    resolution: v.optional(
      v.union(
        v.literal("supported"),
        v.literal("inconclusive"),
        v.literal("contradicted")
      )
    ),

    // Versioning
    versionOfId: v.optional(v.id("hypotheses")),
    openQuestions: v.optional(v.array(v.string())),

    // Visibility & ownership
    visibility: visibilityValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_updatedAt", ["status", "updatedAt"])
    .index("by_visibility_updatedAt", ["visibility", "updatedAt"]),

  // ==========================================================================
  // RECIPES - DAW-ready composition specifications
  // ==========================================================================
  recipes: defineTable({
    hypothesisId: v.id("hypotheses"),
    title: v.string(),
    bodyMd: v.string(),
    parameters: v.array(compositionParameterValidator),
    dawChecklist: v.array(v.string()),

    // Protocol (test design)
    protocol: v.optional(
      v.object({
        studyType: v.union(v.literal("litmus"), v.literal("comparison")),
        durationSecs: v.number(),
        panelPlanned: v.array(v.string()),
        listeningContext: v.optional(v.string()),
        baselineArtifactId: v.optional(v.id("compositions")),
        whatVaries: v.array(v.string()),
        whatStaysConstant: v.array(v.string()),
      })
    ),

    // Lifecycle
    status: v.union(
      v.literal("draft"),
      v.literal("in_use"),
      v.literal("archived")
    ),
    visibility: visibilityValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_hypothesisId_updatedAt", ["hypothesisId", "updatedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  // ==========================================================================
  // COMPOSITIONS - Produced audio artifacts
  // ==========================================================================
  compositions: defineTable({
    title: v.string(),
    recipeId: v.id("recipes"),

    // Artifact type
    artifactType: v.union(
      v.literal("microStudy"),
      v.literal("expandedStudy"),
      v.literal("fullTrack")
    ),

    // Content
    projectNotesMd: v.optional(v.string()),
    links: v.optional(
      v.array(
        v.object({
          label: v.string(),
          url: v.string(),
        })
      )
    ),

    // Versioning
    version: v.string(), // e.g., "v0.1"
    diffNote: v.optional(v.string()),
    versionOfId: v.optional(v.id("compositions")),

    // Lifecycle
    status: v.union(
      v.literal("idea"),
      v.literal("in_progress"),
      v.literal("rendered"),
      v.literal("published")
    ),
    visibility: visibilityValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_recipeId_updatedAt", ["recipeId", "updatedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  // ==========================================================================
  // LISTENING SESSIONS - Evaluation data
  // ==========================================================================
  listeningSessions: defineTable({
    compositionId: v.id("compositions"),

    // Context
    participants: v.array(
      v.object({
        name: v.optional(v.string()),
        userId: v.optional(v.id("users")),
        role: v.optional(v.string()), // "self", "wife", "colleague"
      })
    ),
    contextMd: v.optional(v.string()),

    // Ratings (0-5 scale)
    ratings: v.object({
      bodilyPleasantness: v.optional(v.number()),
      goosebumps: v.optional(v.number()),
      perceivedConsonance: v.optional(v.number()),
      musicality: v.optional(v.number()),
      easeOfComposability: v.optional(v.number()),
      consonanceComputed: v.optional(v.number()),
    }),

    // Feedback
    feedbackMd: v.string(),
    bodyMapNotes: v.optional(v.string()),
    expandVerdict: v.optional(
      v.union(v.literal("yes"), v.literal("maybe"), v.literal("no"))
    ),

    // Ownership
    visibility: visibilityValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_compositionId_createdAt", ["compositionId", "createdAt"]),

  // ==========================================================================
  // WEEKLY BRIEFS - Synthesized output
  // ==========================================================================
  weeklyBriefs: defineTable({
    weekOf: v.string(), // ISO date of Monday

    // AI metadata
    model: v.string(),
    promptVersion: v.string(),

    // Content
    bodyMd: v.string(),
    sourceIds: v.array(v.id("sources")),
    recommendedHypothesisIds: v.array(v.id("hypotheses")),
    recommendedRecipeIds: v.array(v.id("recipes")),
    todo: v.optional(v.array(v.string())),

    // Publishing
    visibility: visibilityValidator,
    publishedAt: v.optional(v.number()),
    createdBy: v.union(v.id("users"), v.literal("system")),
    createdAt: v.number(),
  })
    .index("by_weekOf", ["weekOf"])
    .index("by_visibility_createdAt", ["visibility", "createdAt"]),
});
