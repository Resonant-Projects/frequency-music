# Hypothesis Tournament Design (wave 4)

Replace one-draft-one-check with a bounded search: candidates from several
seed families, evidence gathered per candidate, a duplicate check, a scored
shortlist, a small finalist comparison, and then the same single human door
with the cap of three.

Parent: [Listen-first program](./2026-09-28-listen-first-program-design.md).
Independent of waves 1 to 3, except that listening fitness (§7, deferred)
needs human sessions on validated renders.

## 1. Outcome

- Each run considers up to eight candidates and submits at most one draft
  that beat its siblings on stake, novelty, and falsifiability.
- Every candidate, its evidence, its scores, and its outcome is archived.
- Seeds come from correspondences, claims, listening responses, failure
  inversions, and doctrine passages.
- Freq can request a run with a seed hint; the worker drafts, so provenance
  is unchanged.

## 2. Graph

`agent/src/graphs/hypothesis-tournament/`, registered in
`convex/shared/agentContract.ts` (`KNOWN_GRAPH_NAMES` and terminal ownership),
`agent/src/worker/graphInput.ts`, and `agent/src/worker/runner.ts`.

```
check_capacity → gather_seeds → generate_candidates → gather_evidence
  → duplicate_check → score → finalists → self_check → write_draft → summarize
```

- `check_capacity`: as today.
- `gather_seeds`: up to two seeds per family (§3), eight total, provenance
  tagged. Fewer than three seeds ends the run at `summarize`.
- `generate_candidates`: one call per seed, temperature 0.9, producing a
  `TournamentCandidate` (typed in `agent/src/graphs/hypothesis-tournament/
  types.ts`): `{ payload: HypothesisDraftPayload fields title, question,
  statement, rationale, whyThisMatters, concepts; seedFamily; seedRefs;
  evidenceClaimIds: [] }`. Seed metadata never enters the draft payload,
  which keeps `hypothesisDraftPayloadZ` unchanged.
- `gather_evidence`: for each candidate, `searchClaimsSemantic` on the
  statement, then a new read tool `hydrateClaims` (claim ids → claim text,
  source id, extraction id; the search tool returns no extraction ids). Keep
  candidates with at least two claims; fill `sourceIds` and `extractionIds`
  from hydrated claims only, and `correspondenceId` when the seed was a
  correspondence. Then a `ground` call rewrites the rationale to cite the
  claim ids literally. The research-pipeline's id ledger is extracted into
  `agent/src/graphs/shared/idLedger.ts` and used here: any source,
  extraction, correspondence, or claim id not read in this run rejects the
  candidate.
- `duplicate_check`: embed each statement (same model as claims, per ADR
  0001) and retrieve neighbours above 0.86 similarity from hypotheses,
  pending drafts (embedded at query time), the candidate archive, and the
  current batch's siblings. A judge call classifies each pair as
  `duplicate`, `inversion`, or `refinement`. Only duplicates are dropped
  (for sibling duplicates, the later batch index); inversions and
  refinements are kept and named in the draft summary. Hypotheses whose
  embedding is missing are compared by re-embedding their statement text at
  query time, so a partial backfill cannot hide a duplicate.
- `score`: three independent judge calls per candidate with the rubric
  (stake: changes what Keith would do in the studio; novelty: against the
  seed's own context; falsifiability: a listening test could refute it).
  A candidate needs at least two successful judgments to be eligible; a
  failed judge call is a missing judgment, never a draw.
- `finalists`: the top three by mean score go through three pairwise
  comparisons; the winner proceeds. Ties go to the higher falsifiability.
- `self_check`: the existing prompt's three checks unchanged (30 to 90
  second testability, exactly one variable, rationale cites supplied claim
  ids without overstating), with the seed context substituted for the
  correspondence block when the seed is not a correspondence. One revision
  as today; if the revision changes the statement, `duplicate_check` runs
  once more on the revised statement.
