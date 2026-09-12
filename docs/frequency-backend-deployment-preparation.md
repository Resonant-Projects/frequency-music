# Frequency backend deployment preparation

This is preparation, not a deployment approval. The exact current-to-candidate delta and a recoverable rollback remain blocked on protected runtime evidence. No backend deployment, schema validation push, export, queue mutation, or worker change is part of this procedure.

## Evidence boundary

Candidate source is `07aa3d4d524b421bfd577ced008e8f8190e972c9`, published by [run 34704787115](https://github.com/Resonant-Projects/frequency-music/actions/runs/34704787115). The attested `convex-root-modules.json` has SHA-256 `6b8bb954ceab03948b9b0cef2051bf4f739d227ff024af5fc5ae6a56fae5a9bb` and 127 root module identities. It does not attest component bundles, schema, or a recoverable backend image.

At 2026-09-12T16:29:23Z the Mac coordinator obtained 129 live root module identities and failed strict equality with this manifest. HTTP 200 from the queue timestamp/query endpoints did not produce accepted complete counts. Neither result identifies the deployed source revision or proves the internal query absent. The raw evidence remains on Mac; only sanitized comparison results belong in this repository.

## Candidate inventory

The inventory below was built at the exact candidate checkout with the existing audited Convex 1.34.1 offline builder: inert environment/admin argument, denied network, `--push-all-modules --write-push-request`, disabled codegen/typecheck. The temporary complete request was inspected locally and never sent. `--dry-run` alone is not an offline or read-only guarantee: normal deploy flow can start schema validation/index preparation before final activation. Do not use it for live discovery.

The full request has no external Node package dependencies and does not specify a Node version. Root component dependencies are `actionCache`, `aggregate`, and `workflow`; `workflow` owns a nested `workpool`. Package versions in the lockfile/install are action-cache 0.3.0, aggregate 0.2.1, workflow 0.3.9, and workpool 0.3.1. There are 127 root module bundles and 45 component module bundles. A module bundle can contain multiple functions: these are not function counts.

All five schemas enable validation. The following hashes are SHA-256 of the generated schema JavaScript **source bytes only**, not the root-manifest module identity algorithm and not a newly signed release.

| Scope | Module bundles | Tables | Schema source SHA-256 |
| --- | ---: | ---: | --- |
| root | 127 | 24 | `aaf9d8359331439c51b712cabd99af4dff2bcebecae5b2e1095d9b45ef24f209` |
| action-cache | 6 | 2 | `d979f18929e8642ead301dd8248a8d085226a0eced876346790459a66aaac3f3` |
| aggregate | 6 | 2 | `5458d0f3dc00d2b67567cf98ac67eba4edeecdffdf834d589b574909e001d0fe` |
| workpool | 20 | 7 | `b9dfc6909b4c222fa7241962ec80dcfbe1a05554790ffe065af08e204102a177` |
| workflow | 13 | 5 | `7cf69a647eeaa33a9e081cd07bb9dff8d4286d10800306946385bdd35638319e` |

Schema inventory below names declared indexes. Full comparison must also compare document validators, index field order, search filters, vector dimensions/filters, staged indexes, and validation settings; index names alone are insufficient.

| Scope / table | Database indexes | Search / vector indexes |
| --- | --- | --- |
| root / users | by_clerkUserId | none |
| root / agentRuns | by_status_updatedAt, by_graphName_updatedAt, by_status_graphName_updatedAt, by_updatedAt | none |
| root / agentRunEvents | by_runId_createdAt | none |
| root / agentReviewDrafts | by_agentRunId_updatedAt, by_agentRunId_status_updatedAt, by_status_updatedAt, by_status_kind_updatedAt, by_graphName_updatedAt | none |
| root / editCaptures | by_exported_editedAt | none |
| root / sources | by_status_updatedAt, by_visibility_updatedAt, by_type_updatedAt, by_dedupeKey, by_notionPageId, by_canonicalUrl, by_createdAt | none |
| root / feeds | by_enabled, by_type, by_url | none |
| root / extractions | by_sourceId_createdAt, by_inputHash | none |
| root / claims | by_extractionId_ordinal, by_sourceId, by_sourceId_status, by_status | by_embedding |
| root / correspondences | by_pairKey, by_status_updatedAt, by_conceptAId, by_conceptBId | none |
| root / theses | by_status_updatedAt, by_visibility_updatedAt | none |
| root / campaigns | by_status_updatedAt, by_visibility_updatedAt | none |
| root / hypotheses | by_status_updatedAt, by_visibility_updatedAt, by_correspondenceId, by_thesisId_updatedAt, by_extractionIds | none |
| root / recipes | by_hypothesisId_updatedAt, by_status_updatedAt | none |
| root / compositions | by_recipeId_updatedAt, by_status_updatedAt, by_revisionParentId_updatedAt | none |
| root / listeningSessions | by_compositionId_createdAt | none |
| root / weeklyBriefs | by_weekOf, by_visibility_createdAt | none |
| root / stats | by_key | none |
| root / editorialArtifacts | by_slug, by_status_updatedAt, by_visibility_updatedAt, by_kind_updatedAt | none |
| root / parameterKinds | by_name, by_status | none |
| root / conceptDomains | by_name, by_status, by_sectorMapping | none |
| root / relationshipKinds | by_name, by_status | none |
| root / concepts | by_name, by_domain, by_missionRelevance, by_missionRelevance_lastProbedAt, by_mentionCount | search_concepts, by_embedding |
| root / edges | by_from, by_to, by_to_fromType, by_relationship, by_fromType_relationship | none |
| action-cache / values | key | none |
| action-cache / metadata | expiresAt | none |
| aggregate / btree | by_namespace | none |
| aggregate / btreeNode | none | none |
| workflow / config | none | none |
| workflow / workflows | name | none |
| workflow / steps | workflow, inProgress | none |
| workflow / events | workflowId_state | none |
| workflow / onCompleteFailures | none | none |
| workpool / globals | none | none |
| workpool / internalState | none | none |
| workpool / runStatus | none | none |
| workpool / work | none | none |
| workpool / pendingStart | workId, segment | none |
| workpool / pendingCompletion | workId, segment | none |
| workpool / pendingCancelation | workId, segment | none |

Root cron definitions in `convex/crons.ts` are:

| Name | Schedule (UTC for calendar schedules) | Target | Static arguments |
| --- | --- | --- | --- |
| poll-feeds | every 6 hours | ingest:pollAllFeedsInternal | none |
| batch-extract | every 8 hours | workflows:startBatchExtractionInternal | limit 3 |
| generate-hypotheses | Monday 16:00 | workflows:startBatchHypothesisInternal | limit 3 |
| generate-weekly-turn | Friday 16:00 | weeklyBriefs:generateInternal | daysBack 7 |
| sweep-stale-agent-runs | every 15 minutes | agentRuns:sweepStaleRuns | empty |
| reconcile-reviewed-agent-runs | every 15 minutes | agentRuns:reconcileReviewedRuns | empty |
| recompute-stats | every 30 minutes | dashboard:recomputeStats | empty |
| classify-stale-concepts | every hour | conceptClassifier:sweepUnreviewedConcepts | empty |
| embed-missing-sweep | Sunday 15:00 | embeddings:sweepMissingEmbeddings | empty |
| retire-stale-correspondences | Sunday 16:00 | correspondences:autoRetireStale | empty |
| enqueue-correspondence-miner | daily 05:00 | agentRuns:enqueue | graph correspondence-miner; limit 20 |
| enqueue-evidence-hunter | daily 06:00 | agentRuns:enqueue | graph evidence-hunter; limit 5 |
| enqueue-hypothesis-drafter | Thursday 16:00 | agentRuns:enqueue | graph hypothesis-drafter; empty input |
| enqueue-source-scout | Wednesday 16:00 | agentRuns:enqueue | graph source-scout; empty input |

Component cron definitions in the pinned packages add `actionCache` / `expire` every 24 hours, targeting public component mutation `crons:purge` with empty arguments (which can schedule further cache purges), and `workflow/workpool` / `recover` every 30 minutes, targeting internal component mutation `crons:recover` with no arguments (which can schedule `kick:forceKick`). Aggregate and workflow have no own `crons.js` module in the generated candidate; workflow's nested workpool still runs its recovery cron. The candidate therefore defines 16 cron schedules across root and components.

These schedules can produce jobs and external effects. Claim pause does not freeze producers, direct actions, component workflows, or already scheduled work. Review all component cron/scheduler definitions and deployed schedules too; root cron inventory alone is not an activation gate pass.

## Remaining read-only evidence request for Mac

First use the already captured hash response to produce sorted path/environment comparisons: candidate-only, deployed-only, and same-path changed identities. Return names and hashes only. Do not perform duplicate reads just to regenerate this comparison. HTTP success and module count differences alone cannot identify the delta.

The following existing interfaces were verified in upstream backend source at commit `8ccdd1097dbcb1da1be662d7909cc2c9117b5092`; availability on the actual self-hosted backend version remains a gate. The installed CLI verifies only the `/api/get_config_hashes` contract. No private system function should be deployed or rewritten to expose this information publicly.

| Interface | Contract and restrictions |
| --- | --- |
| POST `/api/get_config` | Existing admin key in JSON `adminKey`; returns `config`, `modules` with source/source maps, and `udfServerVersion`. Root only, explicitly a pre-components interface. Retain raw response privately with restrictive permissions; source/config can contain sensitive literals. Never log request body or raw response. This is inspection, not a complete rollback export. |
| `_system/frontend/modules:listForAllComponents`, args `{}` | Privileged query; returns analyzed functions, HTTP routes, source package IDs and optional cron specs for components. Does not return executable source or a restore package. Runtime compatibility and response limits must be checked before use. |
| `_system/frontend/components:list`, args `{}` | Privileged query; returns component IDs, paths, state and arguments. Keep arguments private; return only sanitized path/state metadata. |
| `_system/frontend/getSchemas:default`, args `{componentId: null}` or an existing component ID | Privileged query; active and in-progress schema strings per component. Preserve full schema privately for structural diff; return reviewed validator/index deltas. |

Do not use `_system/frontend/listCronJobs` for this evidence: its response includes recent run records. Use static cron specs from analyzed module metadata, keep argument values private, and return only reviewed schedule/target changes and an arguments-changed boolean. Any function metadata or schema response that exceeds the coordinator's established byte/time budget is incomplete evidence; do not truncate and claim completeness. These private queries can use the existing authenticated query transport after the deployed backend's contract is verified. No new grant is required or authorized.

Upstream references: [root config retrieval](https://github.com/get-convex/convex-backend/blob/8ccdd1097dbcb1da1be662d7909cc2c9117b5092/crates/local_backend/src/deploy_config.rs), [module metadata](https://github.com/get-convex/convex-backend/blob/8ccdd1097dbcb1da1be662d7909cc2c9117b5092/npm-packages/system-udfs/convex/_system/frontend/modules.ts), [component metadata](https://github.com/get-convex/convex-backend/blob/8ccdd1097dbcb1da1be662d7909cc2c9117b5092/npm-packages/system-udfs/convex/_system/frontend/components.ts), and [schemas](https://github.com/get-convex/convex-backend/blob/8ccdd1097dbcb1da1be662d7909cc2c9117b5092/npm-packages/system-udfs/convex/_system/frontend/getSchemas.ts).

## Full delta and rollback gates

A reviewer needs a complete before/after report covering root and component function source identities, public/internal visibility and validators, HTTP routes, authentication configuration, all schemas/indexes, component definitions/arguments/state, Node dependencies/runtime, and cron schedules/targets/arguments. Compare at a frozen deployment configuration, or repeat identities and schema/component reads around the capture and fail if anything changed. Multiple metadata reads do not establish an atomic snapshot or freeze running jobs.

The current root hashes cannot reconstruct source. Root `/api/get_config` plus schema/metadata captures still cannot reconstruct a component-aware deployment. Locate the actual prior deployment's retained source/bundle and pinned dependencies, tied by exact root **and component** identities and schema/definition comparison to runtime. A local Git revision, a tag, or the old worker image revision is not backend provenance. If no matching retained artifact exists, the backend owner must establish and validate a protected full backend/database/object-store backup and version-compatible restore procedure; this is a separate approval, not an implied action here.

A rollback is recoverable only after its exact artifact, component packages, validators/indexes, runtime compatibility, required environment references, data compatibility and restore procedure are reviewed and tested in an isolated backend with no production egress. Protect raw backups and do not copy job payloads into PR evidence. `convex export` is a data snapshot workflow that starts server-side export work; it is not a read-only source/config rollback and must not be run under this task. Data restore/import is also a separate mutation.

No verified read-only API in the installed CLI provides a complete restore-ready deployment. Do not invent a POST restore endpoint or send the captured root config to a deployment endpoint. Any eventual deployment or rollback uses a separately reviewed supported deployment flow, with producer/direct-execution freeze and worker handoff gates from `frequency-worker-handoff.md`. Rolling back source cannot undo external effects, accepted jobs, data writes, or cron executions.

Before approving deployment, attach the completed sanitized before/after report, protected rollback artifact identity and successful isolated restore evidence. Until those exist, the exact delta and recoverable rollback remain open gates; the attested release is only a candidate.
