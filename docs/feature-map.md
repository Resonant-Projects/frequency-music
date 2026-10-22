# Frequency Music feature map

Audit date: **2026-10-22**. Source baseline: `a9b728466f9254938e40761e012451b4d896825b` on `docs/feature-map`. The original audit added documentation and a verification skill. Follow-up proof below is scoped to separate, unmerged fix PRs and a throwaway localhost backend; it makes no production claim.

The intended loop is **source → extraction/claims → correspondence/hypothesis → recipe → composition/render → listening → accumulated learning/editorial**. Intent is grounded in current schema, public APIs, route/component calls, worker/job registries, explicit stop paths and repository plans. Aspirational prose is recorded separately from shipped contracts.

> 🧠 **From Hindsight memory (Component map; Key decisions and rationale)** — The four package boundaries and existing local browser fixtures informed where to look. Current code and the dated command receipts determine every status below; historical verification/deployment claims are not reused as current proof.

## Read this map

- **done**: evidence covers the feature as scoped, including its mapped UI journey. The complete feature boundary still matters after a local save passes.
- **partial**: some implementation/proof exists, but an intended UI seam, persistence, integration, or acceptance remains unproved or gated.
- **missing**: the named intended stage is absent, even if neighboring backend APIs exist.
- **V** = local aggregate checks/backend/worker tests; **U1–U3** = isolated fixture browsers; **B1–B4** = guarded real frontend journeys/refusal; **F1** = reproduced feedback-fixture blocker. See [commands and output](evidence/feature-map-20261022/README.md). N1 = navigation follow-up; A1 = graph-filter fixture; L1–L4 = real local persistence journeys. [Follow-up commands/output](evidence/feature-map-gap-fixes-20261022/README.md). Test passes do not prove provider quality or deployed behavior.

Each stage matrix has intent, backend status, UI exposure and entry point, happy path, edge cases, verification, status and next step. Its source table supplies linked implementation PRs/issues. The final column links current fix PRs and decision issues; the gap ledger retains their scope.

**Audit PR:** [audit PR][audit] · **Reproduce:** [verify-frequency skill](../.agents/skills/verify-frequency/SKILL.md) · **Build/run and blockers:** [evidence](evidence/feature-map-20261022/README.md) · **Classified gaps:** [gap ledger](feature-map/gaps.md) · **Exhaustive route/API/table/job index:** [surfaces](feature-map/surfaces.md)

## Feature status index

