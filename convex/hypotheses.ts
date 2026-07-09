import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { recordEditCapture } from "./editCaptures";
import { DEFAULT_MODEL, extractJsonObject } from "./llm";
import { hypothesisStatusValidator } from "./schema";
import {
  hypothesisReturnValidator,
  sourceReturnValidator,
  thesisReturnValidator,
} from "./validators";

interface GeneratedHypothesisPayload {
  title: string;
  question: string;
  hypothesis: string;
  whyThisMatters: string;
  rationaleMd: string;
  concepts?: string[];
}

type BatchGenerationResult =
  | {
      success: true;
      hypothesisId: Id<"hypotheses">;
      model: string;
      generated: GeneratedHypothesisPayload;
    }
  | {
      success: false;
      extractionId: Id<"extractions">;
      error: string;
    };

type GenerateFromExtractionResult = {
  hypothesisId: Id<"hypotheses">;
  model: string;
  generated: GeneratedHypothesisPayload;
};

const generateFromExtractionRef = makeFunctionReference<"action">(
  "hypotheses:generateFromExtraction",
);

async function loadThesisOrThrow(
  ctx: {
    db: {
      get: (table: "theses", id: Id<"theses">) => Promise<unknown>;
    };
  },
  thesisId: Id<"theses">,
) {
  const thesis = await ctx.db.get("theses", thesisId);
  if (!thesis) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Thesis not found",
    });
  }
  return thesis;
}

