# Public API declaration inventory

[Surface crosswalk](surfaces.md) · [Feature map](../feature-map.md)

Snapshot `a9b728466f9254938e40761e012451b4d896825b`, 2026-10-22.

45 modules / 248 declarations. `q` = query, `m` = mutation, `a` = action. Module ownership points to the stage matrix containing intent and verification. “Public” is a Convex export kind, not anonymous access or a UI promise.

| Module / feature | Declared public functions |
| --- | --- |
| [admin](../../convex/admin.ts) — O05 | `workspaceSnapshot` (q), `listFeeds` (q), `createFeed` (m), `setFeedEnabled` (m), `setSourceStatus` (m), `promoteVisibility` (m), `pollFeedsNow` (a) |
| [agentDrafts](../../convex/agentDrafts.ts) — S03 | `listByRunPublic` (q), `listByRun` (q), `listPending` (q), `listPendingPublic` (q), `getReviewContext` (q), `countPendingPublic` (q), `countPendingHypothesesPublic` (q), `approve` (m), `reject` (m), `supersede` (m) |
| [agentRuns](../../convex/agentRuns.ts) — O01 | `get` (q), `listRecent` (q), `listRecentPublic` (q), `getPublic` (q), `statusCountsPublic` (q), `listEventsPublic` (q), `statusCounts` (q), `listByStatus` (q), `listEvents` (q) |
| [aggregates](../../convex/aggregates.ts) — R11 | `getTotalConceptCount` (q), `getTotalMentions` (q), `getTopConceptsRanked` (q), `getSourceCounts` (q), `getTotalSourceCount` (q) |
| [audioArtifacts](../../convex/audioArtifacts.ts) — M06 | `playback` (q), `listReadyForTarget` (q) |
| [audioFeedback](../../convex/audioFeedback.ts) — M07 | `item` (q), `queue` (q), `submit` (m), `forArtifact` (q) |
| [authFailures](../../convex/authFailures.ts) — O05 | `summary` (q) |
| [blindGroups](../../convex/blindGroups.ts) — M08/M09 | `projection` (q) |
| [campaigns](../../convex/campaigns.ts) — S07 | `list` (q), `listForSelection` (q), `get` (q), `getActive` (q), `getRecommendedActions` (q), `create` (m), `update` (m), `setActive` (m), `attachThesis` (m), `detachThesis` (m) |
| [claims](../../convex/claims.ts) — R10 | `listByExtraction` (q), `listBySource` (q), `getMany` (q) |
| [compositions](../../convex/compositions.ts) — M01/M02 | `list` (q), `get` (q), `getLineage` (q), `create` (m), `update` (m), `deleteById` (m) |
| [conceptClassifier](../../convex/conceptClassifier.ts) — R12 | `writeClassifications` (m), `listClassificationCandidates` (q), `classifyConcepts` (a) |
| [correspondences](../../convex/correspondences.ts) — R13 | `scoutTargets` (q), `upsertConjecture` (m), `addEvidence` (m), `setStatus` (m), `getByPairKey` (q), `listByStatus` (q), `get` (q), `listForConcept` (q), `listRecentMovement` (q) |
| [dashboard](../../convex/dashboard.ts) — R09/R11 | `pipeline` (q), `zodiacSectors` (q), `domainSubTopics` (q), `pipelineItems` (q), `conceptSectors` (q), `editorialSignals` (q), `itemRelations` (q), `activityFeed` (q) |
| [decisionIntents](../../convex/decisionIntents.ts) — O04 | `propose` (m), `get` (q), `applyWeb` (m), `cancelWeb` (m), `deferWeb` (m) |
| [docket](../../convex/docket.ts) — O04 | `listWeb` (q) |
| [editCaptures](../../convex/editCaptures.ts) — O06 | `listUnexported` (q), `markExported` (m) |
| [editorialArtifacts](../../convex/editorialArtifacts.ts) — S09 | `list` (q), `get` (q), `createDraftFromWeeklyBrief` (m), `createDraftFromCampaign` (m), `createDraftFromThesis` (m), `update` (m), `submitForReview` (m), `approve` (m), `publish` (m), `listPublicExport` (q), `getPublicExportBundle` (q), `setAstroExportMetadata` (m), `exportForAstro` (a) |
| [embeddings](../../convex/embeddings.ts) — R14 | `backfillBatch` (a), `probe` (a) |
| [extract](../../convex/extract.ts) — R08 | `extractSource` (a), `beginOperatorExtraction` (a), `storeOperatorExtraction` (a), `parkOperatorUnextractable` (a), `extractAllReady` (a), `listModels` (a) |
| [extractions](../../convex/extractions.ts) — R08/R10 | `get` (q), `getByInputHash` (q), `getBySourceId` (q), `listRecent` (q), `editExtraction` (m), `backfillClaims` (m), `startConceptBackfill` (m) |
| [fabric](../../convex/fabric.ts) — R01/R02 | `getYouTubeTranscript` (a), `fetchTranscriptForSource` (a), `fetchAllYouTubeTranscripts` (a), `fetchArticleText` (a), `fetchArticleForSource` (a) |
| [failures](../../convex/failures.ts) — S10 | `listArchive` (q), `getByKey` (q), `getByKeys` (q) |
| [feeds](../../convex/feeds.ts) — R04 | `listEnabled` (q), `list` (q), `get` (q), `getByIds` (q), `create` (m), `setEnabled` (m), `remove` (m) |
| [graph](../../convex/graph.ts) — R11 | `getConcept` (q), `searchConcepts` (q), `listByDomain` (q), `getTopConcepts` (q), `getEdgesFrom` (q), `getEdgesTo` (q), `getRelatedSources` (q), `getConceptsFor` (q), `searchSourcesByConcept` (q), `getConceptsForDomain` (q), `getConceptEdges` (q), `getConceptDetail` (q), `getConceptDetailPublic` (q), `exportForVisualization` (q) |
| [hypotheses](../../convex/hypotheses.ts) — S01/S02 | `listByStatus` (q), `get` (q), `getBySourceId` (q), `listByThesis` (q), `listMissingWhyThisMatters` (q), `create` (m), `update` (m), `updateStatus` (m), `generateFromExtraction` (a), `generateBatch` (a), `deleteById` (m) |
| [inbox](../../convex/inbox.ts) — R09 | `list` (q), `counts` (q) |
| [ingest](../../convex/ingest.ts) — R01/R02/R04 | `pollAllFeeds` (a), `ingestUrl` (a), `ingestYouTube` (a) |
| [listen](../../convex/listen.ts) — M09 | `shootouts` (q) |
| [listening](../../convex/listening.ts) — M03 | `listByComposition` (q), `listRecent` (q), `create` (m), `updateVisibility` (m), `deleteById` (m) |
| [operationFailures](../../convex/operationFailures.ts) — O02 | `listForRun` (q) |
| [passages](../../convex/passages.ts) — R14 | `probe` (a), `backfillBatch` (a) |
| [pdfCapture](../../convex/pdfCapture.ts) — R03 | `generatePdfUploadUrl` (m), `createFromPdfUpload` (m), `createFromPdfUrl` (m) |
| [podcast](../../convex/podcast.ts) — M10 | `subscription` (q) |
| [recipes](../../convex/recipes.ts) — S04/S05 | `listByStatus` (q), `get` (q), `getByHypothesisId` (q), `create` (m), `update` (m), `updateStatus` (m), `generateFromHypothesis` (a), `generateBatch` (a), `deleteById` (m) |
| [renders](../../convex/renders.ts) — M05 | `request` (m), `setPlan` (m), `validationGate` (q) |
| [settings](../../convex/settings.ts) — M09 | `houseVoice` (q), `setHouseVoice` (m) |
| [sources](../../convex/sources.ts) — R01–R10 | `listByStatus` (q), `operatorExtractionPage` (q), `operatorExtractionSnapshots` (q), `listRecent` (q), `listByType` (q), `get` (q), `getByDedupeKey` (q), `create` (m), `updateStatus` (m), `updateText` (m), `archiveRecoverySource` (m), `provideRecoveryText` (m), `requestSourceRecovery` (m), `resetScoutCapture` (m), `setVisibility` (m), `createFromUrlInput` (m), `createFromYouTubeInput` (m), `createFromUrlAndQueue` (a), `createFromYouTubeAndQueue` (a), `archive` (m), `recomputeDedupeKeys` (m), `bulkArchive` (m), `deleteById` (m) |
| [studioComparisons](../../convex/studioComparisons.ts) — M08 | `beginUpload` (m), `finishUpload` (a), `list` (q), `get` (q), `machineCandidates` (q), `submitRatings` (m) |
| [testing](../../convex/testing.ts) — O05 (test seed, not product) | `seedCampaigns` (m) |
| [theses](../../convex/theses.ts) — S06 | `list` (q), `get` (q), `getByIds` (q), `getDetail` (q), `create` (m), `update` (m) |
| [vocabulary](../../convex/vocabulary.ts) — R12 | `seedMissionConceptDomains` (m), `cleanupProvisionalConceptDomainDuplicates` (m), `seedKnownRelationshipKinds` (m), `seedKnownParameterKinds` (m), `rekeyLegacyParameterKinds` (m), `promoteEntry` (m), `rejectEntry` (m), `mergeEntry` (m), `mergeVocabularyReferenceBatch` (m), `triageBoard` (q), `reviewSummary` (q) |
| [voiceRatings](../../convex/voiceRatings.ts) — M09 | `submit` (m), `forGroup` (q) |
| [weeklyBriefs](../../convex/weeklyBriefs.ts) — S08 | `list` (q), `get` (q), `getLatest` (q), `publish` (m), `editBrief` (m), `generate` (a), `publishToNotion` (a), `deleteById` (m) |
| [workflows](../../convex/workflows.ts) — R08/S02 | `startBatchExtraction` (m), `startSingleSourceExtraction` (m), `startBatchHypothesis` (m), `startFullPipeline` (m), `getStatus` (q) |
