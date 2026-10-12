# Concept classification and explicit retries

The classifier assigns domains from the registry and proposes mission relevance. A response with an unknown, provisional, or deprecated domain, or no domains, leaves the concept `unreviewed` for human triage. Any unknown domain blocks the whole assignment, even when other proposed domains are assignable. New unknown domains are staged as provisional registry entries.

`classifiedAt` records the last completed, persisted classifier response, including one that needs review. The hourly sweep selects at most 20 `unreviewed` concepts with no `classifiedAt` and a `createdAt` at least one hour old. Its index applies both eligibility conditions before the limit, so completed proposals cannot block newer concepts or trigger repeat model calls.

Existing review outcomes without `classifiedAt` remain eligible for one more automatic attempt. A completed response records the timestamp and parks the concept if review is still needed. Malformed rows, missing result rows, and provider failures retain their existing retry behavior. They do not record a completed response; this change does not bound their retries.

## Retry an unreviewed concept batch

After reviewing the provisional registry entries, preview up to 20 unreviewed concepts:

```sh
vpx tsx scripts/classify-concepts.ts --retry-unreviewed --limit=20
```

To save the results, run:

```sh
vpx tsx scripts/classify-concepts.ts --retry-unreviewed --limit=20 --apply
```

Both commands contact the configured Convex deployment and make paid model calls. The preview prints proposed classifications without saving them. Applying runs a fresh classification; it does not reuse the preview. Confirm the configured target before running either command. The script loads configuration through Varlock and obtains `devBypassSecret` through the existing authenticated CLI path. Do not print or paste the secret.

`--retry-unreviewed` selects only concepts whose mission relevance is `unreviewed` and bypasses the completed-response guard for those concepts. It includes both parked proposals and concepts without a completed response. Concepts already marked `on` or `off` are excluded. A retry that again proposes unusable domains stays unreviewed and records a new completion timestamp.

The retry option defaults to a maximum of 30 concepts, including with `--apply`. Use `--limit=N` to choose another cap, or `--all` to traverse every unreviewed concept. `--batch-size=N` controls request size, up to 20 concepts; it is separate from the total concept cap. `--model=ID` selects a registered model. Ordinary `--force` retains its broader behavior and can reclassify assigned concepts.

Domain promotion changes registry eligibility but does not schedule classification. Run the explicit retry after promotion. The ordinary backfill skips completed proposals; its `converged` output only describes whether that invocation found candidates, not whether all domain triage is finished.

For a particular concept, authenticated callers can use `conceptClassifier:classifyConcepts` with its `conceptIds`, `force: true`, and `apply: true`. The CLI retry option processes a bounded batch in index order rather than selecting a specific ID.
