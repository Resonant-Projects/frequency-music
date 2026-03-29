import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import {
  deriveFailureArchiveEntries,
  type FailureArchiveEntry,
} from "./failures";
import { summarizeListeningSessions } from "./phase2";
import {
  campaignReturnValidator,
  recommendedActionValidator,
  thesisReturnValidator,
} from "./validators";

export type RecommendedAction = {
  kind:
    | "advance_recipe"
    | "revive_recipe"
    | "expand_composition"
    | "compare_branch"
    | "prototype_hypothesis";
  targetType: "hypothesis" | "recipe" | "composition";
  targetId: string;
  durationBucket: "10-minute" | "30-minute" | "90-minute";
  reason: string;
};

export type RecommendationContext = {
  campaign: Doc<"campaigns"> | null;
  theses: Doc<"theses">[];
  hypotheses: Doc<"hypotheses">[];
  recipes: Doc<"recipes">[];
  actions: RecommendedAction[];
  failureArchive: FailureArchiveEntry[];
};

const campaignStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
);

const recommendedActionsReturnValidator = v.object({
  campaign: v.union(campaignReturnValidator, v.null()),
  theses: v.array(thesisReturnValidator),
  actions: v.array(recommendedActionValidator),
});

async function getThesisOrThrow(ctx: { db: any }, thesisId: Id<"theses">) {
  const thesis = await ctx.db.get("theses", thesisId);
  if (!thesis) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Thesis not found",
    });
  }
  return thesis;
}

async function pauseOtherCampaigns(
  ctx: { db: any },
  exceptId?: Id<"campaigns">,
): Promise<void> {
  const activeCampaigns = await ctx.db
    .query("campaigns")
    .withIndex("by_status_updatedAt", (q: any) => q.eq("status", "active"))
    .collect();

  const now = Date.now();
  await Promise.all(
    activeCampaigns
      .filter((campaign: Doc<"campaigns">) => campaign._id !== exceptId)
      .map((campaign: Doc<"campaigns">) =>
        ctx.db.patch(campaign._id, {
          status: "paused",
          updatedAt: now,
        }),
      ),
  );
}

async function getActiveCampaignDoc(db: any): Promise<Doc<"campaigns"> | null> {
  return await db
    .query("campaigns")
    .withIndex("by_status_updatedAt", (q: any) => q.eq("status", "active"))
    .order("desc")
    .first();
}

async function loadScopedHypotheses(
  db: any,
  thesisIds: Id<"theses">[],
): Promise<Doc<"hypotheses">[]> {
  if (thesisIds.length === 0) return [];
  const lists = await Promise.all(
    thesisIds.map((thesisId) =>
      db
        .query("hypotheses")
        .withIndex("by_thesisId_updatedAt", (q: any) =>
          q.eq("thesisId", thesisId),
        )
        .collect(),
    ),
  );

  const seen = new Set<string>();
  const rows: Doc<"hypotheses">[] = [];
  for (const list of lists as Doc<"hypotheses">[][]) {
    for (const hypothesis of list) {
      if (seen.has(String(hypothesis._id))) continue;
      seen.add(String(hypothesis._id));
      rows.push(hypothesis);
    }
  }
  return rows.toSorted((a, b) => b.updatedAt - a.updatedAt);
}

async function loadRecipesForHypotheses(
  db: any,
  hypotheses: Doc<"hypotheses">[],
): Promise<Doc<"recipes">[]> {
  if (hypotheses.length === 0) return [];
  const lists = await Promise.all(
    hypotheses.map((hypothesis) =>
      db
        .query("recipes")
        .withIndex("by_hypothesisId_updatedAt", (q: any) =>
          q.eq("hypothesisId", hypothesis._id),
        )
        .collect(),
    ),
  );
  return lists
    .flat()
    .toSorted(
      (a: Doc<"recipes">, b: Doc<"recipes">) => b.updatedAt - a.updatedAt,
    );
}