export function assertWhyThisMatters(
  value: string,
  field = "whyThisMatters",
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${field} is required`,
      field,
    });
  }
  return trimmed;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List hypotheses by status
 */
export const listByStatus = query({
  args: {
    status: v.optional(hypothesisStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(hypothesisReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const status = args.status;

    if (status !== undefined) {
      return await ctx.db
        .query("hypotheses")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("hypotheses").order("desc").take(limit);
  },
});

/**
 * Get a single hypothesis with its linked sources
 */
export const get = query({
  args: { id: v.id("hypotheses") },
  returns: v.union(
    v.object({
      ...hypothesisReturnValidator.fields,
      sources: v.array(sourceReturnValidator),
      thesis: v.union(thesisReturnValidator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const hypothesis = await ctx.db.get("hypotheses", args.id);
    if (!hypothesis) return null;

    // Fetch linked sources
    const sources = await Promise.all(
      hypothesis.sourceIds.map((id) => ctx.db.get("sources", id)),
    );
    const thesis = hypothesis.thesisId
      ? await ctx.db.get("theses", hypothesis.thesisId)
      : null;

    return {
      ...hypothesis,
      sources: sources.filter((s): s is NonNullable<typeof s> => s !== null),
      thesis,
    };
  },
});

/**
 * Get hypotheses linked to a specific source
 */
export const getBySourceId = query({
  args: { sourceId: v.id("sources") },
  returns: v.array(hypothesisReturnValidator),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("hypotheses").order("desc").take(200);
    return all.filter((h) => h.sourceIds.includes(args.sourceId));
  },
});

export const listByThesis = query({
  args: {
    thesisId: v.id("theses"),
    limit: v.optional(v.number()),
  },
  returns: v.array(hypothesisReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("hypotheses")
      .withIndex("by_thesisId_updatedAt", (q) =>
        q.eq("thesisId", args.thesisId),
      )
      .order("desc")
      .take(limit);
  },
});

export const listMissingWhyThisMatters = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(hypothesisReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows = await ctx.db
      .query("hypotheses")
      .filter((q) => q.eq(q.field("whyThisMatters"), undefined))
      .collect();
    return rows.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new hypothesis
 */
export const create = mutation({
  args: {
    title: v.string(),
    question: v.string(),
    hypothesis: v.string(),
    whyThisMatters: v.optional(v.string()),
    rationaleMd: v.string(),
    thesisId: v.optional(v.id("theses")),
    sourceIds: v.array(v.id("sources")),
    concepts: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("hypotheses"),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const identity = await requireAuth(ctx, args);
    const now = Date.now();
    const whyThisMatters = assertWhyThisMatters(
      createArgs.whyThisMatters ?? createArgs.rationaleMd,
    );
    if (createArgs.thesisId) {
      await loadThesisOrThrow(ctx, createArgs.thesisId);
    }

    return await ctx.db.insert("hypotheses", {
      ...createArgs,
      whyThisMatters,
      status: "draft",
      visibility: "private",
      createdBy:
        identity.subject === "system"
          ? "system"
          : (identity.subject as Id<"users">),
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a hypothesis
 */
export const update = mutation({
  args: {
    id: v.id("hypotheses"),
    title: v.optional(v.string()),
    question: v.optional(v.string()),
    hypothesis: v.optional(v.string()),
    whyThisMatters: v.optional(v.string()),
    rationaleMd: v.optional(v.string()),
    thesisId: v.optional(v.union(v.id("theses"), v.null())),
    sourceIds: v.optional(v.array(v.id("sources"))),
    concepts: v.optional(v.array(v.string())),
    status: v.optional(hypothesisStatusValidator),
    resolution: v.optional(
      v.union(
        v.literal("supported"),
        v.literal("inconclusive"),
        v.literal("contradicted"),
      ),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const {
      id,
      devBypassSecret: _devBypassSecret,
      thesisId,
      ...updates
    } = args;

    const hypothesis = await ctx.db.get("hypotheses", id);
    if (!hypothesis) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Hypothesis not found",
      });
    }

    if (thesisId) {
      await loadThesisOrThrow(ctx, thesisId);
    }

    const whyThisMatters =
      updates.whyThisMatters !== undefined
        ? assertWhyThisMatters(updates.whyThisMatters)
        : hypothesis.whyThisMatters !== undefined
          ? assertWhyThisMatters(hypothesis.whyThisMatters)
          : undefined;

    const hasContentEdit =
      updates.title !== undefined ||
      updates.question !== undefined ||
      updates.hypothesis !== undefined ||
      updates.whyThisMatters !== undefined ||
      updates.rationaleMd !== undefined ||
      updates.sourceIds !== undefined ||
      updates.concepts !== undefined ||
      thesisId !== undefined;

    // Preserve complete (generated, edited) pairs for agent-originated content
    // edits as eval data. Status/resolution-only changes are lifecycle metadata,
    // not golden-output candidates.
    if (hypothesis.origin === "agent" && hasContentEdit) {
      await recordEditCapture(ctx, {
        entityType: "hypothesis",
        entityId: id,
        generated: {
          title: hypothesis.title,
          question: hypothesis.question,
          hypothesis: hypothesis.hypothesis,
          whyThisMatters: hypothesis.whyThisMatters,
          rationaleMd: hypothesis.rationaleMd,
          thesisId: hypothesis.thesisId,
          sourceIds: hypothesis.sourceIds,
          concepts: hypothesis.concepts,
        },
        edited: {
          title: updates.title ?? hypothesis.title,
          question: updates.question ?? hypothesis.question,
          hypothesis: updates.hypothesis ?? hypothesis.hypothesis,
          whyThisMatters,
          rationaleMd: updates.rationaleMd ?? hypothesis.rationaleMd,
          thesisId:
            thesisId === undefined
              ? hypothesis.thesisId
              : thesisId === null
                ? undefined
                : thesisId,
          sourceIds: updates.sourceIds ?? hypothesis.sourceIds,
          concepts: updates.concepts ?? hypothesis.concepts,
        },
      });
    }

    const patch = {
      ...updates,
      ...(whyThisMatters !== undefined ? { whyThisMatters } : {}),
      ...(thesisId !== undefined
        ? { thesisId: thesisId === null ? undefined : thesisId }
        : {}),
      updatedAt: Date.now(),
    };

    await ctx.db.patch("hypotheses", id, patch);
    return null;
  },
});

/**
 * Update hypothesis status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("hypotheses"),
    status: hypothesisStatusValidator,
    resolution: v.optional(
      v.union(
        v.literal("supported"),
        v.literal("inconclusive"),
        v.literal("contradicted"),
      ),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.patch("hypotheses", args.id, {
      status: args.status,
      resolution: args.resolution,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// ============================================================================
// AI GENERATION
// ============================================================================

const HYPOTHESIS_SYSTEM_PROMPT = `You are a research scientist helping to generate testable hypotheses for music/sound experiments.

Your task is to take extracted claims and composition parameters from research sources and formulate testable hypotheses.

A good hypothesis should:
1. Be specific and testable through musical composition
2. Connect a cause (musical parameter) to an effect (perceptual/emotional outcome)
3. Reference supporting evidence from the source material
4. Include measurable or observable outcomes

Format:
- **Question**: What are we trying to find out?
- **Hypothesis**: If/then statement (If we do X, then Y will occur because Z)
- **Why This Matters**: What musical or perceptual stakes make this worth studio time
- **Rationale**: Why we think this, citing claims
- **Concepts**: Key terms and domains`;

const HYPOTHESIS_USER_PROMPT = `Based on the following extracted claims and parameters, generate a testable hypothesis.

**Source Title**: {{sourceTitle}}

**Claims**:
{{claims}}

**Composition Parameters**:
{{parameters}}

**Topics**: {{topics}}

Generate a hypothesis that could be tested through musical composition. Be specific about:
1. What musical parameters to manipulate
2. What effect we expect to observe
3. How this connects to the source claims

Respond in JSON format:
{
  "title": "Short descriptive title",
  "question": "What question does this address?",
  "hypothesis": "If/then statement",
  "whyThisMatters": "Why this deserves studio time and what would change musically if it holds",
  "rationaleMd": "Markdown explanation with citations to the claims",
  "concepts": ["concept1", "concept2"]
}`;

/**
 * Generate a hypothesis from an extraction using AI
 */
export const generateFromExtraction = action({
  args: {
    extractionId: v.id("extractions"),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    hypothesisId: v.id("hypotheses"),
    model: v.string(),
    generated: v.object({
      title: v.string(),
      question: v.string(),
      hypothesis: v.string(),
      whyThisMatters: v.string(),
      rationaleMd: v.string(),
      concepts: v.optional(v.array(v.string())),
    }),
  }),
  handler: async (ctx, args): Promise<GenerateFromExtractionResult> => {
    await requireAuth(ctx, args);
    // Get extraction
    const extraction: Doc<"extractions"> | null = await ctx.runQuery(
      api.extractions.get,
      {
        id: args.extractionId,
      },
    );

    if (!extraction) {
      throw new Error("Extraction not found");
    }

    // Get source
    const source: Doc<"sources"> | null = await ctx.runQuery(api.sources.get, {
      id: extraction.sourceId,
    });

    if (!source) {
      throw new Error("Source not found");
    }

    // Build prompt
    const claimsText = extraction.claims
      .map(
        (c: Doc<"extractions">["claims"][number], i: number) =>
          `${i + 1}. [${c.evidenceLevel}] ${c.text}`,
      )
      .join("\n");

    const paramsText =
      extraction.compositionParameters
        .map(
          (p: Doc<"extractions">["compositionParameters"][number]) =>
            `- ${p.kind ?? p.type ?? "parameter"}: ${p.value}`,
        )
        .join("\n") || "None specified";

    const prompt = HYPOTHESIS_USER_PROMPT.replace(
      "{{sourceTitle}}",
      source.title || "Untitled",
    )
      .replace("{{claims}}", claimsText)
      .replace("{{parameters}}", paramsText)
      .replace("{{topics}}", extraction.topics.join(", "));

    // Call AI (traced as hypothesis_v1 in the Node-runtime internal action)
    const modelId = args.model || DEFAULT_MODEL;

    const { text } = await ctx.runAction(
      internal.hypothesesInternal.generateHypothesisText,
      {
        system: HYPOTHESIS_SYSTEM_PROMPT,
        prompt,
        model: modelId,
        extractionId: args.extractionId,
        sourceId: extraction.sourceId,
        promptVersion: "hypothesis_v1",
      },
    );

    // Parse response
    let parsed: GeneratedHypothesisPayload;
    try {
      parsed = extractJsonObject(text) as GeneratedHypothesisPayload;
      parsed.whyThisMatters = assertWhyThisMatters(
        parsed.whyThisMatters,
        "generated.whyThisMatters",
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`, { cause: e });
    }

    // Create hypothesis
    const hypothesisId: Id<"hypotheses"> = await ctx.runMutation(
      api.hypotheses.create,
      {
        title: parsed.title,
        question: parsed.question,
        hypothesis: parsed.hypothesis,
        whyThisMatters: parsed.whyThisMatters,
        rationaleMd: parsed.rationaleMd,
        sourceIds: [extraction.sourceId],
        concepts: parsed.concepts,
        devBypassSecret: args.devBypassSecret,
      },
    );

    return {
      hypothesisId,
      model: modelId,
      generated: parsed,
    };
  },
});

