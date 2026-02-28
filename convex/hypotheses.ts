import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";

type HypothesisStatus =
  | "draft"
  | "queued"
  | "active"
  | "evaluated"
  | "revised"
  | "retired";
const hypothesisStatusValidator = v.union(
  v.literal("draft"),
  v.literal("queued"),
  v.literal("active"),
  v.literal("evaluated"),
  v.literal("revised"),
  v.literal("retired"),
);

interface GeneratedHypothesisPayload {
  title: string;
  question: string;
  hypothesis: string;
  rationaleMd: string;
  concepts?: string[];
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
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    if (args.status !== undefined) {
      return await ctx.db
        .query("hypotheses")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status))
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
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const hypothesis = await ctx.db.get("hypotheses", args.id);
    if (!hypothesis) return null;

    // Fetch linked sources
    const sources = await Promise.all(
      hypothesis.sourceIds.map((id) => ctx.db.get("sources", id)),
    );

    return {
      ...hypothesis,
      sources: sources.filter(Boolean),
    };
  },
});

/**
 * Get hypotheses linked to a specific source
 */
export const getBySourceId = query({
  args: { sourceId: v.id("sources") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("hypotheses").collect();
    return all.filter((h) => h.sourceIds.includes(args.sourceId));
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
    rationaleMd: v.string(),
    sourceIds: v.array(v.id("sources")),
    concepts: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("hypotheses"),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const identity = await requireAuth(ctx, args);
    const now = Date.now();

    return await ctx.db.insert("hypotheses", {
      ...createArgs,
      status: "draft",
      visibility: "private",
      createdBy: identity.subject,
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
    rationaleMd: v.optional(v.string()),
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
    const { id, devBypassSecret: _devBypassSecret, ...updates } = args;

    const hypothesis = await ctx.db.get("hypotheses", id);
    if (!hypothesis) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Hypothesis not found",
      });
    }

    await ctx.db.patch("hypotheses", id, { ...updates, updatedAt: Date.now() });
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
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.patch("hypotheses", args.id, {
      status: args.status,
      resolution: args.resolution,
      updatedAt: Date.now(),
    });
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
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    // Get extraction
    const extraction = await ctx.runQuery(api.extractions.get, {
      id: args.extractionId,
    });

    if (!extraction) {
      throw new Error("Extraction not found");
    }

    // Get source
    const source = await ctx.runQuery(api.sources.get, {
      id: extraction.sourceId,
    });

    if (!source) {
      throw new Error("Source not found");
    }

    // Build prompt
    const claimsText = extraction.claims
      .map((c, i) => `${i + 1}. [${c.evidenceLevel}] ${c.text}`)
      .join("\n");

    const paramsText =
      extraction.compositionParameters
        .map((p) => `- ${p.type}: ${p.value}`)
        .join("\n") || "None specified";

    const prompt = HYPOTHESIS_USER_PROMPT.replace(
      "{{sourceTitle}}",
      source.title || "Untitled",
    )
      .replace("{{claims}}", claimsText)
      .replace("{{parameters}}", paramsText)
      .replace("{{topics}}", extraction.topics.join(", "));

    // Call AI
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured");

    const openrouter = createOpenRouter({ apiKey: openRouterKey });
    const modelId = args.model || "anthropic/claude-sonnet-4-6";

    const result = await generateText({
      model: openrouter(modelId),
      system: HYPOTHESIS_SYSTEM_PROMPT,
      prompt,
      maxTokens: 2000,
    });

    // Parse response
    let parsed: GeneratedHypothesisPayload;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]) as GeneratedHypothesisPayload;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`);
    }

    // Create hypothesis
    const hypothesisId = await ctx.runMutation(api.hypotheses.create, {
      title: parsed.title,
      question: parsed.question,
      hypothesis: parsed.hypothesis,
      rationaleMd: parsed.rationaleMd,
      sourceIds: [extraction.sourceId],
      concepts: parsed.concepts,
      devBypassSecret: args.devBypassSecret,
    });

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
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const limit = args.limit ?? 3;
    const minClaims = args.minClaims ?? 2;

    // Get extractions with enough claims
    const extractions = await ctx.runQuery(api.extractions.listRecent, {
      limit: 50,
    });

    const candidates = extractions.filter(
      (e) => e.claims.length >= minClaims && e.compositionParameters.length > 0,
    );

    const results = [];

    for (const extraction of candidates.slice(0, limit)) {
      try {
        const result = await ctx.runAction(
          api.hypotheses.generateFromExtraction,
          {
            extractionId: extraction._id,
            model: args.model,
            devBypassSecret: args.devBypassSecret,
          },
        );
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
