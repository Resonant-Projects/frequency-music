import { v, ConvexError } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List recipes by status
 */
export const listByStatus = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    if (args.status) {
      return await ctx.db
        .query("recipes")
        .withIndex("by_status_updatedAt", (q) =>
          q.eq("status", args.status as any),
        )
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
  },
  returns: v.id("recipes"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("recipes", {
      ...args,
      parameters: args.parameters as any,
      status: "draft",
      visibility: "private",
      createdBy: "system",
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
    status: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const recipe = await ctx.db.get("recipes", id);
    if (!recipe) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    await ctx.db.patch("recipes", id, {
      ...updates,
      updatedAt: Date.now(),
    } as any);
    return null;
  },
});

/**
 * Update recipe status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("recipes"),
    status: v.union(
      v.literal("draft"),
      v.literal("in_use"),
      v.literal("archived"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
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
    const modelId = args.model || "anthropic/claude-sonnet-4";

    const result = await generateText({
      model: openrouter(modelId),
      system: RECIPE_SYSTEM_PROMPT,
      prompt,
      maxTokens: 3000,
    });

    // Parse response
    let parsed;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${e}`);
    }

    // Sanitize protocol to only include schema-valid fields
    let sanitizedProtocol = undefined;
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
  },
  handler: async (ctx, args) => {
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
        });
        results.push({ success: true, ...result });
      } catch (e: any) {
        results.push({
          success: false,
          hypothesisId: hypothesis._id,
          error: e.message,
        });
      }
    }

    return results;
  },
});
