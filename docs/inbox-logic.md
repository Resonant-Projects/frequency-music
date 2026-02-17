# Inbox Logic — Exact Query + “Next Action” Derivation

## Inbox query (admin)
Return sources where:
- `visibility="private"` (most work happens here)
- `status in ("ingested","text_ready","extracted","review_needed")`
Sort by:
1) blockedReason exists DESC
2) status priority:
   - ingested (needs text)
   - text_ready (needs extraction)
   - extracted/review_needed (needs triage)
3) updatedAt ASC (oldest first)

## Next Action (derived)
- status=ingested:
  - if type=url|rss → “Fetch text”
  - if type=youtube → “Fetch transcript”
  - if type=pdf and uploadThingUrl exists → “Extract PDF text”
  - else → “Add missing content”
- status=text_ready:
  - “Run extraction”
- status=review_needed or extracted:
  - “Review extraction” (edit claims/parameters, set evidence levels)
  - then “Triage”:
    - create hypothesis
    - create recipe
    - archive
    - promote to followers
- blockedReason=no_text:
  - “Paste excerpt / add manual notes / mark copyright”
- blockedReason=ai_error:
  - “Retry extraction” (or downgrade model / shorten text)

## Always-available manual escape hatch
Admin can:
- create a hypothesis directly from a source without extraction
- create a recipe directly from a hypothesis without AI
This guarantees forward movement even if automation fails.
