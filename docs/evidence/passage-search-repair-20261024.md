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
  transcript is considered. Search now over-fetches eight times the requested
  result count, capped at 64 chunks, before selecting distinct Sources.
  Explicit type filters retain their existing OR meaning.
- The RAG component's existing hybrid search combines lexical and vector
  results, with text weight 4 and vector weight 1. One global ranking keeps
  scores comparable across source types, including a limit-one search.
  The query embedding is computed once; hydration reads at most twelve Source
  rows per query.
- Each Source's best candidate is packed before repeated windows from the
  same Source. Packing preserves that order rather than re-sorting by score.
  The response still returns at most eight passages and 12,000
  characters, with live provenance and archived Sources excluded.
- A context window can grow beyond 10,000 characters around an 8,000-byte
  matched transcript chunk. Neighboring context is now shortened to keep a
  window within 9,000 characters, preserving the entire matched chunk and
  marking truncation. Short windows are unchanged.
- The response packer now skips a non-fitting later passage and considers
  shorter remaining hits. An oversized first passage remains visibly clipped
  to the response budget, and Unicode boundaries remain valid.
- The requested result count is applied after character-budget packing. A
  caller-level regression reproduced the remaining early-stop bug with
  6,000-, 7,000- and 500-character candidates and limit two: the previous
  caller returned only the first hit; the repaired caller retains the first
  and third. `omitted` includes both budget exclusions and count exclusions.

Retrieval lives in `convex/passageSearch.ts`; index creation, updates and
deletion remain in `convex/passages.ts`. No re-indexing, embedding-space
migration, schema change, publication operation or generator integration is
required by the repair.

## Local verification

`vp test convex/passageSearch.test.ts convex/passages.test.ts convex/shared/passages.test.ts`
passes 35 tests. Coverage includes mixed article/transcript retrieval, phrase-specific
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
url:     passages=5 chars=11287 article=true
```

The expected transcript contains the precise-temperament phrase. This improves
on the original live YouTube response, whose sole passage contained only broad
tuning discussion. Live acceptance remains to be rerun after deployment.

Full `APP_ENV=test vp run verify` passes all ten tasks, including four
typechecks and 2,431 tests: 1,626 root, 234 harness, 430 agent and 141 media.
Six real SuperCollider tests remain skipped on this host. Existing lint and
Panda warnings remain. The offline, network-denied provenance builder produced
268 root module identities for the candidate.

## Configuration cleanup

`agent/.env.schema` now distinguishes the backend API at
`https://convex.resonantprojects.art` from the HTTP-actions site at
`https://convex-http.resonantprojects.art`. `agent/.env.example` uses the
same HTTP-actions URL.

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
follow [the supported deployment procedure](../frequency-supported-deployment-rollback.md)
against `https://convex.resonantprojects.art`. This session has no inherited
Convex admin key, and its 1Password identity cannot read Country Manor Lab.
Keith selected devbox or MacBookMax as the existing operator environment.
Devbox's public SSH key was verified against the current infrastructure
repository's `hosts/ceph-cluster/DEVBOX-NEXT-MIGRATION.md`, blob
`b6d74bfae3e4327bc44b04876ec48ba259a33ec2`. Strict host checking now passes,
but devbox refuses login with `Permission denied (publickey)`, including
with the desktop's existing 1Password SSH agent. No key was exported or
login configuration changed. The Mac's LAN and Tailscale SSH attempts timed
out. Operator authentication remains unavailable. No production deployment
or paid probe has been run during this repair.

After deployment, rerun the original three probes: all types, YouTube only,
and URL only, each with limit eight and the original phrase. Each action still
computes only one query embedding. At the existing $0.13/million-token price,
the conservative ceiling is 33 query characters × 3 tokens/character × 3
embedding attempts × 3 probes = 891 tokens, or $0.00011583. A fresh $0.01
approval was granted in this thread on October 24 and covers exactly those
three probes after the reviewed deployment; the earlier approval was for the
October 22 run only. No backfill or re-indexing is part of that check.

## Read-only runtime recheck

The existing Radar route was read again around 20:14-20:16 UTC. The worker
still has one ready and available replica. Pod
`frequency-worker-6dcb68fbb8-4dtcw` is Running 2/2 with zero restarts in both
containers since October 20. It still runs image `sha256:41885e83...` with
source annotation `e1a2fb0a...` and the old `http://convex.rproj.art:3211`
URL. The live Cilium policy still allows `172.16.10.24:3211` and lacks the
canonical HTTP-actions hostname. Argo is Synced/Healthy at infrastructure
revision `2ea1c42084151a2a2f6de61e60f793be0a6f2028`; PR #808 remains unmerged
and requires an approving review despite passing validation and Ansible CI.

The completed `frequency-process-check-29881215-sbckx` monitor reports
`process_readiness`, `status: up`, `queue_completion_proven: false`.
This confirms current process readiness, not end-to-end job completion or
acceptance of the replacement image. No cluster resource was changed.

The historical log-gap waiver and final keep-indexing decision are distinct
from repairing and verifying retrieval. The existing instruction to leave
indexing enabled during investigation was preserved.
