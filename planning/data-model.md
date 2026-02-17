# Data Model (Convex) — MVP Schema

## Conventions
- Every record has: `createdAt`, `updatedAt`, `createdBy`, `visibility` (`private|followers|public`)
- Prefer append-only versioning for generated artifacts (store `promptVersion`, `model`, `inputHash`)

## Tables

### users
- `clerkUserId`
- `role`: `admin|collaborator|follower`
- `email`, `displayName`

### sources
Represents an ingested item.
- `type`: `notion|rss|url|youtube|pdf`
- `title`
- `author` (optional)
- `publishedAt` (optional)
- `canonicalUrl` (optional)
- `uploadThingUrl` (if pdf/file)
- `rawText` (optional; may store excerpt only)
- `metadata` (json: tags, notion ids, etc.)
- `hash` (dedupe)
- `ingestedAt`

### extractions
Structured AI output derived from `sources`.
- `sourceId`
- `model`
- `promptVersion`
- `summary`
- `claims[]`:
  - `text`
  - `evidenceLevel`: `peer_reviewed|preprint|anecdotal|speculative|personal`
  - `citations[]` (urls/anchors)
- `compositionParameters[]` (see below)
- `topics[]` (e.g. math/physics/music/psychoacoustics)
- `confidence` (0–1)
- `inputHash`

### compositionParameters
Represent as structured objects (store inside extractions for MVP; can normalize later):
- `type`: `tempo|key|tuningSystem|rootNote|chordProgression|rhythm|instrument|synthWaveform|harmonicProfile|frequency|note`
- `value` (string)
- `details` (json; e.g. bpm number, tuning ratios, interval sets, note lengths)

### concepts (optional in MVP; can start lightweight)
- `name`
- `domain`: `math|physics|music|other`
- `description`
- `sourceIds[]`

### hypotheses
- `title`
- `question`
- `hypothesis`
- `rationale` (markdown)
- `sourceIds[]` (traceability)
- `status`: `draft|active|retired`
- `versionOfId` (optional)

### recipes
- `hypothesisId`
- `title`
- `body` (markdown narrative + bullet parameters)
- `parameters[]` (same schema as above)
- `dawChecklist[]` (strings)
- `status`: `draft|in_use|archived`

### compositions
- `title`
- `recipeId`
- `projectNotes` (markdown)
- `links[]` (SoundCloud/private storage/etc.)
- `status`: `idea|in_progress|rendered|published`

### listeningSessions
- `compositionId`
- `participants[]` (names or anonymized ids)
- `context` (markdown: room, headphones, etc.)
- `feedback` (markdown)
- `ratings` (json; optional simple scales)
- `createdAt`

### weeklyBriefs
- `weekOf` (ISO date)
- `model`
- `promptVersion`
- `body` (markdown narrative)
- `sourceIds[]`
- `recommendedHypothesisIds[]`
- `recommendedRecipeIds[]`
- `publishedAt` (optional)

## Visibility rules (suggested)
- Default: everything private
- Promote to `followers` when coherent
- Promote to `public` when edited/curated
