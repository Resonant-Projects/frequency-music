# Surface coverage index

[Feature map](../feature-map.md) · [Evidence](../evidence/feature-map-20261022/README.md)

Snapshot `a9b728466f9254938e40761e012451b4d896825b`. Mechanically enumerated from current source, with human-assigned feature IDs. This is a coverage crosswalk, not runtime proof. Public query/mutation/action declarations are counted; pure helper exports, generated files and internal functions are not counted as public APIs. Component-owned tables (for example RAG/workflow internals) are outside root schema-table counts.

## Routes and entry ownership

All routes live under the shared AuthGate. Top-level entries come from `app-navigation.ts` (19 links including Home); record detail routes are reached from list cards, lineage, search or review links. Only the guarded Essays route transitions and selected fixture routes have browser proof.

| Route | Component | Feature |
| --- | --- | --- |
| `/` | `Zodiac3D` | R11 |
| `/ingest` | `IngestPage` | R01–R04 |
| `/display` | `DisplayPage` | R07–R10 |
| `/essays` | `EssaysPage` | A04 |
| `/essays/$essaySlug` | `EssayDetailPage` | A04 |
| `/hypotheses` | `HypothesesPage` | S01 |
| `/hypotheses/$hypothesisId` | `HypothesisDetailPage` | S01 |
| `/recipes` | `RecipesPage` | S04 |
| `/theses` | `ThesesPage` | S06 |
| `/theses/$thesisId` | `ThesisDetailPage` | S06 |
| `/recipes/$recipeId` | `RecipeDetailPage` | S04/S05/M06 |
| `/correspondences/$correspondenceId` | `CorrespondenceDetailPage` | R13 |
| `/correspondences` | `CorrespondencesPage` | R13 |
| `/weekly-turns` | `WeeklyTurnsPage` | S07/S08 |
| `/weekly-turns/$briefId` | `WeeklyBriefDetailPage` | S08 |
| `/compositions` | `CompositionsPage` | M01 |
| `/editorial` | `EditorialPage` | S09 |
| `/editorial/$artifactId` | `EditorialDetailPage` | S09 |
| `/compositions/$compositionId` | `CompositionDetailPage` | M01–M03/M06/R10 |
| `/failures` | `FailuresPage` | S10 |
| `/feedback` | `FeedbackPage` | M03 |
| `/listen` | `ListenPage` | M07–M10 |
| `/docket` | `DocketPage` | O04 |
| `/admin` | `AdminPage` | O05 |
| `/agent-runs` | `AgentRunsPage` | O01 |
| `/agent-runs/$runId` | `AgentRunDetailPage` | O01/S03/O02 |
| `/agent-drafts` | `AgentDraftsPage` | S03/O04 |
| `/vocabulary-triage` | `VocabularyTriagePage` | R12 |

## Root schema ownership

[schema.ts](../../convex/schema.ts): 41 tables. Shared statuses and validators govern lifecycle; schema field existence does not establish an input control.

| Table | Feature owner / UI consequence |
| --- | --- |
| `failureInvestigationGroups` | O02 |
| `operationFailures` | O02 |
| `authFailureCounters` | O05 |
| `users` | A01 |
| `agentRuns` | O01 |
| `agentRunEvents` | O01 |
| `decisionIntents` | O04 |
| `webhookEvents` | O04 |
| `docketCards` | O04 |
| `docketDeliveries` | O04 |
| `agentReviewDrafts` | S03 |
| `tournamentRuns` | S11 |
| `hypothesisCandidates` | S11 |
| `hypothesisEmbeddings` | S11 |
| `editCaptures` | O06 |
| `sources` | R01–R10 |
| `feeds` | R04 |
| `extractionAttempts` | R08 |
| `extractions` | R08/R10 |
| `claims` | R10 |
| `correspondences` | R13 |
| `theses` | S06 |
| `campaigns` | S07 |
| `hypotheses` | S01/S02 |
| `recipes` | S04/S05 |
| `compositions` | M01/M02 |
| `listeningSessions` | M03 |
| `audioArtifacts` | M05–M10 |
| `blindGroups` | M08/M09 |
| `mediaJobs` | M05/M09/M10 |
| `settings` | O05/M09/R14 |
| `voiceRatings` | M09 |
| `audioRatings` | M07 |
| `weeklyBriefs` | S08 |
| `stats` | R09/R11 |
| `editorialArtifacts` | S09 |
| `parameterKinds` | R12 |
| `conceptDomains` | R12 |
| `relationshipKinds` | R12 |
| `concepts` | R11/R12 |
| `edges` | R11/R13 |

## Public backend APIs

The [API declaration inventory](apis.md) maps all **45 public modules / 248 query, mutation and action exports** to feature IDs. It is split out to respect the repository file-size limit. Internal support and external routes remain below.

## Public capabilities without a direct web call

Source scan of `api.<module>.<function>` across `web/src` finds no caller for the following notable operational or intended-next-stage capabilities. Absence of a direct call is a reachability lead, not a runtime call-graph proof. The module table above retains all other public declarations, including aliases and maintenance APIs.

