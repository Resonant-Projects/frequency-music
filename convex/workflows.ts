/**
 * Durable Workflows for Resonant Projects
 *
 * Uses @convex-dev/workflow for:
 * - Reliable extraction pipeline with retries
 * - Batch hypothesis/recipe generation
 * - Weekly brief generation
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { workflowManager } from "./components";
import { internal, api } from "./_generated/api";

// ============================================================================
// EXTRACTION WORKFLOW
// ============================================================================

/**
 * Extract a single source with retry logic
 */
export const extractSourceWorkflow = workflowManager.define({
  args: {
    sourceId: v.id("sources"),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // Validate source exists and has content
    const source = await ctx.runQuery(api.sources.get, { id: args.sourceId });

    if (!source) {
      console.log(`Source ${args.sourceId} not found`);
      return;
    }

    if (!source.rawText || source.rawText.length < 100) {
      console.log(`Source ${args.sourceId} has no content`);
      return;
    }

    // Run extraction with retry
    await ctx.runAction(
      api.extract.extractSource,
      { sourceId: args.sourceId, model: args.model },
      { retry: true },
    );

    // Get extraction and link concepts
    const extractions = await ctx.runQuery(api.extractions.getBySourceId, {
      sourceId: args.sourceId,
    });

    if (extractions.length > 0) {
      await ctx.runAction(api.graph.linkExtractionConcepts, {
        extractionId: extractions[0]._id,
      });
    }

    console.log(`Completed extraction workflow for ${args.sourceId}`);
  },
});

/**
 * Batch extraction workflow
 */
export const batchExtractionWorkflow = workflowManager.define({
  args: {
    limit: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const limit = args.limit ?? 10;

    const sources = await ctx.runQuery(api.sources.listByStatus, {
      status: "text_ready",
      limit,
    });

    console.log(`Starting batch extraction of ${sources.length} sources`);

    for (const source of sources) {
      try {
        await ctx.runAction(
          api.extract.extractSource,
          { sourceId: source._id, model: args.model },
          { retry: true },
        );

        const extractions = await ctx.runQuery(api.extractions.getBySourceId, {
          sourceId: source._id,
        });

        if (extractions.length > 0) {
          await ctx.runAction(api.graph.linkExtractionConcepts, {
            extractionId: extractions[0]._id,
          });
        }
      } catch (e) {
        console.error(`Failed to extract ${source._id}: ${e}`);
      }
    }

    console.log(`Batch extraction complete`);
  },
});

// ============================================================================
// HYPOTHESIS WORKFLOW
// ============================================================================

/**
 * Generate hypothesis from extraction with concept linking
 */
export const generateHypothesisWorkflow = workflowManager.define({
  args: {
    extractionId: v.id("extractions"),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const result = await ctx.runAction(
      api.hypotheses.generateFromExtraction,
      { extractionId: args.extractionId, model: args.model },
      { retry: true },
    );

    if (result.hypothesisId) {
      await ctx.runAction(api.graph.linkHypothesisConcepts, {
        hypothesisId: result.hypothesisId,
      });
    }
  },
});

/**
 * Batch hypothesis generation
 */
export const batchHypothesisWorkflow = workflowManager.define({
  args: {
    limit: v.optional(v.number()),
    minClaims: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const limit = args.limit ?? 5;
    const minClaims = args.minClaims ?? 2;

    const extractions = await ctx.runQuery(api.extractions.listRecent, {
      limit: 50,
    });

    const candidates = extractions.filter(
      (e: any) =>
        e.claims.length >= minClaims && e.compositionParameters.length > 0,
    );

    console.log(
      `Found ${candidates.length} candidates for hypothesis generation`,
    );

    for (const extraction of candidates.slice(0, limit)) {
      try {
        const result = await ctx.runAction(
          api.hypotheses.generateFromExtraction,
          { extractionId: extraction._id, model: args.model },
          { retry: true },
        );

        if (result.hypothesisId) {
          await ctx.runAction(api.graph.linkHypothesisConcepts, {
            hypothesisId: result.hypothesisId,
          });
        }
      } catch (e) {
        console.error(`Failed: ${e}`);
      }
    }
  },
});

// ============================================================================
// FULL PIPELINE WORKFLOW
// ============================================================================

/**
 * Full pipeline: extract → hypothesize → recipe
 */
export const fullPipelineWorkflow = workflowManager.define({
  args: {
    extractLimit: v.optional(v.number()),
    hypothesisLimit: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const extractLimit = args.extractLimit ?? 5;
    const hypothesisLimit = args.hypothesisLimit ?? 3;

    console.log("Starting full pipeline");

    // Step 1: Extract sources
    const sources = await ctx.runQuery(api.sources.listByStatus, {
      status: "text_ready",
      limit: extractLimit,
    });

    for (const source of sources) {
      try {
        await ctx.runAction(
          api.extract.extractSource,
          { sourceId: source._id, model: args.model },
          { retry: true },
        );
      } catch (e) {
        console.error(`Extract failed: ${e}`);
      }
    }

    // Step 2: Generate hypotheses
    const extractions = await ctx.runQuery(api.extractions.listRecent, {
      limit: 30,
    });

    const candidates = extractions.filter(
      (e: any) => e.claims.length >= 2 && e.compositionParameters.length > 0,
    );

    for (const extraction of candidates.slice(0, hypothesisLimit)) {
      try {
        const result = await ctx.runAction(
          api.hypotheses.generateFromExtraction,
          { extractionId: extraction._id, model: args.model },
          { retry: true },
        );

        if (result.hypothesisId) {
          // Generate recipe
          await ctx.runAction(
            api.recipes.generateFromHypothesis,
            { hypothesisId: result.hypothesisId, model: args.model },
            { retry: true },
          );
        }
      } catch (e) {
        console.error(`Pipeline step failed: ${e}`);
      }
    }

    console.log("Full pipeline complete");
  },
});

// ============================================================================
// WORKFLOW TRIGGERS
// ============================================================================

/**
 * Start batch extraction workflow
 */
export const startBatchExtraction = mutation({
  args: {
    limit: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workflowId = await workflowManager.start(
      ctx,
      internal.workflows.batchExtractionWorkflow,
      { limit: args.limit, model: args.model },
    );
    return { workflowId };
  },
});

/**
 * Start batch hypothesis workflow
 */
export const startBatchHypothesis = mutation({
  args: {
    limit: v.optional(v.number()),
    minClaims: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workflowId = await workflowManager.start(
      ctx,
      internal.workflows.batchHypothesisWorkflow,
      args,
    );
    return { workflowId };
  },
});

/**
 * Start full pipeline workflow
 */
export const startFullPipeline = mutation({
  args: {
    extractLimit: v.optional(v.number()),
    hypothesisLimit: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workflowId = await workflowManager.start(
      ctx,
      internal.workflows.fullPipelineWorkflow,
      args,
    );
    return { workflowId };
  },
});

/**
 * Get workflow status
 */
export const getStatus = query({
  args: { workflowId: v.string() },
  handler: async (ctx, args) => {
    return await workflowManager.status(ctx, args.workflowId as any);
  },
});
