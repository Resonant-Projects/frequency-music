"use node";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, action } from "./_generated/server";
import { requireAuth } from "./auth";
import { DEFAULT_MODEL, MODELS } from "./llm";
import { generateJson } from "./llmNode";
import { claimValidator } from "./shared/claims";
import {
  EXTRACT_SYSTEM_PROMPT,
  EXTRACTION_PROMPT_VERSION,
  extractionInputHash,
  renderExtractionPrompt,
} from "./shared/extractionPrompt";
import { unextractableTextReason } from "./shared/sourceText";

export { MODELS };

// ============================================================================
// EXTRACTION ACTION
// ============================================================================

interface ExtractionResult {
  summary: string;
  claims: Array<{
    text: string;
    evidenceLevel: string;
    truthConfidence?: string;
    interestLevel?: string;
    citations: Array<{ quote?: string; label?: string }>;
  }>;
  compositionParameters: Array<{
    kind?: string;
    type?: string;
    value: string;
    details?: Record<string, unknown>;
  }>;
  topics: string[];
  openQuestions: string[];
}

export function parseConfidenceBand(
  value: unknown,
): "low" | "medium" | "high" | undefined {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : undefined;
}

/**
 * Extract structured data from a source using AI SDK + OpenRouter
 */
async function archiveAsDuplicate(
  ctx: ActionCtx,
  args: { sourceId: Id<"sources">; devBypassSecret?: string },
  holderSourceId: Id<"sources">,
  extractionId: Id<"extractions">,
) {
  // Another Source holds the Extraction (and its claims) for this text.
  await ctx.runMutation(api.sources.updateStatus, {
    id: args.sourceId,
    status: "archived",
    blockedReason: "duplicate",
    blockedDetails: `Same text as source ${holderSourceId} (extraction ${extractionId})`,
    devBypassSecret: args.devBypassSecret,
  });
}

type ExtractionOutcome =
  | { skipped: true; reason: string }
  | {
      success: true;
      model: string;
      summary: string;
      claimCount: number;
      parameterCount: number;
    };

const extractionOutcomeValidator = v.union(
  v.object({
    skipped: v.literal(true),
    reason: v.string(),
  }),
  v.object({
    success: v.literal(true),
    model: v.string(),
    summary: v.string(),
    claimCount: v.number(),
    parameterCount: v.number(),
  }),
);

type ExtractionArgs = {
  sourceId: Id<"sources">;
  force?: boolean;
  devBypassSecret?: string;
};

/**
 * Checks shared by every extraction path before any model work: the Source
 * has extractable text, and no Extraction already covers that text. Returns
 * the outcome when the Source needs no extraction, or its text and inputHash.
 */
async function prepareExtraction(
  ctx: ActionCtx,
  args: ExtractionArgs,
  source: { rawText?: string; transcript?: string },
): Promise<
  | { outcome: ExtractionOutcome }
  | { content: string; inputHash: string; outcome?: undefined }
> {
  const content = source.rawText || source.transcript;
  if (!content) {
    await ctx.runMutation(api.sources.updateStatus, {
      id: args.sourceId,
      status: "review_needed",
      blockedReason: "no_text",
      blockedDetails: "No text content available for extraction",
      devBypassSecret: args.devBypassSecret,
    });
    return { outcome: { skipped: true, reason: "no content" } };
  }

  // Feed excerpts, bot walls and near-empty captures wait for real text
  // instead of spending a model call.
  const unextractable = unextractableTextReason(content);
  if (unextractable) {
    await ctx.runMutation(api.sources.updateStatus, {
      id: args.sourceId,
      status: "review_needed",
      blockedReason: "no_text",
      blockedDetails: unextractable,
      devBypassSecret: args.devBypassSecret,
    });
    return { outcome: { skipped: true, reason: unextractable } };
  }

  // The same text was extracted for another Source (an arXiv paper in two
  // feeds, say): reuse that Extraction instead of paying for the model call.
  const inputHash = await extractionInputHash(content);
  if (!args.force) {
    const found = await ctx.runQuery(
      internal.extractInternal.findExtractionForInput,
      { inputHash, sourceId: args.sourceId },
    );
    if (found?.sameSource) {
      // This Source's own Extraction already covers this text.
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "extracted",
        devBypassSecret: args.devBypassSecret,
      });
      return { outcome: { skipped: true, reason: "already extracted" } };
    }
    if (found) {
      await archiveAsDuplicate(ctx, args, found.sourceId, found.extractionId);
      return { outcome: { skipped: true, reason: "duplicate extraction" } };
    }
  }
  return { content, inputHash };
}

