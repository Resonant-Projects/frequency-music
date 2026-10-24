# Passage search repair, 2026-10-24

Keith authorized repair of the failed passage acceptance, the worker's canonical
HTTP-actions URL cleanup, and Plan 13 option 1. The completed extraction and
hypothesis baseline now clears recipe draft/review workflow implementation;
weekly-brief evaluation remains separate and recipe quality is not baselined.

## Reproduced failures and changes

The original acceptance query remains `432 Hz precise temperament tuning`.
No alternate phrase was substituted.

- Vector-only retrieval can exclude the phrase-specific transcript in favor
  of many broadly related tuning passages. A deterministic regression seeded
  one transcript, fourteen broad transcript distractors, and a multi-chunk
  article. It fails with the original vector-only path.
- Article windows can consume every candidate and result slot before a
  transcript is considered. Unfiltered search now retrieves bounded article
  (`url`, `rss`, `notion`, `pdf`) and transcript (`youtube`, `podcast`) pools
  separately. Explicit type filters retain their existing OR meaning.
- The RAG component's existing hybrid search combines lexical and vector
  results, with text weight 2 and vector weight 1. The query embedding is
  computed once and reused. Each pool returns at most twelve candidates;
  hydration reads at most twelve Source rows per query.
- Each Source's best candidate is considered before repeated windows from the
  same Source. The response still returns at most eight passages and 12,000
  characters, with live provenance and archived Sources excluded.
- A context window can grow beyond 10,000 characters around an 8,000-byte
  matched transcript chunk. Neighboring context is now shortened to keep a
  window within 9,000 characters, preserving the entire matched chunk and
  marking truncation. Short windows are unchanged.
- The response packer now skips a non-fitting later passage and considers
  shorter remaining hits. An oversized first passage remains visibly clipped
  to the response budget, and Unicode boundaries remain valid.

Retrieval lives in `convex/passageSearch.ts`; index creation, updates and
deletion remain in `convex/passages.ts`. No re-indexing, embedding-space
migration, schema change, publication operation or generator integration is
required by the repair.

## Local verification

`vp test convex/passages.test.ts convex/shared/passages.test.ts` passes 33
tests. Coverage includes mixed article/transcript retrieval, phrase-specific
retrieval despite broad distractors, one query embedding, type filters, live
provenance, archive exclusion, count limits, context boundaries and packing.

The actual four Sources used or anticipated in the failed acceptance were
read through `sources:get`, without mutations or embedding calls, and replayed
through the local Convex test backend with its deterministic mocked embedder:

- Precise Temperament Tuning article: 28,934 characters.
- Easter IG LIVE transcript: 76,228 characters.
- The previously returned broad Tanah Lot transcript: 968 characters.
- Music in Terms of Science PDF: 161,992 characters.

Raw source text stayed in an owner-only temporary file and is not committed.
The replay uses the same query, source text, component and selection code.
Its embedding model is mocked, so it does not establish live OpenAI ranking
or acceptance over the full production corpus.

Selected replay output:

```text
all:     passages=3 chars=11686 article=true expectedTranscript=true
youtube: passages=2 chars=9968  expectedTranscript=true
url:     passages=4 chars=10147 article=true
```

The expected transcript contains the precise-temperament phrase. This improves
on the original live YouTube response, whose sole passage contained only broad
tuning discussion. Live acceptance remains to be rerun after deployment.

Full `APP_ENV=test vp run verify` passes all ten tasks, including four
typechecks and 2,429 tests: 1,624 root, 234 harness, 430 agent and 141 media.
Six real SuperCollider tests remain skipped on this host. Existing lint and
Panda warnings remain. The offline, network-denied provenance builder produced
268 root module identities for the candidate.

## Configuration cleanup

`agent/.env.schema` now distinguishes the backend API at
`https://convex.resonantprojects.art` from the HTTP-actions site at
`https://convex-http.resonantprojects.art`.

Infrastructure PR [keithce/homelab-infra#808](https://github.com/keithce/homelab-infra/pull/808)
updates the live worker's URL and exact Cilium HTTPS allowance together. It
removes the active worker's direct LAN port-3211 rule, preserves the current
image and Recreate strategy, and documents the old address only as historical
transfer-candidate state. Eighteen focused infrastructure tests and all pinned
platform/ARC chart renders passed locally. Both the old and canonical endpoints
returned HTTP 200 for the same authenticated read-only `countPendingDrafts`
request after its required `kind` argument was supplied.

## Production verification still required

The backend source at this branch consists of the retrieval repair plus the
current main. Relative to the last identified deployed source `e1a2fb0a`,
main's only other `convex/` source edit is a comment correction in `settings.ts`.
Root dependencies also include LangSmith 0.11.0 and current tooling, so source
comparison alone does not establish deployed byte identity.

Before deploying, the existing operator environment must read and retain live
module identities, establish the complete candidate delta and rollback, and
use `scripts/convex-deploy.ts` against
`https://convex.resonantprojects.art`. This session has no inherited Convex admin
key, and its 1Password identity cannot read Country Manor Lab. No production
deployment or paid probe has been run during this repair.

After deployment, rerun the original three probes: all types, YouTube only,
and URL only, each with limit eight and the original phrase. Each action still
computes only one query embedding. At the existing $0.13/million-token price,
the conservative ceiling is 33 query characters × 3 tokens/character × 3
embedding attempts × 3 probes = 891 tokens, or $0.00011583. A fresh $0.01
approval covers those probes; the earlier approval was for the October 22
three-probe run only. No backfill or re-indexing is part of that check.

The historical log-gap waiver and final keep-indexing decision are distinct
from repairing and verifying retrieval. The existing instruction to leave
indexing enabled during investigation was preserved.
