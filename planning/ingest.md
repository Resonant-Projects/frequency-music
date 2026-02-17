# Ingestion Pipelines — RSS, URLs, YouTube, PDFs

## RSS (n8n → Convex)
- Configure list of RSS feeds.
- Poll schedule: daily or twice daily.
- For each new item:
  - Create `source` with type `rss`, include title, url, publishedAt, feed name
  - Optionally fetch page text via a readability step (n8n) or via Convex Action

## URL ingestion (App UI → Convex)
- User pastes URL.
- Convex Action:
  - fetch content (respect robots/ToS)
  - extract readable text
  - create `source` (type url)
  - enqueue extraction

## YouTube ingestion (App UI → Convex)
- Store video metadata + URL.
- If transcript available:
  - fetch transcript via approved method/API
  - store transcript text
- Enqueue extraction.

## PDF ingestion (App UI → UploadThing → Convex)
- UploadThing handles file upload and returns asset URL + metadata.
- Convex stores `uploadThingUrl`.
- Text extraction:
  - either in Convex Action using a PDF text extraction library/service
  - or via n8n/worker calling a PDF-to-text service
- Store extracted text (or excerpt) and enqueue LLM extraction.

## Dedupe
- `hash` sources by canonical URL OR file hash OR notion page id.
- Avoid repeated LLM processing unless content changes.
