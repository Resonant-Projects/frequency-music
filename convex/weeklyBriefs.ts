import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import {
  computeRecommendedActionContext,
  type RecommendedAction,
} from "./campaigns";
import { computeEditorialSignals } from "./dashboard";
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
  kind?: string;
  type?: string;
  value: string;
}

interface StudioPromptVariants {
  tenMinuteMd: string;
  thirtyMinuteMd: string;
  ninetyMinuteMd: string;
}

type ParsedBriefMetadata = {
  todo: string[];
  studioPrompts: StudioPromptVariants;
  cleanBodyMd: string;
};

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
    campaignId: v.optional(v.id("campaigns")),
    recommendedHypothesisIds: v.array(v.id("hypotheses")),
    recommendedRecipeIds: v.array(v.id("recipes")),
    activeThesisIds: v.optional(v.array(v.id("theses"))),
    referencedFailureKeys: v.optional(v.array(v.string())),
    studioPrompts: v.object({
      tenMinuteMd: v.string(),
      thirtyMinuteMd: v.string(),
      ninetyMinuteMd: v.string(),
    }),
    recommendedActions: v.array(
      v.object({
        kind: v.union(
          v.literal("advance_recipe"),
          v.literal("revive_recipe"),
          v.literal("expand_composition"),
          v.literal("compare_branch"),
          v.literal("prototype_hypothesis"),
        ),
        targetType: v.union(
          v.literal("hypothesis"),
          v.literal("recipe"),
          v.literal("composition"),
        ),
        targetId: v.string(),
        durationBucket: v.union(
          v.literal("10-minute"),
          v.literal("30-minute"),
          v.literal("90-minute"),
        ),
        reason: v.string(),
      }),
    ),
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
4. Preserves the artistic stakes behind each idea, not just the procedural steps
5. Notes active theses, contradictions, and low-yield paths when they should influence next actions

Format your output as a markdown document with:
- Title and date range
- Executive summary (2-3 sentences)
- Experiment cards with priority, time estimate, and requirements
- Active theses section
- Contradictions and reversals section
- Concept signal section
- Themes section
- Open questions section

Be practical and DAW-focused. Each experiment should be completable in a single studio session.
For each recommended experiment, explain both what to try and why it matters musically or perceptually.
Explicitly mention when a line of work contradicts prior work or has repeatedly failed to expand.`;

const BRIEF_USER_PROMPT = `Create a weekly research brief.

**Week of**: {{weekOf}}

**Active Campaign**:
{{campaign}}

**Hypotheses ({{numHypotheses}})**:
{{hypotheses}}

**Recipes ({{numRecipes}})**:
{{recipes}}

**Active Theses ({{numTheses}})**:
{{theses}}

**Recent Failures / Contradictions ({{numFailures}})**:
{{failures}}

**Editorial Signals**:
High-yield concept areas:
{{highYield}}

Low-yield concept areas:
{{lowYield}}

**Recommended Actions**:
{{recommendedActions}}

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
  "todo": ["actionable item 1", "actionable item 2", ...],
  "studioPrompts": {
    "tenMinuteMd": "short focused prompt",
    "thirtyMinuteMd": "medium prompt",
    "ninetyMinuteMd": "deep session prompt"
  }
}
\`\`\``;

const DEFAULT_STUDIO_PROMPTS: StudioPromptVariants = {
  tenMinuteMd:
    "Choose the most concrete open thread from this week and make the smallest possible audible test of it.",
  thirtyMinuteMd:
    "Take the strongest recipe or branch from this week and produce a deliberate comparison pass with one clearly named change.",
  ninetyMinuteMd:
    "Use the current weekly brief to expand the most promising branch into a structured study that could plausibly become a finished piece.",
};

export function selectRecentBriefInputs(args: {
  hypotheses: Doc<"hypotheses">[];
  recipes: Doc<"recipes">[];
  cutoff: number;
}) {
  const recentHypotheses = args.hypotheses.filter(
    (hypothesis) => hypothesis.createdAt > args.cutoff,
  );
  const recentRecipes = args.recipes.filter(
    (recipe) => recipe.createdAt > args.cutoff,
  );
  const sourceIds = [
    ...new Set(recentHypotheses.flatMap((hypothesis) => hypothesis.sourceIds)),
  ];

  return {
    recentHypotheses,
    recentRecipes,
    sourceIds,
  };
}

