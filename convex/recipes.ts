import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";

const recipeStatusValidator = v.union(
  v.literal("draft"),
  v.literal("in_use"),
  v.literal("archived"),
);

interface RecipeParameter {
  type: string;
  value: string;
  details?: unknown;
}

interface RecipeProtocol {
  studyType: "litmus" | "comparison";
  durationSecs: number;
  panelPlanned: string[];
  listeningContext?: string;
  listeningMethod?: string;
  whatVaries: string[];
  whatStaysConstant: string[];
}

interface ParsedRecipePayload {
  title: string;
  bodyMd: string;
  parameters: RecipeParameter[];
  dawChecklist: string[];
  protocol?: {
    studyType?: "litmus" | "comparison";
    durationSecs?: number;
    panelPlanned?: string[];
    listeningContext?: string;
    listeningMethod?: string;
    whatVaries?: string[];
    whatStaysConstant?: string[];
  };
}

function validateGeneratedRecipePayload(raw: unknown): ParsedRecipePayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe payload must be an object",
      field: "root",
      raw,
    });
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.title !== "string" || row.title.trim().length === 0) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe title must be a non-empty string",
      field: "title",
      raw,
    });
  }
  if (typeof row.bodyMd !== "string" || row.bodyMd.trim().length === 0) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe bodyMd must be a non-empty string",
      field: "bodyMd",
      raw,
    });
  }
  if (!Array.isArray(row.parameters)) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe parameters must be an array",
      field: "parameters",
      raw,
    });
  }
  const parameters: RecipeParameter[] = row.parameters.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "recipe parameter must be an object",
        field: `parameters[${index}]`,
        raw,
      });
    }
    const param = value as Record<string, unknown>;
    if (typeof param.type !== "string" || param.type.trim().length === 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "recipe parameter type must be a non-empty string",
        field: `parameters[${index}].type`,
        raw,
      });
    }
    if (typeof param.value !== "string" || param.value.trim().length === 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "recipe parameter value must be a non-empty string",
        field: `parameters[${index}].value`,
        raw,
      });
    }

    return {
      type: param.type,
      value: param.value,
      details: param.details,
    };
  });
  if (
    !Array.isArray(row.dawChecklist) ||
    row.dawChecklist.some(
      (item) => typeof item !== "string" || item.trim().length === 0,
    )
  ) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe dawChecklist must be string[]",
      field: "dawChecklist",
      raw,
    });
  }

  const protocol = row.protocol;
  if (protocol !== undefined) {
    if (!protocol || typeof protocol !== "object" || Array.isArray(protocol)) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "generated recipe protocol must be an object",
        field: "protocol",
        raw,
      });
    }

    const p = protocol as Record<string, unknown>;
    if (
      p.studyType !== undefined &&
      p.studyType !== "litmus" &&
      p.studyType !== "comparison"
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "protocol.studyType must be litmus|comparison",
        field: "protocol.studyType",
        raw,
      });
    }
    if (p.durationSecs !== undefined && typeof p.durationSecs !== "number") {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "protocol.durationSecs must be a number",
        field: "protocol.durationSecs",
        raw,
      });
    }
    if (
      p.panelPlanned !== undefined &&
      (!Array.isArray(p.panelPlanned) ||
        p.panelPlanned.some(
          (item) => typeof item !== "string" || item.trim().length === 0,
        ))
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "protocol.panelPlanned must be string[]",
        field: "protocol.panelPlanned",
        raw,
      });
    }
    if (
      p.whatVaries !== undefined &&
      (!Array.isArray(p.whatVaries) ||
        p.whatVaries.some(
          (item) => typeof item !== "string" || item.trim().length === 0,
        ))
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "protocol.whatVaries must be string[]",
        field: "protocol.whatVaries",
        raw,
      });
    }
    if (
      p.whatStaysConstant !== undefined &&
      (!Array.isArray(p.whatStaysConstant) ||
        p.whatStaysConstant.some(
          (item) => typeof item !== "string" || item.trim().length === 0,
        ))
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "protocol.whatStaysConstant must be string[]",
        field: "protocol.whatStaysConstant",
        raw,
      });
    }
  }

  return {
    title: row.title,
    bodyMd: row.bodyMd,
    parameters,
    dawChecklist: row.dawChecklist as string[],
    protocol: row.protocol as ParsedRecipePayload["protocol"],
  };
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List recipes by status
 */
