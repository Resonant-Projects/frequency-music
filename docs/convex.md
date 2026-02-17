# Convex HTTP Endpoints + Actions — Exact Responsibilities

## Why split endpoints vs actions?
- **HTTP endpoints**: called by n8n (no user session), idempotent ingestion.
- **Mutations**: called by app (authenticated), create/update records.
- **Actions**: long-running / external calls (LLM, fetch page text, PDF extraction).

---

## A) HTTP Endpoints (n8n → Convex)

### 1) POST /ingest/notion
Payload:
- `secret` (shared signing secret)
- `notionPageId: string`
- `title: string`
- `tags: string[]`
- `lastEditedAt: number`
- `contentText: string` (plain text)
- `sourceUrl?: string`

Behavior:
- Compute `dedupeKey = notion:<pageId>`
- Upsert `sources` with type=notion
- If content hash changed: set `status="text_ready"` and enqueue extraction
- Else: update `updatedAt` only

### 2) POST /ingest/rssItem
Payload:
- `secret`
- `feedUrl: string`
- `guid: string`
- `title: string`
- `link: string`
- `publishedAt?: number`
- `summaryText?: string` (optional)
Behavior:
- dedupeKey `rss:<feedUrl>:<guid>`
- Create source; `rawText` may be summaryText
- status:
  - if summaryText exists -> `text_ready`
  - else -> `ingested` + `blockedReason="no_text"` (until fetch step runs)
- Enqueue fetch/extract job based on config

### 3) POST /ingest/url
Payload:
- `secret`
- `url: string`
Behavior:
- Create source (type url), status `ingested`
- Enqueue `fetchText` action → then extraction

---

## B) Mutations (App → Convex)

### createSourceFromUrl(url)
- Creates `sources` with createdBy=user
- status=ingested
- enqueue fetch/extract

### createSourceFromYouTube(url)
- Parse videoId
- status=ingested
- enqueue transcript fetch (if available) → then extraction

### attachUploadThingToSource(sourceId, uploadThingUrl, fileSha256)
- Update source; type `pdf`
- status=ingested or text_ready (depending on whether you also provide extracted text)
- enqueue pdfTextExtraction

### setSourceStatus(sourceId, status, blockedReason?)
- Admin tool to move items forward or mark blocked

### editExtraction(extractionId, fields…)
- Human override; set source status to review_needed or triaged depending

### promoteVisibility(entityType, id, visibility)
- Admin workflow to promote to followers/public

---

## C) Actions (Server-side long tasks)

### fetchReadableText(sourceId)
- For `type=url|rss`
- Fetch HTML and run readability extraction
- Store `rawText`, `rawTextSha256`
- status -> `text_ready` or blocked `no_text`

### fetchYouTubeTranscript(sourceId)
- Store transcript in `rawText`
- status -> `text_ready` or blocked `no_text`

### extractPdfText(sourceId)
- Pull from UploadThing URL
- Extract text (service/library)
- Store `rawText`
- status -> `text_ready` or blocked `no_text|copyright`

### runExtraction(sourceId, promptVersion="extract_v1")
- Requires `rawText`
- Calls LLM
- Writes `extractions`
- Sets source status:
  - `extracted` then `review_needed`
- If fails: `blockedReason="ai_error"`

### generateWeeklyBrief(weekOf)
- Gather sources updated/ingested during the week with `status in (review_needed, triaged, promoted_*)`
- Pull their latest extractions
- Call LLM with `brief_v1`
- Store `weeklyBriefs` (private by default)

---

## Queueing / Idempotency rules (to prevent “spinning”)
- Only enqueue `runExtraction` if:
  - `rawTextSha256` exists
  - and no extraction exists with same `inputHash`
- If blocked, don’t re-enqueue unless admin hits “Retry”
