# Frequency candidate semantic review

This is an offline review of the complete **candidate**, based on source
`0d07b44` and the cached full push request generated from equivalent Convex
sources at `07aa3d4`. It does not approve deployment. No credentials, backend
queries, production rows, or worker operations were used for this review.
Source history is not proof of the currently deployed source revision.

## Evidence scope and counting rules

The cached push request has 127 root function/dependency bundles. Adding its
separate root `schema.js` and `convex.config.js` yields **129 root identities**.
The corrected cached identity comparison reports **106 unchanged, 7 added,
7 removed, and 16 changed**: both sides total 129. Added/removed paths are
bundler chunks, not evidence of seven added/removed callable functions.
A changed entrypoint hash can reflect a changed imported chunk; it does not
establish that every function exported by that entrypoint changed behavior.

The candidate has four component definitions with 45 function/dependency
bundles: action-cache 6, aggregate 6, workflow 13, and workpool 20. Each also
has a separate `schema.js` and `convex.config.js` (53 component identities
in total). The root registers aggregate,
actionCache, and workflow; workpool is the workflow dependency. Counts of
bundle identities, analyzed modules, callable functions, tables, and component
instances are different measurements and must not be substituted for one another.

The Mac coordinator's separate observation at **2026-09-13T01:07:27.373Z**
reported HTTP 200, success, complete analysis containing **74 root modules**;
`agentRuns.js` was present and `opsStatusCountsPage` absent. This review did not
repeat that probe. That observation establishes missing deployed functionality,
not a deployed Git SHA or a complete candidate-versus-deployed semantic diff.
The cached 129-identity comparison and this later 74-analyzed-module observation
are different records with different coverage; do not call them one snapshot.

## Semantic findings and activation consequences

1. **Claim pause is admission control.** `agentRuns.claimNextPending` is an
   internal mutation accepting `workerId: string` and optional `graphName:
   string`. It returns the shared nullable claimed-run validator. Any nonempty
   `FREQUENCY_WORKER_CLAIMS_PAUSED` value except exact `false` returns null before
   selecting or updating a row. It preserves queued and active rows. It does
   not stop admitted graphs, direct actions, crons, or external effects. The
   candidate alone cannot establish that this branch is deployed.
2. **Counts are internal scalar evidence.** `agentRuns.opsStatusCountsPage` is
   an internal query accepting a required string-or-null cursor and optional
   numeric page size. Runtime checks require an integer 1–200 and a nonempty
   cursor of at most 16,384 characters. It scans immutable creation order, with
   201-row/4-MiB read limits, and returns status counts, rows read, continuation,
   completion, query time, pause state, and split status. It returns no job
   payload. Each call is a separate query snapshot unless the caller pins one;
   a multi-page scan alone is not an atomic queue snapshot. Split, truncation,
   history retention failures, or scan limits fail acceptance. Public recent
   status counts remain a window and cannot prove full queue emptiness.
3. **Lifecycle writes remain effectful.** `enqueue`, `create`, `markRunning`,
   `appendEvent`, `markNeedsReview`, `markCompleted`, `markFailed`,
   `sweepStaleRuns`, and `reconcileReviewedRuns` mutate queue/event state.
   Stale sweeps mark records failed; they do not terminate a process. A terminal
   row never proves external work has stopped, and blind retry can duplicate
   effects. Existing cron producers can enqueue while claim admission is paused.
4. **Draft promotion is a publication boundary.** `agentDrafts.approve` is a
   public mutation protected by `requireAuth`, accepting a typed draft ID,
   optional decision note, optional shared structured amended payload, and
   optional bypass secret. Its explicit return distinguishes typed promoted
   hypothesis/recipe IDs. It rejects absent/nonpending/unstructured or mismatched
   drafts, records edit/provenance fields, and creates promoted domain records.
   `reject` and `supersede` resolve drafts. The associated helper module
   `agentDraftPromotion` is not itself a registered endpoint. Human approval
   remains an operational requirement; authentication alone is not evidence of
   human review.
5. **LLM and publishing entrypoints have external effects.** `extractSource`,
   hypothesis/recipe generation, concept classification, and brief generation
   route to provider calls and subsequent database writes. `llm.ts` selects
   `openai/gpt-5.6-terra` by default and sets per-task output caps; `llmNode.ts`
   routes `groq/*` to Groq and other models to OpenRouter, and invokes traced
   generation. Budget caps are not cost receipts or idempotency guarantees.
   Brief publication includes an external Notion path. These actions and their
   scheduled callers must be included in any producer/executor freeze scope;
   stopping CT107 alone cannot freeze them.
6. **Internal generation validators are explicit.**
   `conceptClassifierInternal.generateClassifications` takes string system,
   prompt, model and numeric expectedCount; it returns classified items with
   numeric index, string-array domains, on/off mission relevance and rationale,
   plus failed/inputTokens/outputTokens numbers. The hypothesis, recipe, and
   brief internal text actions return `{text: string}` and accept typed input
   record IDs plus prompt/model metadata. These are candidate validator
   declarations, not verified deployed validator equivalence.
7. **Authentication is broader than a release stamp.** `auth.config.ts` requires
   `CLERK_JWT_ISSUER_DOMAIN` when evaluated and uses application ID `convex`.
   `requireAuth` accepts a verified identity or the standing bypass identity
   only when enabled and its existing secret matches. `/agent-tools/*` uses
   `AGENT_TOOL_SECRET`. Internal query visibility is protected by Convex's
   privileged invocation boundary, not by adding a public endpoint or broad
   application grant. Auth configuration hash changes require protected
   deployed configuration comparison and target verification; no secret value
   belongs in review evidence.
8. **Vocabulary maintenance is not passive evidence.** `seedMissionConceptDomains`,
   cleanup, rekey and reference-remap paths accept explicit apply controls and
   authenticate before writes. Promotion/rejection/merge endpoints change registry
   state and graph references. Classification's `force`/`apply` controls do not
   make an arbitrary action a read-only inventory call. None were invoked here.
9. **Full backend deployment has a larger scope than the ops query.** The
   candidate includes all schemas, component definitions, dependencies, HTTP
   routes and cron definitions below. Root identity equality does not validate
   component databases, existing row compatibility, auth environment, pending
   scheduled functions, or schema/index transitions. Treat a deploy command as
   a distinct live change, even if its originating source PR was preparation.

## Changed root entrypoints and shared dependencies

The 16 changed paths in the cached identity delta are `agentDraftPromotion`,
`agentDrafts`, `agentRuns`, `auth.config`, `conceptClassifier`,
`conceptClassifierInternal`, `extract`, `hypotheses`, `hypothesesInternal`,
`llm`, `llmNode`, `recipes`, `recipesInternal`, `vocabulary`, `weeklyBriefs`,
and `weeklyBriefsInternal` (all `.js`). The candidate Node entrypoints are
`conceptClassifierInternal`, `extract`, `hypothesesInternal`, `llmNode`,
`recipesInternal`, and `weeklyBriefsInternal`; the remainder are isolate modules.

Source-map inspection identifies the added isolate chunks as:

| Added chunk | Candidate source ownership |
| --- | --- |
| `_deps/BUMM5S53.js` | `convex/agentDrafts.ts` |
| `_deps/CDHW6WAE.js` | `convex/llm.ts` |
| `_deps/FZCTIQQK.js` | `convex/hypotheses.ts` |
| `_deps/OWYE2LE3.js` | `convex/agentDraftPromotion.ts` |
| `_deps/U4LU3C2N.js` | `convex/agentRuns.ts` |
| `_deps/VWZL5UNK.js` | `convex/vocabulary.ts` |
| `_deps/node/MNA6XR3T.js` | `convex/llm.ts`, `convex/llmNode.ts`, and 459 vendor source-map entries |

Removed chunk identities have no cached deployed source bodies here. Do not
pair them with new chunks based only on name or count, or describe their
semantic contents as reviewed. Vendor source-map entries are not 459 packages
or functions. Imports can spread a source change across multiple entrypoints.

## Candidate schemas and component state

The cached schema inventory has schema validation enabled for all five schema
namespaces. Root: 24 tables, 71 ordinary indexes, one search index, two vector
indexes. Components together: 16 tables and 13 ordinary indexes. This is a
candidate inventory; no index additions/deletions or existing-data compatibility
are established without the protected deployed schema and component comparison.

### root

| Table | Ordinary indexes | Search / vector indexes |
| --- | --- | --- |
| `users` | `by_clerkUserId` | none |
| `agentRuns` | `by_status_updatedAt`, `by_graphName_updatedAt`, `by_status_graphName_updatedAt`, `by_updatedAt` | none |
| `agentRunEvents` | `by_runId_createdAt` | none |
| `agentReviewDrafts` | `by_agentRunId_updatedAt`, `by_agentRunId_status_updatedAt`, `by_status_updatedAt`, `by_status_kind_updatedAt`, `by_graphName_updatedAt` | none |
| `editCaptures` | `by_exported_editedAt` | none |
| `sources` | `by_status_updatedAt`, `by_visibility_updatedAt`, `by_type_updatedAt`, `by_dedupeKey`, `by_notionPageId`, `by_canonicalUrl`, `by_createdAt` | none |
| `feeds` | `by_enabled`, `by_type`, `by_url` | none |
| `extractions` | `by_sourceId_createdAt`, `by_inputHash` | none |
| `claims` | `by_extractionId_ordinal`, `by_sourceId`, `by_sourceId_status`, `by_status` | vector `by_embedding` |
| `correspondences` | `by_pairKey`, `by_status_updatedAt`, `by_conceptAId`, `by_conceptBId` | none |
| `theses` | `by_status_updatedAt`, `by_visibility_updatedAt` | none |
| `campaigns` | `by_status_updatedAt`, `by_visibility_updatedAt` | none |
| `hypotheses` | `by_status_updatedAt`, `by_visibility_updatedAt`, `by_correspondenceId`, `by_thesisId_updatedAt`, `by_extractionIds` | none |
| `recipes` | `by_hypothesisId_updatedAt`, `by_status_updatedAt` | none |
| `compositions` | `by_recipeId_updatedAt`, `by_status_updatedAt`, `by_revisionParentId_updatedAt` | none |
| `listeningSessions` | `by_compositionId_createdAt` | none |
| `weeklyBriefs` | `by_weekOf`, `by_visibility_createdAt` | none |
| `stats` | `by_key` | none |
| `editorialArtifacts` | `by_slug`, `by_status_updatedAt`, `by_visibility_updatedAt`, `by_kind_updatedAt` | none |
| `parameterKinds` | `by_name`, `by_status` | none |
| `conceptDomains` | `by_name`, `by_status`, `by_sectorMapping` | none |
| `relationshipKinds` | `by_name`, `by_status` | none |
| `concepts` | `by_name`, `by_domain`, `by_missionRelevance`, `by_missionRelevance_lastProbedAt`, `by_mentionCount` | search `search_concepts`, vector `by_embedding` |
| `edges` | `by_from`, `by_to`, `by_to_fromType`, `by_relationship`, `by_fromType_relationship` | none |