async function loadFallbackHypotheses(db: any): Promise<Doc<"hypotheses">[]> {
  return await db
    .query("hypotheses")
    .withIndex("by_status_updatedAt", (q: any) => q.eq("status", "active"))
    .order("desc")
    .take(12);
}

async function loadScope(
  db: any,
  campaignId?: Id<"campaigns"> | null,
): Promise<{
  campaign: Doc<"campaigns"> | null;
  theses: Doc<"theses">[];
  hypotheses: Doc<"hypotheses">[];
  recipes: Doc<"recipes">[];
}> {
  const campaign =
    campaignId !== undefined
      ? campaignId === null
        ? null
        : await db.get("campaigns", campaignId)
      : await getActiveCampaignDoc(db);

  if (campaignId !== undefined && campaignId !== null && campaign === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  const theses =
    campaign && campaign.thesisIds.length > 0
      ? (
          await Promise.all(
            campaign.thesisIds.map((thesisId: Id<"theses">) =>
              db.get("theses", thesisId),
            ),
          )
        ).filter(
          (thesis: Doc<"theses"> | null): thesis is Doc<"theses"> =>
            thesis !== null,
        )
      : [];

  const hypotheses =
    theses.length > 0
      ? await loadScopedHypotheses(
          db,
          theses.map((thesis) => thesis._id),
        )
      : await loadFallbackHypotheses(db);

  const recipes = await loadRecipesForHypotheses(db, hypotheses);

  return {
    campaign,
    theses,
    hypotheses,
    recipes,
  };
}

function distinctById<T extends { _id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(String(row._id))) return false;
    seen.add(String(row._id));
    return true;
  });
}

