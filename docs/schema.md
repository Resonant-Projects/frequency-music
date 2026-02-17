# Convex Schema (MVP+) — Tables, Fields, Indexes (Specific)

> Notes:
> - Convex uses `defineSchema` with `v` validators.
> - Indexes matter: build for Inbox, dedupe, week ranges, and role-based queries.
> - Store timestamps as `v.number()` (ms since epoch) for easy range queries.

## 1) users
Fields:
- `clerkUserId: string` (unique)
- `email?: string`
- `displayName?: string`
- `role: "admin" | "collaborator" | "follower"`
- `createdAt: number`
- `updatedAt: number`

Indexes:
- `by_clerkUserId (clerkUserId)`

## 2) sources
Fields:
- `type: "notion" | "rss" | "url" | "youtube" | "pdf"`
- `title?: string`
- `author?: string`
- `publishedAt?: number`
- `canonicalUrl?: string` (normalized if possible)
- `uploadThingUrl?: string` (pdf/file)
- `notionPageId?: string`
- `rssGuid?: string`
- `feedUrl?: string`
- `rawText?: string` (may be excerpt; avoid huge text if needed)
- `rawTextSha256?: string` (dedupe + change detection)
- `metadata?: any` (json blob; keep small)
- `visibility: "private" | "followers" | "public"`
- `status:
   "ingested" | "text_ready" | "extracted" | "review_needed" | "triaged" |
   "promoted_followers" | "promoted_public" | "archived"`
- `blockedReason?:
   "no_text" | "copyright" | "needs_metadata" | "needs_tagging" |
   "ai_error" | "needs_human_review" | "duplicate"`
- `blockedDetails?: string`
- `openQuestions?: string[]`
- `tags?: string[]` (fast filter; e.g. ["ResonantProjects"])
- `topics?: string[]` (fast filter; e.g. ["music","physics"])
- `confidence?: number` (0..1; overall)
- `dedupeKey?: string` (see dedupe section below)
- `createdBy: Id<users> | "system"`
- `createdAt: number`
- `updatedAt: number`

Indexes (critical):
- `by_status_updatedAt (status, updatedAt)`  // Inbox queries
- `by_visibility_updatedAt (visibility, updatedAt)`
- `by_type_updatedAt (type, updatedAt)`
- `by_dedupeKey (dedupeKey)`                 // hard dedupe
- `by_notionPageId (notionPageId)`
- `by_canonicalUrl (canonicalUrl)`
- `by_tag_updatedAt (tags, updatedAt)`       // if using array indexes isn’t ideal, store `primaryTag`
- `by_createdAt (createdAt)`

## 3) extractions
Fields:
- `sourceId: Id<sources>`
- `model: string` (e.g. "claude-3-5-sonnet")
- `promptVersion: "extract_v1" | ...`
- `summary: string`
- `claims: {
    text: string,
    evidenceLevel: "peer_reviewed"|"preprint"|"anecdotal"|"speculative"|"personal",
    citations: { label?: string, url?: string, quote?: string }[]
  }[]`
- `compositionParameters: {
    type: "tempo"|"key"|"tuningSystem"|"rootNote"|"chordProgression"|
          "rhythm"|"instrument"|"synthWaveform"|"harmonicProfile"|
          "frequency"|"note",
    value: string,
    details?: any
  }[]`
- `topics: string[]`
- `openQuestions: string[]`
- `confidence: number`
- `inputHash: string` (hash of source text + promptVersion)
- `createdAt: number`
- `createdBy: Id<users> | "system"`

Indexes:
- `by_sourceId_createdAt (sourceId, createdAt)`
- `by_inputHash (inputHash)` // prevent re-run duplicates

## 4) hypotheses
Fields:
- `title: string`
- `question: string`
- `hypothesis: string`
- `rationaleMd: string`
- `sourceIds: Id<sources>[]`
- `concepts?: string[]` (simple tags until you add concepts table)
- `status: "draft" | "active" | "retired"`
- `visibility: "private" | "followers" | "public"`
- `versionOfId?: Id<hypotheses>`
- `openQuestions?: string[]`
- `createdAt: number`
- `updatedAt: number`
- `createdBy: Id<users>`

Indexes:
- `by_status_updatedAt (status, updatedAt)`
- `by_visibility_updatedAt (visibility, updatedAt)`

## 5) recipes
Fields:
- `hypothesisId: Id<hypotheses>`
- `title: string`
- `bodyMd: string`
- `parameters: (same schema as extraction params)[]`
- `dawChecklist: string[]`
- `status: "draft" | "in_use" | "archived"`
- `visibility: "private" | "followers" | "public"`
- `createdAt: number`
- `updatedAt: number`
- `createdBy: Id<users>`

Indexes:
- `by_hypothesisId_updatedAt (hypothesisId, updatedAt)`
- `by_status_updatedAt (status, updatedAt)`

## 6) compositions
Fields:
- `title: string`
- `recipeId: Id<recipes>`
- `status: "idea" | "in_progress" | "rendered" | "published"`
- `projectNotesMd?: string`
- `links?: { label: string, url: string }[]`
- `visibility: "private" | "followers" | "public"`
- `createdAt: number`
- `updatedAt: number`
- `createdBy: Id<users>`

Indexes:
- `by_recipeId_updatedAt (recipeId, updatedAt)`
- `by_status_updatedAt (status, updatedAt)`

## 7) listeningSessions
Fields:
- `compositionId: Id<compositions>`
- `participants: { name?: string, userId?: Id<users> }[]`
- `contextMd?: string`
- `feedbackMd: string`
- `ratings?: { label: string, value: number, scaleMax: number }[]`
- `visibility: "private" | "followers" | "public"`
- `createdAt: number`
- `createdBy: Id<users>`

Indexes:
- `by_compositionId_createdAt (compositionId, createdAt)`

## 8) weeklyBriefs
Fields:
- `weekOf: string` (e.g. "2026-02-02" Monday)
- `model: string`
- `promptVersion: "brief_v1" | ...`
- `bodyMd: string`
- `sourceIds: Id<sources>[]`
- `recommendedHypothesisIds: Id<hypotheses>[]`
- `recommendedRecipeIds: Id<recipes>[]`
- `todo?: string[]`
- `visibility: "private" | "followers" | "public"`
- `publishedAt?: number`
- `createdAt: number`
- `createdBy: Id<users> | "system"`

Indexes:
- `by_weekOf (weekOf)`
- `by_visibility_createdAt (visibility, createdAt)`

## DedupeKey strategy (concrete)
Set `sources.dedupeKey` using first available:
- Notion: `notion:<pageId>`
- RSS: `rss:<feedUrl>:<guid-or-url>`
- URL: `url:<canonicalUrlNormalized>`
- YouTube: `yt:<videoId>`
- PDF: `pdf:<sha256(file)>`

If a new item comes in with existing dedupeKey:
- mark new attempt as `blockedReason="duplicate"` OR update the existing record’s metadata.
