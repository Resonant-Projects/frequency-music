# Notion Integration Plan (One-way Sync)

## Notion source
- Single database: `Notes`
- Add/standardize:
  - Tag: `ResonantProjects` (or similar)
  - Optional properties (nice-to-have, not required):
    - `Source URL`
    - `Type` (idea, article, paper, voice note, etc.)
    - `Status` (inbox, processed, published)

## Sync strategy (MVP)
- n8n scheduled job (e.g., every 30 minutes):
  1. Query Notion DB for items tagged `ResonantProjects` updated since last cursor
  2. For each page:
     - Extract title, tags, body text, created/updated timestamps
     - Push to Convex ingestion endpoint
  3. Convex dedupes by `notionPageId` + `lastEditedTime`

## What gets stored
- Create/update `sources` of type `notion`
- Store body text as `rawText` (or in `metadata.notionRichText`)
- Trigger extraction job only when:
  - new page ingested
  - or content changed materially (hash diff)

## No bidirectional sync (MVP)
- Notion remains capture tool.
- App is where synthesis/publishing happens.