### action-cache

| Table | Ordinary indexes | Search / vector indexes |
| --- | --- | --- |
| `values` | `key` | none |
| `metadata` | `expiresAt` | none |

### aggregate

| Table | Ordinary indexes | Search / vector indexes |
| --- | --- | --- |
| `btree` | `by_namespace` | none |
| `btreeNode` | none | none |

### workflow

| Table | Ordinary indexes | Search / vector indexes |
| --- | --- | --- |
| `config` | none | none |
| `workflows` | `name` | none |
| `steps` | `workflow`, `inProgress` | none |
| `events` | `workflowId_state` | none |
| `onCompleteFailures` | none | none |

### workpool

| Table | Ordinary indexes | Search / vector indexes |
| --- | --- | --- |
| `globals` | none | none |
| `internalState` | none | none |
| `runStatus` | none | none |
| `work` | none | none |
| `pendingStart` | `workId`, `segment` | none |
| `pendingCompletion` | `workId`, `segment` | none |
| `pendingCancelation` | `workId`, `segment` | none |

## Candidate cron and HTTP inventory

The root has 14 cron registrations in `convex/crons.ts`. All are effectful
producers or maintenance executors; claim pause does not disable them.

| Name | Schedule (UTC where calendar based) | Target / fixed arguments |
| --- | --- | --- |
| poll-feeds | every 6 hours | ingest.pollAllFeedsInternal |
| batch-extract | every 8 hours | workflows.startBatchExtractionInternal, limit 3 |
| generate-hypotheses | Monday 16:00 | workflows.startBatchHypothesisInternal, limit 3 |
| generate-weekly-turn | Friday 16:00 | weeklyBriefs.generateInternal, daysBack 7 |
| sweep-stale-agent-runs | every 15 minutes | agentRuns.sweepStaleRuns |
| reconcile-reviewed-agent-runs | every 15 minutes | agentRuns.reconcileReviewedRuns |
| recompute-stats | every 30 minutes | dashboard.recomputeStats |
| classify-stale-concepts | every hour | conceptClassifier.sweepUnreviewedConcepts |
| embed-missing-sweep | Sunday 15:00 | embeddings.sweepMissingEmbeddings |
| retire-stale-correspondences | Sunday 16:00 | correspondences.autoRetireStale |
| enqueue-correspondence-miner | daily 05:00 | agentRuns.enqueue, graph correspondence-miner, limit 20 |
| enqueue-evidence-hunter | daily 06:00 | agentRuns.enqueue, graph evidence-hunter, limit 5 |
| enqueue-hypothesis-drafter | Thursday 16:00 | agentRuns.enqueue, graph hypothesis-drafter |
| enqueue-source-scout | Wednesday 16:00 | agentRuns.enqueue, graph source-scout |

`convex/http.ts` registers GET `/health`, POST `/agent-tools/${name}` for the
tracked agent-tool registry, and POST `/ingest/notion`, `/ingest/rssItem`, and
`/ingest/url`. The registry expands the route family, so the four literal paths
are not the full HTTP endpoint count. Health is not proof of claim-pause or ops
query deployment. Component-owned cron modules exist in action-cache and
workpool; their cleanup/recovery execution and pending component work also need
protected deployed comparison before backend approval.

## Complete direct root callable declaration inventory

The following lexical inventory reads every top-level `convex/*.ts` file,
excluding test files, and captures exported direct `query`, `mutation`, `action`,
`internalQuery`, `internalMutation`, and `internalAction` declarations. It finds
290 declarations: 105 public queries, 73 public mutations, 24 public actions,
24 internal queries, 42 internal mutations, and 22 internal actions. It is not
Convex backend analysis: router methods, component functions, helper exports,
and generated/chunk exports are deliberately not counted as these declarations.
“Public” is Convex visibility, not a claim that authentication is absent.

