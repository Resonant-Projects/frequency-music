/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as aggregates from "../aggregates.js";
import type * as components_ from "../components.js";
import type * as compositions from "../compositions.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as extract from "../extract.js";
import type * as extractions from "../extractions.js";
import type * as fabric from "../fabric.js";
import type * as feeds from "../feeds.js";
import type * as graph from "../graph.js";
import type * as http from "../http.js";
import type * as hypotheses from "../hypotheses.js";
import type * as inbox from "../inbox.js";
import type * as ingest from "../ingest.js";
import type * as listening from "../listening.js";
import type * as recipes from "../recipes.js";
import type * as sourceUtils from "../sourceUtils.js";
import type * as sources from "../sources.js";
import type * as weeklyBriefs from "../weeklyBriefs.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  aggregates: typeof aggregates;
  components: typeof components_;
  compositions: typeof compositions;
  crons: typeof crons;
  dashboard: typeof dashboard;
  extract: typeof extract;
  extractions: typeof extractions;
  fabric: typeof fabric;
  feeds: typeof feeds;
  graph: typeof graph;
  http: typeof http;
  hypotheses: typeof hypotheses;
  inbox: typeof inbox;
  ingest: typeof ingest;
  listening: typeof listening;
  recipes: typeof recipes;
  sourceUtils: typeof sourceUtils;
  sources: typeof sources;
  weeklyBriefs: typeof weeklyBriefs;
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
        { k1?: any; k2?: any; namespace?: any },
        { count: number; sum: number }
      >;
      aggregateBetweenBatch: FunctionReference<
        "query",
        "internal",
        { queries: Array<{ k1?: any; k2?: any; namespace?: any }> },
        Array<{ count: number; sum: number }>
      >;
      atNegativeOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
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
        },
        Array<{ k: any; s: number; v: any }>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key: any; namespace?: any },
        null | { k: any; s: number; v: any }
      >;
      offset: FunctionReference<
        "query",
        "internal",
        { k1?: any; key: any; namespace?: any },
        number
      >;
      offsetUntil: FunctionReference<
        "query",
        "internal",
        { k2?: any; key: any; namespace?: any },
        number
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
        },
        {
          cursor: string;
          isDone: boolean;
          page: Array<{ k: any; s: number; v: any }>;
        }
      >;
      paginateNamespaces: FunctionReference<
        "query",
        "internal",
        { cursor?: string; limit: number },
        { cursor: string; isDone: boolean; page: Array<any> }
      >;
      validate: FunctionReference<
        "query",
        "internal",
        { namespace?: any },
        any
      >;
    };
    inspect: {
      display: FunctionReference<"query", "internal", { namespace?: any }, any>;
      dump: FunctionReference<"query", "internal", { namespace?: any }, string>;
      inspectNode: FunctionReference<
        "query",
        "internal",
        { namespace?: any; node?: string },
        null
      >;
      listTreeNodes: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aggregate?: { count: number; sum: number };
          items: Array<{ k: any; s: number; v: any }>;
          subtrees: Array<string>;
        }>
      >;
      listTrees: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          maxNodeSize: number;
          namespace?: any;
          root: string;
        }>
      >;
    };
    public: {
      clear: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      delete_: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        null
      >;
      deleteIfExists: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        any
      >;
      init: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      insert: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any; summand?: number; value: any },
        null
      >;
      makeRootLazy: FunctionReference<
        "mutation",
        "internal",
        { namespace?: any },
        null
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
        null
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
        any
      >;
    };
  };
  actionCache: {
    crons: {
      purge: FunctionReference<
        "mutation",
        "internal",
        { expiresAt?: number },
        null
      >;
    };
    lib: {
      get: FunctionReference<
        "query",
        "internal",
        { args: any; name: string; ttl: number | null },
        { kind: "hit"; value: any } | { expiredEntry?: string; kind: "miss" }
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
        { cacheHit: boolean; deletedExpiredEntry: boolean }
      >;
      remove: FunctionReference<
        "mutation",
        "internal",
        { args: any; name: string },
        null
      >;
      removeAll: FunctionReference<
        "mutation",
        "internal",
        { batchSize?: number; before?: number; name?: string },
        null
      >;
    };
  };
  workflow: {
    event: {
      create: FunctionReference<
        "mutation",
        "internal",
        { name: string; workflowId: string },
        string
      >;
      send: FunctionReference<
        "mutation",
        "internal",
        {
          eventId?: string;
          name?: string;
          result:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
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
        string
      >;
    };
    journal: {
      load: FunctionReference<
        "query",
        "internal",
        { shortCircuit?: boolean; workflowId: string },
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
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
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
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
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
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      startSteps: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          steps: Array<{
            retry?:
              | boolean
              | { base: number; initialBackoffMs: number; maxAttempts: number };
            schedulerOptions?: { runAt?: number } | { runAfter?: number };
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
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
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
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
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
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
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
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workflowId?: string;
              }
            | {
                args: { eventId?: string };
                argsSize: number;
                completedAt?: number;
                eventId?: string;
                inProgress: boolean;
                kind: "event";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
              };
          stepNumber: number;
          workflowId: string;
        }>
      >;
    };
    workflow: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        null
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        boolean
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          runResult:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId: string;
        },
        null
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          maxParallelism?: number;
          onComplete?: { context?: any; fnHandle: string };
          startAsync?: boolean;
          workflowArgs: any;
          workflowHandle: string;
          workflowName: string;
        },
        string
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { workflowId: string },
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
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
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
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
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
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
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
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
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
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
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
            kind: "function" | "workflow" | "event";
            name: string;
            nestedWorkflowId?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt: number;
            stepId: string;
            stepNumber: number;
            workId?: string;
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
  };
};