export function parseBriefResponse(text: string): ParsedBriefMetadata {
  let todo: string[] = [];
  let studioPrompts: StudioPromptVariants = { ...DEFAULT_STUDIO_PROMPTS };

  const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] ?? "{}") as {
        todo?: unknown;
        studioPrompts?: Partial<StudioPromptVariants>;
      };
      if (
        Array.isArray(parsed.todo) &&
        parsed.todo.every((item) => typeof item === "string")
      ) {
        todo = parsed.todo;
      } else if (typeof parsed.todo === "string") {
        todo = [parsed.todo];
      }

      if (parsed.studioPrompts && typeof parsed.studioPrompts === "object") {
        studioPrompts = {
          tenMinuteMd:
            typeof parsed.studioPrompts.tenMinuteMd === "string" &&
            parsed.studioPrompts.tenMinuteMd.trim().length > 0
              ? parsed.studioPrompts.tenMinuteMd
              : DEFAULT_STUDIO_PROMPTS.tenMinuteMd,
          thirtyMinuteMd:
            typeof parsed.studioPrompts.thirtyMinuteMd === "string" &&
            parsed.studioPrompts.thirtyMinuteMd.trim().length > 0
              ? parsed.studioPrompts.thirtyMinuteMd
              : DEFAULT_STUDIO_PROMPTS.thirtyMinuteMd,
          ninetyMinuteMd:
            typeof parsed.studioPrompts.ninetyMinuteMd === "string" &&
            parsed.studioPrompts.ninetyMinuteMd.trim().length > 0
              ? parsed.studioPrompts.ninetyMinuteMd
              : DEFAULT_STUDIO_PROMPTS.ninetyMinuteMd,
        };
      }
    } catch {
      // Ignore parse errors and fall back to defaults.
    }
  }

  return {
    todo,
    studioPrompts,
    cleanBodyMd: stripTrailingFencedBlock(text),
  };
}

interface GenerateBriefArgs {
  daysBack?: number;
  model?: string;
}

