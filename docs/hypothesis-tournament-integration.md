# Hypothesis tournament integration

This connects the wave 4 tournament core
(`agent/src/graphs/hypothesis-tournament/`) to durable Convex state and the
production worker. Specification:
[hypothesis tournament design](superpowers/specs/2026-09-28-hypothesis-tournament-design.md).
Nothing here schedules a run, and no production command was run.

## Gate

`HYPOTHESIS_TOURNAMENT_ENABLED` is a Convex deployment variable. Only the
literal `true` lets `beginTournamentRun` issue a lease or `requestTournamentRun`
queue a run. When it is absent or any other value:

- a claimed tournament run gets no lease and makes no model or embedding call,
  and finalization marks it failed (`dependency_error`);
- freq's `tournament.request` returns the MCP adapter's generic error;
- a completed run still replays its saved result.

The Thursday cron still enqueues `hypothesis-drafter`. No cron enqueues the
tournament, prunes the archive or backfills vectors.

## Run lifecycle

1. The worker claims an `agentRuns` row with `graphName: "hypothesis-tournament"`
   and maps `input.seedHint` (trimmed, 500 characters at most) into the graph.
2. `beginTournamentRun` atomically returns `replay` for a completed run, `busy`
   while another lease is live, or a new lease. Each lease token carries a new
   epoch, and the lease lasts `wallMs + cleanupMs` (1,210,000 ms).
3. `recordHypothesisCandidates`, `completeTournamentRun` and
   `submitTournamentDraft` reject a token that is expired, replaced or already
   closed (`StaleTournamentLease`).
4. `submitTournamentDraft` is one transaction. It checks the fence, recounts
   pending hypothesis drafts against the cap of three (returning `cap_reached`
   without writing), verifies provenance, inserts the draft with
   `dedupeKey: tournament:<runId>`, saves the canonical result, closes the
   lease and marks the run `needs_review`. A response lost after commit replays
   from step 2. The run cannot end with a draft but no result, so the spec's
   reconcile repair step is not needed.
5. The graph's `summarize` node calls `finalizeTournamentRun`, and Convex sets
   the terminal status from the durable row rather than the worker's result.
   A run that is no longer `running` is left alone, which keeps a committed
   draft's `needs_review` even after a lost response. A saved no-draft result
   completes the run. Without one, the run fails only if this attempt holds
   the lease (which it releases) or no live lease exists. Another attempt's
   live lease leaves the run untouched.

Publication remains a human decision on the existing draft review path.

## Provenance

The worker never asserts provenance. Convex re-reads every evidence claim on
each archive write, including terminal completion, and at submission, and requires an active claim with the
same text, source and extraction. Payload source and extraction ids must come
from that evidence. A correspondence id must be the candidate's own
correspondence seed. At submission the winner also needs at least two claims,
exactly matching source and extraction sets, and one `[claim:<id>]` citation
per claim. The draft payload must equal the winner's final payload. If the
correspondence gained a hypothesis or pending draft in the meantime, the
submission fails with `DraftTargetUnavailable`.

## Seeds

| Family | Source |
| --- | --- |
| correspondence | `agentDrafts.listDraftableCorrespondences`, top two |
| claim | strong active claims (peer reviewed, preprint or reference, not low confidence) from distinct sources whose on-mission concepts no hypothesis lists |
| inversion | contradicted or retired hypotheses from `failures:listArchive` |
| hint | `input.seedHint` |
| listening, doctrine | skipped by the core until validated human sessions and the passage index exist |

## Duplicate neighbors

Statement vectors use the claims embedding model (`text-embedding-3-small`,
1,536 dimensions). Hypothesis vectors live in `hypothesisEmbeddings`, keyed by
hypothesis and the sha256 of the embedded statement. The spec put them on
`hypotheses`, but a separate table keeps vectors out of every hypothesis read.
`findTournamentNeighbors` re-embeds hypotheses whose vector is missing or
stale (32 at most) and embeds pending drafts at query time. It searches
current hypothesis vectors and other runs' archived candidates. Searches
retrieve past the rows that hydration drops: 32 stale vectors plus 16 for
hypotheses, and 8 same-run rows plus 16 for the archive. More than 32 stale
hypotheses, or more than 500 hypotheses in total, fail the run closed rather
than skip a possible duplicate.

## Model routing and metering

`convex/shared/llmPolicy.ts` assigns Opus 5.5 to generation, grounding and
revision. Sonnet 5.5 scores candidates, compares finalists and runs the self
check. Haiku 5.5 classifies duplicates. Calls use direct Anthropic with adaptive
thinking and policy effort, `maxRetries: 0`, and per-call output caps in
`TOURNAMENT_TOKEN_BUDGETS`. Each call's maximum output is reduced so that the
UTF-8 byte length of prompt and schema plus maximum output fits the remaining
run budget. A call with fewer than 1,024 output tokens left is not made. Usage
comes from the provider response. A response without usage, an abort or a
network failure stops the run. An HTTP error counts as an unbilled missing
attempt.

Embeddings are metered the same way. Evidence search
(`searchTournamentEvidence`), candidate vectors and neighbor re-embedding each
make one OpenAI attempt and report `usage.total_tokens`. Each receives the
remaining allowance and refuses without a provider call
(`budgetExceeded: true`) when the UTF-8 byte length of its texts exceeds it.
The worker treats that refusal as budget exhaustion.

## Prepared operator commands (not run)

Each command contacts production and needs coordinator approval. Confirm the
deployment target first. Deploy the worker image that contains this graph
before opening the gate. An older worker would claim a queued tournament run
and mark it failed as an unknown graph.

```sh
# 1. Backfill hypothesis statement vectors (spends embedding tokens). Repeat
#    with the returned cursor until done is true.
vpx convex run hypothesisTournamentNode:backfillHypothesisEmbeddings '{"cursor": null}'

# 2. Open the gate.
vpx convex env set HYPOTHESIS_TOURNAMENT_ENABLED true

# 3. Queue one run as an operator (paid Anthropic inference when claimed).
vpx convex run hypothesisTournament:request '{"requestedBy": "operator", "seedHint": "..."}'

# Rollback: close the gate. Queued runs fail without spending when claimed.
vpx convex env set HYPOTHESIS_TOURNAMENT_ENABLED false

# Retention (bounded and repeatable; not scheduled yet):
vpx convex run hypothesisTournament:pruneCandidates '{"limit": 100}'
```

Schema additions: `tournamentRuns`, `hypothesisCandidates` (vector index
`by_statementEmbedding`), `hypothesisEmbeddings` (vector index `by_embedding`),
and optional `agentReviewDrafts.dedupeKey` with index `by_dedupeKey`. All are
additive, and existing rows need no migration.

## Deferred

- Switching the Thursday cron from `hypothesis-drafter`. That needs ten exported
  tournament runs and the plan 008 comparison, then a recorded decision.
- Listening fitness and adaptive family weights, until validated human sessions
  exist.
- A weekly prune cron, and LangSmith export of the first ten runs.
