# PDF capture

PDF Sources get their text in Convex through the Lab's self-hosted Firecrawl. This is
build slice S5 of [autonomous-ingest-design.md](./autonomous-ingest-design.md). Keith
approved the design on 2026-10-17 (Postplan draft `tzak0v5h9k77`, version 3).

## Paths

| Input | Intake | Text |
| --- | --- | --- |
| Uploaded file (`/ingest`, 25 MB at most) | `pdfCapture.createFromPdfUpload`. The browser uploads to Convex storage first. The Source keeps the blob in `sources.pdfStorageId`. Dedupe key: `pdf:<sha256 hex>` | `POST $FIRECRAWL_API_URL/v2/parse` with the stored bytes |
| Public PDF URL | `pdfCapture.createFromPdfUrl`. Dedupe key: the URL key, so `arxiv:` and `doi:` identity holds | `POST $FIRECRAWL_API_URL/v2/scrape` |

`pdfCaptureNode.capturePdf` (a Node action) calls Firecrawl. It never fetches a
user-supplied URL itself: Firecrawl's egress proxy blocks private, LAN and metadata
targets after DNS and on redirects. Crawl4AI is not used, because it has no PDF text
path. Text is capped at `SOURCE_TEXT_MAX_CHARS` (100,000, shared with
`MAX_URL_TEXT_CHARS`). A longer PDF keeps its first 100,000 characters, and
`metadata.pdfCapture` records `chars`, `truncated` and `numPages`.

## States

`metadata.pdfCapture.state` moves through `queued` → `parsing` → `captured`, or to
`waiting` (a retryable failure) or `blocked`. Every scheduled attempt has a new `seq`,
so a late result from an older attempt is ignored. A watchdog fails an attempt that is
still open after 12 minutes.

| Outcome | Source |
| --- | --- |
| Text | `text_ready`; the passage index is scheduled |
| Firecrawl cannot read the PDF, near-empty text (scanned pages), not a PDF, over 25 MB | `review_needed` + `blockedReason: "pdf_parse_error"`, at once |
| Firecrawl or the source server fails (network, 408, 429, 5xx) | Retries after 1 and 5 minutes, then `review_needed` + `no_text` |
| 404 or another 4xx, capture off, file missing | `review_needed` + `no_text`, at once |

`isMissingTextBlock()` treats `pdf_parse_error` like `no_text`. "Provide text" and
Archive work as they do for other Sources, and "Access changed" starts a new capture run.

## Operator enablement

Production stays off until an operator does the following. Until then, a new PDF Source
blocks with "PDF capture through Lab Firecrawl is off in this deployment", and the
Convex deploy itself is operator-gated.

1. Deploy the backend release that contains this change.
2. From the Convex backend guest, confirm that Lab Firecrawl answers (for example,
   `POST /v2/scrape` with a public arXiv PDF). Use the address that guest can reach:
   `https://firecrawl.rproj.art` or the cluster address in `agent/.env.schema`.
3. Set `FIRECRAWL_API_URL` to that address in the Convex deployment environment.
4. Set `FIRECRAWL_SCRAPE_EGRESS_GUARDED=true` only while the egress proxy still blocks
   private targets. It was verified on 2026-09-30; see
   [source-scout-research.md](./source-scout-research.md).
5. Upload one text PDF and submit one public PDF URL. Both must reach `text_ready`.

Until step 1, `scripts/wave2-deployment-coverage.ts` reports the `pdf-capture` group
missing from the deployment.

Uploads at or below 25 MB fit Firecrawl's proxy, which accepted 30 MB and refused 50 MB
on 2026-10-17.
