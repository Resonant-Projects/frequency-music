# Effect adoption local feature verification

Verified on 2026-10-26 at source HEAD
`ca49509447bd5cdace92e6f15a8de797c8c8e0ef`, after
[PR #229](https://github.com/Resonant-Projects/frequency-music/pull/229)
reached its ready, unmerged checkpoint. The application source stayed unchanged
through this audit. This packet adds documentation and feature-map evidence.

## Result and boundary

The requested local checks passed: the production web build, all 2,456 repository
tests, 43 isolated component/route browser tests, 43 guarded frontend actions,
and four persisted local UI journeys. Both owned app lifecycles cleaned up
successfully. None of the selected suites skipped tests. The six real
SuperCollider tests ran because `sclang`, `scsynth`, `ffmpeg`, and `ffprobe` were
available. They prove bounded synthetic rendering, not human musical acceptance.

The audit used the existing `verify-frequency` workflow. It did not read checkout
credentials, contact production, run hosted-auth E2E, enable gates, invoke paid
TTS/inference, select a house voice, publish, or repair product gaps. Provider
and worker tests inject tools and responses. Auth fixtures substitute Clerk's
network implementation. The offline frontend blocks external requests and
backend WebSockets. The persistence run used a new local Convex deployment with
blocked backend egress and a synthetic identity.

> 🧠 **From Hindsight memory (Isolated local Convex verification journeys)** —
> The existing local persistence workflow and repaired feedback fixture informed
> the verification paths. Current source, execution, independent table reads,
> and cleanup receipts establish the results below.

Commands and exit codes are in [commands.md](commands.md). Compact observed
output is in [output.md](output.md), machine-readable assertions are in
[results.json](results.json), and raw local artifact paths, sizes, and SHA-256
values are in [artifacts.json](artifacts.json). Screenshots and traces remain
local and ignored; they are not GitHub-hosted evidence. The textual assertions
and excerpts in this packet are committed evidence.

## Commands and outcomes

| Proof | Exit | Observed result |
| --- | --- | --- |
| Inert production web build | 0 | 3/3 build tasks; Panda CSS hash unchanged |
| `APP_ENV=test vp run verify` | 0 | 10/10 tasks; root/scripts 1,626, harness 234, agent 443, media 153 |
| Review/Agent Runs fixtures | 0 | 23 tests over real controls and synthetic adapters |
| Target audio fixtures | 0 | 3 tests; authorized URL wiring, stale removal, revoked playback |
| Auth fixtures | 0 | 4 tests; token wiring, signed-out redirect, sign-out, SDK error |
| Feedback/Docket fixtures | 0 | 13 tests; zero/omitted scores, validation, stale/retry/lost response, duplicate submission, deferral |
| Guarded Doctor and essays | 0 | Doctor passes; 25 essay actions; archive and article screenshots inspected |
| Guarded navigation and search | 0 | 9 actions each; Docket targets and desktop/mobile Essays transitions asserted |
| Guarded frontend cleanup | 0 | Process group stopped, port released, scratch removed, evidence retained |
| Disposable local Convex workflow | 0 | Four browser persistence journeys; independent row/ownership/lineage reads |
| Disposable local Convex cleanup | 0 | Container, volume, network and local credentials removed |

Generated `web/styled-system/styles.css` remains 73,548 bytes with SHA-256
`62e6a1f919f80034b866bb75bf937a0a405f170584ade3046e27700e5e914a33`.
Existing Park selector, large-chunk, lint, Effect warning/suggestion, AI SDK
deprecation and fake-clock timeout warnings remain visible. No audit failure
was waived, no configuration was weakened, and no application file changed.

## Feature evidence and reachability

Feature IDs refer to the [feature map](../../feature-map.md). A passing component
fixture does not prove persistence, hosted authentication, real provider quality,
or a complete feature. The dated stage matrices retain the remaining edges.

| IDs | Evidence and source path | Status after this audit |
| --- | --- | --- |
| A01 | [AuthGate and provider fixture](../../../web/tests/auth/auth.spec.ts), real adapter with fake Clerk; Convex authorization tests in the aggregate suite | **partial**; hosted Clerk/JWT and complete hosted authorization remain unproved |
| A02, A03 | Guarded desktop/mobile menus and local page/essay search, including Docket targets; [driver](../../../.cursor/skills/verify-frequency-music/scripts/drive.mjs) | **partial**; destination workflows and backend research results remain separate |
| A04 | Real committed corpus, archive/detail/reload/pagination/related/missing-slug controls, 25 guarded actions, inspected screenshots | **done** within the offline essay-reading boundary |
| R01, R04, R07 | [Persisted journeys](../../../web/tests/local/journeys.spec.ts), real Ingest/Display controls and independent reads for URL dedupe, text recovery, and feed disable/reload | **partial — local save verified**; capture/extraction, polling, archive/access/stale recovery edges unproved |
| S01, S04, M01, M02, M03 | Same persisted journeys: manual hypothesis/recipe/composition/session and lineage readback after reload | **partial — local save verified**; generated work, revisions/deletion, visibility and full historical lineage remain unproved |
| S03, O04 | [Review fixtures](../../../web/tests/ui/intent-binding.spec.ts), terminal draft links, stable confirmation retries, expiry/unauthorized/loading states, feedback/Docket deferral | **partial**; no live signers, publication, or persisted approval journey |
| M05 | [Renders contract](../../../convex/renders.ts), [media job handler](../../../media/src/jobs/litmusRender.ts), six [real local SC tests](../../../media/tests/sc-real.test.ts), job/lease/upload tests | **partial**; local renderer exercised; study-family admission gates, intended UI and human validation unchanged |
| M06, M07 | [Target-audio](../../../web/tests/listen/listen.spec.ts) and [feedback](../../../web/tests/feedback/feedback.spec.ts) fixtures over real routes/components | **partial**; no audible playback or persisted audio-rating claim |
| M09, M10 | [TTS lifetime](../../../media/tests/tts-request.test.ts), provider/shootout/narration/episode/podcast suites, [request module](../../../media/src/tts/request.ts), [Listen route](../../../web/src/routes/listen.tsx) | **partial**; unknown paid outcome never authorizes a retry in injected tests; no provider, subscription or first-house-voice call |
| O01, O02, O05 | Agent Runs graph-filter fixtures, [worker](../../../agent/src/worker/runner.ts), [HTTP transport](../../../agent/src/tools/convexHttp.ts), retained recovery/auth/manifest/backend suites | **partial**; local execution and adapters exercised, live operational history/admin workflows unproved |
| S05, M11 and all unselected UI edges | Existing matrix/source findings only | Their prior **missing**, **partial**, or intentionally gated status is unchanged |

## Feedback fixture source provenance

The skill's October 22 baseline still describes PR #188 as unmerged and its
missing-`createAction` failure as current. GitHub readback during this audit
confirmed [PR #188](https://github.com/Resonant-Projects/frequency-music/pull/188)
merged at `2026-10-22T23:00:11Z`, merge commit
`ac1c205f5f587e2a00474111cc94d2af6ccc7258`. The ancestry check below exited 0.
The audited `ca495094` source already exports `createAction` at line 183 of
`web/tests/feedback/convex-fixture.ts`; blame traces that export to `42d66797c`.
No repair or source substitution was applied during this audit. The historical
F1/G03 failure remains recorded in the original evidence; V26 reports the
re-execution of the landed fixture, including all 13 passing assertions.

```sh
gh pr view 188 --repo Resonant-Projects/frequency-music --json state,mergedAt,mergeCommit
git merge-base --is-ancestor ac1c205f5f587e2a00474111cc94d2af6ccc7258 ca495094
git show ca495094:web/tests/feedback/convex-fixture.ts
git blame -L 177,191 ca495094 -- web/tests/feedback/convex-fixture.ts
```

## Independent persistence observations

The final independent snapshot contains two Sources, one Hypothesis, one Recipe,
one Composition, one Listening Session and one Feed. The URL submission was
deduplicated to one Source. Supplied recovery text retained its provenance prefix
and reached `text_ready`. The manual chain shares its synthetic creator and
preserves Source → Hypothesis → Recipe → Composition → Listening Session links.
The Composition is `rendered`, the session is private with musicality 3, and the
Feed is disabled. The browser separately reloaded session/feed pages and inspected
lineage. No real audio was judged in the synthetic Listening Session.

The backend image is pinned to
`ghcr.io/convex/convex-backend@sha256:294944b33dc55e8f68b2feda11c5e7b195f7778b9ad2951f1bea2744ad392e5a`.
Its version endpoint reports `unknown`; the digest identifies the instance.
Backend, site and frontend used `127.0.0.1` ports 58761, 39251 and 44717.
The disposable copy suppressed crons and added only the existing synthetic
seed/snapshot module. The actual functions, schema, indexes and components
deployed to that instance. The source fingerprint was
`eb59b23e5882874482d0a84b7fea47303104b360f11a476acfdd979aa0fe8646`.
All four tests asserted no forbidden browser requests or page errors.

The guarded offline frontend used port 49685 with source fingerprint
`fbc77f53501d7e27062bfdd9aa6acb98bb6e7d876d814f730fc9d0b65750b5a5`.
Its three journeys reported zero page errors and external requests. Port-9
backend WebSockets were blocked and recorded, not forwarded. Pending research
search is not counted as a successful empty state.

## Gaps and decisions retained

| Classification | Finding and bounded next step |
| --- | --- |
| **small-fix — proof gap resolved** | G01's Docket assertion, G03's fixture import, and G04's nine graph choices are present and passed. The old G11 missing-renderer-tools boundary is also resolved for these six synthetic local tests. This audit changes evidence, not product code. |
| **small-fix — follow-up** | During the preceding root-CI reproduction, an existing recovery assertion once compared 60,001 ms against 60,000 ms using different clocks. A fresh confirmation and subsequent complete checks passed. A future test-only correction should compare times from the same transaction clock; no such edit was made during this audit. |
| **needs-decision** | Starting handler grace immediately on lease abort changes existing execution/cleanup policy. CodeRabbit withdrew that request after the base-code comparison. Current job-deadline/grace and lease behavior remains the compatibility contract. |
| **needs-decision** | G02/G06–G10 retain their eval, product-entry, signer, narration, provider and human-acceptance boundaries. Hosted auth, automatic capture/extraction, generators and additional persisted controls need explicit coverage and suitable isolated inputs. |
| **needs-decision / missing** | M11's later render-analysis/ABX work and S05's recipe-loop closure remain absent or gated as recorded in the matrices. Local saves and pitch/loudness tests do not establish those stages. |

No new UI exposure, gate choice, paid acceptance, production configuration or
behavior change follows from this report.