interface GenerateBriefResult {
  briefId: Id<"weeklyBriefs">;
  weekOf: string;
  model: string;
  stats: { hypotheses: number; recipes: number; sources: number };
  preview: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shared between action and internalAction contexts
export async function generateBriefCore(
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

  const recommendationContext = await computeRecommendedActionContext(ctx.db, {
    limit: 5,
  });
  const hypotheses = recommendationContext.hypotheses;
  const recipes = recommendationContext.recipes;
  const { recentHypotheses, recentRecipes, sourceIds } =
    selectRecentBriefInputs({
      hypotheses,
      recipes,
      cutoff,
    });

  if (recentHypotheses.length === 0 && recentRecipes.length === 0) {
    throw new Error(
      "No recent hypotheses or recipes found. Generate some first.",
    );
  }

  const typedActiveTheses =
    recommendationContext.theses.length > 0
      ? recommendationContext.theses
      : ((await ctx.db
          .query("theses")
          .withIndex("by_status_updatedAt", (q: any) =>
            q.eq("status", "active"),
          )
          .order("desc")
          .take(10)) as Doc<"theses">[]);
  const recommendedActions = recommendationContext.actions;
  const recentFailures = recommendationContext.failureArchive
    .filter((entry) => entry.createdAt > cutoff)
    .slice(0, 8);
  const editorialSignals = await computeEditorialSignals(ctx.db as any, 8);

  // Format for prompt
  const hypothesesText = recentHypotheses
    .map(
      (h: Doc<"hypotheses">, i: number) =>
        `${i + 1}. **${h.title}**\n   Question: ${h.question}\n   Hypothesis: ${h.hypothesis}\n   Why this matters: ${h.whyThisMatters ?? "Not specified"}`,
    )
    .join("\n\n");

  const recipesText =
    recentRecipes.length > 0
      ? recentRecipes
          .map((r: Doc<"recipes">, i: number) => {
            const params = r.parameters
              .slice(0, 4)
              .map(
                (p: BriefParameter) =>
                  `${p.kind ?? p.type ?? "parameter"}: ${p.value}`,
              )
              .join(", ");
            return `${i + 1}. **${r.title}**\n   Why this matters: ${r.whyThisMatters ?? "Not specified"}\n   Parameters: ${params}\n   Checklist items: ${r.dawChecklist.length}`;
          })
          .join("\n\n")
      : "No recipes yet - experiments will need recipe generation.";
  const thesesText =
    typedActiveTheses.length > 0
      ? typedActiveTheses
          .map(
            (thesis: Doc<"theses">, i: number) =>
              `${i + 1}. **${thesis.title}**\n   Statement: ${thesis.statement}`,
          )
          .join("\n\n")
      : "No active theses.";
  const failuresText =
    recentFailures.length > 0
      ? recentFailures
          .map(
            (failure, i: number) =>
              `${i + 1}. **${failure.title}** [${failure.reason}]\n   ${failure.explanation}`,
          )
          .join("\n\n")
      : "No recent contradictions or low-yield results.";
  const campaignText = recommendationContext.campaign
    ? `Title: ${recommendationContext.campaign.title}
Question: ${recommendationContext.campaign.question}
Theses: ${
        recommendationContext.theses.length > 0
          ? recommendationContext.theses
              .map((thesis) => thesis.title)
              .join(", ")
          : "None attached yet"
      }`
    : "No active campaign. Use the strongest active threads from the current weekly system.";
  const highYieldText =
    editorialSignals.highYieldClusters.length > 0
      ? editorialSignals.highYieldClusters
          .map(
            (cluster) =>
              `${cluster.domain}: ${cluster.conceptNames.join(", ")} (score ${cluster.score})`,
          )
          .join("\n")
      : "No strong high-yield clusters yet.";
  const lowYieldText =
    editorialSignals.lowYieldClusters.length > 0
      ? editorialSignals.lowYieldClusters
          .map(
            (cluster) =>
              `${cluster.domain}: ${cluster.conceptNames.join(", ")} (score ${cluster.score})`,
          )
          .join("\n")
      : "No notable low-yield clusters yet.";
  const recommendedActionsText =
    recommendedActions.length > 0
      ? recommendedActions
          .map(
            (action, index) =>
              `${index + 1}. [${action.durationBucket}] ${action.kind} -> ${action.targetType} ${action.targetId}\n   Reason: ${action.reason}`,
          )
          .join("\n\n")
      : "No precomputed recommendation candidates. Derive action items from the strongest active hypotheses.";

  const prompt = BRIEF_USER_PROMPT.replace("{{weekOf}}", weekOf)
    .replace("{{campaign}}", campaignText)
    .replace("{{numHypotheses}}", String(recentHypotheses.length))
    .replace("{{hypotheses}}", hypothesesText)
    .replace("{{numRecipes}}", String(recentRecipes.length))
    .replace("{{recipes}}", recipesText)
    .replace("{{numTheses}}", String(typedActiveTheses.length))
    .replace("{{theses}}", thesesText)
    .replace("{{numFailures}}", String(recentFailures.length))
    .replace("{{failures}}", failuresText)
    .replace("{{highYield}}", highYieldText)
    .replace("{{lowYield}}", lowYieldText)
    .replace("{{recommendedActions}}", recommendedActionsText);

  // Call AI
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured");

  const openrouter = createOpenRouter({ apiKey: openRouterKey });
  const modelId = args.model || "anthropic/claude-sonnet-4-6";

  const result = await generateText({
    model: openrouter(modelId),
    system: BRIEF_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 4000,
  });

  const parsed = parseBriefResponse(result.text);

  const persistedSourceIds = sourceIds.slice(0, 20);

  // Create the brief
  const briefId = await ctx.runMutation(internal.weeklyBriefs.create, {
    weekOf,
    model: modelId,
    promptVersion: "v2.phase3",
    bodyMd: parsed.cleanBodyMd,
    sourceIds: persistedSourceIds,
    campaignId: recommendationContext.campaign?._id,
    recommendedHypothesisIds: recentHypotheses.map(
      (h: Doc<"hypotheses">) => h._id,
    ),
    recommendedRecipeIds: recentRecipes.map((r: Doc<"recipes">) => r._id),
    activeThesisIds: typedActiveTheses.map(
      (thesis: Doc<"theses">) => thesis._id,
    ),
    referencedFailureKeys: recentFailures.map((failure) => failure.key),
    studioPrompts: parsed.studioPrompts,
    recommendedActions: recommendedActions as RecommendedAction[],
    todo: parsed.todo.length > 0 ? parsed.todo : undefined,
  });

  return {
    briefId,
    weekOf,
    model: modelId,
    stats: {
      hypotheses: recentHypotheses.length,
      recipes: recentRecipes.length,
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

function stripTrailingFencedBlock(md: string): string {
  const trimmed = md.trimEnd();
  const match = trimmed.match(
    /^(?<body>[\s\S]*?)\n```(?:[a-zA-Z0-9_-]+)?[^\n]*\n[\s\S]*\n```$/,
  );

  return match?.groups?.body?.trimEnd() ?? trimmed;
}

function markdownToNotionBlocks(md: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = stripTrailingFencedBlock(md).split("\n");
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
            rich_text: chunkText(bulletMatch[1] ?? ""),
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
        heading_3: { rich_text: chunkText(h3Match[1] ?? "") },
      });
    } else if (h2Match) {
      flushBuffer();
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: chunkText(h2Match[1] ?? "") },
      });
    } else if (h1Match) {
      flushBuffer();
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: chunkText(h1Match[1] ?? "") },
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
    if (brief.notionPageId) {
      return { notionPageId: brief.notionPageId, notionUrl: undefined };
    }

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
            title: [{ text: { content: `Weekly Brief — ${brief.weekOf}` } }],
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
