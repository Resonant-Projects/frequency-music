/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as extract from "../extract.js";
import type * as extractions from "../extractions.js";
import type * as fabric from "../fabric.js";
import type * as feeds from "../feeds.js";
import type * as hypotheses from "../hypotheses.js";
import type * as ingest from "../ingest.js";
import type * as recipes from "../recipes.js";
import type * as sources from "../sources.js";
import type * as weeklyBriefs from "../weeklyBriefs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  extract: typeof extract;
  extractions: typeof extractions;
  fabric: typeof fabric;
  feeds: typeof feeds;
  hypotheses: typeof hypotheses;
  ingest: typeof ingest;
  recipes: typeof recipes;
  sources: typeof sources;
  weeklyBriefs: typeof weeklyBriefs;
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

export declare const components: {};