export async function computeRecommendedActionContext(
  db: any,
  args?: {
    campaignId?: Id<"campaigns"> | null;
    limit?: number;
  },
): Promise<RecommendationContext> {
  const limit = args?.limit ?? 5;
  const scope = await loadScope(db, args?.campaignId);
  const failureEntries = await deriveFailureArchiveEntries(db);
  const actions: Array<RecommendedAction & { score: number }> = [];

  const recipesByHypothesis = new Map<string, Doc<"recipes">[]>();
  for (const recipe of scope.recipes) {
    const key = String(recipe.hypothesisId);
    const list = recipesByHypothesis.get(key) ?? [];
    list.push(recipe);
    recipesByHypothesis.set(key, list);
  }

  for (const hypothesis of scope.hypotheses) {
    if (
      hypothesis.status !== "active" ||
      hypothesis.resolution === "contradicted"
    ) {
      continue;
    }

    const hypothesisFailures = failureEntries.filter(
      (entry) =>
        entry.hypothesisId === hypothesis._id &&
        (entry.reason === "contradicted_hypothesis" ||
          entry.reason === "retired_hypothesis"),
    );
    if (hypothesisFailures.length > 0) continue;

    const linkedRecipes = (
      recipesByHypothesis.get(String(hypothesis._id)) ?? []
    ).filter((recipe) => recipe.status !== "archived");

    if (linkedRecipes.length === 0) {
      actions.push({
        kind: "prototype_hypothesis",
        targetType: "hypothesis",
        targetId: String(hypothesis._id),
        durationBucket: "30-minute",
        reason:
          "This active hypothesis has no live recipe yet, so the next best move is to turn it into a concrete studio sketch.",
        score: 7,
      });
    }
  }

  for (const recipe of distinctById(scope.recipes)) {
    const hypothesis = scope.hypotheses.find(
      (row) => row._id === recipe.hypothesisId,
    );
    if (!hypothesis || hypothesis.status === "retired") continue;
    if (hypothesis.resolution === "contradicted") continue;
    if (recipe.status === "archived") continue;

    const recipeFailures = failureEntries.filter(
      (entry) =>
        entry.recipeId === recipe._id ||
        entry.supportingIds.recipeIds.includes(recipe._id),
    );
    if (
      recipeFailures.some(
        (entry) =>
          entry.reason === "archived_recipe" ||
          entry.reason === "repeat_no_expand_composition",
      )
    ) {
      continue;
    }

    const compositions = await db
      .query("compositions")
      .withIndex("by_recipeId_updatedAt", (q: any) =>
        q.eq("recipeId", recipe._id),
      )
      .collect();
    const sortedCompositions = (compositions as Doc<"compositions">[]).toSorted(
      (a, b) => b.updatedAt - a.updatedAt,
    );

    if (sortedCompositions.length === 0) {
      actions.push({
        kind: "advance_recipe",
        targetType: "recipe",
        targetId: String(recipe._id),
        durationBucket: "30-minute",
        reason:
          "This recipe is defined but untested, making it the cleanest next studio move for the current inquiry.",
        score: 8,
      });
      continue;
    }

    const latestComposition = sortedCompositions[0];
    if (!latestComposition) continue;
    const latestSessions = await db
      .query("listeningSessions")
      .withIndex("by_compositionId_createdAt", (q: any) =>
        q.eq("compositionId", latestComposition._id),
      )
      .collect();
    const summary = summarizeListeningSessions(
      latestSessions as Doc<"listeningSessions">[],
    );

    const compositionFailures = failureEntries.filter(
      (entry) =>
        entry.compositionId === latestComposition._id ||
        entry.revisionBranchRootId === latestComposition._id ||
        entry.supportingIds.compositionIds.includes(latestComposition._id),
    );
    if (
      compositionFailures.some(
        (entry) => entry.reason === "repeat_no_expand_composition",
      )
    ) {
      continue;
    }

    if (
      summary.latestExpandVerdict === "yes" ||
      (summary.latestExpandability ?? 0) >= 4
    ) {
      actions.push({
        kind: "expand_composition",
        targetType: "composition",
        targetId: String(latestComposition._id),
        durationBucket: "90-minute",
        reason:
          "Recent listening suggests this branch can become real music, so it deserves a longer expansion block.",
        score: 10,
      });
      continue;
    }

    if (
      compositionFailures.some(
        (entry) => entry.reason === "low_expandability_composition",
      )
    ) {
      continue;
    }

    if (
      summary.latestExpandVerdict === "maybe" ||
      (summary.latestExpandability ?? 0) >= 3
    ) {
      actions.push({
        kind:
          sortedCompositions.length > 1 ? "compare_branch" : "revive_recipe",
        targetType: sortedCompositions.length > 1 ? "composition" : "recipe",
        targetId:
          sortedCompositions.length > 1
            ? String(latestComposition._id)
            : String(recipe._id),
        durationBucket:
          sortedCompositions.length > 1 ? "30-minute" : "10-minute",
        reason:
          sortedCompositions.length > 1
            ? "This branch shows mixed promise, so a quick A/B comparison should clarify which direction is worth keeping."
            : "Listening is not decisively positive yet, but there is enough promise to warrant a short refinement pass.",
        score: sortedCompositions.length > 1 ? 7 : 6,
      });
    }
  }

  const topActions = actions
    .toSorted((a, b) => b.score - a.score || a.reason.localeCompare(b.reason))
    .slice(0, limit)
    .map(({ score: _score, ...action }) => action);

  return {
    campaign: scope.campaign,
    theses: scope.theses,
    hypotheses: distinctById(scope.hypotheses),
    recipes: distinctById(scope.recipes),
    actions: topActions,
    failureArchive: failureEntries,
  };
}

export async function listCampaignSelectionRows(
  db: any,
): Promise<Doc<"campaigns">[]> {
  return await db.query("campaigns").order("desc").take(200);
}

