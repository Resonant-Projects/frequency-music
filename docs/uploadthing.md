# UploadThing Integration — Concrete Flow

## App flow (SolidJS)
1) User uploads PDF via UploadThing UI widget.
2) UploadThing returns:
   - `url`
   - `name`, `size`, `type`
   - (optional) custom metadata

3) App calls Convex mutation `attachUploadThingToSource(...)`:
   - create `source` first (type pdf) OR attach to an existing one
   - store `uploadThingUrl`
   - store `dedupeKey = pdf:<sha256>`

4) Convex schedules `extractPdfText(sourceId)` action.

## Storage rules
- Keep PDFs private by default.
- Public layer shows:
  - title/author/year
  - your extracted notes
  - link to publisher page if available
  - UploadThing URL only if you explicitly promote + have rights

## Edge cases
- PDF text extraction fails:
  - set `status="ingested"`, `blockedReason="no_text"`
  - allow admin to attach manual excerpt text and proceed