/** Parameters with a kind and a value; `type` falls back to the kind. */
function filterParameters(
  parameters: ExtractionResult["compositionParameters"],
) {
  return parameters.flatMap((p) => {
    const kind = p.kind?.trim();
    const type = p.type?.trim();
    const resolvedKind = kind || type;
    const value = p.value?.trim();
    if (!resolvedKind || !value) return [];
    return [
      {
        kind: resolvedKind,
        type: type || resolvedKind,
        value,
        details: p.details,
      },
    ];
  });
}

/** Stores a parsed Extraction and moves its Source to `extracted`. */
async function persistExtraction(
  ctx: ActionCtx,
  args: ExtractionArgs,
  modelId: string,
  inputHash: string,
  extraction: ExtractionResult,
): Promise<ExtractionOutcome> {
  const filteredParameters = filterParameters(extraction.compositionParameters);

  // Store the extraction
  const stored = await ctx.runMutation(
    internal.extractInternal.storeExtraction,
    {
      sourceId: args.sourceId,
      model: modelId,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      inputHash,
      summary: extraction.summary,
      claims: extraction.claims.map((c) => ({
        text: c.text,
        evidenceLevel: c.evidenceLevel as any,
        truthConfidence: parseConfidenceBand(c.truthConfidence),
        interestLevel: parseConfidenceBand(c.interestLevel),
        citations: c.citations || [],
      })),
      compositionParameters: filteredParameters,
      topics: extraction.topics || [],
      openQuestions: extraction.openQuestions || [],
      confidence: 0.8,
      allowDuplicateInput: args.force === true,
    },
  );
  if (stored.existing && !stored.duplicateOfSource) {
    // A concurrent call for this Source stored the same text first.
    await ctx.runMutation(api.sources.updateStatus, {
      id: args.sourceId,
      status: "extracted",
      devBypassSecret: args.devBypassSecret,
    });
    return { skipped: true, reason: "already extracted" };
  }
  if (stored.duplicateOfSource) {
    // A concurrent Extraction of the same text was stored first.
    await archiveAsDuplicate(
      ctx,
      args,
      stored.duplicateOfSource,
      stored.extractionId,
    );
    return { skipped: true, reason: "duplicate extraction" };
  }

  // Update source status
  await ctx.runMutation(api.sources.updateStatus, {
    id: args.sourceId,
    status: "extracted",
    devBypassSecret: args.devBypassSecret,
  });

  return {
    success: true,
    model: modelId,
    summary: extraction.summary,
    claimCount: extraction.claims.length,
    parameterCount: filteredParameters.length,
  };
}

