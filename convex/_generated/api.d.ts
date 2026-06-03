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
import type * as agentRuns from "../agentRuns.js";
import type * as agentTools from "../agentTools.js";
import type * as agentToolsHttp from "../agentToolsHttp.js";
import type * as aggregates from "../aggregates.js";
import type * as auth from "../auth.js";
import type * as campaigns from "../campaigns.js";
import type * as components_ from "../components.js";
import type * as compositions from "../compositions.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as domainMappings from "../domainMappings.js";
import type * as editorialArtifacts from "../editorialArtifacts.js";
import type * as editorialExports from "../editorialExports.js";
import type * as extract from "../extract.js";
import type * as extractInternal from "../extractInternal.js";
import type * as extractions from "../extractions.js";
import type * as fabric from "../fabric.js";
import type * as failures from "../failures.js";
import type * as feeds from "../feeds.js";
import type * as graph from "../graph.js";
import type * as http from "../http.js";
import type * as hypotheses from "../hypotheses.js";
import type * as inbox from "../inbox.js";
import type * as ingest from "../ingest.js";
import type * as listening from "../listening.js";
import type * as phase2 from "../phase2.js";
import type * as recipes from "../recipes.js";
import type * as sourceUtils from "../sourceUtils.js";
import type * as sources from "../sources.js";
import type * as testHelpers from "../testHelpers.js";
import type * as testing from "../testing.js";
import type * as theses from "../theses.js";
import type * as tracing from "../tracing.js";
import type * as validators from "../validators.js";
import type * as vocabulary from "../vocabulary.js";
import type * as weeklyBriefs from "../weeklyBriefs.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agentRuns: typeof agentRuns;
  agentTools: typeof agentTools;
  agentToolsHttp: typeof agentToolsHttp;
  aggregates: typeof aggregates;
  auth: typeof auth;
  campaigns: typeof campaigns;
  components: typeof components_;
  compositions: typeof compositions;
  crons: typeof crons;
  dashboard: typeof dashboard;
  domainMappings: typeof domainMappings;
  editorialArtifacts: typeof editorialArtifacts;
  editorialExports: typeof editorialExports;
  extract: typeof extract;
  extractInternal: typeof extractInternal;
  extractions: typeof extractions;
  fabric: typeof fabric;
  failures: typeof failures;
  feeds: typeof feeds;
  graph: typeof graph;
  http: typeof http;
  hypotheses: typeof hypotheses;
  inbox: typeof inbox;
  ingest: typeof ingest;
  listening: typeof listening;
  phase2: typeof phase2;
  recipes: typeof recipes;
  sourceUtils: typeof sourceUtils;
  sources: typeof sources;
  testHelpers: typeof testHelpers;
  testing: typeof testing;
  theses: typeof theses;
  tracing: typeof tracing;
  validators: typeof validators;
  vocabulary: typeof vocabulary;
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
  aggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregate">;
  actionCache: import("@convex-dev/action-cache/_generated/component.js").ComponentApi<"actionCache">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