export const listByStatus = query({
  args: {
    status: v.optional(recipeStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    if (args.status !== undefined) {
      return await ctx.db
        .query("recipes")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("recipes").order("desc").take(limit);
  },
});

/**
 * Get a single recipe with its hypothesis
 */
export const get = query({
  args: { id: v.id("recipes") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get("recipes", args.id);
    if (!recipe) return null;

    const hypothesis = await ctx.db.get("hypotheses", recipe.hypothesisId);

    return {
      ...recipe,
      hypothesis,
    };
  },
});

/**
 * Get recipes for a hypothesis
 */
export const getByHypothesisId = query({
  args: { hypothesisId: v.id("hypotheses") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recipes")
      .withIndex("by_hypothesisId_updatedAt", (q) =>
        q.eq("hypothesisId", args.hypothesisId),
      )
      .order("desc")
      .collect();
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new recipe
 */
export const create = mutation({
  args: {
    hypothesisId: v.id("hypotheses"),
    title: v.string(),
    bodyMd: v.string(),
    parameters: v.array(
      v.object({
        type: v.string(),
        value: v.string(),
        details: v.optional(v.any()),
      }),
    ),
    dawChecklist: v.array(v.string()),
    protocol: v.optional(
      v.object({
        studyType: v.union(v.literal("litmus"), v.literal("comparison")),
        durationSecs: v.number(),
        panelPlanned: v.array(v.string()),
        listeningContext: v.optional(v.string()),
        listeningMethod: v.optional(v.string()),
        baselineArtifactId: v.optional(v.id("compositions")),
        whatVaries: v.array(v.string()),
        whatStaysConstant: v.array(v.string()),
      }),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("recipes"),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const identity = await requireAuth(ctx, args);
    const now = Date.now();

    return await ctx.db.insert("recipes", {
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
 * Update a recipe
 */
export const update = mutation({
  args: {
    id: v.id("recipes"),
    title: v.optional(v.string()),
    bodyMd: v.optional(v.string()),
    parameters: v.optional(v.array(v.any())),
    dawChecklist: v.optional(v.array(v.string())),
    protocol: v.optional(v.any()),
    status: v.optional(recipeStatusValidator),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const { id, devBypassSecret: _devBypassSecret, ...updates } = args;

    const recipe = await ctx.db.get("recipes", id);
    if (!recipe) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    await ctx.db.patch("recipes", id, { ...updates, updatedAt: Date.now() });
    return null;
  },
});

/**
 * Update recipe status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("recipes"),
    status: recipeStatusValidator,
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.patch("recipes", args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// ============================================================================
// AI GENERATION
// ============================================================================

const RECIPE_SYSTEM_PROMPT = `You are a music producer and composer assistant helping to create DAW-ready composition specifications.

Your task is to take a research hypothesis and generate a practical recipe for a musical micro-study (16-32 bars) that tests the hypothesis.

A good recipe should:
1. Be specific enough to implement in a DAW immediately
2. Test the hypothesis through concrete musical choices
3. Include all necessary parameters (tempo, key, tuning, rhythm, etc.)
4. Have a clear arrangement structure
5. Include a DAW setup checklist

Default micro-study canvas:
- Length: 16-32 bars
- Time signature: 4/4 (unless hypothesis requires otherwise)
- Tempo: 80-145 BPM (justify if outside this range)
- Duration: 30-120 seconds`;

const RECIPE_USER_PROMPT = `Generate a DAW-ready recipe for this hypothesis:

**Title**: {{title}}

**Question**: {{question}}

**Hypothesis**: {{hypothesis}}

**Rationale**:
{{rationale}}

**Concepts**: {{concepts}}

Create a practical micro-study recipe that tests this hypothesis. Be specific about:
1. Exact tempo, key, and tuning system
2. Specific intervals, chords, or frequency values if mentioned
3. Arrangement structure (intro, development, etc.)
4. What to listen for when evaluating

Respond in JSON format:
{
  "title": "Recipe title",
  "bodyMd": "Markdown narrative with arrangement sketch and musical instructions",
  "parameters": [
    {"type": "tempo", "value": "108", "details": {"bpm": 108, "rationale": "..."}},
    {"type": "key", "value": "C major", "details": {"root": "C", "mode": "major"}},
    {"type": "tuningSystem", "value": "432Hz reference", "details": {...}},
    ...
  ],
  "dawChecklist": [
    "Set project tempo to X BPM",
    "Load tuning file or set reference pitch",
    "Create X tracks for...",
    ...
  ],
  "protocol": {
    "studyType": "litmus",
    "durationSecs": 60,
    "panelPlanned": ["self"],
    "listeningContext": "headphones, quiet room",
    "whatVaries": ["the specific parameter being tested"],
    "whatStaysConstant": ["other musical elements"]
  }
}`;

/**
 * Generate a recipe from a hypothesis using AI
 */
export const generateFromHypothesis = action({
  args: {
    hypothesisId: v.id("hypotheses"),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    // Get hypothesis
    const hypothesis = await ctx.runQuery(api.hypotheses.get, {
      id: args.hypothesisId,
    });

    if (!hypothesis) {
      throw new Error("Hypothesis not found");
    }

    // Build prompt
    const prompt = RECIPE_USER_PROMPT.replace("{{title}}", hypothesis.title)
      .replace("{{question}}", hypothesis.question)
      .replace("{{hypothesis}}", hypothesis.hypothesis)
      .replace("{{rationale}}", hypothesis.rationaleMd)
      .replace("{{concepts}}", (hypothesis.concepts || []).join(", "));

    // Call AI
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured");

    const openrouter = createOpenRouter({ apiKey: openRouterKey });
    const modelId = args.model || "anthropic/claude-sonnet-4-6";

    const result = await generateText({
      model: openrouter(modelId),
      system: RECIPE_SYSTEM_PROMPT,
      prompt,
      maxTokens: 3000,
    });

    // Parse response
    let parsed: ParsedRecipePayload;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = validateGeneratedRecipePayload(JSON.parse(jsonMatch[0]));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`);
    }

    // Sanitize protocol to only include schema-valid fields
    let sanitizedProtocol: RecipeProtocol | undefined;
    if (parsed.protocol) {
      const p = parsed.protocol;
      sanitizedProtocol = {
        studyType: p.studyType || "litmus",
        durationSecs: p.durationSecs || 60,
        panelPlanned: p.panelPlanned || ["self"],
        listeningContext: p.listeningContext,
        listeningMethod: p.listeningMethod,
        whatVaries: p.whatVaries || [],
        whatStaysConstant: p.whatStaysConstant || [],
      };
    }

    // Create recipe
    const recipeId = await ctx.runMutation(api.recipes.create, {
      hypothesisId: args.hypothesisId,
      title: parsed.title,
      bodyMd: parsed.bodyMd,
      parameters: parsed.parameters,
      dawChecklist: parsed.dawChecklist,
      protocol: sanitizedProtocol,
      devBypassSecret: args.devBypassSecret,
    });

    return {
      recipeId,
      model: modelId,
      generated: parsed,
    };
  },
});

/**
 * Generate a recipe for each queued/active hypothesis without one
 */
export const generateBatch = action({
  args: {
    limit: v.optional(v.number()),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const limit = args.limit ?? 3;

    // Get hypotheses that need recipes
    const hypotheses = await ctx.runQuery(api.hypotheses.listByStatus, {
      status: "queued",
      limit: 20,
    });

    // Also include active ones
    const activeHypotheses = await ctx.runQuery(api.hypotheses.listByStatus, {
      status: "active",
      limit: 20,
    });

    const allHypotheses = [...hypotheses, ...activeHypotheses];

    // Filter to ones without recipes
    const needsRecipe = [];
    for (const h of allHypotheses) {
      const recipes = await ctx.runQuery(api.recipes.getByHypothesisId, {
        hypothesisId: h._id,
      });
      if (recipes.length === 0) {
        needsRecipe.push(h);
      }
    }

    const results = [];

    for (const hypothesis of needsRecipe.slice(0, limit)) {
      try {
        const result = await ctx.runAction(api.recipes.generateFromHypothesis, {
          hypothesisId: hypothesis._id,
          model: args.model,
          devBypassSecret: args.devBypassSecret,
        });
        results.push({ success: true, ...result });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        results.push({
          success: false,
          hypothesisId: hypothesis._id,
          error: message,
        });
      }
    }

    return results;
  },
});