export const extractSource = action({
  args: {
    sourceId: v.id("sources"),
    model: v.optional(v.string()), // Override model if needed
    force: v.optional(v.boolean()), // Re-extract even if already done
    devBypassSecret: v.optional(v.string()),
  },
  returns: extractionOutcomeValidator,
  handler: async (ctx, args): Promise<ExtractionOutcome> => {
    await requireAuth(ctx, args);
    // Get the source
    const source = await ctx.runQuery(api.sources.get, { id: args.sourceId });
    if (!source) {
      throw new Error("Source not found");
    }

    // Check if already extracted (skip unless forced)
    if (source.status === "extracted" && !args.force) {
      return { skipped: true as const, reason: "already extracted" };
    }

    const prepared = await prepareExtraction(ctx, args, source);
    if (prepared.outcome) return prepared.outcome;
    const { content, inputHash } = prepared;

    // Mark as extracting
    await ctx.runMutation(api.sources.updateStatus, {
      id: args.sourceId,
      status: "extracting",
      devBypassSecret: args.devBypassSecret,
    });

    const userPrompt = renderExtractionPrompt({
      title: source.title,
      canonicalUrl: source.canonicalUrl,
      content,
    });

    const modelId = args.model || DEFAULT_MODEL;

    try {
      const { json } = await generateJson({
        task: "extract_v2",
        model: modelId,
        system: EXTRACT_SYSTEM_PROMPT,
        prompt: userPrompt,
        metadata: {
          sourceId: args.sourceId,
          sourceType: source.type,
          promptVersion: EXTRACTION_PROMPT_VERSION,
        },
      });

      return await persistExtraction(
        ctx,
        args,
        modelId,
        inputHash,
        json as ExtractionResult,
      );
    } catch (error) {
      // Mark as errored
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "review_needed",
        blockedReason: "ai_error",
        blockedDetails: `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        devBypassSecret: args.devBypassSecret,
      });
      throw error;
    }
  },
});

// Models an operator session may record for an Extraction it wrote itself
// (scripts/operator-extraction.ts). Catalog-checked through MODELS.
export const OPERATOR_EXTRACTION_MODELS: readonly string[] = [MODELS.opus];

const operatorExtractionValidator = v.object({
  summary: v.string(),
  claims: v.array(claimValidator),
  compositionParameters: v.array(
    v.object({
      kind: v.optional(v.string()),
      type: v.optional(v.string()),
      value: v.string(),
      details: v.optional(v.any()),
    }),
  ),
  topics: v.array(v.string()),
  openQuestions: v.array(v.string()),
});

/**
 * Operator extraction writes run only as the operator service identity (the
 * bypass secret Varlock resolves for scripts), never as a signed-in user.
 */
async function requireOperator(
  ctx: ActionCtx,
  args: { devBypassSecret?: string },
): Promise<void> {
  const identity = await requireAuth(ctx, args);
  if (!identity.isBypass) {
    throw new Error("Operator extraction requires the operator bypass secret");
  }
}

/**
 * Stores an Extraction written outside the worker by an operator session that
 * read the same extract_v2 prompt (scripts/operator-extraction.ts export).
 * One transaction (extractInternal.storeOperatorExtraction) checks that the
 * Source is still text_ready with the exported text (inputHash), applies the
 * extraction gate and duplicate checks, stores it and marks the Source
 * extracted. No model is called.
 */
export const storeOperatorExtraction = action({
  args: {
    sourceId: v.id("sources"),
    model: v.string(),
    inputHash: v.string(),
    extraction: operatorExtractionValidator,
    devBypassSecret: v.optional(v.string()),
  },
  returns: extractionOutcomeValidator,
  handler: async (ctx, args): Promise<ExtractionOutcome> => {
    await requireOperator(ctx, args);
    if (!OPERATOR_EXTRACTION_MODELS.includes(args.model)) {
      throw new Error(
        `Operator extractions record one of: ${OPERATOR_EXTRACTION_MODELS.join(", ")}`,
      );
    }
    const { extraction } = args;
    if (!extraction.summary.trim()) {
      throw new Error("An operator extraction needs a summary");
    }
    return await ctx.runMutation(
      internal.extractInternal.storeOperatorExtraction,
      {
        sourceId: args.sourceId,
        model: args.model,
        inputHash: args.inputHash,
        summary: extraction.summary,
        claims: extraction.claims,
        compositionParameters: filterParameters(
          extraction.compositionParameters,
        ),
        topics: extraction.topics,
        openQuestions: extraction.openQuestions,
      },
    );
  },
});

/**
 * Parks a text_ready Source whose exported text the extraction gate refuses
 * (feed excerpt, bot wall, near-empty capture), in one transaction that
 * rechecks the exported inputHash. Never calls a model.
 */
export const parkOperatorUnextractable = action({
  args: {
    sourceId: v.id("sources"),
    inputHash: v.string(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({ parked: v.boolean(), reason: v.string() }),
  handler: async (ctx, args): Promise<{ parked: boolean; reason: string }> => {
    await requireOperator(ctx, args);
    return await ctx.runMutation(
      internal.extractInternal.parkOperatorUnextractable,
      { sourceId: args.sourceId, inputHash: args.inputHash },
    );
  },
});

/**
 * Extract all sources that are ready
 */
export const extractAllReady = action({
  args: {
    limit: v.optional(v.number()),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        success: v.boolean(),
        error: v.optional(v.string()),
        summary: v.optional(v.string()),
        model: v.optional(v.string()),
      }),
    ),
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const limit = args.limit ?? 10;
    const sources = await ctx.runQuery(api.sources.listByStatus, {
      status: "text_ready",
      limit,
    });

    const results: Array<{
      id: string;
      title: string;
      success: boolean;
      error?: string;
      summary?: string;
      model?: string;
    }> = [];

    for (const source of sources) {
      try {
        const result = await ctx.runAction(api.extract.extractSource, {
          sourceId: source._id,
          model: args.model,
          devBypassSecret: args.devBypassSecret,
        });
        results.push({
          id: source._id,
          title: source.title || "Untitled",
          success: true,
          ...("success" in result
            ? { summary: result.summary, model: result.model }
            : {}),
        });
      } catch (error) {
        results.push({
          id: source._id,
          title: source.title || "Untitled",
          success: false,
          error: String(error),
        });
      }
    }

    return { results, processed: results.length };
  },
});

/**
 * List available models
 */
export const listModels = action({
  args: {},
  returns: v.object({
    fast: v.string(),
    default: v.string(),
    quality: v.string(),
    sonnet: v.string(),
    haiku: v.string(),
    opus: v.string(),
    gemini: v.string(),
    gpt4: v.string(),
    deepseek: v.string(),
    grok: v.string(),
  }),
  // MODELS also holds non-extraction ids (transcription, luna), which the
  // return validator would reject: return only the listed ones.
  handler: () => ({
    fast: MODELS.fast,
    default: MODELS.default,
    quality: MODELS.quality,
    sonnet: MODELS.sonnet,
    haiku: MODELS.haiku,
    opus: MODELS.opus,
    gemini: MODELS.gemini,
    gpt4: MODELS.gpt4,
    deepseek: MODELS.deepseek,
    grok: MODELS.grok,
  }),
});
