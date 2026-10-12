"use node";
import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, action, internalAction } from "./_generated/server";
import { requireAuth } from "./auth";
import { prepareRetirement } from "./extractInternal";
import { DEFAULT_MODEL, MODELS } from "./llm";
import { generateJson } from "./llmNode";
import { claimValidator } from "./shared/claims";
import { redactError } from "./shared/redactError";
import { truncateText } from "./shared/truncateText";

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

type ExtractionOutcome =
  | { skipped: true; reason: string }
  | {
      success: true;
      extractionId?: Id<"extractions">;
      current?: boolean;
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
    extractionId: v.optional(v.id("extractions")),
    current: v.optional(v.boolean()),
    model: v.string(),
    summary: v.string(),
    claimCount: v.number(),
    parameterCount: v.number(),
  }),
);

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

export const extractSource = action({
  args: {
    sourceId: v.id("sources"),
    model: v.optional(v.string()),
    force: v.optional(v.boolean()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: extractionOutcomeValidator,
  handler: async (ctx, args): Promise<ExtractionOutcome> => {
    await requireAuth(ctx, args);
    const prepared = await ctx.runMutation(
      internal.extractInternal.beginExtraction,
      {
        sourceId: args.sourceId,
        model: args.model || DEFAULT_MODEL,
        force: args.force,
      },
    );
    if (prepared.skipped) return { skipped: true, reason: prepared.reason };
    return executeAttempt(ctx, prepared.attemptId);
  },
});

async function executeAttempt(
  ctx: ActionCtx,
  attemptId: Id<"extractionAttempts">,
): Promise<ExtractionOutcome> {
  let attempt = await ctx.runQuery(internal.extractInternal.getAttempt, {
    attemptId,
  });
  if (!attempt) throw new Error("Extraction attempt not found");
  const generationLease = randomUUID();
  try {
    if (
      !attempt.result &&
      !(await ctx.runMutation(internal.extractInternal.claimGeneration, {
        attemptId,
        lease: generationLease,
      }))
    ) {
      // A producer may have retained its result after our initial read.
      const latest = await ctx.runQuery(internal.extractInternal.getAttempt, {
        attemptId,
      });
      if (!latest?.result) {
        return {
          skipped: true,
          reason: "extraction generation already in progress",
        };
      }
      attempt = latest;
    }
    if (!attempt.result) {
      const { json } = await generateJson({
        task:
          attempt.promptVersion === "extract_v3" ? "extract_v3" : "extract_v2",
        model: attempt.model,
        system: attempt.systemPrompt,
        prompt: attempt.prompt,
        metadata: {
          sourceId: attempt.sourceId,
          promptVersion: attempt.promptVersion,
        },
      });
      const result = json as ExtractionResult;
      await ctx.runMutation(internal.extractInternal.retainExtractionResult, {
        attemptId: attempt._id,
        generationLease,
        result: {
          summary: result.summary,
          claims: result.claims.map((c) => ({
            text: c.text,
            evidenceLevel: c.evidenceLevel as any,
            truthConfidence: parseConfidenceBand(c.truthConfidence),
            interestLevel: parseConfidenceBand(c.interestLevel),
            citations: c.citations || [],
          })),
          compositionParameters: filterParameters(result.compositionParameters),
          topics: result.topics || [],
          openQuestions: result.openQuestions || [],
        },
      });
    }
    const completed = await ctx.runAction(
      internal.extractInternal.completeExtraction,
      { attemptId: attempt._id },
    );
    return { success: true, ...completed };
  } catch (error) {
    await ctx.runMutation(internal.extractInternal.failExtraction, {
      attemptId: attempt._id,
      // Result replay did not acquire a new generation lease.
      generationLease: attempt.result
        ? attempt.generationLease
        : generationLease,
      error: truncateText(redactError(error), 1000),
    });
    throw error;
  }
}
export const resumeAttempt = internalAction({
  args: { attemptId: v.id("extractionAttempts") },
  returns: extractionOutcomeValidator,
  handler: (ctx, args): Promise<ExtractionOutcome> =>
    executeAttempt(ctx, args.attemptId),
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

/** Pin an operator export before any external model work begins. */
export const beginOperatorExtraction = action({
  args: {
    sourceId: v.id("sources"),
    inputHash: v.string(),
    model: v.string(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      snapshotId: v.id("extractionAttempts"),
      prompt: v.string(),
      system: v.string(),
      promptVersion: v.string(),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{
    snapshotId: Id<"extractionAttempts">;
    prompt: string;
    system: string;
    promptVersion: string;
  } | null> => {
    await requireOperator(ctx, args);
    if (!OPERATOR_EXTRACTION_MODELS.includes(args.model))
      throw new Error("Unsupported operator model");
    const started = await ctx.runMutation(
      internal.extractInternal.beginExtraction,
      {
        sourceId: args.sourceId,
        model: args.model,
        expectedInputHash: args.inputHash,
      },
    );
    if (started.skipped) return null;
    return {
      snapshotId: started.attemptId,
      prompt: started.prompt,
      system: started.systemPrompt,
      promptVersion: started.promptVersion,
    };
  },
});

/**
 * Stores an Extraction written outside the worker by an operator session that
 * read the same extract_v3 prompt (scripts/operator-extraction.ts export).
 * One transaction (extractInternal.storeOperatorExtraction) checks that the
 * Source is still text_ready with the exported text (inputHash), applies the
 * extraction gate and duplicate checks, stores it and marks the Source
 * extracted. No model is called.
 */
export const storeOperatorExtraction = action({
  args: {
    sourceId: v.id("sources"),
    snapshotId: v.optional(v.id("extractionAttempts")),
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
    if (args.snapshotId) {
      const attempt = await ctx.runQuery(internal.extractInternal.getAttempt, {
        attemptId: args.snapshotId,
      });
      if (
        !attempt ||
        attempt.origin !== "operator" ||
        attempt.sourceId !== args.sourceId ||
        attempt.inputHash !== args.inputHash ||
        attempt.model !== args.model
      )
        throw new Error("Operator snapshot does not match result provenance");
      await ctx.runMutation(internal.extractInternal.retainExtractionResult, {
        attemptId: args.snapshotId,
        result: {
          ...extraction,
          compositionParameters: filterParameters(
            extraction.compositionParameters,
          ),
        },
      });
      return {
        success: true,
        ...(await ctx.runAction(internal.extractInternal.completeExtraction, {
          attemptId: args.snapshotId,
        })),
      };
    }
    await prepareRetirement(ctx, {
      sourceId: args.sourceId,
      inputHash: args.inputHash,
    });
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