| Source module | Kind and exported names |
| --- | --- |
| `convex/admin.ts` | **query**: `workspaceSnapshot`, `listFeeds`; **mutation**: `createFeed`, `setFeedEnabled`, `setSourceStatus`, `promoteVisibility`; **action**: `pollFeedsNow` |
| `convex/agentDrafts.ts` | **internalMutation**: `createFromAgentRun`; **query**: `listByRunPublic`, `listByRun`, `listPending`, `listPendingPublic`, `getReviewContext`, `countPendingPublic`, `countPendingHypothesesPublic`; **internalQuery**: `countPending`, `listDraftableCorrespondences`; **mutation**: `approve`, `reject`, `supersede` |
| `convex/agentRuns.ts` | **internalMutation**: `create`, `enqueue`, `claimNextPending`, `sweepStaleRuns`, `markRunning`, `appendEvent`, `markNeedsReview`, `markCompleted`, `reconcileReviewedRuns`, `markFailed`; **internalQuery**: `getForWorker`, `opsStatusCountsPage`; **query**: `get`, `listRecent`, `listRecentPublic`, `getPublic`, `statusCountsPublic`, `listEventsPublic`, `statusCounts`, `listByStatus`, `listEvents` |
| `convex/agentTools.ts` | **internalQuery**: `selfImprovementStats` |
| `convex/aggregates.ts` | **query**: `getTotalConceptCount`, `getTotalMentions`, `getTopConceptsRanked`, `getSourceCounts`, `getTotalSourceCount`; **internalMutation**: `rebuildConceptAggregate`, `rebuildSourceAggregate` |
| `convex/campaigns.ts` | **query**: `list`, `listForSelection`, `get`, `getActive`, `getRecommendedActions`; **mutation**: `create`, `update`, `setActive`, `attachThesis`, `detachThesis` |
| `convex/claims.ts` | **query**: `listByExtraction`, `listBySource`, `getMany` |
| `convex/compositions.ts` | **query**: `list`, `get`, `getLineage`; **mutation**: `create`, `update`, `deleteById` |
| `convex/conceptClassifier.ts` | **mutation**: `writeClassifications`; **internalMutation**: `writeClassificationsInternal`; **query**: `listClassificationCandidates`; **internalQuery**: `getClassificationInputs`, `listStaleUnreviewed`; **internalAction**: `classifyConceptBatch`, `sweepUnreviewedConcepts`; **action**: `classifyConcepts` |
| `convex/conceptClassifierInternal.ts` | **internalAction**: `generateClassifications` |
| `convex/correspondenceCandidates.ts` | **internalQuery**: `getProbeConcept`, `hydrateClaimMatches`, `getStructuralScores`, `getCandidateSamples`, `hydrateAgentCandidates`, `listEvidenceTargets`; **internalMutation**: `markConceptProbed`; **internalAction**: `generateCandidates`, `listForAgent`, `searchClaimsSemantic` |
| `convex/correspondences.ts` | **query**: `scoutTargets`, `getByPairKey`, `listByStatus`, `get`, `listForConcept`, `listRecentMovement`; **mutation**: `upsertConjecture`, `addEvidence`, `setStatus`; **internalMutation**: `upsertConjectureFromAgent`, `addEvidenceFromAgent`, `autoRetireStale` |
| `convex/dashboard.ts` | **internalQuery**: `countPage`, `readLoopTimestamps`; **internalMutation**: `writeStat`, `recordBatchExtractionOutcome`; **internalAction**: `recomputeStats`; **query**: `pipeline`, `zodiacSectors`, `domainSubTopics`, `pipelineItems`, `editorialSignals`, `itemRelations`, `activityFeed` |
| `convex/editCaptures.ts` | **query**: `listUnexported`; **mutation**: `markExported` |
| `convex/editorialArtifacts.ts` | **query**: `list`, `get`, `listPublicExport`, `getPublicExportBundle`; **mutation**: `createDraftFromWeeklyBrief`, `createDraftFromCampaign`, `createDraftFromThesis`, `update`, `submitForReview`, `approve`, `publish`, `setAstroExportMetadata`; **internalMutation**: `setAstroExportMetadataInternal`; **internalQuery**: `getExportBundleInternal`; **action**: `exportForAstro` |
| `convex/editorialExports.ts` | **internalAction**: `exportForAstroInternal` |
| `convex/embeddings.ts` | **internalAction**: `embedTexts`, `embedClaims`, `embedConcepts`, `sweepMissingEmbeddings`; **action**: `backfillBatch`, `probe` |
| `convex/embeddingsStore.ts` | **internalQuery**: `getClaims`, `getConcepts`, `getBackfillPage`, `getSweepCandidates`, `getProbeClaim`, `hydrateProbeMatches`; **internalMutation**: `storeClaimEmbeddings`, `storeConceptEmbeddings` |
| `convex/extract.ts` | **action**: `extractSource`, `extractAllReady`, `listModels` |
| `convex/extractInternal.ts` | **internalMutation**: `storeExtraction` |
| `convex/extractions.ts` | **query**: `get`, `getByInputHash`, `getBySourceId`, `listRecent`; **mutation**: `editExtraction`, `backfillClaims` |
| `convex/fabric.ts` | **action**: `getYouTubeTranscript`, `fetchTranscriptForSource`, `fetchAllYouTubeTranscripts`, `fetchArticleText`, `fetchArticleForSource` |
| `convex/failures.ts` | **query**: `listArchive`, `getByKey`, `getByKeys` |
| `convex/feeds.ts` | **query**: `listEnabled`, `list`, `get`, `getByIds`; **mutation**: `create`, `setEnabled`, `remove`; **internalMutation**: `proposeFeed`, `updateLastPolled`, `seedInitialFeeds` |
| `convex/graph.ts` | **query**: `getConcept`, `searchConcepts`, `listByDomain`, `getTopConcepts`, `getEdgesFrom`, `getEdgesTo`, `getRelatedSources`, `getConceptsFor`, `searchSourcesByConcept`, `getConceptsForDomain`, `getConceptEdges`, `getConceptDetail`, `getConceptDetailPublic`, `exportForVisualization`; **internalMutation**: `upsertConcept`, `incrementMentions`, `createEdge`, `deleteEdge`; **internalAction**: `linkExtractionConcepts`, `linkHypothesisConcepts`, `buildGraphFromExtractions` |
| `convex/hypotheses.ts` | **query**: `listByStatus`, `get`, `getBySourceId`, `listByThesis`, `listMissingWhyThisMatters`; **mutation**: `create`, `update`, `updateStatus`, `deleteById`; **action**: `generateFromExtraction`, `generateBatch`; **internalQuery**: `listUnlinkedBatchCandidates` |
| `convex/hypothesesInternal.ts` | **internalAction**: `generateHypothesisText` |
| `convex/inbox.ts` | **query**: `list`, `counts` |
| `convex/ingest.ts` | **internalAction**: `pollFeed`, `pollAllFeedsInternal`, `fetchUrlText`; **action**: `pollAllFeeds`, `ingestUrl`, `ingestYouTube` |
| `convex/listening.ts` | **query**: `listByComposition`, `listRecent`; **mutation**: `create`, `updateVisibility`, `deleteById` |
| `convex/maintenance.ts` | **internalMutation**: `purgeE2eDebris` |
| `convex/recipes.ts` | **query**: `listByStatus`, `get`, `getByHypothesisId`; **mutation**: `create`, `update`, `updateStatus`, `deleteById`; **action**: `generateFromHypothesis`, `generateBatch` |
| `convex/recipesInternal.ts` | **internalAction**: `generateRecipeText` |
| `convex/sources.ts` | **query**: `listByStatus`, `listRecent`, `listByType`, `get`, `getByDedupeKey`; **mutation**: `create`, `updateStatus`, `updateText`, `setVisibility`, `createFromUrlInput`, `createFromYouTubeInput`, `archive`, `recomputeDedupeKeys`, `bulkArchive`, `deleteById`; **internalMutation**: `upsertExternal`, `createScoutedSource`; **action**: `createFromUrlAndQueue`, `createFromYouTubeAndQueue` |
| `convex/testing.ts` | **mutation**: `seedCampaigns` |
| `convex/theses.ts` | **query**: `list`, `get`, `getByIds`, `getDetail`; **mutation**: `create`, `update` |
| `convex/vocabulary.ts` | **internalMutation**: `ensureParameterKind`, `ensureConceptDomain`, `seedConceptDomains`, `ensureRelationshipKind`; **mutation**: `seedMissionConceptDomains`, `cleanupProvisionalConceptDomainDuplicates`, `seedKnownRelationshipKinds`, `seedKnownParameterKinds`, `rekeyLegacyParameterKinds`, `promoteEntry`, `rejectEntry`, `mergeEntry`, `mergeVocabularyReferenceBatch`; **query**: `triageBoard`, `reviewSummary` |
| `convex/weeklyBriefs.ts` | **query**: `list`, `get`, `getLatest`; **internalMutation**: `create`, `setPublished`; **mutation**: `publish`, `editBrief`, `deleteById`; **internalQuery**: `loadBriefContext`; **action**: `generate`, `publishToNotion`; **internalAction**: `generateInternal` |
| `convex/weeklyBriefsInternal.ts` | **internalAction**: `generateBriefText` |
| `convex/workflows.ts` | **mutation**: `startBatchExtraction`, `startSingleSourceExtraction`, `startBatchHypothesis`, `startFullPipeline`; **internalMutation**: `startBatchExtractionInternal`, `startBatchHypothesisInternal`; **query**: `getStatus` |

## Validators of candidate callables in changed entrypoints

These are the named source validator expressions on the candidate declarations.
Shared validator names resolve through the tracked imports and are preserved
here rather than inventing expanded backend schemas. `returns` appears where
explicitly declared; its absence is not proof that a handler has no result.
Handler-side integer, pagination, authentication, domain and business constraints
still apply. This lists all candidate callables in each changed module, not
only functions proven to differ semantically from deployed code.