- `write_draft`: `createAgentReviewDraft` with the finalist summary and the
  losing candidates' titles. Per-run idempotency: a draft dedupe key
  `tournament:<runId>` on the draft so a retried run returns the existing
  draft (today's dedupe covers only correspondence-keyed drafts).
  Immediately after the draft id returns, the winner's archive row is
  upserted with `draftId` and `outcome: "submitted"`.
- `summarize`: as today.

Budget, enforced by the graph state as separate counters: 8 generation
calls, 8 grounding calls, 24 scoring calls, 3 duplicate-classification
calls per candidate, 3 finalist calls, 2 self-check calls, 1 revision
generation call (the rewrite after a failed first self-check), and 1
duplicate re-check, with retries counted against the same counter; 300 000
total tokens summed from provider usage; 20 minutes wall clock; persistence
calls are not counted. Exhaustion behaviour, all without a draft: before
`finalists`, every eligible candidate is archived as `lost` and the run
summarizes; during the pairwise comparisons, before a winner exists, the
three finalists are archived as `finalist` with whatever pairwise results
were recorded and the run summarizes with reason `budget_exhausted`; after
a winner is chosen, the winner stays `finalist` and the run summarizes,
because an unchecked draft is never submitted. `TOKEN_BUDGETS` in `convex/llm.ts`
gains per-call caps for the new prompts; it remains a per-call cap table,
and the run budget lives in the graph.

## 3. Seed families

| Family | Source | Tool |
| --- | --- | --- |
| correspondence | as today | `listDraftableCorrespondences` |
| claim | strong active claims whose concepts no hypothesis references | new read tool `listUnhypothesizedClaims` |
| listening | human sessions with `bodilyPleasantness` or `goosebumps` ≥ 4 on validated renders whose recipe has no follow-up hypothesis | new read tool `listStandoutListeningSessions`; skipped while empty |
| inversion | contradicted or retired paths | `listFailureArchive`; skipped while empty |
| doctrine | passages from `docs/essays` retrieved by similarity to the week's brief themes, through the passage program of plan 15 and ADR 0001 (essays are ingested as sources into the passage index; no separate table) | passage search tool from plan 15; skipped until plan 15 lands |
| hint | a seed supplied by freq (§6) | run input |

Families are sampled equally, two seeds each, in this release.

## 4. Candidate archive

```
hypothesisCandidates
  agentRunId, batchIndex
  seedFamily, seedRefs: string[]
  payload                        // hypothesisDraftPayloadZ shape as generated and grounded
  finalPayload?                  // winner only: the payload after self-check revision
  selfCheck?: { pass, testable, oneVariable, evidenceGrounded, feedback }
  statementEmbedding?: number[]  // vector index, same model as claims
  duplicateOf?: string, duplicateKind?: "duplicate" | "inversion" | "refinement"
  scores: { stake, novelty, falsifiability }[]   // one per successful judgment
  outcome: "dropped_evidence" | "dropped_duplicate" | "ineligible" | "lost"
         | "finalist" | "failed_self_check" | "submitted"
  draftId?
  createdAt
```

Embedding freshness: `hypotheses` also gains `statementEmbeddingHash`
(sha256 of the statement). The duplicate check re-embeds any hypothesis
whose hash does not match its current statement, and the existing
`embed-missing-sweep` cron refreshes mismatches. Candidate rows are
immutable after creation, so they need no freshness rule.

Written incrementally through the audit-only tool
`recordHypothesisCandidates` keyed by `(agentRunId, batchIndex)` so retries
upsert: after `duplicate_check` (candidates, evidence, duplicate status),
after `finalists` (scores, `lost` and `ineligible` outcomes, the winner as
`finalist`), after `self_check` (the winner's `selfCheck` result and
`finalPayload`, or outcome `failed_self_check` when the revision still
fails, in which case no draft is written), and after `write_draft` (winner
set to `submitted` with `draftId`). A run that dies between draft creation and the last write
leaves a `finalist` row and a draft carrying `tournament:<runId>`; the
existing `reconcile-reviewed-agent-runs` cron gains a step that repairs that
linkage. Rows are never promoted directly. Unsubmitted rows older than 180
days are pruned weekly.

Migration: `hypotheses` gains `statementEmbedding?` with a vector index and a
backfill script `scripts/embed-hypotheses.ts` using the existing embedding
pipeline; the duplicate check reads hypotheses, pending drafts (embedded at
query time), and the archive.

## 5. Rollout

The Thursday cron keeps calling `hypothesis-drafter`. Tournament runs are
enqueued manually and by freq until ten runs have been exported to LangSmith
by `scripts/export-eval-datasets.ts` and plan 008's baseline sweep has
compared approval rates. Switching the cron is a decision recorded in the
decision log, not a side effect of this wave.

## 6. Freq's requests

`tournament.request` (wave 2 MCP) enqueues an `agentRuns` row for
`hypothesis-tournament` with `input.seedHint` and `requestedBy: "freq"`. The
hint becomes the `hint` family's seed. Freq is told the run id and nothing
else until a draft appears on the docket.

## 7. Deferred

- Evolution and mutation rounds.
- Swiss pairing and cross-run Elo.
- Listening fitness and adaptive family weights. When revisited, it needs a
  per-family minimum of five human sessions on validated renders, a stated
  aggregation for repeated sessions, and a defined treatment of `maybe`.
- A `sweep` family over under-explored parameter kinds.

## 8. Error handling

- A family tool failure skips the family with an event.
- Embedding failure in `duplicate_check` fails open for that candidate with a
  flag in the draft summary.
- Judge failures are missing judgments; a candidate below two judgments is
  ineligible; no eligible candidate ends the run without a draft.
- Draft cap reached between `check_capacity` and `write_draft`: the mutation
  rejects, the run records `ineligible` outcomes, and summarizes.

## 9. Testing

- Graph tests: routing, seed bounding, evidence minimum, duplicate
  classification handling, eligibility rule, finalist selection, single
  draft, incremental archive writes, budget exhaustion path.
- `convex/hypothesisCandidates.test.ts`: upsert by batch key, prune cron.
- `convex/agentDrafts.test.ts`: tournament dedupe key returns the existing
  draft on retry.
- `scripts/embed-hypotheses.test.ts`: idempotent backfill.
- LangSmith: first ten runs exported for the plan 008 comparison.

## 10. Out of scope

- More than one draft per run; the cap of three stays.
- Automatic promotion of any candidate.
- Recipe tournaments.
