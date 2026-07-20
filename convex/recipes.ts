import { ConvexError, v, type Value } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { DEFAULT_MODEL, extractJsonObject } from "./llm";
import { recipeStarterKitValidator, recipeStatusValidator } from "./schema";
import {
  generatedRecipeValidator,
  hypothesisReturnValidator,
  recipeParameterValidator,
  recipeProtocolValidator,
  recipeReturnValidator,
} from "./validators";

interface RecipeParameter {
  kind?: string;
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
  whyThisMatters?: string;
  bodyMd: string;
  parameters: RecipeParameter[];
  dawChecklist: string[];
  protocol?: RecipeProtocol;
}

type GeneratedRecipeResult = {
  recipeId: Id<"recipes">;
  model: string;
  generated: ParsedRecipePayload;
};

type BatchRecipeResult =
  | ({ success: true } & GeneratedRecipeResult)
  | {
      success: false;
      hypothesisId: Id<"hypotheses">;
      error: string;
    };

function assertStringArray(
  value: unknown,
  field: string,
  raw: unknown,
): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0)
  ) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${field} must be a non-empty string[]`,
      field,
      raw: raw as Value,
    });
  }
  return value as string[];
}

export function validateGeneratedRecipePayload(
  raw: unknown,
): ParsedRecipePayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe payload must be an object",
      field: "root",
      raw: raw as Value,
    });
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.title !== "string" || row.title.trim().length === 0) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe title must be a non-empty string",
      field: "title",
      raw: raw as Value,
    });
  }
  if (typeof row.bodyMd !== "string" || row.bodyMd.trim().length === 0) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe bodyMd must be a non-empty string",
      field: "bodyMd",
      raw: raw as Value,
    });
  }
  if (!Array.isArray(row.parameters)) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "generated recipe parameters must be an array",
      field: "parameters",
      raw: raw as Value,
    });
  }
  const parameters: RecipeParameter[] = row.parameters.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "recipe parameter must be an object",
        field: `parameters[${index}]`,
        raw: raw as Value,
      });
    }
    const param = value as Record<string, unknown>;
    const kind = param.kind ?? param.type;
    if (typeof kind !== "string" || kind.trim().length === 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "recipe parameter kind must be a non-empty string",
        field: `parameters[${index}].kind`,
        raw: raw as Value,
      });
    }
    if (typeof param.value !== "string" || param.value.trim().length === 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "recipe parameter value must be a non-empty string",
        field: `parameters[${index}].value`,
        raw: raw as Value,
      });
    }

    return {
      kind,
      type:
        typeof param.type === "string" && param.type.trim().length > 0
          ? param.type.trim()
          : kind,
      value: param.value,
      details: param.details,
    };
  });
  assertStringArray(row.dawChecklist, "dawChecklist", raw);

  const protocol = row.protocol;
  if (protocol !== undefined) {
    if (!protocol || typeof protocol !== "object" || Array.isArray(protocol)) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "generated recipe protocol must be an object",
        field: "protocol",
        raw: raw as Value,
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
        raw: raw as Value,
      });
    }
    if (p.durationSecs !== undefined && typeof p.durationSecs !== "number") {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "protocol.durationSecs must be a number",
        field: "protocol.durationSecs",
        raw: raw as Value,
      });
    }
    if (p.panelPlanned !== undefined)
      assertStringArray(p.panelPlanned, "protocol.panelPlanned", raw);
    if (p.whatVaries !== undefined)
      assertStringArray(p.whatVaries, "protocol.whatVaries", raw);
    if (p.whatStaysConstant !== undefined)
      assertStringArray(p.whatStaysConstant, "protocol.whatStaysConstant", raw);
  }

  return {
    title: row.title,
    whyThisMatters:
      typeof row.whyThisMatters === "string" ? row.whyThisMatters : undefined,
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
  returns: v.array(recipeReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const status = args.status;
    if (status !== undefined) {
      return await ctx.db
        .query("recipes")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
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
  returns: v.union(
    v.object({
      ...recipeReturnValidator.fields,
      hypothesis: v.union(hypothesisReturnValidator, v.null()),
    }),
    v.null(),
  ),
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
  returns: v.array(recipeReturnValidator),
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
    whyThisMatters: v.optional(v.string()),
    bodyMd: v.string(),
    parameters: v.array(recipeParameterValidator),
    dawChecklist: v.array(v.string()),
    protocol: v.optional(recipeProtocolValidator),
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
      createdBy: identity.subject as Id<"users">,
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
    whyThisMatters: v.optional(v.string()),
    bodyMd: v.optional(v.string()),
    parameters: v.optional(v.array(recipeParameterValidator)),
    dawChecklist: v.optional(v.array(v.string())),
    protocol: v.optional(recipeProtocolValidator),
    starterKit: v.optional(recipeStarterKitValidator),
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

**Why This Matters**:
{{whyThisMatters}}

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
  "whyThisMatters": "What musical or perceptual stake this recipe is trying to reveal",
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
  returns: v.object({
    recipeId: v.id("recipes"),
    model: v.string(),
    generated: generatedRecipeValidator,
  }),
  handler: async (ctx, args): Promise<GeneratedRecipeResult> => {
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
      .replace(
        "{{whyThisMatters}}",
        hypothesis.whyThisMatters ??
          "Not specified. Infer the musical stakes from the hypothesis and rationale.",
      )
      .replace("{{rationale}}", hypothesis.rationaleMd)
      .replace("{{concepts}}", (hypothesis.concepts || []).join(", "));

    // Call AI (traced as recipe_v1 in the Node-runtime internal action)
    const modelId = args.model || DEFAULT_MODEL;

    const { text } = await ctx.runAction(
      internal.recipesInternal.generateRecipeText,
      {
        system: RECIPE_SYSTEM_PROMPT,
        prompt,
        model: modelId,
        hypothesisId: args.hypothesisId,
        promptVersion: "recipe_v1",
      },
    );

    // Parse response
    let parsed: ParsedRecipePayload;
    try {
      parsed = validateGeneratedRecipePayload(extractJsonObject(text));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown parse error";
      throw new Error(`Failed to parse AI response: ${message}`, { cause: e });
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
    const recipeId: Id<"recipes"> = await ctx.runMutation(api.recipes.create, {
      hypothesisId: args.hypothesisId,
      title: parsed.title,
      whyThisMatters: parsed.whyThisMatters,
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
  returns: v.array(
    v.union(
      v.object({
        success: v.literal(true),
        recipeId: v.id("recipes"),
        model: v.string(),
        generated: generatedRecipeValidator,
      }),
      v.object({
        success: v.literal(false),
        hypothesisId: v.id("hypotheses"),
        error: v.string(),
      }),
    ),
  ),
  handler: async (ctx, args): Promise<BatchRecipeResult[]> => {
    await requireAuth(ctx, args);
    const limit = args.limit ?? 3;

    // Get hypotheses that need recipes
    const hypotheses: Doc<"hypotheses">[] = await ctx.runQuery(
      api.hypotheses.listByStatus,
      {
        status: "queued",
        limit: 20,
      },
    );

    // Also include active ones
    const activeHypotheses: Doc<"hypotheses">[] = await ctx.runQuery(
      api.hypotheses.listByStatus,
      {
        status: "active",
        limit: 20,
      },
    );

    const allHypotheses: Doc<"hypotheses">[] = [
      ...hypotheses,
      ...activeHypotheses,
    ];

    // Filter to ones without recipes
    const needsRecipe: Doc<"hypotheses">[] = [];
    for (const h of allHypotheses) {
      const recipes = await ctx.runQuery(api.recipes.getByHypothesisId, {
        hypothesisId: h._id,
      });
      if (recipes.length === 0) {
        needsRecipe.push(h);
      }
    }

    const results: BatchRecipeResult[] = [];

    for (const hypothesis of needsRecipe.slice(0, limit)) {
      try {
        const result: GeneratedRecipeResult = await ctx.runAction(
          api.recipes.generateFromHypothesis,
          {
            hypothesisId: hypothesis._id,
            model: args.model,
            devBypassSecret: args.devBypassSecret,
          },
        );
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

/**
 * Delete a recipe by ID
 */
export const deleteById = mutation({
  args: { id: v.id("recipes"), devBypassSecret: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.delete(args.id);
    return null;
  },
});