| Stage / feature and intended outcome | Backend / UI summary | Status | Evidence / remaining step | Linked PR / issue |
| --- | --- | --- | --- | --- |
| [A01 — Authentication and authorization](feature-map/access.md#a01) | Clerk provider, JWT adapter, `auth.ts` / All routes under AuthGate | **partial** | U3 (4 fixture tests), V; [G05](feature-map/gaps.md) | [audit][audit] |
| [A02 — Grouped navigation and route reachability](feature-map/access.md#a02) | 28 registered routes / Home + Research/Compose/Library/Operations | **partial** | N1: 9 guarded actions + 2 affected navigation tests; destination workflows partial. | [fix #200][p200] |
| [A03 — Site search: pages, essays, concepts, research](feature-map/access.md#a03) | Local page/essay search / Search button, Ctrl+K, Meta+K on app shell. | **partial** | B1/B3 prove local subset only (25/9 actions); [G05](feature-map/gaps.md) | [audit][audit] |
| [A04 — Essay archive and reading](feature-map/access.md#a04) | 413 committed Markdown essays / Library → Essays | **done** | B1: 25 actions, zero page errors/external requests | [audit][audit] |
| [R01 — URL intake and deduplication](feature-map/research.md#r01) | `sources.createFromUrlAndQueue`, ingest fetch, canonical dedupe / Research → Ingest → URL form (/ingest). | **partial — local save verified** | L1: URL-only admission/dedupe persisted; fetching/extraction unproved. | [local proof][plocal] |
| [R02 — YouTube intake and transcript capture](feature-map/research.md#r02) | YouTube source creation / /ingest YouTube form | **partial** | V: transcriptCapture/sourceRecovery; [G05](feature-map/gaps.md) | [audit][audit] |
| [R03 — PDF URL/upload capture](feature-map/research.md#r03) | Upload admission, storage ownership, dedupe and Firecrawl parse / /ingest PDF file/URL | **partial** | V: pdfCapture/pdfCaptureNode and shared PDF contracts; [G05; G12](feature-map/gaps.md) | [docs #202][p202] |
| [R04 — RSS/Atom feed management and proposals](feature-map/research.md#r04) | Feed create/toggle/poll, external RSS ingress / /ingest feed form/list/poll | **partial — local save verified** | L4: feed create/disable persisted; polling/proposals unproved. | [local proof][plocal] |
| [R05 — Notion inbound notes](feature-map/research.md#r05) | Secret-guarded POST /ingest/notion → sources.upsertExternal. / External input by documented contract | **partial** | Source/HTTP implementation inspected; [G06](feature-map/gaps.md) | [#191][i191] |
| [R06 — Source Scout discovery and capture](feature-map/research.md#r06) | source-scout graph targets graph gaps / Scheduled/operator enqueue | **partial** | V: agent source-scout/crawl/openalex tests + scoutWrites/scoutTargets tests.; [G05; G06](feature-map/gaps.md) | [#191][i191] |
| [R07 — Missing-text recovery and archive](feature-map/research.md#r07) | provideRecoveryText/requestSourceRecovery/archiveRecoverySource with version fences. / /display missing-text row → recovery details/form/access changed/archive. | **partial — local save verified** | L2: source text/provenance saved; archive/access/stale UI unproved. | [local proof][plocal] |
| [R08 — Extraction, attempt history and operator import](feature-map/research.md#r08) | Durable workflows / /display Run extraction | **partial** | V: extract/operatorExtraction/extractions, completion/settlement harness; [G05](feature-map/gaps.md) | [docs #202][p202] |
| [R09 — Inbox triage and visibility promotion](feature-map/research.md#r09) | inbox list/counts / Research → Display (/display) → status tabs/row actions. | **partial** | V: dashboard/PDF inbox and extraction settlement cases; [G05](feature-map/gaps.md) | [audit][audit] |
| [R10 — First-class claims, parameters and correction](feature-map/research.md#r10) | Claims with citation/confidence/evidence status / Extraction review in /display | **partial** | V: claims harness, editCaptures and extraction completion/settlement; [G05](feature-map/gaps.md) | [audit][audit] |
| [R11 — 3D atlas, concept detail and relationships](feature-map/research.md#r11) | dashboard bounded projections, semantic sectors, graph concepts/edges. / Home / | **partial** | V: dashboard/graph/sourceProjection harness + domain mapping tests; [G05](feature-map/gaps.md) | [audit][audit] |
| [R12 — Vocabulary triage and classification](feature-map/research.md#r12) | Concept domains, parameter/relationship kinds / Research → Triage (/vocabulary-triage) | **partial** | V: vocabulary and conceptClassifier harness; [G05](feature-map/gaps.md) | [audit][audit] |
| [R13 — Cross-domain correspondences and evidence](feature-map/research.md#r13) | Canonical pair/rationale, claim evidence, lifecycle, candidate miner/evidence-hunter. / Research → Correspondences → /correspondences/$correspondenceId | **partial** | V: correspondences harness, agent miner/evidence tests; [G05](feature-map/gaps.md) | [audit][audit] |
| [R14 — Embeddings and source-passage retrieval](feature-map/research.md#r14) | Separate claim/concept vectors and bounded passage index/search / Agent searchSourcePassages/operator probes | **partial** | V: passages/shared passages, embeddings harness; [G07](feature-map/gaps.md) | [#192][i192] |
| [S01 — Manual hypotheses and lifecycle](feature-map/synthesis.md#s01) | Hypothesis create/update/status, stakes, thesis/source linkage, resolution. / Research → Hypotheses → /hypotheses/$hypothesisId. | **partial — local save verified** | L3: create + Source citation persisted; thesis/lifecycle controls unproved. | [local proof][plocal] |
| [S02 — Generated hypotheses and bounded drafting](feature-map/synthesis.md#s02) | Extraction generator/workflows and correspondence hypothesis-drafter / Scheduled/operator generation → /agent-drafts and /hypotheses. | **partial** | V: hypotheses and agentDrafts harness; [G05](feature-map/gaps.md) | [audit][audit] |
| [S03 — Agent draft review, amendment and promotion](feature-map/synthesis.md#s03) | Approve/reject/supersede, original/amended payload, provenance, terminal run reconciliation. / Operations → Review Queue (/agent-drafts?draft=ID) | **partial** | U1: 4 draft-route tests; [G05](feature-map/gaps.md) | [audit][audit] |
| [S04 — Manual and generated recipe creation](feature-map/synthesis.md#s04) | recipes.create/generateFromHypothesis / Compose → Recipes (/recipes) | **partial — local save verified** | L3: manual recipe/parameters persisted; generation unproved; [G02](feature-map/gaps.md). | [local proof][plocal] · [#189][i189] |
| [S05 — Recipe loop closure and promoted recipe editing](feature-map/synthesis.md#s05) | Update/status APIs exist / Recipe detail currently query-only | **missing** | Static absence in hypotheses/agentDrafts/recipe-detail; [G02](feature-map/gaps.md) | [#189][i189] |
| [S06 — Theses and accumulated research](feature-map/synthesis.md#s06) | Thesis create/update/detail / Research → Theses (/theses) → /theses/$thesisId | **partial** | Source inspected; V: related phase4/campaign cases; [G05](feature-map/gaps.md) | [audit][audit] |
| [S07 — Campaigns and recommended next actions](feature-map/synthesis.md#s07) | Campaign create/update/active selection, thesis links, recommendations. / Library → Weekly Turns (/weekly-turns), campaign cards | **partial** | V: campaigns tests; [G05](feature-map/gaps.md) | [audit][audit] |
| [S08 — Weekly Turns, brief editing and publication](feature-map/synthesis.md#s08) | Generate written synthesis/loop report, edit capture, publish and Notion export. / /weekly-turns → /weekly-turns/$briefId | **partial** | V: weeklyBriefs tests/harness; [G05; G10](feature-map/gaps.md) | [#195][i195] |
| [S09 — Editorial drafting, approval and static export](feature-map/synthesis.md#s09) | Artifacts from brief/campaign/thesis / Library → Editorial → /editorial/$artifactId | **partial** | V: phase4/editorialExports + script tests; [G05](feature-map/gaps.md) | [audit][audit] |
| [S10 — Negative-results failure archive](feature-map/synthesis.md#s10) | Read model from contradicted/retired hypotheses and low-yield listening/compositions. / Library → Failures (/failures) | **partial** | V: failures tests and phase4 lineage; [G05](feature-map/gaps.md) | [audit][audit] |
| [S11 — Hypothesis tournament](feature-map/synthesis.md#s11) | Durable candidates/runs, model adapters, duplicate checks and draft promotion / Operator/internal request | **partial** | V: tournament core/worker tests and hypothesisTournament harness; [G09](feature-map/gaps.md) | [#194][i194] |
| [M01 — Composition lifecycle and revisions](feature-map/music.md#m01) | Composition create/update/delete, artifact type/version/status, revision variable/note. / Compose → Compositions → /compositions/$compositionId. | **partial — local save verified** | L3: create/rendered status persisted; revision/delete UI unproved. | [local proof][plocal] |
| [M02 — Lineage and provenance inspection](feature-map/music.md#m02) | getLineage joins source/extraction/hypothesis/recipe/thesis/revisions/listening. / Composition detail → Lineage/Provenance/Linked Sources/Extractions/Listening History. | **partial — local save verified** | L3: basic lineage readback; missing/historical/full-graph cases unproved. | [local proof][plocal] |
| [M03 — Subjective and embodied listening sessions](feature-map/music.md#m03) | Listening create/recent/by-composition/updateVisibility / Compose → Feedback (/feedback) | **partial — local save verified** | L3: ratings/ownership/reload persisted; embodied/visibility controls unproved. | [local proof][plocal] |
| [M04 — Composition starter kits](feature-map/music.md#m04) | CLI/pure generation: Scala .scl/.kbm, seed MIDI, card / scripts/generate-starter-kit.ts <recipeId> | **partial** | V: generate-starter-kit, seedMidi and tuning tests write local kits/cards. No live CLI run.; [G08](feature-map/gaps.md) | [#193][i193] |
| [M05 — Typed litmus render ladder](feature-map/music.md#m05) | renders.setPlan/request, leased litmusRender, normalized delivery, validation/composition effects. / Backend request only | **partial** | V: renders/mediaJobs/media effects, litmusRender; [G09; G11](feature-map/gaps.md) | [#194][i194] · [#196][i196] |
| [M06 — Recipe/composition target audio](feature-map/music.md#m06) | Authorized ready-target lookup and playback / Recipe/composition detail → Listen section. | **partial** | U2: 3 component fixture tests pass. URL/player wiring proved; [G05](feature-map/gaps.md) | [audit][audit] |
| [M07 — Audio ratings and Docket deferral](feature-map/music.md#m07) | audioFeedback queues, kind-specific scores, stable request IDs/content hashes, deferWeb. / /listen Rate audio | **partial** | 13 real-route rating/deferral fixture tests; backend persistence/audio unproved. | [fix #188][p188] |
| [M08 — Human studio versus machine blind comparison](feature-map/music.md#m08) | Studio upload validation/digests, paired hidden group, complete ratings/reveal. / /listen Studio comparisons → upload metadata/audio → rate both members. | **partial** | V: studioComparisons tests pass; [G03; G09](feature-map/gaps.md) | [#194][i194] |
| [M09 — Blind voice shootouts and house voice](feature-map/music.md#m09) | Five media job handlers / /listen Voice shootouts → take rating/reveal → choose house voice. | **partial** | V: voiceRatings/blindGroups/settings/provider/shootout tests; [G05; G10](feature-map/gaps.md) | [#195][i195] |
| [M10 — Essay/brief episodes and private podcast subscription](feature-map/music.md#m10) | Narrate/assemble jobs, chapters/artifacts/feed token / /listen Episodes/feed copy/play | **partial** | V: narration/podcast/episodes/media tests; [G05; G10](feature-map/gaps.md) | [#195][i195] |
| [M11 — Render analysis and later comparison stages](feature-map/music.md#m11) | Spec describes analyze job/roughness / No analysis UI | **missing** | Static job/handler/spec comparison only; [G11](feature-map/gaps.md) | [#196][i196] |
| [O01 — Agent run history, events and queue health](feature-map/operations.md#o01) | Nine graph registrations / Operations → Agent Runs → /agent-runs/$runId → related drafts/failures/trace. | **partial** | A1: all nine graph choices + list/count arguments in 10 fixture tests; [G05](feature-map/gaps.md). | [fix #201][p201] |
| [O02 — Automatic failure investigation and recovery](feature-map/operations.md#o02) | Grouped failures, retained outputs, reconciliation/recovery workflows, failure-investigation graph. / /agent-runs/$runId failures | **partial** | V: operationRecovery/recoveryAdmission/settlement harness + agent investigation/outbox tests.; [G05](feature-map/gaps.md) | [audit][audit] |
| [O03 — Scheduled intake/synthesis/maintenance](feature-map/operations.md#o03) | 21 registered crons: feed/extraction/brief/docket/agents plus repair/sweeps. / Effects reach existing routes | **partial** | V: handler tests, workflows and harness; [G05; G06](feature-map/gaps.md) | [#191][i191] |
| [O04 — Docket, signed decisions, MCP and channel delivery](feature-map/operations.md#o04) | Cards, immutable payload/digest/revision, propose/confirm/cancel/apply receipts / Compose → Docket | **partial** | U1: 9 intent tests; [G03; G09](feature-map/gaps.md) | [#194][i194] |
| [O05 — Admin, service auth and bounded tool surface](feature-map/operations.md#o05) | Workspace counts/overrides / Operations → Admin | **partial** | V: auth/authFailures/agentTools/manifest/runtime boundary tests; [G05; G06](feature-map/gaps.md) | [#191][i191] |
| [O06 — Edit captures, golden evals and generator policy](feature-map/operations.md#o06) | Generated/edited pairs / Editing extraction/hypothesis/brief/draft creates capture | **partial** | V: editCaptures/langsmith/llm/llmNode tests; [G02; G07](feature-map/gaps.md) | [#192][i192] |
| [O07 — Research-pipeline specialist stop paths and deployment tooling](feature-map/operations.md#o07) | Research graph builds review drafts but extract/critique/archive nodes intentionally stop / Review output in /agent-drafts | **partial** | V: research-pipeline tests. Recovery/provenance commands inspected only; [G06; G13](feature-map/gaps.md) | [#191][i191] · [#197][i197] |

## Coverage and limits

The index covers 47 feature/stage rows, all 28 registered web routes, all 41 schema tables, all public Convex export modules, all nine worker graphs, all five media job handlers and all 21 registered crons. The [surface index](feature-map/surfaces.md) records the exact mechanical inventory and its limits: an API declaration or URL does not prove a usable UI.

A throwaway local Docker Convex now supplies real persistence for L1–L4, with independent table reads, synthetic identity and owned teardown. [G05's environment issue][i190] is closed by [the local workflow PR][plocal]. The default hosted-auth E2E suite remains unrun. Hosted Clerk/JWTs, generators, automatic capture/extraction, media, signers and unexercised controls remain unproved. Local saves do not complete those broader feature rows.

Fixes remain on their linked branches. The skill-path repair is committed directly to [PR #185][audit]; the local-backend skill extension is in its dependent PR. [Follow-up receipts](evidence/feature-map-gap-fixes-20261022/README.md) record commands, output, source/image fingerprints and artifact hashes. Full raw artifacts stay local and ignored. No production endpoint, admin key, configuration or data was used.

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
