/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as operationFailures from "../operationFailures.js";
import type * as recoveryWorkflows from "../recoveryWorkflows.js";
import type * as admin from "../admin.js";
import type * as decisionIntents from "../decisionIntents.js";
import type * as decisionSignerRuntime from "../decisionSignerRuntime.js";
import type * as decisionIntentsMigrations from "../decisionIntentsMigrations.js";
import type * as docket from "../docket.js";
import type * as docketBlurbs from "../docketBlurbs.js";
import type * as agentDraftPromotion from "../agentDraftPromotion.js";
import type * as agentDrafts from "../agentDrafts.js";
import type * as agentRuns from "../agentRuns.js";
import type * as agentToolRegistry from "../agentToolRegistry.js";
import type * as agentTools from "../agentTools.js";
import type * as agentToolsHttp from "../agentToolsHttp.js";
import type * as aggregates from "../aggregates.js";
import type * as audioArtifacts from "../audioArtifacts.js";
import type * as audioFeedback from "../audioFeedback.js";
import type * as auth from "../auth.js";
import type * as authFailures from "../authFailures.js";
import type * as blindGroups from "../blindGroups.js";
import type * as campaigns from "../campaigns.js";
import type * as claims from "../claims.js";
import type * as components_ from "../components.js";
import type * as compositions from "../compositions.js";
import type * as conceptClassification from "../conceptClassification.js";
import type * as conceptClassifier from "../conceptClassifier.js";
import type * as conceptClassifierInternal from "../conceptClassifierInternal.js";
import type * as conceptDomainNormalization from "../conceptDomainNormalization.js";
import type * as correspondenceCandidates from "../correspondenceCandidates.js";
import type * as correspondences from "../correspondences.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as domainMappings from "../domainMappings.js";
import type * as editCaptures from "../editCaptures.js";
import type * as editorialArtifacts from "../editorialArtifacts.js";
import type * as editorialExports from "../editorialExports.js";
import type * as embeddings from "../embeddings.js";
import type * as embeddingsStore from "../embeddingsStore.js";
import type * as episodes from "../episodes.js";
import type * as extract from "../extract.js";
import type * as extractInternal from "../extractInternal.js";
import type * as extractions from "../extractions.js";
import type * as fabric from "../fabric.js";
import type * as failures from "../failures.js";
import type * as feeds from "../feeds.js";
import type * as graph from "../graph.js";
import type * as http from "../http.js";
import type * as hypotheses from "../hypotheses.js";
import type * as hypothesesInternal from "../hypothesesInternal.js";
import type * as hypothesisTournament from "../hypothesisTournament.js";
import type * as hypothesisTournamentNode from "../hypothesisTournamentNode.js";
import type * as inbox from "../inbox.js";
import type * as ingest from "../ingest.js";
import type * as listen from "../listen.js";
import type * as listening from "../listening.js";
import type * as llm from "../llm.js";
import type * as llmNode from "../llmNode.js";
import type * as maintenance from "../maintenance.js";
import type * as mediaJobEffects from "../mediaJobEffects.js";
import type * as mediaJobs from "../mediaJobs.js";
import type * as mediaSweeper from "../mediaSweeper.js";
import type * as mediaToolsInternal from "../mediaToolsInternal.js";
import type * as narration from "../narration.js";
import type * as narrationPrompt from "../narrationPrompt.js";
import type * as passages from "../passages.js";
import type * as phase2 from "../phase2.js";
import type * as podcast from "../podcast.js";
import type * as recipes from "../recipes.js";
import type * as recipesInternal from "../recipesInternal.js";
import type * as renders from "../renders.js";
import type * as settings from "../settings.js";
import type * as studioComparisons from "../studioComparisons.js";
import type * as shared_agentContract from "../shared/agentContract.js";
import type * as shared_agentRunClaim from "../shared/agentRunClaim.js";
import type * as shared_agentToolArgs from "../shared/agentToolArgs.js";
import type * as shared_agentToolManifest from "../shared/agentToolManifest.js";
import type * as shared_audioArtifacts from "../shared/audioArtifacts.js";
import type * as shared_audioFeedback from "../shared/audioFeedback.js";
import type * as shared_claims from "../shared/claims.js";
import type * as shared_conceptProjection from "../shared/conceptProjection.js";
import type * as shared_correspondenceCandidates from "../shared/correspondenceCandidates.js";
import type * as shared_correspondenceKey from "../shared/correspondenceKey.js";
import type * as shared_correspondences from "../shared/correspondences.js";
import type * as shared_draftPayloads from "../shared/draftPayloads.js";
import type * as shared_embeddingText from "../shared/embeddingText.js";
import type * as shared_feedProposals from "../shared/feedProposals.js";
import type * as shared_listeningConditions from "../shared/listeningConditions.js";
import type * as shared_listeningPredicates from "../shared/listeningPredicates.js";
import type * as shared_mediaJobs from "../shared/mediaJobs.js";
import type * as shared_stableHash from "../shared/stableHash.js";
import type * as shared_statuses from "../shared/statuses.js";
import type * as shared_vocabularyTriage from "../shared/vocabularyTriage.js";
import type * as shared_voices from "../shared/voices.js";
import type * as sourceUtils from "../sourceUtils.js";
import type * as sources from "../sources.js";
import type * as testHelpers from "../testHelpers.js";
import type * as testing from "../testing.js";
import type * as theses from "../theses.js";
import type * as tracing from "../tracing.js";
import type * as transcriptCapture from "../transcriptCapture.js";
import type * as validators from "../validators.js";
import type * as vocabulary from "../vocabulary.js";
import type * as voiceRatings from "../voiceRatings.js";
import type * as weeklyBriefs from "../weeklyBriefs.js";
import type * as weeklyBriefsInternal from "../weeklyBriefsInternal.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  operationFailures: typeof operationFailures;
  recoveryWorkflows: typeof recoveryWorkflows;
  admin: typeof admin;
  decisionIntents: typeof decisionIntents;
  decisionSignerRuntime: typeof decisionSignerRuntime;
  decisionIntentsMigrations: typeof decisionIntentsMigrations;
  docket: typeof docket;
  docketBlurbs: typeof docketBlurbs;
  agentDraftPromotion: typeof agentDraftPromotion;
  agentDrafts: typeof agentDrafts;
  agentRuns: typeof agentRuns;
  agentToolRegistry: typeof agentToolRegistry;
  agentTools: typeof agentTools;
  agentToolsHttp: typeof agentToolsHttp;
  aggregates: typeof aggregates;
  audioArtifacts: typeof audioArtifacts;
  audioFeedback: typeof audioFeedback;
  auth: typeof auth;
  authFailures: typeof authFailures;
  blindGroups: typeof blindGroups;
  campaigns: typeof campaigns;
  claims: typeof claims;
  components: typeof components_;
  compositions: typeof compositions;
  conceptClassification: typeof conceptClassification;
  conceptClassifier: typeof conceptClassifier;
  conceptClassifierInternal: typeof conceptClassifierInternal;
  conceptDomainNormalization: typeof conceptDomainNormalization;
  correspondenceCandidates: typeof correspondenceCandidates;
  correspondences: typeof correspondences;
  crons: typeof crons;
  dashboard: typeof dashboard;
  domainMappings: typeof domainMappings;
  editCaptures: typeof editCaptures;
  editorialArtifacts: typeof editorialArtifacts;
  editorialExports: typeof editorialExports;
  embeddings: typeof embeddings;
  embeddingsStore: typeof embeddingsStore;
  episodes: typeof episodes;
  extract: typeof extract;
  extractInternal: typeof extractInternal;
  extractions: typeof extractions;
  fabric: typeof fabric;
  failures: typeof failures;
  feeds: typeof feeds;
  graph: typeof graph;
  http: typeof http;
  hypotheses: typeof hypotheses;
  hypothesesInternal: typeof hypothesesInternal;
  hypothesisTournament: typeof hypothesisTournament;
  hypothesisTournamentNode: typeof hypothesisTournamentNode;
  inbox: typeof inbox;
  ingest: typeof ingest;
  listen: typeof listen;
  listening: typeof listening;
  llm: typeof llm;
  llmNode: typeof llmNode;
  maintenance: typeof maintenance;
  mediaJobEffects: typeof mediaJobEffects;
  mediaJobs: typeof mediaJobs;
  mediaSweeper: typeof mediaSweeper;
  mediaToolsInternal: typeof mediaToolsInternal;
  narration: typeof narration;
  narrationPrompt: typeof narrationPrompt;
  passages: typeof passages;
  phase2: typeof phase2;
  podcast: typeof podcast;
  recipes: typeof recipes;
  recipesInternal: typeof recipesInternal;
  renders: typeof renders;
  settings: typeof settings;
  studioComparisons: typeof studioComparisons;
  "shared/agentContract": typeof shared_agentContract;
  "shared/agentRunClaim": typeof shared_agentRunClaim;
  "shared/agentToolArgs": typeof shared_agentToolArgs;
  "shared/agentToolManifest": typeof shared_agentToolManifest;
  "shared/audioArtifacts": typeof shared_audioArtifacts;
  "shared/audioFeedback": typeof shared_audioFeedback;
  "shared/claims": typeof shared_claims;
  "shared/conceptProjection": typeof shared_conceptProjection;
  "shared/correspondenceCandidates": typeof shared_correspondenceCandidates;
  "shared/correspondenceKey": typeof shared_correspondenceKey;
  "shared/correspondences": typeof shared_correspondences;
  "shared/draftPayloads": typeof shared_draftPayloads;
  "shared/embeddingText": typeof shared_embeddingText;
  "shared/feedProposals": typeof shared_feedProposals;
  "shared/listeningConditions": typeof shared_listeningConditions;
  "shared/listeningPredicates": typeof shared_listeningPredicates;
  "shared/mediaJobs": typeof shared_mediaJobs;
  "shared/stableHash": typeof shared_stableHash;
  "shared/statuses": typeof shared_statuses;
  "shared/vocabularyTriage": typeof shared_vocabularyTriage;
  "shared/voices": typeof shared_voices;
  sourceUtils: typeof sourceUtils;
  sources: typeof sources;
  testHelpers: typeof testHelpers;
  testing: typeof testing;
  theses: typeof theses;
  tracing: typeof tracing;
  transcriptCapture: typeof transcriptCapture;
  validators: typeof validators;
  vocabulary: typeof vocabulary;
  voiceRatings: typeof voiceRatings;
  weeklyBriefs: typeof weeklyBriefs;
  weeklyBriefsInternal: typeof weeklyBriefsInternal;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  aggregate: {
    btree: {
      aggregateBetween: FunctionReference<
        "query",
        "internal",
        {
          k1?: any;
          k2?: any;
          namespace?: any;
          stale?: boolean;
        },
        {
          count: number;
          sum: number;
        },
        "aggregate"
      >;
      aggregateBetweenBatch: FunctionReference<
        "query",
        "internal",
        {
          queries: Array<{
            k1?: any;
            k2?: any;
            namespace?: any;
          }>;
          stale?: boolean;
        },
        Array<{
          count: number;
          sum: number;
        }>,
        "aggregate"
      >;
      atNegativeOffset: FunctionReference<
        "query",
        "internal",
        {
          k1?: any;
          k2?: any;
          namespace?: any;
          offset: number;
          stale?: boolean;
        },
        {
          k: any;
          s: number;
          v: any;
        },
        "aggregate"
      >;
      atOffset: FunctionReference<
        "query",
        "internal",
        {
          k1?: any;
          k2?: any;
          namespace?: any;
          offset: number;
          stale?: boolean;
        },
        {
          k: any;
          s: number;
          v: any;
        },
        "aggregate"
      >;
      atOffsetBatch: FunctionReference<
        "query",
        "internal",
        {
          queries: Array<{
            k1?: any;
            k2?: any;
            namespace?: any;
            offset: number;
          }>;
          stale?: boolean;
        },
        Array<{
          k: any;
          s: number;
          v: any;
        }>,
        "aggregate"
      >;
      get: FunctionReference<
        "query",
        "internal",
        {
          key: any;
          namespace?: any;
          stale?: boolean;
        },
        null | {
          k: any;
          s: number;
          v: any;
        },
        "aggregate"
      >;
      offset: FunctionReference<
        "query",
        "internal",
        {
          k1?: any;
          key: any;
          namespace?: any;
          stale?: boolean;
        },
        number,
        "aggregate"
      >;
      offsetUntil: FunctionReference<
        "query",
        "internal",
        {
          k2?: any;
          key: any;
          namespace?: any;
          stale?: boolean;
        },
        number,
        "aggregate"
      >;
      paginate: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string;
          k1?: any;
          k2?: any;
          limit: number;
          namespace?: any;
          order: "asc" | "desc";
          stale?: boolean;
        },
        {
          cursor: string;
          isDone: boolean;
          page: Array<{
            k: any;
            s: number;
            v: any;
          }>;
        },
        "aggregate"
      >;
      paginateNamespaces: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string;
          limit: number;
          stale?: boolean;
        },
        {
          cursor: string;
          isDone: boolean;
          page: Array<any>;
        },
        "aggregate"
      >;
      validate: FunctionReference<
        "query",
        "internal",
        {
          namespace?: any;
          stale?: boolean;
        },
        any,
        "aggregate"
      >;
    };
    deadLetter: {
      delete_: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
        },
        boolean,
        "aggregate"
      >;
      get: FunctionReference<
        "query",
        "internal",
        {
          id: string;
        },
        {
          _creationTime: number;
          _id: string;
          commitTs: bigint;
          error: string;
          operation:
            | {
                key: any;
                namespace?: any;
                summand?: number;
                type: "insert";
                value: any;
              }
            | {
                key: any;
                namespace?: any;
                type: "delete";
              }
            | {
                currentKey: any;
                namespace?: any;
                newKey: any;
                newNamespace?: any;
                summand?: number;
                type: "replace";
                value: any;
              }
            | {
                key: any;
                namespace?: any;
                type: "deleteIfExists";
              }
            | {
                currentKey: any;
                namespace?: any;
                newKey: any;
                newNamespace?: any;
                summand?: number;
                type: "replaceOrInsert";
                value: any;
              };
        } | null,
        "aggregate"
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          order?: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            commitTs: bigint;
            error: string;
            operation:
              | {
                  key: any;
                  namespace?: any;
                  summand?: number;
                  type: "insert";
                  value: any;
                }
              | {
                  key: any;
                  namespace?: any;
                  type: "delete";
                }
              | {
                  currentKey: any;
                  namespace?: any;
                  newKey: any;
                  newNamespace?: any;
                  summand?: number;
                  type: "replace";
                  value: any;
                }
              | {
                  key: any;
                  namespace?: any;
                  type: "deleteIfExists";
                }
              | {
                  currentKey: any;
                  namespace?: any;
                  newKey: any;
                  newNamespace?: any;
                  summand?: number;
                  type: "replaceOrInsert";
                  value: any;
                };
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        "aggregate"
      >;
    };
    inspect: {
      display: FunctionReference<
        "query",
        "internal",
        {
          namespace?: any;
        },
        any,
        "aggregate"
      >;
      dump: FunctionReference<
        "query",
        "internal",
        {
          namespace?: any;
        },
        string,
        "aggregate"
      >;
      inspectNode: FunctionReference<
        "query",
        "internal",
        {
          namespace?: any;
          node?: string;
        },
        null,
        "aggregate"
      >;
      listTreeNodes: FunctionReference<
        "query",
        "internal",
        {
          take?: number;
        },
        Array<{
          _creationTime: number;
          _id: string;
          aggregate?: {
            count: number;
            sum: number;
          };
          items: Array<{
            k: any;
            s: number;
            v: any;
          }>;
          subtrees: Array<string>;
        }>,
        "aggregate"
      >;
      listTrees: FunctionReference<
        "query",
        "internal",
        {
          take?: number;
        },
        Array<{
          _creationTime: number;
          _id: string;
          maxNodeSize: number;
          namespace?: any;
          root: string;
        }>,
        "aggregate"
      >;
    };
    public: {
      clear: FunctionReference<
        "mutation",
        "internal",
        {
          maxNodeSize?: number;
          namespace?: any;
          rootLazy?: boolean;
        },
        null,
        "aggregate"
      >;
      delete_: FunctionReference<
        "mutation",
        "internal",
        {
          key: any;
          namespace?: any;
        },
        null,
        "aggregate"
      >;
      deleteIfExists: FunctionReference<
        "mutation",
        "internal",
        {
          key: any;
          namespace?: any;
        },
        any,
        "aggregate"
      >;
      enqueue: FunctionReference<
        "mutation",
        "internal",
        {
          operation:
            | {
                key: any;
                namespace?: any;
                summand?: number;
                type: "insert";
                value: any;
              }
            | {
                key: any;
                namespace?: any;
                type: "delete";
              }
            | {
                currentKey: any;
                namespace?: any;
                newKey: any;
                newNamespace?: any;
                summand?: number;
                type: "replace";
                value: any;
              }
            | {
                key: any;
                namespace?: any;
                type: "deleteIfExists";
              }
            | {
                currentKey: any;
                namespace?: any;
                newKey: any;
                newNamespace?: any;
                summand?: number;
                type: "replaceOrInsert";
                value: any;
              };
        },
        null,
        "aggregate"
      >;
      enqueueBatch: FunctionReference<
        "mutation",
        "internal",
        {
          operations: Array<
            | {
                key: any;
                namespace?: any;
                summand?: number;
                type: "insert";
                value: any;
              }
            | {
                key: any;
                namespace?: any;
                type: "delete";
              }
            | {
                currentKey: any;
                namespace?: any;
                newKey: any;
                newNamespace?: any;
                summand?: number;
                type: "replace";
                value: any;
              }
            | {
                key: any;
                namespace?: any;
                type: "deleteIfExists";
              }
            | {
                currentKey: any;
                namespace?: any;
                newKey: any;
                newNamespace?: any;
                summand?: number;
                type: "replaceOrInsert";
                value: any;
              }
          >;
        },
        null,
        "aggregate"
      >;
      init: FunctionReference<
        "mutation",
        "internal",
        {
          maxNodeSize?: number;
          namespace?: any;
          rootLazy?: boolean;
        },
        null,
        "aggregate"
      >;
      insert: FunctionReference<
        "mutation",
        "internal",
        {
          key: any;
          namespace?: any;
          summand?: number;
          value: any;
        },
        null,
        "aggregate"
      >;
      makeRootLazy: FunctionReference<
        "mutation",
        "internal",
        {
          namespace?: any;
        },
        null,
        "aggregate"
      >;
      replace: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        null,
        "aggregate"
      >;
      replaceOrInsert: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        any,
        "aggregate"
      >;
    };
  };
  actionCache: {
    crons: {
      purge: FunctionReference<
        "mutation",
        "internal",
        {
          expiresAt?: number;
        },
        null,
        "actionCache"
      >;
    };
    lib: {
      get: FunctionReference<
        "query",
        "internal",
        {
          args: any;
          name: string;
          ttl: number | null;
        },
        | {
            kind: "hit";
            value: any;
          }
        | {
            expiredEntry?: string;
            kind: "miss";
          },
        "actionCache"
      >;
      put: FunctionReference<
        "mutation",
        "internal",
        {
          args: any;
          expiredEntry?: string;
          name: string;
          ttl: number | null;
          value: any;
        },
        {
          cacheHit: boolean;
          deletedExpiredEntry: boolean;
        },
        "actionCache"
      >;
      remove: FunctionReference<
        "mutation",
        "internal",
        {
          args: any;
          name: string;
        },
        null,
        "actionCache"
      >;
      removeAll: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          before?: number;
          name?: string;
        },
        null,
        "actionCache"
      >;
    };
  };
  workflow: {
    event: {
      create: FunctionReference<
        "mutation",
        "internal",
        {
          name: string;
          workflowId: string;
        },
        string,
        "workflow"
      >;
      send: FunctionReference<
        "mutation",
        "internal",
        {
          eventId?: string;
          name?: string;
          result:
            | {
                kind: "success";
                returnValue: any;
              }
            | {
                error: string;
                kind: "failed";
              }
            | {
                kind: "canceled";
              };
          workflowId?: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        string,
        "workflow"
      >;
    };
    journal: {
      load: FunctionReference<
        "query",
        "internal",
        {
          shortCircuit?: boolean;
          workflowId: string;
        },
        {
          blocked?: boolean;
          journalEntries: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: {
                    eventId?: string;
                  };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  inProgress: boolean;
                  kind: "sleep";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workId?: string;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          ok: boolean;
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: {
              context?: any;
              fnHandle: string;
            };
            runResult?:
              | {
                  kind: "success";
                  returnValue: any;
                }
              | {
                  error: string;
                  kind: "failed";
                }
              | {
                  kind: "canceled";
                };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        },
        "workflow"
      >;
      startSteps: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          steps: Array<{
            retry?:
              | boolean
              | {
                  base: number;
                  initialBackoffMs: number;
                  maxAttempts: number;
                };
            schedulerOptions?:
              | {
                  runAt?: number;
                }
              | {
                  runAfter?: number;
                };
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: {
                    eventId?: string;
                  };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  inProgress: boolean;
                  kind: "sleep";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workId?: string;
                };
          }>;
          workflowId: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        Array<{
          _creationTime: number;
          _id: string;
          step:
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                functionType: "query" | "mutation" | "action";
                handle: string;
                inProgress: boolean;
                kind?: "function";
                name: string;
                runResult?:
                  | {
                      kind: "success";
                      returnValue: any;
                    }
                  | {
                      error: string;
                      kind: "failed";
                    }
                  | {
                      kind: "canceled";
                    };
                startedAt: number;
                workId?: string;
              }
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                handle: string;
                inProgress: boolean;
                kind: "workflow";
                name: string;
                runResult?:
                  | {
                      kind: "success";
                      returnValue: any;
                    }
                  | {
                      error: string;
                      kind: "failed";
                    }
                  | {
                      kind: "canceled";
                    };
                startedAt: number;
                workflowId?: string;
              }
            | {
                args: {
                  eventId?: string;
                };
                argsSize: number;
                completedAt?: number;
                eventId?: string;
                inProgress: boolean;
                kind: "event";
                name: string;
                runResult?:
                  | {
                      kind: "success";
                      returnValue: any;
                    }
                  | {
                      error: string;
                      kind: "failed";
                    }
                  | {
                      kind: "canceled";
                    };
                startedAt: number;
              }
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                inProgress: boolean;
                kind: "sleep";
                name: string;
                runResult?:
                  | {
                      kind: "success";
                      returnValue: any;
                    }
                  | {
                      error: string;
                      kind: "failed";
                    }
                  | {
                      kind: "canceled";
                    };
                startedAt: number;
                workId?: string;
              };
          stepNumber: number;
          workflowId: string;
        }>,
        "workflow"
      >;
    };
    workflow: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        {
          workflowId: string;
        },
        null,
        "workflow"
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        {
          force?: boolean;
          workflowId: string;
        },
        boolean,
        "workflow"
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          runResult:
            | {
                kind: "success";
                returnValue: any;
              }
            | {
                error: string;
                kind: "failed";
              }
            | {
                kind: "canceled";
              };
          workflowId: string;
        },
        null,
        "workflow"
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          createOnly?: boolean;
          maxParallelism?: number;
          onComplete?: {
            context?: any;
            fnHandle: string;
          };
          startAsync?: boolean;
          workflowArgs: any;
          workflowHandle: string;
          workflowName: string;
        },
        string,
        "workflow"
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        {
          workflowId: string;
        },
        {
          inProgress: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: {
                    eventId?: string;
                  };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  inProgress: boolean;
                  kind: "sleep";
                  name: string;
                  runResult?:
                    | {
                        kind: "success";
                        returnValue: any;
                      }
                    | {
                        error: string;
                        kind: "failed";
                      }
                    | {
                        kind: "canceled";
                      };
                  startedAt: number;
                  workId?: string;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: {
              context?: any;
              fnHandle: string;
            };
            runResult?:
              | {
                  kind: "success";
                  returnValue: any;
                }
              | {
                  error: string;
                  kind: "failed";
                }
              | {
                  kind: "canceled";
                };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        },
        "workflow"
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            context?: any;
            name?: string;
            runResult?:
              | {
                  kind: "success";
                  returnValue: any;
                }
              | {
                  error: string;
                  kind: "failed";
                }
              | {
                  kind: "canceled";
                };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        "workflow"
      >;
      listByName: FunctionReference<
        "query",
        "internal",
        {
          name: string;
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            context?: any;
            name?: string;
            runResult?:
              | {
                  kind: "success";
                  returnValue: any;
                }
              | {
                  error: string;
                  kind: "failed";
                }
              | {
                  kind: "canceled";
                };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        "workflow"
      >;
      listSteps: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          workflowId: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            completedAt?: number;
            eventId?: string;
            kind: "function" | "workflow" | "event" | "sleep";
            name: string;
            nestedWorkflowId?: string;
            runResult?:
              | {
                  kind: "success";
                  returnValue: any;
                }
              | {
                  error: string;
                  kind: "failed";
                }
              | {
                  kind: "canceled";
                };
            startedAt: number;
            stepId: string;
            stepNumber: number;
            workId?: string;
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        "workflow"
      >;
      restart: FunctionReference<
        "mutation",
        "internal",
        {
          from?: number | string;
          startAsync?: boolean;
          workflowId: string;
        },
        null,
        "workflow"
      >;
    };
  };
  rag: {
    chunks: {
      insert: FunctionReference<
        "mutation",
        "internal",
        {
          chunks: Array<{
            content: {
              metadata?: Record<string, any>;
              text: string;
            };
            embedding: Array<number>;
            searchableText?: string;
          }>;
          entryId: string;
          startOrder: number;
        },
        {
          status: "pending" | "ready" | "replaced";
        },
        "rag"
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          entryId: string;
          order: "desc" | "asc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            metadata?: Record<string, any>;
            order: number;
            state: "pending" | "ready" | "replaced";
            text: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        "rag"
      >;
      replaceChunksPage: FunctionReference<
        "mutation",
        "internal",
        {
          entryId: string;
          startOrder: number;
        },
        {
          nextStartOrder: number;
          status: "pending" | "ready" | "replaced";
        },
        "rag"
      >;
    };
    entries: {
      add: FunctionReference<
        "mutation",
        "internal",
        {
          allChunks?: Array<{
            content: {
              metadata?: Record<string, any>;
              text: string;
            };
            embedding: Array<number>;
            searchableText?: string;
          }>;
          entry: {
            contentHash?: string;
            filterValues: Array<{
              name: string;
              value: any;
            }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            namespaceId: string;
            title?: string;
          };
          onComplete?: string;
        },
        {
          created: boolean;
          entryId: string;
          status: "pending" | "ready" | "replaced";
        },
        "rag"
      >;
      addAsync: FunctionReference<
        "mutation",
        "internal",
        {
          chunker: string;
          entry: {
            contentHash?: string;
            filterValues: Array<{
              name: string;
              value: any;
            }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            namespaceId: string;
            title?: string;
          };
          onComplete?: string;
        },
        {
          created: boolean;
          entryId: string;
          status: "pending" | "ready";
        },
        "rag"
      >;
      deleteAsync: FunctionReference<
        "mutation",
        "internal",
        {
          entryId: string;
          startOrder: number;
        },
        null,
        "rag"
      >;
      deleteByKeyAsync: FunctionReference<
        "mutation",
        "internal",
        {
          beforeVersion?: number;
          key: string;
          namespaceId: string;
        },
        null,
        "rag"
      >;
      deleteByKeySync: FunctionReference<
        "action",
        "internal",
        {
          key: string;
          namespaceId: string;
        },
        null,
        "rag"
      >;
      deleteSync: FunctionReference<
        "action",
        "internal",
        {
          entryId: string;
        },
        null,
        "rag"
      >;
      findByContentHash: FunctionReference<
        "query",
        "internal",
        {
          contentHash: string;
          dimension: number;
          filterNames: Array<string>;
          key: string;
          modelId: string;
          namespace: string;
        },
        {
          contentHash?: string;
          entryId: string;
          filterValues: Array<{
            name: string;
            value: any;
          }>;
          importance: number;
          key?: string;
          metadata?: Record<string, any>;
          replacedAt?: number;
          status: "pending" | "ready" | "replaced";
          title?: string;
        } | null,
        "rag"
      >;
      get: FunctionReference<
        "query",
        "internal",
        {
          entryId: string;
        },
        {
          contentHash?: string;
          entryId: string;
          filterValues: Array<{
            name: string;
            value: any;
          }>;
          importance: number;
          key?: string;
          metadata?: Record<string, any>;
          replacedAt?: number;
          status: "pending" | "ready" | "replaced";
          title?: string;
        } | null,
        "rag"
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          namespaceId?: string;
          order?: "desc" | "asc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          status: "pending" | "ready" | "replaced";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            contentHash?: string;
            entryId: string;
            filterValues: Array<{
              name: string;
              value: any;
            }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            replacedAt?: number;
            status: "pending" | "ready" | "replaced";
            title?: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        "rag"
      >;
      promoteToReady: FunctionReference<
        "mutation",
        "internal",
        {
          entryId: string;
        },
        {
          replacedEntry: {
            contentHash?: string;
            entryId: string;
            filterValues: Array<{
              name: string;
              value: any;
            }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            replacedAt?: number;
            status: "pending" | "ready" | "replaced";
            title?: string;
          } | null;
        },
        "rag"
      >;
    };
    namespaces: {
      deleteNamespace: FunctionReference<
        "mutation",
        "internal",
        {
          namespaceId: string;
        },
        {
          deletedNamespace: null | {
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          };
        },
        "rag"
      >;
      deleteNamespaceSync: FunctionReference<
        "action",
        "internal",
        {
          namespaceId: string;
        },
        null,
        "rag"
      >;
      get: FunctionReference<
        "query",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
        },
        null | {
          createdAt: number;
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
          namespaceId: string;
          status: "pending" | "ready" | "replaced";
          version: number;
        },
        "rag"
      >;
      getOrCreate: FunctionReference<
        "mutation",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
          onComplete?: string;
          status: "pending" | "ready";
        },
        {
          namespaceId: string;
          status: "pending" | "ready";
        },
        "rag"
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          status: "pending" | "ready" | "replaced";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        "rag"
      >;
      listNamespaceVersions: FunctionReference<
        "query",
        "internal",
        {
          namespace: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        "rag"
      >;
      lookup: FunctionReference<
        "query",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
        },
        null | string,
        "rag"
      >;
      promoteToReady: FunctionReference<
        "mutation",
        "internal",
        {
          namespaceId: string;
        },
        {
          replacedNamespace: null | {
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          };
        },
        "rag"
      >;
    };
    search: {
      search: FunctionReference<
        "action",
        "internal",
        {
          chunkContext?: {
            after: number;
            before: number;
          };
          dimension?: number;
          embedding?: Array<number>;
          filters: Array<{
            name: string;
            value: any;
          }>;
          limit: number;
          modelId: string;
          namespace: string;
          searchType?: "vector" | "text" | "hybrid";
          textQuery?: string;
          textWeight?: number;
          vectorScoreThreshold?: number;
          vectorWeight?: number;
        },
        {
          entries: Array<{
            contentHash?: string;
            entryId: string;
            filterValues: Array<{
              name: string;
              value: any;
            }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            replacedAt?: number;
            status: "pending" | "ready" | "replaced";
            title?: string;
          }>;
          results: Array<{
            content: Array<{
              metadata?: Record<string, any>;
              text: string;
            }>;
            entryId: string;
            order: number;
            score: number;
            startOrder: number;
          }>;
        },
        "rag"
      >;
    };
  };
};
