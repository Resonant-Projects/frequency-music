/**
 * Durable Workflows for Resonant Projects
 *
 * Uses @convex-dev/workflow for:
 * - Reliable extraction pipeline with retries
 * - Batch hypothesis/recipe generation
 * - Weekly brief generation
 */

import { v } from "convex/values";
import type { WorkflowId } from "@convex-dev/workflow";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { workflowManager } from "./components";

interface MinimalExtraction {
  _id: Id<"extractions">;
  claims: unknown[];
  compositionParameters: unknown[];
}

export function countBatchExtractionOutcomes(outcomes: boolean[]) {
  const succeeded = outcomes.filter(Boolean).length;
  const attempted = outcomes.length;
  const failed = attempted - succeeded;
  return {
    attempted,
    succeeded,
    failed,
    allFailed: attempted > 0 && failed === attempted,
  };
}

// Auth bypass secret is threaded through workflow args since workflow handlers
// run in mutation context where process.env is not available.

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
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const devBypassSecret = args.devBypassSecret;
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
      { sourceId: args.sourceId, model: args.model, devBypassSecret },
      { retry: true },
    );

    // Get extraction and link concepts
    const extractions = await ctx.runQuery(api.extractions.getBySourceId, {
      sourceId: args.sourceId,
    });

    const extraction = extractions[0];
    if (extraction) {
      await ctx.runAction(internal.graph.linkExtractionConcepts, {
        extractionId: extraction._id,
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
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const limit = args.limit ?? 10;
    const devBypassSecret = args.devBypassSecret;

    const sources = await ctx.runQuery(api.sources.listByStatus, {
      status: "text_ready",
      limit,
    });

    console.log(`Starting batch extraction of ${sources.length} sources`);

    const outcomes: boolean[] = [];
    for (const source of sources) {
      try {
        await ctx.runAction(
          api.extract.extractSource,
          { sourceId: source._id, model: args.model, devBypassSecret },
          { retry: true },
        );

        const extractions = await ctx.runQuery(api.extractions.getBySourceId, {
          sourceId: source._id,
        });

        const extraction = extractions[0];
        if (extraction) {
          await ctx.runAction(internal.graph.linkExtractionConcepts, {
            extractionId: extraction._id,
          });
        }
        outcomes.push(true);
      } catch (e) {
        outcomes.push(false);
        console.error("Failed to extract source", source._id, e);
      }
    }

    const counts = countBatchExtractionOutcomes(outcomes);
    await ctx.runMutation(internal.dashboard.recordBatchExtractionOutcome, {
      ...counts,
    });
    console.log(
      `Batch extraction complete: attempted=${counts.attempted} succeeded=${counts.succeeded} failed=${counts.failed}`,
    );
    if (counts.allFailed) {
      console.error(
        "Batch extraction failed for every attempted source",
        counts,
      );
    }
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
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const devBypassSecret = args.devBypassSecret;
    const result = await ctx.runAction(
      api.hypotheses.generateFromExtraction,
      { extractionId: args.extractionId, model: args.model, devBypassSecret },
      { retry: true },
    );

    if (result.hypothesisId) {
      await ctx.runAction(internal.graph.linkHypothesisConcepts, {
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
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const limit = args.limit ?? 5;
    const minClaims = args.minClaims ?? 2;
    const devBypassSecret = args.devBypassSecret;

    const candidates: MinimalExtraction[] = await ctx.runQuery(
      internal.hypotheses.listUnlinkedBatchCandidates,
      { limit, minClaims },
    );

    console.log(
      `Found ${candidates.length} candidates for hypothesis generation`,
    );

    for (const extraction of candidates) {
      try {
        const result = await ctx.runAction(
          api.hypotheses.generateFromExtraction,
          { extractionId: extraction._id, model: args.model, devBypassSecret },
          { retry: true },
        );

        if (result.hypothesisId) {
          await ctx.runAction(internal.graph.linkHypothesisConcepts, {
            hypothesisId: result.hypothesisId,
          });
        }
      } catch (e) {
        console.error("Failed to generate hypothesis", e);
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
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const extractLimit = args.extractLimit ?? 5;
    const hypothesisLimit = args.hypothesisLimit ?? 3;
    const devBypassSecret = args.devBypassSecret;

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
          { sourceId: source._id, model: args.model, devBypassSecret },
          { retry: true },
        );
      } catch (e) {
        console.error("Extraction failed", e);
      }
    }

    // Step 2: Generate hypotheses
    const extractions = await ctx.runQuery(api.extractions.listRecent, {
      limit: 30,
    });

    const candidates = extractions.filter(
      (e: MinimalExtraction) =>
        e.claims.length >= 2 && e.compositionParameters.length > 0,
    );

    for (const extraction of candidates.slice(0, hypothesisLimit)) {
      try {
        const result = await ctx.runAction(
          api.hypotheses.generateFromExtraction,
          { extractionId: extraction._id, model: args.model, devBypassSecret },
          { retry: true },
        );

        if (result.hypothesisId) {
          // Generate recipe
          await ctx.runAction(
            api.recipes.generateFromHypothesis,
            {
              hypothesisId: result.hypothesisId,
              model: args.model,
              devBypassSecret,
            },
            { retry: true },
          );
        }
      } catch (e) {
        console.error("Pipeline step failed", e);
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
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({ workflowId: v.string() }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const workflowId: WorkflowId = await workflowManager.start(
      ctx,
      internal.workflows.batchExtractionWorkflow,
      {
        limit: args.limit,
        model: args.model,
        devBypassSecret: args.devBypassSecret,
      },
    );
    return { workflowId };
  },
});

/**
 * Start extraction workflow for a single source.
 */
export const startSingleSourceExtraction = mutation({
  args: {
    sourceId: v.id("sources"),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({ workflowId: v.string() }),
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    await requireAuth(ctx, args);
    const workflowId: WorkflowId = await workflowManager.start(
      ctx,
      internal.workflows.extractSourceWorkflow,
      {
        sourceId: args.sourceId,
        model: args.model,
        devBypassSecret: args.devBypassSecret,
      },
    );
    return { workflowId };
  },
});

/**
 * Start batch extraction (internal, for crons)
 */
export const startBatchExtractionInternal = internalMutation({
  args: {
    limit: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Internal mutations can access process.env; pass bypass secret to workflow
    const devBypassSecret =
      process.env.AUTH_BYPASS_ENABLED === "true"
        ? process.env.AUTH_BYPASS_SECRET
        : undefined;
    await workflowManager.start(
      ctx,
      internal.workflows.batchExtractionWorkflow,
      {
        limit: args.limit,
        model: args.model,
        devBypassSecret,
      },
    );
    return null;
  },
});

/**
 * Start batch hypothesis workflow (internal, for crons — mirrors
 * startBatchExtractionInternal so hypothesis generation is schedulable).
 */
export const startBatchHypothesisInternal = internalMutation({
  args: {
    limit: v.optional(v.number()),
    minClaims: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Internal mutations can access process.env; pass bypass secret to workflow
    const devBypassSecret =
      process.env.AUTH_BYPASS_ENABLED === "true"
        ? process.env.AUTH_BYPASS_SECRET
        : undefined;
    await workflowManager.start(
      ctx,
      internal.workflows.batchHypothesisWorkflow,
      {
        limit: args.limit,
        minClaims: args.minClaims,
        model: args.model,
        devBypassSecret,
      },
    );
    return null;
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
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({ workflowId: v.string() }),
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    await requireAuth(ctx, args);
    const workflowId: WorkflowId = await workflowManager.start(
      ctx,
      internal.workflows.batchHypothesisWorkflow,
      {
        limit: args.limit,
        minClaims: args.minClaims,
        model: args.model,
        devBypassSecret: args.devBypassSecret,
      },
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
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({ workflowId: v.string() }),
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    await requireAuth(ctx, args);
    const workflowId: WorkflowId = await workflowManager.start(
      ctx,
      internal.workflows.fullPipelineWorkflow,
      {
        extractLimit: args.extractLimit,
        hypothesisLimit: args.hypothesisLimit,
        model: args.model,
        devBypassSecret: args.devBypassSecret,
      },
    );
    return { workflowId };
  },
});

/**
 * Get workflow status
 */
export const getStatus = query({
  args: { workflowId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await workflowManager.status(ctx, args.workflowId as WorkflowId);
  },
});
