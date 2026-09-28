# Hypothesis Tournament Design (wave 4)

Replace one-draft-one-check with a search: many candidates from diverse
seeds, a novelty gate, a pairwise tournament, one evolution round, and then
the same single human door with the same cap of three.

Parent: [Listen-first program](./2026-09-28-listen-first-program-design.md).
Independent of waves 1–3 except that listening fitness (§6) needs wave 3
data.

## 1. Outcome

- Each weekly drafter run considers eight or more candidates and submits at
  most one draft, as today, but the survivor has beaten its siblings on
  stake, novelty, and falsifiability.
- Candidates and their scores are archived, so the next run can avoid what
  lost and the eval loop can learn from what Keith approved.
- Seeds come from five families, not one.
- Freq can request a run with a seed hint; the worker does the drafting, so
  provenance is unchanged.

## 2. Graph

New graph `hypothesis-tournament` in `agent/src/graphs/hypothesis-tournament/`,
registered in `agent/src/worker/runner.ts`. The existing `hypothesis-drafter`
stays for comparison runs and is what the Thursday cron calls until the
tournament's first three drafts have been reviewed; then the cron switches.

```
check_capacity → gather_seeds → generate_candidates → novelty_gate
  → tournament → evolve → self_check → write_draft → summarize
```

- `check_capacity`: as today (`countPendingDrafts`, exit when the cap is full).
- `gather_seeds`: pulls up to three seeds from each family (§3), bounded and
  provenance-tagged. Total seed count is capped at twelve.
- `generate_candidates`: one LLM call per seed producing a candidate in the
  existing hypothesis payload shape (`whyThisMatters`, statement, rationale,
  falsification condition, proposed recipe sketch). Temperature 0.9 for
  breadth. Candidates carry `seedFamily` and `seedRefs`.
- `novelty_gate`: embeds each candidate statement and searches hypotheses,
  pending drafts, the candidate archive, and the failure archive through a
  new read tool `searchHypothesesSemantic`. A cosine similarity above 0.86
  to any existing item drops the candidate with the matched id recorded.
- `tournament`: pairwise judging with `agent/src/graphs/shared/judge.ts`,
  extended with a rubric of stake (does the answer change what Keith would
  do in the studio), novelty (against the seeds' own context), and
  falsifiability (is there a listening test that could refute it). Round
  robin for up to eight survivors, Swiss pairing beyond that. Scores are
  Elo-style so archive rows are comparable across runs.
- `evolve`: the top three each get one mutation prompt ("sharpen the
  falsification", "cross with candidate N", "invert the losing sibling's
  assumption"); mutants re-enter a final mini-tournament with their parents.
- `self_check`: the existing self-check prompt, unchanged.
- `write_draft`: one draft, `createAgentReviewDraft`, with the tournament
  bracket summary in the draft `summary` and the losing candidates' titles
  listed so the reviewer sees the alternatives.
- `summarize`: as today, plus `recordHypothesisCandidates` (§4).

The run is bounded: at most 14 candidate generations, 40 judge calls, 6
mutations, all under the existing `TOKEN_BUDGETS` policy with a new
`hypothesisTournament` budget line in `convex/llm.ts`.

## 3. Seed families

| Family | Source | Tool |
| --- | --- | --- |
| correspondence | as today: evidenced or conjectured cross-domain pairs | `listDraftableCorrespondences` |
| claim | a strong active claim with no hypothesis referencing its concepts | new `listUnhypothesizedClaims` |
| inversion | a contradicted or retired path from the failure archive, seeded as "what if the opposite holds" | `listFailureArchive` (empty today; family is skipped when empty) |
| listening | a listening session with `bodilyPleasantness` or `goosebumps` ≥ 4 whose composition's recipe has no follow-up hypothesis, seeded as "what explains this response" | new `listStandoutListeningSessions` |
| sweep | a recipe parameter kind with fewer than two hypotheses touching it, seeded as "vary this" | new `listUnderexploredParameterKinds` |
| doctrine | a passage from `docs/essays` (418 essays) chosen by embedding similarity to the week's brief themes | new `searchEssayPassages`, backed by an `essayPassages` table built by `scripts/index-essays.ts` (paragraph chunks, existing embedding pipeline) |

Family weights default to equal. Each candidate's `seedFamily` is stored so
the archive can show which families produce approved drafts.

## 4. Candidate archive

New table `hypothesisCandidates`:

```
hypothesisCandidates
  agentRunId
  seedFamily, seedRefs: string[]
  payload                         // hypothesis payload shape
  statementEmbedding?: number[]   // vector index for the novelty gate
  noveltyDroppedBy?: string       // id of the near-duplicate
  elo: number, wins, losses
  mutatedFrom?: Id<"hypothesisCandidates">
  outcome: "dropped_novelty" | "lost" | "evolved" | "submitted"
  draftId?: Id<"agentReviewDrafts">
  createdAt
```

Written through one audit-only tool `recordHypothesisCandidates` at the end
of the run. Candidate rows are never promoted directly; only the submitted
draft passes through the human door. Rows older than 180 days that were not
submitted are pruned by a weekly cron.

## 5. Freq's night shift

Freq's HEARTBEAT may call `tournament.request` (wave 2 MCP) with a seed hint
such as "listening session L-42" or "the geometric temperament essays". The
MCP server enqueues an `agentRuns` row for `hypothesis-tournament` with
`input.seedHint`. `gather_seeds` treats the hint as a sixth seed with family
`hint` and provenance `requestedBy: "freq"`. The run still checks capacity
and still submits at most one draft. Freq is told the run id and nothing
else until the draft appears on the docket.

## 6. Listening fitness

After wave 3, `seedFamilyFitness` (a Convex query) computes, per family, the
mean human `bodilyPleasantness` and `expandVerdict` rate of compositions whose
recipe traces back to an approved hypothesis from that family, over the last
90 days. `gather_seeds` allocates its twelve seeds proportionally to fitness
with a floor of one per family, so a family that produced nothing good
still gets a hearing. Until there are five rated compositions, weights stay
equal.

## 7. Error handling

- Any family's tool failure skips that family and logs an event; the run
  proceeds if at least three seeds exist, otherwise it summarizes and exits.
- Novelty gate embedding failure fails open for that candidate with an event,
  so a transient embedding outage does not silently block a good idea; the
  reviewer sees the flag.
- Judge call failures count as a draw.
- Budget exhaustion mid-tournament takes the current Elo leader to
  `self_check` rather than failing the run.

## 8. Testing

- `agent/src/graphs/hypothesis-tournament/*.test.ts`: routing, seed bounding,
  novelty threshold, round-robin pairing, Elo update math, mutation prompts
  applied to the right candidates, single draft written, candidate archive
  payload shape.
- `convex/hypothesisCandidates.test.ts`: write tool validation, prune cron.
- `convex/essayPassages.test.ts`: chunking is stable; index script is
  idempotent on unchanged essays.
- LangSmith dataset: the first ten tournament runs are exported by
  `scripts/export-eval-datasets.ts` so plan 008's baseline sweep can compare
  drafter versus tournament approval rates.

## 9. Out of scope

- Multi-draft submission per run. The cap stays at three pending and one per
  run.
- Automatic promotion of any candidate.
- Recipe tournaments; recipes remain one draft per approved hypothesis.
