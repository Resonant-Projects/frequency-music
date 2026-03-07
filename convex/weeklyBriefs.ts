import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { weeklyBriefReturnValidator } from "./validators";

interface BriefParameter {
  type: string;
  value: string;
}

// ============================================================================
// QUERIES
// ============================================================================

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(weeklyBriefReturnValidator),
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
  returns: v.union(weeklyBriefReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("weeklyBriefs", args.id);
  },
});

export const getLatest = query({
  args: {},
  returns: v.union(weeklyBriefReturnValidator, v.null()),
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
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.patch("weeklyBriefs", args.id, {
      visibility: "public",
      publishedAt: Date.now(),
    });
    return null;
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

interface GenerateBriefArgs {
  daysBack?: number;
  model?: string;
}

interface GenerateBriefResult {
  briefId: string; // Id<"weeklyBriefs"> at runtime
  weekOf: string;
  model: string;
  stats: { hypotheses: number; recipes: number; sources: number };
  preview: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shared between action and internalAction contexts
async function generateBriefCore(
  ctx: any,
  args: GenerateBriefArgs,
): Promise<GenerateBriefResult> {
  const daysBack = args.daysBack ?? 7;
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  // Get Monday of current week for weekOf
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  const weekOf = monday.toISOString().split("T")[0] as string;

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
      const parsed = JSON.parse(jsonMatch[1]) as { todo?: unknown };
      if (
        Array.isArray(parsed.todo) &&
        parsed.todo.every((item) => typeof item === "string")
      ) {
        todo = parsed.todo;
      } else if (typeof parsed.todo === "string") {
        todo = [parsed.todo];
      } else {
        todo = [];
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Get source IDs from hypotheses
  const sourceIds = [...new Set(hypotheses.flatMap((h) => h.sourceIds))];
  const persistedSourceIds = sourceIds.slice(0, 20);

  // Create the brief
  const briefId = await ctx.runMutation(internal.weeklyBriefs.create, {
    weekOf,
    model: modelId,
    promptVersion: "v1",
    bodyMd: result.text,
    sourceIds: persistedSourceIds,
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
      sources: persistedSourceIds.length,
    },
    preview: `${result.text.slice(0, 500)}...`,
  };
}

const generateReturnsValidator = v.object({
  briefId: v.id("weeklyBriefs"),
  weekOf: v.string(),
  model: v.string(),
  stats: v.object({
    hypotheses: v.number(),
    recipes: v.number(),
    sources: v.number(),
  }),
  preview: v.string(),
});

export const generate = action({
  args: {
    daysBack: v.optional(v.number()),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: generateReturnsValidator,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await generateBriefCore(ctx, args);
  },
});

/**
 * Internal action for cron-triggered brief generation (no auth required)
 */
export const generateInternal = internalAction({
  args: {
    daysBack: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  returns: generateReturnsValidator,
  handler: async (ctx, args) => {
    return await generateBriefCore(ctx, args);
  },
});

// ============================================================================
// NOTION PUBLISHING
// ============================================================================

interface NotionRichText {
  type: "text";
  text: { content: string };
}

interface NotionBlock {
  object: "block";
  type: string;
  [key: string]: unknown;
}

function chunkText(text: string, maxLen = 2000): NotionRichText[] {
  const chunks: NotionRichText[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push({ type: "text", text: { content: text.slice(i, i + maxLen) } });
  }
  return chunks;
}

function markdownToNotionBlocks(md: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = md.split("\n");
  let buffer: string[] = [];

  function flushBuffer() {
    const text = buffer.join("\n").trim();
    if (!text) {
      buffer = [];
      return;
    }
    // Split bullet lists
    const bulletLines = text.split("\n");
    let paragraphLines: string[] = [];

    for (const line of bulletLines) {
      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      if (bulletMatch) {
        // Flush any paragraph lines first
        if (paragraphLines.length > 0) {
          const pText = paragraphLines.join("\n").trim();
          if (pText) {
            blocks.push({
              object: "block",
              type: "paragraph",
              paragraph: { rich_text: chunkText(pText) },
            });
          }
          paragraphLines = [];
        }
        blocks.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: chunkText(bulletMatch[1]),
          },
        });
      } else {
        paragraphLines.push(line);
      }
    }

    if (paragraphLines.length > 0) {
      const pText = paragraphLines.join("\n").trim();
      if (pText) {
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: chunkText(pText) },
        });
      }
    }

    buffer = [];
  }

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.*)/);
    const h2Match = line.match(/^##\s+(.*)/);
    const h3Match = line.match(/^###\s+(.*)/);

    if (h3Match) {
      flushBuffer();
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: chunkText(h3Match[1]) },
      });
    } else if (h2Match) {
      flushBuffer();
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: chunkText(h2Match[1]) },
      });
    } else if (h1Match) {
      flushBuffer();
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: chunkText(h1Match[1]) },
      });
    } else {
      buffer.push(line);
    }
  }

  flushBuffer();

  // Notion API limits 100 blocks per request
  return blocks.slice(0, 100);
}

export const setPublished = internalMutation({
  args: {
    id: v.id("weeklyBriefs"),
    notionPageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("weeklyBriefs", args.id, {
      visibility: "public",
      publishedAt: Date.now(),
      notionPageId: args.notionPageId,
    });
  },
});

export const publishToNotion = action({
  args: {
    id: v.id("weeklyBriefs"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    notionPageId: v.string(),
    notionUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const brief = await ctx.runQuery(api.weeklyBriefs.get, { id: args.id });
    if (!brief) throw new Error("Brief not found");

    const notionToken = process.env.NOTION_API_KEY;
    const notionDbId = process.env.NOTION_WEEKLY_BRIEFS_DB;
    if (!notionToken || !notionDbId) {
      throw new Error(
        "Notion not configured. Set NOTION_API_KEY and NOTION_WEEKLY_BRIEFS_DB env vars.",
      );
    }

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: notionDbId },
        properties: {
          Name: {
            title: [
              { text: { content: `Weekly Brief — ${brief.weekOf}` } },
            ],
          },
          "Week Of": { date: { start: brief.weekOf } },
          Model: {
            rich_text: [{ text: { content: brief.model } }],
          },
        },
        children: markdownToNotionBlocks(brief.bodyMd),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Notion API error ${response.status}: ${body}`);
    }

    const page = (await response.json()) as { id: string; url?: string };
    await ctx.runMutation(internal.weeklyBriefs.setPublished, {
      id: args.id,
      notionPageId: page.id,
    });

    return { notionPageId: page.id, notionUrl: page.url };
  },
});