| Capability | Current boundary / classification |
| --- | --- |
| `recipes.update`, `recipes.updateStatus` | Recipe detail is read-only; planned loop closure G02. |
| `renders.setPlan`, `renders.request`, `renders.validationGate` | Backend render admission; no web rendering controls. G09. |
| `authFailures.summary` | Bounded operator observability API; no admin panel promised. G06. |
| `passages.probe`, `passages.backfillBatch`, embedding probes/backfill | Operator/index foundation, not palette search. G07. |
| `hypotheses.generateFromExtraction/generateBatch`, workflow full-pipeline controls | Background/operator synthesis; current manual recipe generation **is** wired. G05/G06. |
| `testing.seedCampaigns` | Test-only explicit seed; do not call against the shared deployment. |

`starterKit` has schema/validator/CLI writers but no recipe detail reader. `searchSourcePassages` is in the agent manifest/registry, with no graph/generator consumer. See G07/G08.

## Internal support modules

These non-public backend modules were included in the source inventory. Their responsibilities attach to the feature domains above; they are not independent missing screens. Tests and generated modules are excluded.


`agentDraftPromotion`, `agentToolRegistry`, `agentTools`, `agentToolsHttp`, `auth.config`, `auth`, `components`, `conceptClassification`, `conceptClassifierInternal`, `conceptDomainNormalization`, `convex.config`, `correspondenceCandidates`, `crons`, `decisionIdentity`, `decisionIntentsMigrations`, `decisionSignerDelivery`, `decisionSignerParsing`, `decisionSignerRuntime`, `decisionSignerTransport`, `discordInteractions`, `docketBlurbs`, `domainMappings`, `editorialExports`, `embeddingsStore`, `episodes`, `extractInternal`, `http`, `hypothesesInternal`, `hypothesisTournament`, `hypothesisTournamentNode`, `llm`, `llmNode`, `maintenance`, `mediaJobEffects`, `mediaJobs`, `mediaSweeper`, `mediaToolsInternal`, `narration`, `narrationPrompt`, `pdfCaptureNode`, `phase2`, `recipesInternal`, `recoveryWorkflows`, `sourceUtils`, `telegramWebhook`, `tracing`, `transcriptCapture`, `weeklyBriefsInternal`.

## HTTP ingress and external consumers

[http.ts](../../convex/http.ts) registers:

| Route | Boundary / feature |
| --- | --- |
| `GET /health` | Reachability only, no database health claim (O05). |
| `POST /ingest/notion` | Shared-secret external source upsert (R05). |
| `POST /ingest/rssItem` | Shared-secret external RSS item upsert (R04). |
| `POST /ingest/url` | Shared-secret external URL upsert (R01). |
| `POST /agent-tools/<name>` | One generated handler per shared manifest entry; scoped agent/media lifecycle tools (O05). |
| `GET /podcast/<token>/feed.xml` | Token-gated private RSS, wrong token 404 (M10). Do not exercise hosted Vite proxy here. |
| `POST /discord/interactions` | Signed human decisions/channel transport (O04). |
| `POST /telegram/webhook/<path>` | Guarded Telegram decision transport (O04). |

The manifest/registry tests in V check tool coverage, argument/schema agreement, provenance and boundaries. MCP wraps bounded docket/decision tools separately in `agent/src/mcp/`. These contracts do not authorize external messages or publication during verification.

## Worker graph registry

[shared contract](../../convex/shared/agentContract.ts) and [runner](../../agent/src/worker/runner.ts): nine graphs.

| Graph | User-visible consequence / feature |
| --- | --- |
| `failure-investigation` | O02; run/events on O01, draft outputs through S03 where applicable. |
| `research-pipeline` | S03/O07; run/events on O01, draft outputs through S03 where applicable. |
| `weekly-brief` | S08; run/events on O01, draft outputs through S03 where applicable. |
| `correspondence-miner` | R13; run/events on O01, draft outputs through S03 where applicable. |
| `evidence-hunter` | R13; run/events on O01, draft outputs through S03 where applicable. |
| `hypothesis-drafter` | S02; run/events on O01, draft outputs through S03 where applicable. |
| `source-scout` | R06; run/events on O01, draft outputs through S03 where applicable. |
| `transcript-capture` | R02; run/events on O01, draft outputs through S03 where applicable. |
| `hypothesis-tournament` | S11; run/events on O01, draft outputs through S03 where applicable. |

## Media job registry

[shared kinds](../../convex/shared/mediaJobs.ts) and [handlers](../../media/src/jobs/index.ts) agree on five kinds. No `analyze` handler exists.

| Job | Handler | Feature |
| --- | --- | --- |
| `probe` | [handler](../../media/src/jobs/probe.ts) | O05/M05 |
| `narrate` | [handler](../../media/src/jobs/narrate.ts) | M10 |
| `shootout` | [handler](../../media/src/jobs/shootout.ts) | M09 |
| `assembleEpisode` | [handler](../../media/src/jobs/assembleEpisode.ts) | M10 |
| `litmusRender` | [handler](../../media/src/jobs/litmusRender.ts) | M05 |

