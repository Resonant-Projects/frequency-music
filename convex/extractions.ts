/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { recordEditCapture } from "./editCaptures";
import { compositionParameterValidator } from "./schema";
import { claimValidator } from "./shared/claims";
import { extractionReturnValidator } from "./validators";

// ============================================================================
// EDIT CAPTURE - pure helpers (unit-testable without a DB harness)
// ============================================================================
// Extractions have no `origin` field: every row is produced by the AI
// extraction pipeline (convex/extractInternal.ts is the only inserter), so
// unlike hypotheses there is no human-authored row to exclude. The only gate
// is "did the human-editable content actually change".

export interface ExtractionEditableContent {
  summary: string;
  claims: Doc<"extractions">["claims"];
  compositionParameters: Doc<"extractions">["compositionParameters"];
  topics: string[];
  openQuestions: string[];
  confidence: number;
}

export type ExtractionEditableUpdates = Partial<ExtractionEditableContent>;

export function selectExtractionContent(
  row: ExtractionEditableContent,
): ExtractionEditableContent {
  return {
    summary: row.summary,
    claims: row.claims,
    compositionParameters: row.compositionParameters,
    topics: row.topics,
    openQuestions: row.openQuestions,
    confidence: row.confidence,
  };
}

export function mergeExtractionContent(
  existing: ExtractionEditableContent,
  updates: ExtractionEditableUpdates,
): ExtractionEditableContent {
  return {
    summary: updates.summary ?? existing.summary,
    claims: updates.claims ?? existing.claims,
    compositionParameters:
      updates.compositionParameters ?? existing.compositionParameters,
    topics: updates.topics ?? existing.topics,
    openQuestions: updates.openQuestions ?? existing.openQuestions,
    confidence: updates.confidence ?? existing.confidence,
  };
}

export function extractionContentChanged(
  generated: ExtractionEditableContent,
  edited: ExtractionEditableContent,
): boolean {
  return JSON.stringify(generated) !== JSON.stringify(edited);
}

export interface ExtractionEditCapture {
  promptVersion: string;
  model: string;
  generated: ExtractionEditableContent;
  edited: ExtractionEditableContent;
}

/**
 * Decide whether an extraction edit is capture-worthy and build the
 * (generated, edited) payload. Returns null when nothing actually changed.
 */
export function computeExtractionEditCapture(
  extraction: ExtractionEditableContent & {
    promptVersion: string;
    model: string;
  },
  updates: ExtractionEditableUpdates,
): ExtractionEditCapture | null {
  const generated = selectExtractionContent(extraction);
  const edited = mergeExtractionContent(generated, updates);
  if (!extractionContentChanged(generated, edited)) return null;
  return {
    promptVersion: extraction.promptVersion,
    model: extraction.model,
    generated,
    edited,
  };
}

/**
 * Get a single extraction by ID
 */
export const get = query({
  args: { id: v.id("extractions") },
  returns: v.union(extractionReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("extractions", args.id);
  },
});

/**
 * Get extraction by input hash (for deduplication)
 */
export const getByInputHash = query({
  args: { inputHash: v.string() },
  returns: v.union(extractionReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractions")
      .withIndex("by_inputHash", (q) => q.eq("inputHash", args.inputHash))
      .first();
  },
});

/**
 * Get extractions for a source
 */
export const getBySourceId = query({
  args: { sourceId: v.id("sources") },
  returns: v.array(extractionReturnValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractions")
      .withIndex("by_sourceId_createdAt", (q) =>
        q.eq("sourceId", args.sourceId),
      )
      .order("desc")
      .collect();
  },
});

/**
 * List recent extractions
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(extractionReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db.query("extractions").order("desc").take(limit);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Edit the human-editable content of an extraction (summary, claims,
 * composition parameters, topics, open questions, confidence). Status
 * bookkeeping lives on the source row, not here.
 *
 * Every extraction is AI-generated (there is no human-authored path), so a
 * capture row is written whenever the edited content actually differs from
 * what was stored, preserving the (generated, edited) pair as eval data.
 */
export const editExtraction = mutation({
  args: {
    id: v.id("extractions"),
    summary: v.optional(v.string()),
    claims: v.optional(v.array(claimValidator)),
    compositionParameters: v.optional(v.array(compositionParameterValidator)),
    topics: v.optional(v.array(v.string())),
    openQuestions: v.optional(v.array(v.string())),
    confidence: v.optional(v.number()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const { id, devBypassSecret: _devBypassSecret, ...updates } = args;

    const extraction = await ctx.db.get("extractions", id);
    if (!extraction) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Extraction not found",
      });
    }

    const capture = computeExtractionEditCapture(extraction, updates);
    if (capture) {
      await recordEditCapture(ctx, {
        entityType: "extraction",
        entityId: id,
        promptVersion: capture.promptVersion,
        model: capture.model,
        generated: capture.generated,
        edited: capture.edited,
      });
    }

    await ctx.db.patch("extractions", id, updates);
    return null;
  },
});

/**
 * Backfill first-class claim rows from the denormalized extraction payloads.
 * Dry-run by default at the driver layer; apply:false never writes.
 */
export const backfillClaims = mutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    claimsInserted: v.number(),
    skippedExisting: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const batchSize = Math.min(Math.max(args.batchSize ?? 10, 1), 50);
    const page = await ctx.db
      .query("extractions")
      .paginate({ numItems: batchSize, cursor: args.cursor });
    let claimsInserted = 0;
    let skippedExisting = 0;

    for (const extraction of page.page) {
      const existingClaim = await ctx.db
        .query("claims")
        .withIndex("by_extractionId_ordinal", (q) =>
          q.eq("extractionId", extraction._id),
        )
        .first();
      if (existingClaim) {
        skippedExisting++;
        continue;
      }

      const newestExtraction = await ctx.db
        .query("extractions")
        .withIndex("by_sourceId_createdAt", (q) =>
          q.eq("sourceId", extraction.sourceId),
        )
        .order("desc")
        .first();
      const status =
        newestExtraction?._id === extraction._id ? "active" : "superseded";
      claimsInserted += extraction.claims.length;

      if (!args.apply) continue;
      for (const [ordinal, claim] of extraction.claims.entries()) {
        await ctx.db.insert("claims", {
          extractionId: extraction._id,
          sourceId: extraction.sourceId,
          ordinal,
          ...claim,
          status,
          createdBy: extraction.createdBy,
          createdAt: extraction.createdAt,
        });
      }
    }

    return {
      processed: page.page.length,
      claimsInserted,
      skippedExisting,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