/**
 * Generate hypotheses from multiple high-value extractions
 */
export const generateBatch = action({
  args: {
    limit: v.optional(v.number()),
    minClaims: v.optional(v.number()),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.array(
    v.union(
      v.object({
        success: v.literal(true),
        hypothesisId: v.id("hypotheses"),
        model: v.string(),
        generated: v.object({
          title: v.string(),
          question: v.string(),
          hypothesis: v.string(),
          whyThisMatters: v.string(),
          rationaleMd: v.string(),
          concepts: v.optional(v.array(v.string())),
        }),
      }),
      v.object({
        success: v.literal(false),
        extractionId: v.id("extractions"),
        error: v.string(),
      }),
    ),
  ),
  handler: async (ctx, args): Promise<BatchGenerationResult[]> => {
    await requireAuth(ctx, args);
    const limit = args.limit ?? 3;
    const minClaims = args.minClaims ?? 2;

    // Get extractions with enough claims
    const extractions: Doc<"extractions">[] = await ctx.runQuery(
      api.extractions.listRecent,
      {
        limit: 50,
      },
    );

    const candidates: Doc<"extractions">[] = extractions.filter(
      (e: Doc<"extractions">) =>
        e.claims.length >= minClaims && e.compositionParameters.length > 0,
    );

    const results: BatchGenerationResult[] = [];

    for (const extraction of candidates.slice(0, limit)) {
      try {
        const result = await ctx.runAction(generateFromExtractionRef, {
          extractionId: extraction._id,
          model: args.model,
          devBypassSecret: args.devBypassSecret,
        });
        results.push({ success: true, ...result });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        results.push({
          success: false,
          extractionId: extraction._id,
          error: message,
        });
      }
    }

    return results;
  },
});

/**
 * Delete a hypothesis by ID
 */
export const deleteById = mutation({
  args: { id: v.id("hypotheses"), devBypassSecret: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.delete(args.id);
    return null;
  },
});