- `weeklyBriefsInternal:generateBriefText` — **internalAction**, [source](../convex/weeklyBriefsInternal.ts#L9): `args: { system: v.string(), prompt: v.string(), model: v.string(), weekOf: v.string(), promptVersion: v.string(), numHypotheses: v.number(), numRecipes: v.number(), campaignId: v.optional(v.id("campaigns")), }, returns: v.object({ text: v.string() })`
- `weeklyBriefs:list` — **query**, [source](../convex/weeklyBriefs.ts#L142): `args: { limit: v.optional(v.number()) }, returns: v.array(weeklyBriefReturnValidator)`
- `weeklyBriefs:get` — **query**, [source](../convex/weeklyBriefs.ts#L154): `args: { id: v.id("weeklyBriefs") }, returns: v.union(weeklyBriefReturnValidator, v.null())`
- `weeklyBriefs:getLatest` — **query**, [source](../convex/weeklyBriefs.ts#L162): `args: {}, returns: v.union(weeklyBriefReturnValidator, v.null())`
- `weeklyBriefs:create` — **internalMutation**, [source](../convex/weeklyBriefs.ts#L178): `args: { weekOf: v.string(), model: v.string(), promptVersion: v.string(), bodyMd: v.string(), sourceIds: v.array(v.id("sources")), campaignId: v.optional(v.id("campaigns")), recommendedHypothesisIds: v.array(v.id("hypotheses")), recommendedRecipeIds: v.array(v.id("recipes")), activeThesisIds: v.optional(v.array(v.id("theses"))), referencedFailureKeys: v.optional(v.array(v.string())), studioPrompts: studioPromptVariantsValidator, recommendedActions: v.array(recommendedActionValidator), loopReport: v.optional(loopReportValidator), todo: v.optional(v.array(v.string())), }`
- `weeklyBriefs:publish` — **mutation**, [source](../convex/weeklyBriefs.ts#L205): `args: { id: v.id("weeklyBriefs"), devBypassSecret: v.optional(v.string()) }, returns: v.null()`
- `weeklyBriefs:editBrief` — **mutation**, [source](../convex/weeklyBriefs.ts#L227): `args: { id: v.id("weeklyBriefs"), bodyMd: v.optional(v.string()), todo: v.optional(v.array(v.string())), studioPrompts: v.optional(studioPromptVariantsValidator), devBypassSecret: v.optional(v.string()), }, returns: v.null()`
- `weeklyBriefs:loadBriefContext` — **internalQuery**, [source](../convex/weeklyBriefs.ts#L727): `args: {}, returns: loadBriefContextReturnsValidator`
- `weeklyBriefs:generate` — **action**, [source](../convex/weeklyBriefs.ts#L969): `args: { daysBack: v.optional(v.number()), model: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: generateReturnsValidator`
- `weeklyBriefs:generateInternal` — **internalAction**, [source](../convex/weeklyBriefs.ts#L985): `args: { daysBack: v.optional(v.number()), model: v.optional(v.string()), }, returns: generateReturnsValidator`
- `weeklyBriefs:setPublished` — **internalMutation**, [source](../convex/weeklyBriefs.ts#L1121): `args: { id: v.id("weeklyBriefs"), notionPageId: v.string(), }`
- `weeklyBriefs:publishToNotion` — **action**, [source](../convex/weeklyBriefs.ts#L1135): `args: { id: v.id("weeklyBriefs"), devBypassSecret: v.optional(v.string()), }, returns: v.object({ notionPageId: v.string(), notionUrl: v.optional(v.string()), })`
- `weeklyBriefs:deleteById` — **mutation**, [source](../convex/weeklyBriefs.ts#L1206): `args: { id: v.id("weeklyBriefs"), devBypassSecret: v.optional(v.string()), }, returns: v.null()`
- `vocabulary:ensureParameterKind` — **internalMutation**, [source](../convex/vocabulary.ts#L172): `args: { name: v.string(), description: v.optional(v.string()), }, returns: v.object({ status: registryStatusValidator, })`
- `vocabulary:ensureConceptDomain` — **internalMutation**, [source](../convex/vocabulary.ts#L207): `args: { name: v.string(), description: v.optional(v.string()), sectorMapping: v.optional(v.string()), }, returns: v.object({ status: registryStatusValidator, })`
- `vocabulary:seedConceptDomains` — **internalMutation**, [source](../convex/vocabulary.ts#L249): `args: {}, returns: v.object({ seeded: v.number(), updated: v.number(), })`
- `vocabulary:seedMissionConceptDomains` — **mutation**, [source](../convex/vocabulary.ts#L296): `args: { entries: v.array( v.object({ name: v.string(), description: v.string(), }), ), apply: v.boolean(), devBypassSecret: v.optional(v.string()), }, returns: v.object({ created: v.number(), updated: v.number(), unchanged: v.number(), })`
- `vocabulary:cleanupProvisionalConceptDomainDuplicates` — **mutation**, [source](../convex/vocabulary.ts#L363): `args: { apply: v.boolean(), devBypassSecret: v.optional(v.string()), }, returns: v.object({ duplicateGroups: v.number(), deleted: v.number(), renamed: v.number(), })`
- `vocabulary:ensureRelationshipKind` — **internalMutation**, [source](../convex/vocabulary.ts#L425): `args: { name: v.string(), description: v.optional(v.string()), }, returns: v.object({ status: registryStatusValidator, })`
- `vocabulary:seedKnownRelationshipKinds` — **mutation**, [source](../convex/vocabulary.ts#L532): `args: seedArgs, returns: seedResultValidator`
- `vocabulary:seedKnownParameterKinds` — **mutation**, [source](../convex/vocabulary.ts#L547): `args: seedArgs, returns: seedResultValidator`
- `vocabulary:rekeyLegacyParameterKinds` — **mutation**, [source](../convex/vocabulary.ts#L580): `args: { apply: v.boolean(), devBypassSecret: v.optional(v.string()), }, returns: v.object({ renamed: v.array(v.object({ from: v.string(), to: v.string() })), merged: v.array(v.object({ from: v.string(), into: v.string() })), unchanged: v.number(), })`
- `vocabulary:promoteEntry` — **mutation**, [source](../convex/vocabulary.ts#L671): `args: { list: vocabularyListValidator, entryId: v.string(), note: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: decisionResultValidator`
- `vocabulary:rejectEntry` — **mutation**, [source](../convex/vocabulary.ts#L682): `args: { list: vocabularyListValidator, entryId: v.string(), note: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: decisionResultValidator`
- `vocabulary:mergeEntry` — **mutation**, [source](../convex/vocabulary.ts#L704): `args: { list: vocabularyListValidator, sourceEntryId: v.string(), targetEntryId: v.string(), note: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: mergeResultValidator`
- `vocabulary:mergeVocabularyReferenceBatch` — **mutation**, [source](../convex/vocabulary.ts#L814): `args: { list: vocabularyListValidator, sourceEntryId: v.string(), targetEntryId: v.string(), cursor: v.union(v.string(), v.null()), batchSize: v.optional(v.number()), apply: v.boolean(), devBypassSecret: v.optional(v.string()), }, returns: v.object({ sourceName: v.string(), targetName: v.string(), processed: v.number(), remapped: v.number(), isDone: v.boolean(), continueCursor: v.string(), })`
- `vocabulary:triageBoard` — **query**, [source](../convex/vocabulary.ts#L1012): `args: {}, returns: v.object({ conceptDomains: triageListValidator, parameterKinds: triageListValidator, relationshipKinds: triageListValidator, })`
- `vocabulary:reviewSummary` — **query**, [source](../convex/vocabulary.ts#L1108): `args: {}, returns: v.object({ provisionalParameterKinds: v.array(v.string()), provisionalConceptDomains: v.array(v.string()), provisionalRelationshipKinds: v.array(v.string()), })`
- `recipesInternal:generateRecipeText` — **internalAction**, [source](../convex/recipesInternal.ts#L8): `args: { system: v.string(), prompt: v.string(), model: v.string(), hypothesisId: v.id("hypotheses"), promptVersion: v.string(), }, returns: v.object({ text: v.string() })`
- `recipes:listByStatus` — **query**, [source](../convex/recipes.ts#L209): `args: { status: v.optional(recipeStatusValidator), limit: v.optional(v.number()), }, returns: v.array(recipeReturnValidator)`
- `recipes:get` — **query**, [source](../convex/recipes.ts#L234): `args: { id: v.id("recipes") }, returns: v.union( v.object({ ...recipeReturnValidator.fields, hypothesis: v.union(hypothesisReturnValidator, v.null()), }), v.null(), )`
- `recipes:getByHypothesisId` — **query**, [source](../convex/recipes.ts#L259): `args: { hypothesisId: v.id("hypotheses") }, returns: v.array(recipeReturnValidator)`
- `recipes:create` — **mutation**, [source](../convex/recipes.ts#L280): `args: { hypothesisId: v.id("hypotheses"), title: v.string(), whyThisMatters: v.optional(v.string()), bodyMd: v.string(), parameters: v.array(recipeParameterValidator), dawChecklist: v.array(v.string()), protocol: v.optional(recipeProtocolValidator), devBypassSecret: v.optional(v.string()), }, returns: v.id("recipes")`
- `recipes:update` — **mutation**, [source](../convex/recipes.ts#L311): `args: { id: v.id("recipes"), title: v.optional(v.string()), whyThisMatters: v.optional(v.string()), bodyMd: v.optional(v.string()), parameters: v.optional(v.array(recipeParameterValidator)), dawChecklist: v.optional(v.array(v.string())), protocol: v.optional(recipeProtocolValidator), starterKit: v.optional(recipeStarterKitValidator), status: v.optional(recipeStatusValidator), devBypassSecret: v.optional(v.string()), }, returns: v.null()`
- `recipes:updateStatus` — **mutation**, [source](../convex/recipes.ts#L342): `args: { id: v.id("recipes"), status: recipeStatusValidator, devBypassSecret: v.optional(v.string()), }, returns: v.null()`
- `recipes:generateFromHypothesis` — **action**, [source](../convex/recipes.ts#L432): `args: { hypothesisId: v.id("hypotheses"), model: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: v.object({ recipeId: v.id("recipes"), model: v.string(), generated: generatedRecipeValidator, })`
- `recipes:generateBatch` — **action**, [source](../convex/recipes.ts#L527): `args: { limit: v.optional(v.number()), model: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: v.array( v.union( v.object({ success: v.literal(true), recipeId: v.id("recipes"), model: v.string(), generated: generatedRecipeValidator, }), v.object({ success: v.literal(false), hypothesisId: v.id("hypotheses"), error: v.string(), }), ), )`
- `recipes:deleteById` — **mutation**, [source](../convex/recipes.ts#L616): `args: { id: v.id("recipes"), devBypassSecret: v.optional(v.string()) }, returns: v.null()`
- `hypothesesInternal:generateHypothesisText` — **internalAction**, [source](../convex/hypothesesInternal.ts#L11): `args: { system: v.string(), prompt: v.string(), model: v.string(), extractionId: v.id("extractions"), sourceId: v.id("sources"), promptVersion: v.string(), }, returns: v.object({ text: v.string() })`
- `hypotheses:listByStatus` — **query**, [source](../convex/hypotheses.ts#L121): `args: { status: v.optional(hypothesisStatusValidator), limit: v.optional(v.number()), }, returns: v.array(hypothesisReturnValidator)`
- `hypotheses:get` — **query**, [source](../convex/hypotheses.ts#L146): `args: { id: v.id("hypotheses") }, returns: v.union( v.object({ ...hypothesisReturnValidator.fields, sources: v.array(sourceReturnValidator), thesis: v.union(thesisReturnValidator, v.null()), }), v.null(), )`
- `hypotheses:getBySourceId` — **query**, [source](../convex/hypotheses.ts#L179): `args: { sourceId: v.id("sources") }, returns: v.array(hypothesisReturnValidator)`
- `hypotheses:listByThesis` — **query**, [source](../convex/hypotheses.ts#L188): `args: { thesisId: v.id("theses"), limit: v.optional(v.number()), }, returns: v.array(hypothesisReturnValidator)`
- `hypotheses:listMissingWhyThisMatters` — **query**, [source](../convex/hypotheses.ts#L206): `args: { limit: v.optional(v.number()) }, returns: v.array(hypothesisReturnValidator)`
- `hypotheses:create` — **mutation**, [source](../convex/hypotheses.ts#L226): `args: { title: v.string(), question: v.string(), hypothesis: v.string(), whyThisMatters: v.optional(v.string()), rationaleMd: v.string(), thesisId: v.optional(v.id("theses")), sourceIds: v.array(v.id("sources")), extractionIds: v.optional(v.array(v.id("extractions"))), concepts: v.optional(v.array(v.string())), devBypassSecret: v.optional(v.string()), }, returns: v.id("hypotheses")`
- `hypotheses:update` — **mutation**, [source](../convex/hypotheses.ts#L269): `args: { id: v.id("hypotheses"), title: v.optional(v.string()), question: v.optional(v.string()), hypothesis: v.optional(v.string()), whyThisMatters: v.optional(v.string()), rationaleMd: v.optional(v.string()), thesisId: v.optional(v.union(v.id("theses"), v.null())), sourceIds: v.optional(v.array(v.id("sources"))), concepts: v.optional(v.array(v.string())), status: v.optional(hypothesisStatusValidator), resolution: v.optional( v.union( v.literal("supported"), v.literal("inconclusive"), v.literal("contradicted"), ), ), devBypassSecret: v.optional(v.string()), }, returns: v.null()`
- `hypotheses:updateStatus` — **mutation**, [source](../convex/hypotheses.ts#L381): `args: { id: v.id("hypotheses"), status: hypothesisStatusValidator, resolution: v.optional( v.union( v.literal("supported"), v.literal("inconclusive"), v.literal("contradicted"), ), ), devBypassSecret: v.optional(v.string()), }, returns: v.null()`
- `hypotheses:generateFromExtraction` — **action**, [source](../convex/hypotheses.ts#L457): `args: { extractionId: v.id("extractions"), model: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: v.object({ hypothesisId: v.id("hypotheses"), model: v.string(), generated: v.object({ title: v.string(), question: v.string(), hypothesis: v.string(), whyThisMatters: v.string(), rationaleMd: v.string(), concepts: v.optional(v.array(v.string())), }), })`
- `hypotheses:listUnlinkedBatchCandidates` — **internalQuery**, [source](../convex/hypotheses.ts#L574): `args: { limit: v.number(), minClaims: v.number() }, returns: v.array(extractionReturnValidator)`
- `hypotheses:generateBatch` — **action**, [source](../convex/hypotheses.ts#L600): `args: { limit: v.optional(v.number()), minClaims: v.optional(v.number()), model: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: v.array( v.union( v.object({ success: v.literal(true), hypothesisId: v.id("hypotheses"), model: v.string(), generated: v.object({ title: v.string(), question: v.string(), hypothesis: v.string(), whyThisMatters: v.string(), rationaleMd: v.string(), concepts: v.optional(v.array(v.string())), }), }), v.object({ success: v.literal(false), extractionId: v.id("extractions"), error: v.string(), }), ), )`
- `hypotheses:deleteById` — **mutation**, [source](../convex/hypotheses.ts#L666): `args: { id: v.id("hypotheses"), devBypassSecret: v.optional(v.string()) }, returns: v.null()`
- `extract:extractSource` — **action**, [source](../convex/extract.ts#L108): `args: { sourceId: v.id("sources"), model: v.optional(v.string()), force: v.optional(v.boolean()), devBypassSecret: v.optional(v.string()), }, returns: v.union( v.object({ skipped: v.literal(true), reason: v.string(), }), v.object({ success: v.literal(true), model: v.string(), summary: v.string(), claimCount: v.number(), parameterCount: v.number(), }), )`
- `extract:extractAllReady` — **action**, [source](../convex/extract.ts#L279): `args: { limit: v.optional(v.number()), model: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: v.object({ results: v.array( v.object({ id: v.string(), title: v.string(), success: v.boolean(), error: v.optional(v.string()), summary: v.optional(v.string()), model: v.optional(v.string()), }), ), processed: v.number(), })`
- `extract:listModels` — **action**, [source](../convex/extract.ts#L346): `args: {}, returns: v.object({ fast: v.string(), default: v.string(), quality: v.string(), sonnet: v.string(), haiku: v.string(), gemini: v.string(), gpt4: v.string(), deepseek: v.string(), grok: v.string(), })`
- `conceptClassifierInternal:generateClassifications` — **internalAction**, [source](../convex/conceptClassifierInternal.ts#L10): `args: { system: v.string(), prompt: v.string(), model: v.string(), expectedCount: v.number(), }, returns: v.object({ classifications: v.array( v.object({ index: v.number(), classification: v.object({ domains: v.array(v.string()), missionRelevance: v.union(v.literal("on"), v.literal("off")), rationale: v.string(), }), }), ), failed: v.number(), inputTokens: v.number(), outputTokens: v.number(), })`
- `conceptClassifier:writeClassifications` — **mutation**, [source](../convex/conceptClassifier.ts#L246): `args: { classifications: v.array(classificationValidator), model: v.string(), force: v.boolean(), devBypassSecret: v.optional(v.string()), }, returns: writeResultValidator`
- `conceptClassifier:writeClassificationsInternal` — **internalMutation**, [source](../convex/conceptClassifier.ts#L260): `args: { classifications: v.array(classificationValidator), model: v.string(), force: v.boolean(), }, returns: writeResultValidator`
- `conceptClassifier:listClassificationCandidates` — **query**, [source](../convex/conceptClassifier.ts#L270): `args: { cursor: v.union(v.string(), v.null()), batchSize: v.number(), force: v.boolean(), devBypassSecret: v.optional(v.string()), }, returns: v.object({ conceptIds: v.array(v.id("concepts")), isDone: v.boolean(), continueCursor: v.string(), })`
- `conceptClassifier:getClassificationInputs` — **internalQuery**, [source](../convex/conceptClassifier.ts#L298): `args: { conceptIds: v.array(v.id("concepts")), force: v.boolean(), }, returns: v.object({ domains: v.array( v.object({ name: v.string(), description: v.optional(v.string()), }), ), concepts: v.array( v.object({ conceptId: v.id("concepts"), displayName: v.string(), aliases: v.array(v.string()), description: v.optional(v.string()), coMentionedConcepts: v.array(v.string()), }), ), })`
- `conceptClassifier:classifyConceptBatch` — **internalAction**, [source](../convex/conceptClassifier.ts#L384): `args: { conceptIds: v.array(v.id("concepts")), model: v.optional(v.string()), force: v.optional(v.boolean()), apply: v.optional(v.boolean()), }, returns: batchResultValidator`
- `conceptClassifier:classifyConcepts` — **action**, [source](../convex/conceptClassifier.ts#L469): `args: { conceptIds: v.array(v.id("concepts")), model: v.optional(v.string()), force: v.boolean(), apply: v.boolean(), devBypassSecret: v.optional(v.string()), }, returns: batchResultValidator`
- `conceptClassifier:listStaleUnreviewed` — **internalQuery**, [source](../convex/conceptClassifier.ts#L489): `args: { cutoff: v.number(), limit: v.number() }, returns: v.array(v.id("concepts"))`
- `conceptClassifier:sweepUnreviewedConcepts` — **internalAction**, [source](../convex/conceptClassifier.ts#L505): `args: {}, returns: v.object({ scheduled: v.number() })`
- `agentRuns:create` — **internalMutation**, [source](../convex/agentRuns.ts#L298): `args: { graphName: v.string(), input: v.optional(v.any()), traceUrl: v.optional(v.string()), }`
- `agentRuns:enqueue` — **internalMutation**, [source](../convex/agentRuns.ts#L308): `args: { graphName: v.string(), input: v.optional(v.any()), traceUrl: v.optional(v.string()), }`
- `agentRuns:claimNextPending` — **internalMutation**, [source](../convex/agentRuns.ts#L325): `args: { workerId: v.string(), graphName: v.optional(v.string()) }, returns: zodToConvex(claimedAgentRunZ.nullable())`
- `agentRuns:getForWorker` — **internalQuery**, [source](../convex/agentRuns.ts#L389): `args: { runId: v.id("agentRuns") }`
- `agentRuns:sweepStaleRuns` — **internalMutation**, [source](../convex/agentRuns.ts#L407): `args: { thresholdMs: v.optional(v.number()) }`
- `agentRuns:markRunning` — **internalMutation**, [source](../convex/agentRuns.ts#L441): `args: { runId: v.id("agentRuns"), }`
- `agentRuns:appendEvent` — **internalMutation**, [source](../convex/agentRuns.ts#L470): `args: { runId: v.id("agentRuns"), kind: agentRunEventKindValidator, message: v.string(), payload: v.optional(v.any()), }`
- `agentRuns:markNeedsReview` — **internalMutation**, [source](../convex/agentRuns.ts#L485): `args: { runId: v.id("agentRuns"), summary: v.optional(v.string()), reviewDraft: v.optional(v.any()), }`
- `agentRuns:markCompleted` — **internalMutation**, [source](../convex/agentRuns.ts#L520): `args: { runId: v.id("agentRuns"), summary: v.optional(v.string()), traceUrl: v.optional(v.string()), }`
- `agentRuns:reconcileReviewedRuns` — **internalMutation**, [source](../convex/agentRuns.ts#L547): `args: { limit: v.optional(v.number()), cursor: v.optional(v.string()), }, returns: v.object({ scanned: v.number(), reconciled: v.number(), stillPending: v.number(), cursor: v.union(v.string(), v.null()), isDone: v.boolean(), })`
- `agentRuns:markFailed` — **internalMutation**, [source](../convex/agentRuns.ts#L584): `args: { runId: v.id("agentRuns"), summary: v.optional(v.string()), error: v.optional(v.any()), traceUrl: v.optional(v.string()), }`
- `agentRuns:get` — **query**, [source](../convex/agentRuns.ts#L622): `args: { runId: v.id("agentRuns"), devBypassSecret: v.optional(v.string()) }`
- `agentRuns:listRecent` — **query**, [source](../convex/agentRuns.ts#L632): `args: { limit: v.optional(v.number()), status: v.optional(agentRunStatusValidator), graphName: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }`
- `agentRuns:listRecentPublic` — **query**, [source](../convex/agentRuns.ts#L646): `args: { limit: v.optional(v.number()), status: v.optional(agentRunStatusValidator), graphName: v.optional(v.string()), }`
- `agentRuns:getPublic` — **query**, [source](../convex/agentRuns.ts#L658): `args: { runId: v.id("agentRuns") }`
- `agentRuns:opsStatusCountsPage` — **internalQuery**, [source](../convex/agentRuns.ts#L671): `args: { cursor: v.union(v.string(), v.null()), pageSize: v.optional(v.number()), }`
- `agentRuns:statusCountsPublic` — **query**, [source](../convex/agentRuns.ts#L713): `args: { limit: v.optional(v.number()), graphName: v.optional(v.string()) }`
- `agentRuns:listEventsPublic` — **query**, [source](../convex/agentRuns.ts#L735): `args: { runId: v.id("agentRuns"), limit: v.optional(v.number()), }`
- `agentRuns:statusCounts` — **query**, [source](../convex/agentRuns.ts#L751): `args: { limit: v.optional(v.number()), graphName: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }`
- `agentRuns:listByStatus` — **query**, [source](../convex/agentRuns.ts#L778): `args: { status: agentRunStatusValidator, limit: v.optional(v.number()), devBypassSecret: v.optional(v.string()), }`
- `agentRuns:listEvents` — **query**, [source](../convex/agentRuns.ts#L794): `args: { runId: v.id("agentRuns"), limit: v.optional(v.number()), devBypassSecret: v.optional(v.string()), }`
- `agentDrafts:createFromAgentRun` — **internalMutation**, [source](../convex/agentDrafts.ts#L252): `args: { agentRunId: v.id("agentRuns"), draft: v.any(), }`
- `agentDrafts:listByRunPublic` — **query**, [source](../convex/agentDrafts.ts#L351): `args: { agentRunId: v.id("agentRuns"), limit: v.optional(v.number()), }`
- `agentDrafts:listByRun` — **query**, [source](../convex/agentDrafts.ts#L370): `args: { agentRunId: v.id("agentRuns"), limit: v.optional(v.number()), devBypassSecret: v.optional(v.string()), }`
- `agentDrafts:listPending` — **query**, [source](../convex/agentDrafts.ts#L426): `args: { limit: v.optional(v.number()), devBypassSecret: v.optional(v.string()), }`
- `agentDrafts:listPendingPublic` — **query**, [source](../convex/agentDrafts.ts#L438): `args: { limit: v.optional(v.number()), devBypassSecret: v.optional(v.string()), }`
- `agentDrafts:getReviewContext` — **query**, [source](../convex/agentDrafts.ts#L545): `args: { draftId: v.id("agentReviewDrafts"), devBypassSecret: v.optional(v.string()), }`
- `agentDrafts:countPendingPublic` — **query**, [source](../convex/agentDrafts.ts#L637): `args: {}`
- `agentDrafts:countPendingHypothesesPublic` — **query**, [source](../convex/agentDrafts.ts#L649): `args: {}`
- `agentDrafts:countPending` — **internalQuery**, [source](../convex/agentDrafts.ts#L663): `args: { kind: v.union(v.literal("hypothesis_draft"), v.literal("recipe_draft")), }`
- `agentDrafts:listDraftableCorrespondences` — **internalQuery**, [source](../convex/agentDrafts.ts#L675): `args: { limit: v.optional(v.number()) }`
- `agentDrafts:approve` — **mutation**, [source](../convex/agentDrafts.ts#L772): `args: { draftId: v.id("agentReviewDrafts"), decisionNote: v.optional(v.string()), amendedPayload: v.optional(agentReviewDraftPayloadValidator), devBypassSecret: v.optional(v.string()), }, returns: v.object({ draftId: v.id("agentReviewDrafts"), promotedId: v.union(v.id("hypotheses"), v.id("recipes")), promotedKind: v.union(v.literal("hypothesis"), v.literal("recipe")), })`
- `agentDrafts:reject` — **mutation**, [source](../convex/agentDrafts.ts#L921): `args: { draftId: v.id("agentReviewDrafts"), decisionNote: v.string(), devBypassSecret: v.optional(v.string()), }, returns: v.object({ draftId: v.id("agentReviewDrafts"), status: v.literal("rejected"), })`
- `agentDrafts:supersede` — **mutation**, [source](../convex/agentDrafts.ts#L960): `args: { draftId: v.id("agentReviewDrafts"), byDraftId: v.id("agentReviewDrafts"), decisionNote: v.optional(v.string()), devBypassSecret: v.optional(v.string()), }, returns: v.object({ draftId: v.id("agentReviewDrafts"), status: v.literal("superseded"), byDraftId: v.id("agentReviewDrafts"), })`

## Candidate schema validator details

The compact notation below transcribes the cached candidate schema's complete
`documentType` validators (`?` means optional, `/` means a union). It is candidate
structure, not row contents. Ordinary index field sequences and search/vector
configuration are included because descriptor names alone cannot establish
index equivalence. System fields are implicit in Convex. No live schema has
been substituted from historical source.

### root document validators

- **users**: `{clerkUserId: string, email?: string, displayName?: string, role: ("admin" / "collaborator" / "follower"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_clerkUserId","fields":["clerkUserId"]}]}`
- **agentRuns**: `{graphName: string, status: ("queued" / "running" / "needs_review" / "completed" / "failed" / "cancelled"), input: any, summary?: string, traceUrl?: string, reviewDraft?: {kind: ("dry_run_summary" / "hypothesis_draft" / "recipe_draft"), title: string, summary: string, candidateIds: Array<string>, needsReview: boolean}, startedAt?: number, finishedAt?: number, workerId?: string, createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_graphName_updatedAt","fields":["graphName","updatedAt"]},{"indexDescriptor":"by_status_graphName_updatedAt","fields":["status","graphName","updatedAt"]},{"indexDescriptor":"by_updatedAt","fields":["updatedAt"]}]}`
- **agentRunEvents**: `{runId: Id<agentRuns>, kind: ("tool_call" / "decision" / "draft_write" / "error" / "review_request" / "status" / "node" / "memory_recall" / "model_call"), message: string, payload?: any, createdAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_runId_createdAt","fields":["runId","createdAt"]}]}`
- **agentReviewDrafts**: `{agentRunId: Id<agentRuns>, graphName: string, kind: ("hypothesis_draft" / "recipe_draft"), title: string, summary: string, candidateIds: Array<string>, payload?: ({title: string, question: string, statement: string, rationale: string, whyThisMatters: string, concepts?: Array<string>, sourceIds: Array<Id<sources>>, extractionIds: Array<Id<extractions>>, correspondenceId?: Id<correspondences>, thesisId?: Id<theses>, confidence?: number} / {hypothesisId?: Id<hypotheses>, title: string, parameters: Array<{kind?: string, type?: string, value: string, details?: any, registryStatus?: ("known" / "provisional" / "experimental" / "deprecated"), canonicalKind?: string}>, protocol?: {studyType: ("litmus" / "comparison"), durationSecs: number, panelPlanned: Array<string>, listeningContext?: string, listeningMethod?: string, baselineArtifactId?: Id<compositions>, whatVaries: Array<string>, whatStaysConstant: Array<string>}, whyThisMatters: string, bodyMd?: string, dawChecklist?: Array<string>, instrumentationNotes?: string}), amendedPayload?: ({title: string, question: string, statement: string, rationale: string, whyThisMatters: string, concepts?: Array<string>, sourceIds: Array<Id<sources>>, extractionIds: Array<Id<extractions>>, correspondenceId?: Id<correspondences>, thesisId?: Id<theses>, confidence?: number} / {hypothesisId?: Id<hypotheses>, title: string, parameters: Array<{kind?: string, type?: string, value: string, details?: any, registryStatus?: ("known" / "provisional" / "experimental" / "deprecated"), canonicalKind?: string}>, protocol?: {studyType: ("litmus" / "comparison"), durationSecs: number, panelPlanned: Array<string>, listeningContext?: string, listeningMethod?: string, baselineArtifactId?: Id<compositions>, whatVaries: Array<string>, whatStaysConstant: Array<string>}, whyThisMatters: string, bodyMd?: string, dawChecklist?: Array<string>, instrumentationNotes?: string}), status: ("pending_review" / "approved" / "rejected" / "superseded"), createdBy: "agent", decidedAt?: number, decidedBy?: "human", decisionNote?: string, promotedId?: string, createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_agentRunId_updatedAt","fields":["agentRunId","updatedAt"]},{"indexDescriptor":"by_agentRunId_status_updatedAt","fields":["agentRunId","status","updatedAt"]},{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_status_kind_updatedAt","fields":["status","kind","updatedAt"]},{"indexDescriptor":"by_graphName_updatedAt","fields":["graphName","updatedAt"]}]}`
- **editCaptures**: `{entityType: ("extraction" / "hypothesis" / "weeklyBrief"), entityId: string, promptVersion?: string, model?: string, generated: any, edited: any, editedAt: number, exported?: boolean}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_exported_editedAt","fields":["exported","editedAt"]}]}`
- **sources**: `{type: ("notion" / "rss" / "url" / "youtube" / "pdf" / "podcast"), title?: string, author?: string, publishedAt?: number, canonicalUrl?: string, notionPageId?: string, rssGuid?: string, feedUrl?: string, youtubeVideoId?: string, uploadThingUrl?: string, rawText?: string, rawTextSha256?: string, transcript?: string, tags?: Array<string>, topics?: Array<string>, metadata?: any, status: ("ingested" / "text_ready" / "extracting" / "extracted" / "review_needed" / "triaged" / "promoted_followers" / "promoted_public" / "archived"), blockedReason?: ("no_text" / "copyright" / "needs_metadata" / "needs_tagging" / "ai_error" / "needs_human_review" / "duplicate"), blockedDetails?: string, openQuestions?: Array<string>, confidence?: number, dedupeKey: string, visibility: ("private" / "followers" / "public"), createdBy: (Id<users> / "system"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_visibility_updatedAt","fields":["visibility","updatedAt"]},{"indexDescriptor":"by_type_updatedAt","fields":["type","updatedAt"]},{"indexDescriptor":"by_dedupeKey","fields":["dedupeKey"]},{"indexDescriptor":"by_notionPageId","fields":["notionPageId"]},{"indexDescriptor":"by_canonicalUrl","fields":["canonicalUrl"]},{"indexDescriptor":"by_createdAt","fields":["createdAt"]}]}`
- **feeds**: `{name: string, url: string, type: ("rss" / "podcast" / "youtube"), category?: string, enabled: boolean, lastPolledAt?: number, lastItemAt?: number, pollIntervalMs?: number, metadata?: any, createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_enabled","fields":["enabled"]},{"indexDescriptor":"by_type","fields":["type"]},{"indexDescriptor":"by_url","fields":["url"]}]}`
- **extractions**: `{sourceId: Id<sources>, model: string, promptVersion: string, inputHash: string, summary: string, claims: Array<{text: string, evidenceLevel: ("peer_reviewed" / "preprint" / "anecdotal" / "speculative" / "personal"), truthConfidence?: ("low" / "medium" / "high"), interestLevel?: ("low" / "medium" / "high"), citations: Array<{label?: string, url?: string, quote?: string}>}>, compositionParameters: Array<{kind?: string, type?: string, value: string, details?: any, registryStatus?: ("known" / "provisional" / "experimental" / "deprecated"), canonicalKind?: string}>, topics: Array<string>, openQuestions: Array<string>, confidence: number, createdBy: (Id<users> / "system"), createdAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_sourceId_createdAt","fields":["sourceId","createdAt"]},{"indexDescriptor":"by_inputHash","fields":["inputHash"]}]}`
- **claims**: `{extractionId: Id<extractions>, sourceId: Id<sources>, ordinal: number, text: string, evidenceLevel: ("peer_reviewed" / "preprint" / "anecdotal" / "speculative" / "personal"), truthConfidence?: ("low" / "medium" / "high"), interestLevel?: ("low" / "medium" / "high"), citations: Array<{label?: string, url?: string, quote?: string}>, status: ("active" / "superseded"), supersededBy?: Id<claims>, embedding?: Array<number>, embeddingModel?: string, createdBy: (Id<users> / "system"), createdAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_extractionId_ordinal","fields":["extractionId","ordinal"]},{"indexDescriptor":"by_sourceId","fields":["sourceId"]},{"indexDescriptor":"by_sourceId_status","fields":["sourceId","status"]},{"indexDescriptor":"by_status","fields":["status"]}],"vectorIndexes":[{"indexDescriptor":"by_embedding","vectorField":"embedding","dimensions":1536,"filterFields":["status","sourceId"]}]}`
- **correspondences**: `{conceptAId: Id<concepts>, conceptBId: Id<concepts>, pairKey: string, statement: string, rationaleMd: string, relationship?: string, evidence: Array<{claimId: Id<claims>, stance: ("supports" / "contradicts"), note?: string, addedBy: ("agent" / "human"), addedAt: number}>, status: ("conjectured" / "evidenced" / "contradicted" / "retired"), statusReason?: string, statusChangedAt?: number, similarityScore?: number, noveltyScore?: number, origin?: "agent", agentRunId?: Id<agentRuns>, agentDraftId?: Id<agentReviewDrafts>, traceUrl?: string, approvedWithEdits?: true, editedFields?: Array<string>, createdBy: (Id<users> / "system"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_pairKey","fields":["pairKey"]},{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_conceptAId","fields":["conceptAId"]},{"indexDescriptor":"by_conceptBId","fields":["conceptBId"]}]}`
- **theses**: `{title: string, statement: string, descriptionMd?: string, status: ("active" / "paused" / "retired"), visibility: ("private" / "followers" / "public"), createdBy: (Id<users> / "system"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_visibility_updatedAt","fields":["visibility","updatedAt"]}]}`
- **campaigns**: `{title: string, question: string, descriptionMd?: string, status: ("active" / "paused" / "completed"), thesisIds: Array<Id<theses>>, startedAt?: number, endedAt?: number, summaryMd?: string, visibility: ("private" / "followers" / "public"), createdBy: (Id<users> / "system"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_visibility_updatedAt","fields":["visibility","updatedAt"]}]}`
- **hypotheses**: `{title: string, question: string, hypothesis: string, whyThisMatters?: string, rationaleMd: string, correspondenceId?: Id<correspondences>, thesisId?: Id<theses>, sourceIds: Array<Id<sources>>, extractionIds?: Array<Id<extractions>>, concepts?: Array<string>, status: ("draft" / "queued" / "active" / "evaluated" / "revised" / "retired"), resolution?: ("supported" / "inconclusive" / "contradicted"), versionOfId?: Id<hypotheses>, openQuestions?: Array<string>, origin?: "agent", agentRunId?: Id<agentRuns>, agentDraftId?: Id<agentReviewDrafts>, traceUrl?: string, approvedWithEdits?: true, editedFields?: Array<string>, visibility: ("private" / "followers" / "public"), createdBy: (Id<users> / "system"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_visibility_updatedAt","fields":["visibility","updatedAt"]},{"indexDescriptor":"by_correspondenceId","fields":["correspondenceId"]},{"indexDescriptor":"by_thesisId_updatedAt","fields":["thesisId","updatedAt"]},{"indexDescriptor":"by_extractionIds","fields":["extractionIds"]}]}`
- **recipes**: `{hypothesisId: Id<hypotheses>, title: string, whyThisMatters?: string, bodyMd: string, parameters: Array<{kind?: string, type?: string, value: string, details?: any, registryStatus?: ("known" / "provisional" / "experimental" / "deprecated"), canonicalKind?: string}>, dawChecklist: Array<string>, protocol?: {studyType: ("litmus" / "comparison"), durationSecs: number, panelPlanned: Array<string>, listeningContext?: string, listeningMethod?: string, baselineArtifactId?: Id<compositions>, whatVaries: Array<string>, whatStaysConstant: Array<string>}, verification?: {passed: boolean, checks: Array<{name: string, passed: boolean, detail?: string}>, notes?: string, artifacts: Array<string>, verifiedAt: number}, starterKit?: {generatedAt: number, path: string, manifest: Array<string>}, status: ("draft" / "in_use" / "archived"), origin?: "agent", agentRunId?: Id<agentRuns>, agentDraftId?: Id<agentReviewDrafts>, traceUrl?: string, approvedWithEdits?: true, editedFields?: Array<string>, visibility: ("private" / "followers" / "public"), createdBy: (Id<users> / "system"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_hypothesisId_updatedAt","fields":["hypothesisId","updatedAt"]},{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]}]}`
- **compositions**: `{title: string, recipeId: Id<recipes>, artifactType: ("microStudy" / "expandedStudy" / "fullTrack"), projectNotesMd?: string, links?: Array<{label: string, url: string}>, version: string, diffNote?: string, versionOfId?: Id<compositions>, revisionParentId?: Id<compositions>, revisionVariable?: string, status: ("idea" / "in_progress" / "rendered" / "published"), visibility: ("private" / "followers" / "public"), createdBy: (Id<users> / "system"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_recipeId_updatedAt","fields":["recipeId","updatedAt"]},{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_revisionParentId_updatedAt","fields":["revisionParentId","updatedAt"]}]}`
- **listeningSessions**: `{compositionId: Id<compositions>, participants: Array<{name?: string, userId?: Id<users>, role?: string}>, contextMd?: string, ratings: {bodilyPleasantness?: number, goosebumps?: number, perceivedConsonance?: number, musicality?: number, easeOfComposability?: number, consonanceComputed?: number, expandability?: number}, feedbackMd: string, bodyMapNotes?: string, feltQualities?: Array<string>, bodyMapTags?: Array<string>, standoutMoments?: Array<string>, expandVerdict?: ("yes" / "maybe" / "no"), visibility: ("private" / "followers" / "public"), createdBy: (Id<users> / "system"), createdAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_compositionId_createdAt","fields":["compositionId","createdAt"]}]}`
- **weeklyBriefs**: `{weekOf: string, model: string, promptVersion: string, bodyMd: string, sourceIds: Array<Id<sources>>, campaignId?: Id<campaigns>, recommendedHypothesisIds: Array<Id<hypotheses>>, recommendedRecipeIds: Array<Id<recipes>>, activeThesisIds?: Array<Id<theses>>, referencedFailureKeys?: Array<string>, studioPrompts?: {tenMinuteMd: string, thirtyMinuteMd: string, ninetyMinuteMd: string}, recommendedActions?: Array<{kind: ("advance_recipe" / "revive_recipe" / "expand_composition" / "compare_branch" / "prototype_hypothesis"), targetType: ("hypothesis" / "recipe" / "composition"), targetId: string, durationBucket: ("10-minute" / "30-minute" / "90-minute"), reason: string}>, loopReport?: {correspondences: {newConjectures: number, gainedEvidence: number, contradicted: number, autoRetired: number, countsCapped?: boolean, topMovers: Array<{correspondenceId: Id<correspondences>, statement: string, status: string, evidenceDelta: number}>}, reviewQueue: {pendingDrafts: number, cap: number, agentBlocked: boolean, oldestPendingDays?: number}, experimentDebt: Array<{recipeId: Id<recipes>, title: string, state: ("in_use_no_composition" / "composed_no_listening"), ageDays: number}>, proposedFeeds: Array<{feedId: Id<feeds>, name: string, url: string, rationale: string}>, proposedFeedsCapped?: boolean}, todo?: Array<string>, visibility: ("private" / "followers" / "public"), publishedAt?: number, notionPageId?: string, createdBy: (Id<users> / "system"), createdAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_weekOf","fields":["weekOf"]},{"indexDescriptor":"by_visibility_createdAt","fields":["visibility","createdAt"]}]}`
- **stats**: `{key: string, value: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_key","fields":["key"]}]}`
- **editorialArtifacts**: `{kind: ("experiment_recap" / "what_changed_my_mind" / "campaign_summary" / "thesis_summary"), slug: string, title: string, dek: string, bodyMd: string, whyItMattersMd: string, uncertaintyMd: string, whatChangedMd?: string, evidenceStatus: ("supported" / "mixed" / "speculative"), status: ("draft" / "in_review" / "approved" / "published"), visibility: ("private" / "followers" / "public"), primaryRef: ({type: "weeklyBrief", id: Id<weeklyBriefs>} / {type: "campaign", id: Id<campaigns>} / {type: "thesis", id: Id<theses>} / {type: "hypothesis", id: Id<hypotheses>}), linkedIds: {thesisIds: Array<Id<theses>>, hypothesisIds: Array<Id<hypotheses>>, recipeIds: Array<Id<recipes>>, compositionIds: Array<Id<compositions>>, listeningSessionIds: Array<Id<listeningSessions>>, failureKeys: Array<string>}, publicEvidenceCards: Array<{sourceTitle: string, sourceCanonicalUrl?: string, summary: string, evidenceLevel: ("peer_reviewed" / "preprint" / "anecdotal" / "speculative" / "personal"), truthConfidence?: ("low" / "medium" / "high"), interestLevel?: ("low" / "medium" / "high")}>, astro?: {exportPath?: string, exportSha?: string, exportedAt?: number}, notionPageId?: string, publishedAt?: number, createdBy: (Id<users> / "system"), createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_slug","fields":["slug"]},{"indexDescriptor":"by_status_updatedAt","fields":["status","updatedAt"]},{"indexDescriptor":"by_visibility_updatedAt","fields":["visibility","updatedAt"]},{"indexDescriptor":"by_kind_updatedAt","fields":["kind","updatedAt"]}]}`
- **parameterKinds**: `{name: string, status: ("known" / "provisional" / "experimental" / "deprecated"), description?: string, introducedBy: (Id<users> / "system"), displayLabel?: string, color?: string, notes?: string, decidedAt?: number, decidedBy?: string, decisionNote?: string, mergedInto?: string, createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_name","fields":["name"]},{"indexDescriptor":"by_status","fields":["status"]}]}`
- **conceptDomains**: `{name: string, status: ("known" / "provisional" / "experimental" / "deprecated"), description?: string, introducedBy: (Id<users> / "system"), displayLabel?: string, color?: string, sectorMapping?: string, notes?: string, decidedAt?: number, decidedBy?: string, decisionNote?: string, mergedInto?: string, createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_name","fields":["name"]},{"indexDescriptor":"by_status","fields":["status"]},{"indexDescriptor":"by_sectorMapping","fields":["sectorMapping"]}]}`
- **relationshipKinds**: `{name: string, status: ("known" / "provisional" / "experimental" / "deprecated"), description?: string, introducedBy: (Id<users> / "system"), displayLabel?: string, color?: string, directional?: boolean, symmetric?: boolean, notes?: string, decidedAt?: number, decidedBy?: string, decisionNote?: string, mergedInto?: string, createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_name","fields":["name"]},{"indexDescriptor":"by_status","fields":["status"]}]}`
- **concepts**: `{name: string, displayName: string, description?: string, aliases: Array<string>, domain: string, domains?: Array<string>, missionRelevance?: ("on" / "off" / "unreviewed"), relevanceRationale?: string, classifiedAt?: number, classifierModel?: string, embedding?: Array<number>, embeddingModel?: string, lastProbedAt?: number, wikipedia?: string, definitionSource?: Id<sources>, mentionCount: number, hypothesisCount: number, createdAt: number, updatedAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_name","fields":["name"]},{"indexDescriptor":"by_domain","fields":["domain"]},{"indexDescriptor":"by_missionRelevance","fields":["missionRelevance"]},{"indexDescriptor":"by_missionRelevance_lastProbedAt","fields":["missionRelevance","lastProbedAt"]},{"indexDescriptor":"by_mentionCount","fields":["mentionCount"]}],"searchIndexes":[{"indexDescriptor":"search_concepts","searchField":"displayName","filterFields":["domain"]}],"vectorIndexes":[{"indexDescriptor":"by_embedding","vectorField":"embedding","dimensions":1536,"filterFields":["missionRelevance","domain"]}]}`
- **edges**: `{fromType: ("source" / "extraction" / "hypothesis" / "recipe" / "concept" / "composition"), fromId: string, toType: ("source" / "extraction" / "hypothesis" / "recipe" / "concept" / "composition"), toId: string, relationship: string, weight?: number, context?: string, autoGenerated: boolean, createdAt: number, createdBy: (Id<users> / "system")}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_from","fields":["fromType","fromId"]},{"indexDescriptor":"by_to","fields":["toType","toId"]},{"indexDescriptor":"by_to_fromType","fields":["toType","toId","fromType"]},{"indexDescriptor":"by_relationship","fields":["relationship"]},{"indexDescriptor":"by_fromType_relationship","fields":["fromType","relationship"]}]}`

### action-cache document validators

- **values**: `{name: string, args: any, value: any, metadataId?: Id<metadata>}`
  Index configuration: `{"indexes":[{"indexDescriptor":"key","fields":["name","args"]}]}`
- **metadata**: `{valueId: Id<values>, expiresAt: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"expiresAt","fields":["expiresAt"]}]}`

### aggregate document validators

- **btree**: `{root: Id<btreeNode>, namespace?: any, maxNodeSize: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"by_namespace","fields":["namespace"]}]}`
- **btreeNode**: `{items: Array<{k: any, v: any, s: number}>, subtrees: Array<Id<btreeNode>>, aggregate?: {count: number, sum: number}}`

### workflow document validators

- **config**: `{logLevel?: ("DEBUG" / "TRACE" / "INFO" / "REPORT" / "WARN" / "ERROR"), maxParallelism?: number}`
- **workflows**: `{name?: string, workflowHandle: string, args: any, onComplete?: {fnHandle: string, context?: any}, logLevel?: any, startedAt?: any, state?: any, runResult?: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), generationNumber: number}`
  Index configuration: `{"indexes":[{"indexDescriptor":"name","fields":["name"]}]}`
- **steps**: `{workflowId: Id<workflows>, stepNumber: number, step: ({kind?: "function", functionType: ("query" / "mutation" / "action"), handle: string, workId?: string, name: string, inProgress: boolean, argsSize: number, args: any, runResult?: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), startedAt: number, completedAt?: number} / {kind: "workflow", handle: string, workflowId?: Id<workflows>, name: string, inProgress: boolean, argsSize: number, args: any, runResult?: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), startedAt: number, completedAt?: number} / {kind: "event", name: string, inProgress: boolean, argsSize: number, args: {eventId?: Id<events>}, runResult?: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), startedAt: number, completedAt?: number, eventId?: Id<events>} / {kind: "sleep", workId?: string, name: string, inProgress: boolean, argsSize: number, args: any, runResult?: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), startedAt: number, completedAt?: number})}`
  Index configuration: `{"indexes":[{"indexDescriptor":"workflow","fields":["workflowId","stepNumber"]},{"indexDescriptor":"inProgress","fields":["step.inProgress","workflowId"]}]}`
- **events**: `{workflowId: Id<workflows>, name: string, state: ({kind: "created"} / {kind: "sent", result: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), sentAt: number} / {kind: "waiting", waitingAt: number, stepId: Id<steps>} / {kind: "consumed", waitingAt: number, sentAt: number, consumedAt: number, stepId: Id<steps>})}`
  Index configuration: `{"indexes":[{"indexDescriptor":"workflowId_state","fields":["workflowId","state.kind"]}]}`
- **onCompleteFailures**: `({workId?: string, workflowId?: string, result: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), context: any} / {workflowId: Id<workflows>, generationNumber: number, runResult: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), error: string})`

### workpool document validators

- **globals**: `{maxParallelism: number, logLevel: ("DEBUG" / "TRACE" / "INFO" / "REPORT" / "WARN" / "ERROR")}`
- **internalState**: `{generation: bigint, segmentCursors: {incoming: bigint, completion: bigint, cancelation: bigint}, lastRecovery: bigint, report: {completed: number, succeeded: number, failed: number, retries: number, canceled: number, lastReportTs: number}, running: Array<{workId: Id<work>, scheduledId: Id<_scheduled_functions>, started: number}>}`
- **runStatus**: `{state: ({kind: "running"} / {kind: "scheduled", segment: bigint, scheduledId: Id<_scheduled_functions>, saturated: boolean, generation: bigint} / {kind: "idle", generation: bigint})}`
- **work**: `{fnType: ("action" / "mutation" / "query"), fnHandle: string, fnName: string, fnArgs: any, attempts: number, onComplete?: {fnHandle: string, context?: any}, retryBehavior?: {maxAttempts: number, initialBackoffMs: number, base: number}, canceled?: boolean}`
- **pendingStart**: `{workId: Id<work>, segment: bigint}`
  Index configuration: `{"indexes":[{"indexDescriptor":"workId","fields":["workId"]},{"indexDescriptor":"segment","fields":["segment"]}]}`
- **pendingCompletion**: `{segment: bigint, runResult: ({kind: "success", returnValue: any} / {kind: "failed", error: string} / {kind: "canceled"}), workId: Id<work>, retry: boolean}`
  Index configuration: `{"indexes":[{"indexDescriptor":"workId","fields":["workId"]},{"indexDescriptor":"segment","fields":["segment"]}]}`
- **pendingCancelation**: `{segment: bigint, workId: Id<work>}`
  Index configuration: `{"indexes":[{"indexDescriptor":"workId","fields":["workId"]},{"indexDescriptor":"segment","fields":["segment"]}]}`

## Remaining protected comparison and approval gates

Before approving a backend release, the Mac coordinator must compare the actual
current deployed function types, visibility, argument and return validators,
module contents or supported semantic metadata, root schema/index definitions,
auth configuration, component definitions/dependencies/schema and cron schedules
against this exact candidate. Preserve scalar/hash or sanitized structural
evidence; exclude job payloads and secret values. Missing current-state coverage
is a gate, not permission to reconstruct it from Git history.

Review the resulting named semantic changes and index/data compatibility with
the service owner. Confirm a deployment rollback artifact and its compatibility
with any schema/index changes, current worker contract and active workflows.
Obtain distinct live backend deployment authorization. Then verify the deployed
artifact and newly available internal ops query, full queue scalar evidence,
claim-pause behavior, admitted-job reconciliation and old-process cessation
under the handoff protocol before any worker cutover. The existing CT107 worker
and all live infrastructure remain untouched by this preparation.