## Cron registry

[crons.ts](../../convex/crons.ts): 21 registrations. Cadences below are source configuration; this audit did not run or wait for the live scheduler. There is no `reconcile-episodes` cron. Written weekly generation does not imply audio narration.

| Cron | Schedule | Handler |
| --- | --- | --- |
| `rebuild-docket` | weekly: `dayOfWeek: "thursday", hourUTC: 16, minuteUTC: 30` | `docket.prepare` |
| `normalize-legacy-extraction-history` | interval: `minutes: 5` | `extractions.normalizeLegacyHistory` |
| `reconcile-extraction-attempts` | interval: `minutes: 5` | `extractInternal.reconcileAttempts` |
| `reconcile-operation-recovery` | interval: `minutes: 5` | `operationFailures.reconcile` |
| `poll-feeds` | interval: `hours: 6` | `ingest.pollAllFeedsInternal` |
| `batch-extract` | interval: `hours: 8` | `workflows.startBatchExtractionInternal` |
| `generate-hypotheses` | weekly: `dayOfWeek: "monday", hourUTC: 16, minuteUTC: 0` | `workflows.startBatchHypothesisInternal` |
| `generate-weekly-turn` | weekly: `dayOfWeek: "friday", hourUTC: 16, minuteUTC: 0` | `weeklyBriefs.generateInternal` |
| `sweep-stale-agent-runs` | interval: `minutes: 15` | `agentRuns.sweepStaleRuns` |
| `reconcile-reviewed-agent-runs` | interval: `minutes: 15` | `agentRuns.reconcileReviewedRuns` |
| `recompute-stats` | interval: `minutes: 30` | `dashboard.recomputeStats` |
| `classify-stale-concepts` | interval: `hours: 1` | `conceptClassifier.sweepUnreviewedConcepts` |
| `embed-missing-sweep` | weekly: `dayOfWeek: "sunday", hourUTC: 15, minuteUTC: 0` | `embeddings.sweepMissingEmbeddings` |
| `passage-index-sweep` | weekly: `dayOfWeek: "sunday", hourUTC: 15, minuteUTC: 30` | `passages.sweep` |
| `retire-stale-correspondences` | weekly: `dayOfWeek: "sunday", hourUTC: 16, minuteUTC: 0` | `correspondences.autoRetireStale` |
| `enqueue-correspondence-miner` | daily: `hourUTC: 5, minuteUTC: 0` | `agentRuns.enqueue` |
| `enqueue-evidence-hunter` | daily: `hourUTC: 6, minuteUTC: 0` | `agentRuns.enqueue` |
| `enqueue-hypothesis-drafter` | weekly: `dayOfWeek: "thursday", hourUTC: 16, minuteUTC: 0` | `agentRuns.enqueue` |
| `enqueue-source-scout` | weekly: `dayOfWeek: "wednesday", hourUTC: 16, minuteUTC: 0` | `agentRuns.enqueue` |
| `enqueue-transcript-capture` | interval: `hours: 3` | `transcriptCapture.enqueueIfNeeded` |
| `sweep-stale-media-jobs` | interval: `minutes: 10` | `mediaSweeper.sweep` |

## Stubs, TODOs and documented boundaries

The production-source search for `TODO|FIXME|stub|not implemented|coming soon` found a hypothesis form comment referring to fallback “Draft rationale.”; it is not an unimplemented route. The important stop path uses different words: `unsupportedWriteRouteNode` intentionally declines extract/critique/archive specialist writes. Registry/spec comparison also exposes the absent analysis job. CSS auth/loading placeholders and input placeholder strings are not counted as features.

Active plans 008/13/11/15/16, `docs/plans/README.md`, the meaning checkpoints, listen-first specs and media runbooks were reconciled with the current call sites. `scripts/archive/` was searched/read only, never executed/formatted/edited. “Implemented” in an old plan is not imported as a current proof claim. Root README still has stale storage/prompt descriptions (G12).

Root, web, agent and media package scripts/configs/environment schemas were inspected separately. Root `verify` omits browser fixtures and the web build; `agent build` is a LangGraph/container build, not required for these injected graph tests. The media service start and agent worker start would load service config and poll a backend; neither was started. Operator recovery/deployment automation is represented by O07, not exercised against infrastructure.

## Re-enumerate after a source change

```bash
rg -n "path:|component:" web/src/router.tsx
rg -n "defineTable" convex/schema.ts
rg -n "export const .* = (query|mutation|action)" convex/*.ts
rg -n "KNOWN_GRAPH_NAMES|MEDIA_JOB_KINDS" convex/shared/{agentContract,mediaJobs}.ts
rg -n "crons\.(interval|daily|weekly)" convex/crons.ts
rg -n "TODO|FIXME|stub|not implemented|intentionally disabled" web/src convex agent/src media/src
```

Check new entries against a feature ID, update its acceptance recipe, and rerun relevant proof. These searches are inspection commands, not new automated tests.