export const list = query({
  args: {
    status: v.optional(campaignStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(campaignReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    if (args.status !== undefined) {
      const status = args.status;
      return await ctx.db
        .query("campaigns")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("campaigns").order("desc").take(limit);
  },
});

export const listForSelection = query({
  args: {},
  returns: v.array(campaignReturnValidator),
  handler: async (ctx) => {
    return await listCampaignSelectionRows(ctx.db);
  },
});

export const get = query({
  args: { id: v.id("campaigns") },
  returns: v.union(campaignReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("campaigns", args.id);
  },
});

export const getActive = query({
  args: {},
  returns: v.union(campaignReturnValidator, v.null()),
  handler: async (ctx) => {
    return await getActiveCampaignDoc(ctx.db);
  },
});

export const getRecommendedActions = query({
  args: { campaignId: v.optional(v.id("campaigns")) },
  returns: recommendedActionsReturnValidator,
  handler: async (ctx, args) => {
    const result = await computeRecommendedActionContext(ctx.db, {
      campaignId: args.campaignId,
    });

    return {
      campaign: result.campaign,
      theses: result.theses,
      actions: result.actions,
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    question: v.string(),
    descriptionMd: v.optional(v.string()),
    status: v.optional(campaignStatusValidator),
    thesisIds: v.optional(v.array(v.id("theses"))),
    summaryMd: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const identity = await requireAuth(ctx, args);
    const now = Date.now();
    const thesisIds = [...new Set(createArgs.thesisIds ?? [])];

    await Promise.all(
      thesisIds.map((thesisId) => getThesisOrThrow(ctx, thesisId)),
    );

    const status = createArgs.status ?? "paused";
    if (status === "active") {
      await pauseOtherCampaigns(ctx);
    }

    return await ctx.db.insert("campaigns", {
      title: createArgs.title,
      question: createArgs.question,
      descriptionMd: createArgs.descriptionMd,
      status,
      thesisIds,
      startedAt: status === "active" ? now : undefined,
      endedAt: status === "completed" ? now : undefined,
      summaryMd: createArgs.summaryMd,
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

export const update = mutation({
  args: {
    id: v.id("campaigns"),
    title: v.optional(v.string()),
    question: v.optional(v.string()),
    descriptionMd: v.optional(v.string()),
    status: v.optional(campaignStatusValidator),
    thesisIds: v.optional(v.array(v.id("theses"))),
    summaryMd: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal("private"),
        v.literal("followers"),
        v.literal("public"),
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
      thesisIds,
      status,
      ...updates
    } = args;
    const campaign = await ctx.db.get("campaigns", id);
    if (!campaign) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    const nextThesisIds =
      thesisIds !== undefined ? [...new Set(thesisIds)] : campaign.thesisIds;
    await Promise.all(
      nextThesisIds.map((thesisId) => getThesisOrThrow(ctx, thesisId)),
    );

    if (status === "active") {
      await pauseOtherCampaigns(ctx, id);
    }

    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      ...(thesisIds !== undefined ? { thesisIds: nextThesisIds } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(status === "active" && !campaign.startedAt ? { startedAt: now } : {}),
      ...(status === "completed"
        ? { endedAt: now }
        : status !== undefined
          ? { endedAt: undefined }
          : {}),
      updatedAt: now,
    });
    return null;
  },
});

export const setActive = mutation({
  args: {
    id: v.id("campaigns"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const campaign = await ctx.db.get("campaigns", args.id);
    if (!campaign) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    await pauseOtherCampaigns(ctx, args.id);
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "active",
      startedAt: campaign.startedAt ?? now,
      endedAt: undefined,
      updatedAt: now,
    });
    return null;
  },
});

export const attachThesis = mutation({
  args: {
    campaignId: v.id("campaigns"),
    thesisId: v.id("theses"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const campaign = await ctx.db.get("campaigns", args.campaignId);
    if (!campaign) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }
    await getThesisOrThrow(ctx, args.thesisId);
    if (campaign.thesisIds.includes(args.thesisId)) return null;

    await ctx.db.patch(args.campaignId, {
      thesisIds: [...campaign.thesisIds, args.thesisId],
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const detachThesis = mutation({
  args: {
    campaignId: v.id("campaigns"),
    thesisId: v.id("theses"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const campaign = await ctx.db.get("campaigns", args.campaignId);
    if (!campaign) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    await ctx.db.patch(args.campaignId, {
      thesisIds: campaign.thesisIds.filter((id) => id !== args.thesisId),
      updatedAt: Date.now(),
    });
    return null;
  },
});
