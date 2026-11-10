# Frequency Music feature map

Audit baseline: **2026-10-22**, `a9b728466f9254938e40761e012451b4d896825b`. **V26** is the [2026-10-26 local verification][v26] at `ca495094` in [PR #229][p229]. **V10** is the [2026-11-10 checkpoint][v10] at `c323b26c` after [#254][p254]/[#255][p255]. Evidence is local; production behavior is unverified.

The intended loop is **source → extraction/claims → correspondence/hypothesis → recipe → composition/render → listening → accumulated learning/editorial**. Intent is grounded in current schema, public APIs, route/component calls, worker/job registries, explicit stop paths and repository plans. Aspirational prose is recorded separately from shipped contracts.

## Read this map

- **done**: evidence covers the feature as scoped, including its mapped UI journey. The complete feature boundary still matters after a local save passes.
- **partial**: some implementation/proof exists, but an intended UI seam, persistence, integration, or acceptance remains unproved or gated.
- **missing**: the named intended stage is absent, even if neighboring backend APIs exist.
- **V** = local aggregate checks/backend/worker tests; **U1–U3** = isolated fixture browsers; **B1–B4** = guarded real frontend journeys/refusal; **F1** = reproduced feedback-fixture blocker. See [commands and output](evidence/feature-map-20261022/README.md). N1 = navigation follow-up; A1 = graph-filter fixture; L1–L4 = real local persistence journeys. [Follow-up commands/output](evidence/feature-map-gap-fixes-20261022/README.md). Test passes do not prove provider quality or deployed behavior.

Stage matrices own intent, contracts, UI entry points, acceptance and source anchors; the gap ledger retains decision scope.

**Audit PR:** [audit PR][audit] · **Reproduce:** [verify-frequency skill](../.agents/skills/verify-frequency/SKILL.md) · **Build/run and blockers:** [evidence](evidence/feature-map-20261022/README.md) · **Classified gaps:** [gap ledger](feature-map/gaps.md) · **Exhaustive route/API/table/job index:** [surfaces](feature-map/surfaces.md)

## Feature status index

| Stage / feature and intended outcome | Backend / UI summary | Status | Evidence / remaining step | Linked PR / issue |
| --- | --- | --- | --- | --- |
| [A01 — Authentication and authorization](feature-map/access.md#a01) | Clerk/AuthGate; role-gated writes; tier-1 readerQuery; public-query allowlist | **partial** | V10: 4 auth fixtures, role/read tests, local seeded-admin saves; hosted JWT unproved. | [#255][p255] · [#198][i198] |
| [A02 — Grouped navigation and route reachability](feature-map/access.md#a02) | 28 registered routes / Home + Research/Compose/Library/Operations | **partial** | V10: 9 guarded navigation actions; destination workflows partial. | [fix #200][p200] |
| [A03 — Site search: pages, essays, concepts, research](feature-map/access.md#a03) | Local page/essay search / Search button, Ctrl+K, Meta+K on app shell. | **partial** | V10: 9 guarded local search actions; backend research unproved. | [audit][audit] |
| [A04 — Essay archive and reading](feature-map/access.md#a04) | 413 committed Markdown essays / Library → Essays | **done** | V10: 25 isolated actions, archive/body PNG inspection, clean teardown. | [audit][audit] |
| [R01 — URL intake and deduplication](feature-map/research.md#r01) | URL intake, publisher DOI identity and safe URL-only resubmit / /ingest | **partial — local save verified** | V10: local admission/dedupe and backend DOI/resubmit tests; capture/migration unproved. | [#254][p254] · [#255][p255] |
| [R02 — YouTube intake and transcript capture](feature-map/research.md#r02) | YouTube source creation / /ingest YouTube form | **partial** | V: transcriptCapture/sourceRecovery; [G05](feature-map/gaps.md) | [audit][audit] |
| [R03 — PDF URL/upload capture](feature-map/research.md#r03) | PDF URL/upload capture; publisher URLs share DOI identity / /ingest | **partial** | V: pdfCapture/pdfCaptureNode and shared PDF contracts; [G05; G12](feature-map/gaps.md) | [#254][p254] · [docs #202][p202] |
| [R04 — RSS/Atom feed management and proposals](feature-map/research.md#r04) | Feed create/toggle/poll, external RSS ingress / /ingest feed form/list/poll | **partial — local save verified** | V10: both local workflows persist feed create/disable/reload; polling unproved. | [local proof][plocal] |
| [R05 — Notion inbound notes](feature-map/research.md#r05) | Secret-guarded POST /ingest/notion → sources.upsertExternal. / External input by documented contract | **partial** | Source/HTTP implementation inspected; [G06](feature-map/gaps.md) | [#191][i191] |
| [R06 — Source Scout discovery and capture](feature-map/research.md#r06) | Scout preflight/intake share publisher DOI identity / worker/operator | **partial** | V10: mocked agent/backend suites; no provider/corpus migration proof. | [#254][p254] · [#191][i191] |
| [R07 — Missing-text recovery and archive](feature-map/research.md#r07) | provideRecoveryText/requestSourceRecovery/archiveRecoverySource with version fences. / /display missing-text row → recovery details/form/access changed/archive. | **partial — local save verified** | V10: both local workflows persist text/provenance; archive/stale UI unproved. | [local proof][plocal] |
| [R08 — Extraction, attempt history and operator import](feature-map/research.md#r08) | Durable workflows / /display Run extraction | **partial** | V: extract/operatorExtraction/extractions, completion/settlement harness; [G05](feature-map/gaps.md) | [docs #202][p202] |
| [R09 — Inbox triage and visibility promotion](feature-map/research.md#r09) | readerQuery inbox/Source reads; writer-role triage / /display | **partial** | V10: read gate/cap tests; triage/promote UI unproved. | [#255][p255] |
| [R10 — First-class claims, parameters and correction](feature-map/research.md#r10) | Claims with citation/confidence/evidence status / Extraction review in /display | **partial** | V: claims harness, editCaptures and extraction completion/settlement; [G05](feature-map/gaps.md) | [audit][audit] |
| [R11 — 3D atlas, concept detail and relationships](feature-map/research.md#r11) | dashboard bounded projections, semantic sectors, graph concepts/edges. / Home / | **partial** | V: dashboard/graph/sourceProjection harness + domain mapping tests; [G05](feature-map/gaps.md) | [audit][audit] |
| [R12 — Vocabulary triage and classification](feature-map/research.md#r12) | Concept domains, parameter/relationship kinds / Research → Triage (/vocabulary-triage) | **partial** | V: vocabulary and conceptClassifier harness; [G05](feature-map/gaps.md) | [audit][audit] |
| [R13 — Cross-domain correspondences and evidence](feature-map/research.md#r13) | Correspondence/evidence lifecycle; hunter daily target rotation | **partial** | V10: backend/agent suites; browser lifecycle unproved. | [#255][p255] |
| [R14 — Embeddings and source-passage retrieval](feature-map/research.md#r14) | Separate claim/concept vectors and bounded passage index/search / Agent searchSourcePassages/operator probes | **partial** | V: passages/shared passages, embeddings harness; [G07](feature-map/gaps.md) | [#192][i192] |
| [S01 — Manual hypotheses and lifecycle](feature-map/synthesis.md#s01) | Hypothesis create/update/status, stakes, thesis/source linkage, resolution. / Research → Hypotheses → /hypotheses/$hypothesisId. | **partial — local save verified** | V26: manual hypothesis/source link persisted; full lifecycle UI unproved. | [local proof][plocal] |
| [S02 — Generated hypotheses and bounded drafting](feature-map/synthesis.md#s02) | Hypothesis workflow retry:false (recipe step may retry), payload projection, multi-extraction dedupe; 28-day rejected-draft rest | **partial** | V10: backend/agent tests + retry flags inspected; paid generation unproved. | [#255][p255] · [#192][i192] |
| [S03 — Agent draft review, amendment and promotion](feature-map/synthesis.md#s03) | Approve/reject/supersede, original/amended payload, provenance, terminal run reconciliation. / Operations → Review Queue (/agent-drafts?draft=ID) | **partial** | V26: 4 draft-route fixtures; complete persisted promotion UI unproved. | [audit][audit] |
| [S04 — Manual and generated recipe creation](feature-map/synthesis.md#s04) | recipes.create/generateFromHypothesis / Compose → Recipes (/recipes) | **partial — local save verified** | V26: manual recipe/parameters persisted; generation/closure unproved. | [local proof][plocal] · [#189][i189] |
| [S05 — Recipe loop closure and promoted recipe editing](feature-map/synthesis.md#s05) | Update/status APIs exist / Recipe detail currently query-only | **missing** | Static absence in hypotheses/agentDrafts/recipe-detail; [G02](feature-map/gaps.md) | [#189][i189] |
| [S06 — Theses and accumulated research](feature-map/synthesis.md#s06) | Thesis create/update/detail / Research → Theses (/theses) → /theses/$thesisId | **partial** | Source inspected; V: related phase4/campaign cases; [G05](feature-map/gaps.md) | [audit][audit] |
| [S07 — Campaigns and recommended next actions](feature-map/synthesis.md#s07) | Campaign create/update/active selection, thesis links, recommendations. / Library → Weekly Turns (/weekly-turns), campaign cards | **partial** | V: campaigns tests; [G05](feature-map/gaps.md) | [audit][audit] |
| [S08 — Weekly Turns, brief editing and publication](feature-map/synthesis.md#s08) | Generate written synthesis/loop report, edit capture, publish and Notion export. / /weekly-turns → /weekly-turns/$briefId | **partial** | V: weeklyBriefs tests/harness; [G05; G10](feature-map/gaps.md) | [#195][i195] |
| [S09 — Editorial drafting, approval and static export](feature-map/synthesis.md#s09) | Artifacts from brief/campaign/thesis / Library → Editorial → /editorial/$artifactId | **partial** | V: phase4/editorialExports + script tests; [G05](feature-map/gaps.md) | [audit][audit] |
| [S10 — Negative-results failure archive](feature-map/synthesis.md#s10) | Read model from contradicted/retired hypotheses and low-yield listening/compositions. / Library → Failures (/failures) | **partial** | V: failures tests and phase4 lineage; [G05](feature-map/gaps.md) | [audit][audit] |
| [S11 — Hypothesis tournament](feature-map/synthesis.md#s11) | Durable candidates/runs, model adapters, duplicate checks and draft promotion / Operator/internal request | **partial** | V: tournament core/worker tests and hypothesisTournament harness; [G09](feature-map/gaps.md) | [#194][i194] |
| [M01 — Composition lifecycle and revisions](feature-map/music.md#m01) | Composition create/update/delete, artifact type/version/status, revision variable/note. / Compose → Compositions → /compositions/$compositionId. | **partial — local save verified** | V26: create/rendered status persisted; revision/delete UI unproved. | [local proof][plocal] |
| [M02 — Lineage and provenance inspection](feature-map/music.md#m02) | getLineage joins source/extraction/hypothesis/recipe/thesis/revisions/listening. / Composition detail → Lineage/Provenance/Linked Sources/Extractions/Listening History. | **partial — local save verified** | V26: lineage readback; historical/full-graph cases unproved. | [local proof][plocal] |
| [M03 — Subjective and embodied listening sessions](feature-map/music.md#m03) | Writer-role session saves; owner visibility control enabled; blank/double-submit fixes | **partial — local save verified** | V10: ratings/owner/reload persist; fixes source-inspected, 12 unit checks; visibility save unproved. | [#255][p255] |
| [M04 — Composition starter kits](feature-map/music.md#m04) | CLI/pure generation: Scala .scl/.kbm, seed MIDI, card / scripts/generate-starter-kit.ts <recipeId> | **partial** | V: generate-starter-kit, seedMidi and tuning tests write local kits/cards. No live CLI run.; [G08](feature-map/gaps.md) | [#193][i193] |
| [M05 — Typed litmus render ladder](feature-map/music.md#m05) | renders.setPlan/request, leased litmusRender, normalized delivery, validation/composition effects. / Backend request only | **partial** | V10: 153 media tests, including 6 real-SC renders, zero skips; human gates remain. | [#194][i194] · [#196][i196] · [229][p229] |
| [M06 — Recipe/composition target audio](feature-map/music.md#m06) | Target playback; query equality preserves audio across unrelated queue updates | **partial** | V10: 3 playback fixtures + query unit checks; audible playback unproved. | [#255][p255] |
| [M07 — Audio ratings and Docket deferral](feature-map/music.md#m07) | audioFeedback queues, kind-specific scores, stable request IDs/content hashes, deferWeb. / /listen Rate audio | **partial** | V10: 13 feedback/Docket fixtures pass; #188 merged; audio persistence unproved. | [fix #188][p188] |
| [M08 — Human studio versus machine blind comparison](feature-map/music.md#m08) | Studio upload validation/digests, paired hidden group, complete ratings/reveal. / /listen Studio comparisons → upload metadata/audio → rate both members. | **partial** | V: studioComparisons tests pass; [G03; G09](feature-map/gaps.md) | [#194][i194] |
| [M09 — Blind voice shootouts and house voice](feature-map/music.md#m09) | Five media job handlers / /listen Voice shootouts → take rating/reveal → choose house voice. | **partial** | V26: provider/shootout suites with injected services; no live voice call. | [#195][i195] · [229][p229] |
| [M10 — Essay/brief episodes and private podcast subscription](feature-map/music.md#m10) | Narrate/assemble jobs, chapters/artifacts/feed token / /listen Episodes/feed copy/play | **partial** | V26: narration/episode/podcast suites; no real TTS or feed access. | [#195][i195] · [229][p229] |
| [M11 — Render analysis and later comparison stages](feature-map/music.md#m11) | Spec describes analyze job/roughness / No analysis UI | **missing** | Static job/handler/spec comparison only; [G11](feature-map/gaps.md) | [#196][i196] |
| [O01 — Agent run history, events and queue health](feature-map/operations.md#o01) | Nine graph registrations / Operations → Agent Runs → /agent-runs/$runId → related drafts/failures/trace. | **partial** | V26: 10 graph-filter fixtures and worker suites; no live history proof. | [fix #201][p201] · [229][p229] |
| [O02 — Automatic failure investigation and recovery](feature-map/operations.md#o02) | Grouped failures, retained outputs, reconciliation/recovery workflows, failure-investigation graph. / /agent-runs/$runId failures | **partial** | V26: recovery/lease suites; integrated operational UI unproved. | [PR #229][p229] |
| [O03 — Scheduled intake/synthesis/maintenance](feature-map/operations.md#o03) | 21 crons; daily evidence-hunter windows and 28-day drafter rest | **partial** | V10: backend/agent suites; no scheduler/service run. | [#255][p255] · [#191][i191] |
| [O04 — Docket, signed decisions, MCP and channel delivery](feature-map/operations.md#o04) | Cards, immutable payload/digest/revision, propose/confirm/cancel/apply receipts / Compose → Docket | **partial** | V26: 9 intent and 13 feedback fixtures; live signers remain gated. | [#194][i194] |
| [O05 — Admin, service auth and bounded tool surface](feature-map/operations.md#o05) | Admin/tool contracts; role writes, readerQuery and public-query ratchet | **partial** | V10: role/read/creator/manifest tests; hosted grants/admin overrides unproved. | [#255][p255] · [#191][i191] |
| [O06 — Edit captures, golden evals and generator policy](feature-map/operations.md#o06) | Generated/edited pairs / Editing extraction/hypothesis/brief/draft creates capture | **partial** | V: editCaptures/langsmith/llm/llmNode tests; [G02; G07](feature-map/gaps.md) | [#192][i192] |
| [O07 — Research-pipeline specialist stop paths and deployment tooling](feature-map/operations.md#o07) | Specialist stop paths; Node 26 CI, inert builds, size ratchet and scoped deploy typecheck | **partial** | V10: verify 10/10; workflow/size tests; no deployment/hosted publish run. | [#255][p255] · [#245][p245] · [#233][p233] · [#191][i191] · [#197][i197] |

## Coverage and limits

The index covers 47 feature/stage rows, all 28 registered web routes, all 41 schema tables, 46 public Convex modules / 249 declarations (including `readerQuery`), all nine worker graphs, all five media job handlers and all 21 registered crons. The [surface index](feature-map/surfaces.md) records the exact mechanical inventory and its limits: an API declaration or URL does not prove a usable UI.

A throwaway local Docker Convex now supplies real persistence for L1–L4, with independent table reads, synthetic identity and owned teardown. [G05's environment issue][i190] is closed by [the local workflow PR][plocal]. The default hosted-auth E2E suite remains unrun. Hosted Clerk/JWTs, generators, automatic capture/extraction, media, signers and unexercised controls remain unproved. Local saves do not complete those broader feature rows.

V10 rechecks local commands, both persisted lifecycle variants, auth fixtures and native rendering. It records an initial concurrent offline failure and successful isolated rerun. [Commands/output][v10commands] distinguish executed proof from source findings; raw logs/traces remain local.

## Scope decisions preserved

Recipe loop closure is already planned but gated by eval acceptance; render validation, signers, docket preparation, tournament enablement and passage/generator follow-ons retain their documented gates. CLI-first starter kits, external ingestion and operational tools are not assumed to require new product UI. Proposed UI exposure is classified **needs-decision** when the repository does not settle it. Social aspirations are recorded in [#198][i198]; deferred WebMCP in [#199][i199]. No option is selected.

[audit]: https://github.com/Resonant-Projects/frequency-music/pull/185

[p188]: https://github.com/Resonant-Projects/frequency-music/pull/188
[p200]: https://github.com/Resonant-Projects/frequency-music/pull/200
[p201]: https://github.com/Resonant-Projects/frequency-music/pull/201
[p202]: https://github.com/Resonant-Projects/frequency-music/pull/202
[plocal]: https://github.com/Resonant-Projects/frequency-music/pull/203
[i189]: https://github.com/Resonant-Projects/frequency-music/issues/189
[i190]: https://github.com/Resonant-Projects/frequency-music/issues/190
[i191]: https://github.com/Resonant-Projects/frequency-music/issues/191
[i192]: https://github.com/Resonant-Projects/frequency-music/issues/192
[i193]: https://github.com/Resonant-Projects/frequency-music/issues/193
[i194]: https://github.com/Resonant-Projects/frequency-music/issues/194
[i195]: https://github.com/Resonant-Projects/frequency-music/issues/195
[i196]: https://github.com/Resonant-Projects/frequency-music/issues/196
[i197]: https://github.com/Resonant-Projects/frequency-music/issues/197
[i198]: https://github.com/Resonant-Projects/frequency-music/issues/198
[i199]: https://github.com/Resonant-Projects/frequency-music/issues/199

[v26]: evidence/effect-verification-20261026/README.md
[p229]: https://github.com/Resonant-Projects/frequency-music/pull/229

[v10]: feature-map/verification-20261110.md
[v10commands]: feature-map/verification-20261110-commands.md
[p254]: https://github.com/Resonant-Projects/frequency-music/pull/254
[p255]: https://github.com/Resonant-Projects/frequency-music/pull/255
[p245]: https://github.com/Resonant-Projects/frequency-music/pull/245
[p233]: https://github.com/Resonant-Projects/frequency-music/pull/233
