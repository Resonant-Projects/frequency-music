import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";

interface BriefParameter {
  type: string;
  value: string;
}

// ============================================================================
// QUERIES
// ============================================================================

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("weeklyBriefs")
      .withIndex("by_weekOf")
      .order("desc")
      .take(args.limit ?? 10);
  },
});

export const get = query({
  args: { id: v.id("weeklyBriefs") },
  handler: async (ctx, args) => {
    return await ctx.db.get("weeklyBriefs", args.id);
  },
});

export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("weeklyBriefs")
      .withIndex("by_weekOf")
      .order("desc")
      .first();
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

export const create = internalMutation({
  args: {
    weekOf: v.string(),
    model: v.string(),
    promptVersion: v.string(),
    bodyMd: v.string(),
    sourceIds: v.array(v.id("sources")),
    recommendedHypothesisIds: v.array(v.id("hypotheses")),
    recommendedRecipeIds: v.array(v.id("recipes")),
    todo: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("weeklyBriefs", {
      ...args,
      visibility: "private",
      createdBy: "system",
      createdAt: Date.now(),
    });
  },
});

export const publish = mutation({
  args: { id: v.id("weeklyBriefs"), devBypassSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.patch("weeklyBriefs", args.id, {
      visibility: "public",
      publishedAt: Date.now(),
    });
  },
});

// ============================================================================
// AI GENERATION
// ============================================================================

const BRIEF_SYSTEM_PROMPT = `You are a research synthesis assistant for a music/acoustics research project called "Resonant Projects."

Create a weekly brief that:
1. Summarizes research themes across hypotheses and recipes
2. Prioritizes 3-10 actionable studio experiments
3. Identifies open questions for future exploration

Format your output as a markdown document with:
- Title and date range
- Executive summary (2-3 sentences)
- Experiment cards with priority, time estimate, and requirements
- Themes section
- Open questions section

Be practical and DAW-focused. Each experiment should be completable in a single studio session.`;

const BRIEF_USER_PROMPT = `Create a weekly research brief.

**Week of**: {{weekOf}}

**Hypotheses ({{numHypotheses}})**:
{{hypotheses}}

**Recipes ({{numRecipes}})**:
{{recipes}}

Generate a comprehensive weekly brief in markdown format. Include:
1. A catchy title for the week's theme
2. 3-10 experiment cards sorted by priority (high/medium/low)
3. Time estimates (15-120 minutes each)
4. DAW requirements for each experiment
5. Common themes across the research
6. Open questions for future exploration

Also provide a JSON block at the end with:
\`\`\`json
{
  "todo": ["actionable item 1", "actionable item 2", ...]
}
\`\`\``;

export const generate = action({
  args: {
    daysBack: v.optional(v.number()),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const daysBack = args.daysBack ?? 7;
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    // Get Monday of current week for weekOf
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    const weekOf = monday.toISOString().split("T")[0];

    // Get recent hypotheses
    const allHypotheses = await ctx.runQuery(api.hypotheses.listByStatus, {
      limit: 50,
    });
    const hypotheses = allHypotheses.filter((h) => h.createdAt > cutoff);

    // Get recent recipes
    const allRecipes = await ctx.runQuery(api.recipes.listByStatus, {
      limit: 50,
    });
    const recipes = allRecipes.filter((r) => r.createdAt > cutoff);

    if (hypotheses.length === 0) {
      throw new Error("No recent hypotheses found. Generate some first.");
    }

    // Format for prompt
    const hypothesesText = hypotheses
      .map(
        (h, i) =>
          `${i + 1}. **${h.title}**\n   Question: ${h.question}\n   Hypothesis: ${h.hypothesis}`,
      )
      .join("\n\n");

    const recipesText =
      recipes.length > 0
        ? recipes
            .map((r, i) => {
              const params = r.parameters
                .slice(0, 4)
                .map((p: BriefParameter) => `${p.type}: ${p.value}`)
                .join(", ");
              return `${i + 1}. **${r.title}**\n   Parameters: ${params}\n   Checklist items: ${r.dawChecklist.length}`;
            })
            .join("\n\n")
        : "No recipes yet - experiments will need recipe generation.";

    const prompt = BRIEF_USER_PROMPT.replace("{{weekOf}}", weekOf)
      .replace("{{numHypotheses}}", String(hypotheses.length))
      .replace("{{hypotheses}}", hypothesesText)
      .replace("{{numRecipes}}", String(recipes.length))
      .replace("{{recipes}}", recipesText);

    // Call AI
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured");

    const openrouter = createOpenRouter({ apiKey: openRouterKey });
    const modelId = args.model || "anthropic/claude-sonnet-4-6";

    const result = await generateText({
      model: openrouter(modelId),
      system: BRIEF_SYSTEM_PROMPT,
      prompt,
      maxTokens: 4000,
    });

    // Extract todo items from JSON block if present
    let todo: string[] = [];
    const jsonMatch = result.text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        todo = parsed.todo || [];
      } catch (_e) {
        // Ignore parse errors
      }
    }

    // Get source IDs from hypotheses
    const sourceIds = [...new Set(hypotheses.flatMap((h) => h.sourceIds))];

    // Create the brief
    const briefId = await ctx.runMutation(internal.weeklyBriefs.create, {
      weekOf,
      model: modelId,
      promptVersion: "v1",
      bodyMd: result.text,
      sourceIds: sourceIds.slice(0, 20), // Limit to 20
      recommendedHypothesisIds: hypotheses.map((h) => h._id),
      recommendedRecipeIds: recipes.map((r) => r._id),
      todo: todo.length > 0 ? todo : undefined,
    });

    return {
      briefId,
      weekOf,
      model: modelId,
      stats: {
        hypotheses: hypotheses.length,
        recipes: recipes.length,
        sources: sourceIds.length,
      },
      preview: `${result.text.slice(0, 500)}...`,
    };
  },
});
