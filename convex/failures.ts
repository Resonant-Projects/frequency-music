import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import {
  type FailureArchiveEntry,
  type FailureReason,
  inferFailureAction,
  isLowYieldListeningSession,
  summarizeListeningSessions,
} from "./phase2";
export type { FailureArchiveEntry };
import { failureArchiveEntryValidator } from "./validators";

export type DbReader = {
  get: <T extends keyof DataModelMap>(
    table: T,
    id: Id<T>,
  ) => Promise<DataModelMap[T] | null>;
  query: <T extends keyof DataModelMap>(table: T) => any;
};

export type DataModelMap = {
  theses: Doc<"theses">;
  hypotheses: Doc<"hypotheses">;
  recipes: Doc<"recipes">;
  compositions: Doc<"compositions">;
  listeningSessions: Doc<"listeningSessions">;
};

type BranchFailureContext = {
  rootComposition: Doc<"compositions">;
  revisionBranchRootId: Id<"compositions">;
  branchCompositionIds: Id<"compositions">[];
  branchListeningSessions: Doc<"listeningSessions">[];
  branchSummary: ReturnType<typeof summarizeListeningSessions>;
};

type CompositionFailureContext = {
  recipe: Doc<"recipes"> | null;
  hypothesis: Doc<"hypotheses"> | null;
  thesis: Doc<"theses"> | null;
  localListeningSessions: Doc<"listeningSessions">[];
  localSummary: ReturnType<typeof summarizeListeningSessions>;
  branch: BranchFailureContext;
};

async function getBranchRootId(
  db: DbReader,
  composition: Doc<"compositions">,
): Promise<Id<"compositions">> {
  let current = composition;
  const seen = new Set([String(composition._id)]);
  while (current.revisionParentId) {
    if (seen.has(String(current.revisionParentId))) break;
    seen.add(String(current.revisionParentId));
    const parent = await db.get("compositions", current.revisionParentId);
    if (!parent) break;
    current = parent;
  }
  return current._id;
}

async function getBranchCompositionIds(
  db: DbReader,
  rootId: Id<"compositions">,
): Promise<Id<"compositions">[]> {
  const seen = new Set<string>();
  const queue: Id<"compositions">[] = [rootId];
  const ids: Id<"compositions">[] = [];

  while (queue.length > 0) {
    const nextId = queue.shift()!;
    if (seen.has(String(nextId))) continue;
    seen.add(String(nextId));
    ids.push(nextId);

    const children = await db
      .query("compositions")
      .withIndex("by_revisionParentId_updatedAt", (q: any) =>
        q.eq("revisionParentId", nextId),
      )
      .collect();

    for (const child of children) {
      queue.push(child._id);
    }
  }

  return ids;
}

async function getListeningSessionsForCompositionIds(
  db: DbReader,
  compositionIds: Id<"compositions">[],
): Promise<Doc<"listeningSessions">[]> {
  const sessions = await Promise.all(
    compositionIds.map((compositionId) =>
      db
        .query("listeningSessions")
        .withIndex("by_compositionId_createdAt", (q: any) =>
          q.eq("compositionId", compositionId),
        )
        .collect(),
    ),
  );

  return sessions.flat().toSorted((a, b) => b.createdAt - a.createdAt);
}

async function getListeningSessionsForComposition(
  db: DbReader,
  compositionId: Id<"compositions">,
): Promise<Doc<"listeningSessions">[]> {
  return await db
    .query("listeningSessions")
    .withIndex("by_compositionId_createdAt", (q: any) =>
      q.eq("compositionId", compositionId),
    )
    .collect();
}

function getLocalFailureStatus(
  sessions: Doc<"listeningSessions">[],
): FailureReason | undefined {
  const latestSession = [...sessions].toSorted(
    (a, b) => b.createdAt - a.createdAt,
  )[0];
  if (latestSession && isLowYieldListeningSession(latestSession)) {
    return "low_expandability_composition";
  }
  return undefined;
}

function getBranchFailureStatus(
  sessions: Doc<"listeningSessions">[],
): FailureReason | undefined {
  const summary = summarizeListeningSessions(sessions);
  if (summary.lowOutcomeCount >= 2) {
    return "repeat_no_expand_composition";
  }
  return undefined;
}

async function loadBranchFailureContext(
  db: DbReader,
  composition: Doc<"compositions">,
  cache: Map<string, BranchFailureContext>,
): Promise<BranchFailureContext> {
  const revisionBranchRootId = await getBranchRootId(db, composition);
  const cached = cache.get(String(revisionBranchRootId));
  if (cached) return cached;

  const rootComposition =
    composition._id === revisionBranchRootId
      ? composition
      : await db.get("compositions", revisionBranchRootId);
  if (!rootComposition) {
    throw new Error("Branch root composition not found");
  }

  const branchCompositionIds = await getBranchCompositionIds(
    db,
    revisionBranchRootId,
  );
  const branchListeningSessions = await getListeningSessionsForCompositionIds(
    db,
    branchCompositionIds,
  );
  const context = {
    rootComposition,
    revisionBranchRootId,
    branchCompositionIds,
    branchListeningSessions,
    branchSummary: summarizeListeningSessions(branchListeningSessions),
  };
  cache.set(String(revisionBranchRootId), context);
  return context;
}

async function loadCompositionContext(
  db: DbReader,
  composition: Doc<"compositions">,
  branchCache: Map<string, BranchFailureContext>,
): Promise<CompositionFailureContext> {
  const recipe = await db.get("recipes", composition.recipeId);
  const hypothesis = recipe
    ? await db.get("hypotheses", recipe.hypothesisId)
    : null;
  const thesis = hypothesis?.thesisId
    ? await db.get("theses", hypothesis.thesisId)
    : null;
  const localListeningSessions = await getListeningSessionsForComposition(
    db,
    composition._id,
  );
  const branch = await loadBranchFailureContext(db, composition, branchCache);

  return {
    recipe,
    hypothesis,
    thesis,
    localListeningSessions,
    localSummary: summarizeListeningSessions(localListeningSessions),
    branch,
  };
}

function makeFailureEntry(
  args: Omit<FailureArchiveEntry, "recommendedNextAction">,
) {
  return {
    ...args,
    recommendedNextAction: inferFailureAction(args.reason),
  };
}

type FailureDerivationFilter = {
  reason?: FailureReason;
  thesisId?: Id<"theses">;
};

const HYPOTHESIS_REASONS: Set<FailureReason> = new Set([
  "contradicted_hypothesis",
  "retired_hypothesis",
]);
const RECIPE_REASONS: Set<FailureReason> = new Set(["archived_recipe"]);
const COMPOSITION_REASONS: Set<FailureReason> = new Set([
  "low_expandability_composition",
  "repeat_no_expand_composition",
]);

function buildHypothesisEntry(
  hypothesis: Doc<"hypotheses">,
  thesis: Doc<"theses"> | null,
  reason: "contradicted_hypothesis" | "retired_hypothesis",
): FailureArchiveEntry {
  return makeFailureEntry({
    key: `hypothesis:${hypothesis._id}:${reason === "contradicted_hypothesis" ? "contradicted" : "retired"}`,
    reason,
    createdAt: hypothesis.updatedAt,
    title: hypothesis.title,
    summary: hypothesis.hypothesis,
    thesisId: thesis?._id,
    hypothesisId: hypothesis._id,
    explanation:
      reason === "contradicted_hypothesis"
        ? "This hypothesis is marked contradicted and should remain visible as a reversal."
        : "This hypothesis has been retired and should be treated as completed or intentionally shelved learning.",
    supportingIds: {
      hypothesisIds: [hypothesis._id],
      recipeIds: [],
      compositionIds: [],
      listeningSessionIds: [],
      thesisIds: thesis ? [thesis._id] : [],
    },
  });
}

async function deriveHypothesisFailures(
  db: DbReader,
  filter: FailureDerivationFilter,
): Promise<FailureArchiveEntry[]> {
  const entries: FailureArchiveEntry[] = [];
  const hypotheses = filter.thesisId
    ? await db
        .query("hypotheses")
        .withIndex("by_thesisId_updatedAt", (q: any) =>
          q.eq("thesisId", filter.thesisId),
        )
        .collect()
    : await db.query("hypotheses").collect();

  for (const hypothesis of hypotheses) {
    const thesis = hypothesis.thesisId
      ? await db.get("theses", hypothesis.thesisId)
      : null;
    if (
      hypothesis.resolution === "contradicted" &&
      (!filter.reason || filter.reason === "contradicted_hypothesis")
    ) {
      entries.push(
        buildHypothesisEntry(hypothesis, thesis, "contradicted_hypothesis"),
      );
    }
    if (
      hypothesis.status === "retired" &&
      (!filter.reason || filter.reason === "retired_hypothesis")
    ) {
      entries.push(
        buildHypothesisEntry(hypothesis, thesis, "retired_hypothesis"),
      );
    }
  }
  return entries;
}

async function deriveRecipeFailures(
  db: DbReader,
  filter: FailureDerivationFilter,
): Promise<FailureArchiveEntry[]> {
  const entries: FailureArchiveEntry[] = [];
  const recipes = await db.query("recipes").collect();

  for (const recipe of recipes) {
    if (recipe.status !== "archived") continue;
    const hypothesis = await db.get("hypotheses", recipe.hypothesisId);
    if (filter.thesisId && hypothesis?.thesisId !== filter.thesisId) continue;
    const thesis = hypothesis?.thesisId
      ? await db.get("theses", hypothesis.thesisId)
      : null;
    entries.push(
      makeFailureEntry({
        key: `recipe:${recipe._id}:archived`,
        reason: "archived_recipe",
        createdAt: recipe.updatedAt,
        title: recipe.title,
        summary: recipe.whyThisMatters ?? recipe.bodyMd,
        thesisId: thesis?._id,
        hypothesisId: hypothesis?._id,
        recipeId: recipe._id,
        explanation:
          "This recipe is archived and should be revisited only with clear comparative intent.",
        supportingIds: {
          hypothesisIds: hypothesis ? [hypothesis._id] : [],
          recipeIds: [recipe._id],
          compositionIds: [],
          listeningSessionIds: [],
          thesisIds: thesis ? [thesis._id] : [],
        },
      }),
    );
  }
  return entries;
}

async function deriveCompositionFailures(
  db: DbReader,
  filter: FailureDerivationFilter,
): Promise<FailureArchiveEntry[]> {
  const entries: FailureArchiveEntry[] = [];
  const emittedBranchRoots = new Set<string>();
  const branchCache = new Map<string, BranchFailureContext>();
  const compositions = await db.query("compositions").collect();

  for (const composition of compositions) {
    const context = await loadCompositionContext(db, composition, branchCache);
    if (filter.thesisId && context.thesis?._id !== filter.thesisId) continue;

    const localFailureStatus = getLocalFailureStatus(
      context.localListeningSessions,
    );
    const branchFailureStatus = getBranchFailureStatus(
      context.branch.branchListeningSessions,
    );
    const baseEntry = {
      title: composition.title,
      summary:
        composition.diffNote ??
        composition.projectNotesMd ??
        `Revision variable: ${composition.revisionVariable ?? "not recorded"}`,
      thesisId: context.thesis?._id,
      hypothesisId: context.hypothesis?._id,
      recipeId: context.recipe?._id,
      compositionId: composition._id,
      latestListeningSessionId: context.localSummary.latestListeningSessionId,
      revisionBranchRootId: context.branch.revisionBranchRootId,
      supportingIds: {
        hypothesisIds: context.hypothesis ? [context.hypothesis._id] : [],
        recipeIds: context.recipe ? [context.recipe._id] : [],
        compositionIds: [composition._id],
        listeningSessionIds: context.localListeningSessions.map(
          (session) => session._id,
        ),
        thesisIds: context.thesis ? [context.thesis._id] : [],
      },
    };

    if (
      localFailureStatus === "low_expandability_composition" &&
      (!filter.reason || filter.reason === "low_expandability_composition")
    ) {
      const latestSession = context.localListeningSessions.toSorted(
        (a, b) => b.createdAt - a.createdAt,
      )[0];
      entries.push(
        makeFailureEntry({
          key: `composition:${composition._id}:low_expandability`,
          reason: "low_expandability_composition",
          createdAt: latestSession?.createdAt ?? composition.updatedAt,
          explanation:
            "The latest listening result indicates low expandability or a no-expand verdict.",
          ...baseEntry,
        }),
      );
    }

    const branchRootKey = String(context.branch.revisionBranchRootId);
    if (
      branchFailureStatus === "repeat_no_expand_composition" &&
      !emittedBranchRoots.has(branchRootKey) &&
      (!filter.reason || filter.reason === "repeat_no_expand_composition")
    ) {
      emittedBranchRoots.add(branchRootKey);
      const branchRecipe = await db.get(
        "recipes",
        context.branch.rootComposition.recipeId,
      );
      const branchHypothesis = branchRecipe
        ? await db.get("hypotheses", branchRecipe.hypothesisId)
        : null;
      const branchThesis = branchHypothesis?.thesisId
        ? await db.get("theses", branchHypothesis.thesisId)
        : null;
      entries.push(
        makeFailureEntry({
          key: `composition:${context.branch.revisionBranchRootId}:repeat_no_expand`,
          reason: "repeat_no_expand_composition",
          createdAt: context.branch.branchSummary.latestListeningSessionId
            ? ((
                context.branch.branchListeningSessions.find(
                  (session) =>
                    session._id ===
                    context.branch.branchSummary.latestListeningSessionId,
                ) ?? context.branch.branchListeningSessions[0]
              )?.createdAt ?? context.branch.rootComposition.updatedAt)
            : context.branch.rootComposition.updatedAt,
          explanation:
            "Multiple low-yield listening outcomes across this revision branch suggest the branch should remain archived.",
          title: context.branch.rootComposition.title,
          summary:
            context.branch.rootComposition.diffNote ??
            context.branch.rootComposition.projectNotesMd ??
            `Revision variable: ${context.branch.rootComposition.revisionVariable ?? "not recorded"}`,
          thesisId: branchThesis?._id,
          hypothesisId: branchHypothesis?._id,
          recipeId: branchRecipe?._id,
          compositionId: context.branch.revisionBranchRootId,
          latestListeningSessionId:
            context.branch.branchSummary.latestListeningSessionId,
          revisionBranchRootId: context.branch.revisionBranchRootId,
          supportingIds: {
            hypothesisIds: branchHypothesis ? [branchHypothesis._id] : [],
            recipeIds: branchRecipe ? [branchRecipe._id] : [],
            compositionIds: context.branch.branchCompositionIds,
            listeningSessionIds: context.branch.branchListeningSessions.map(
              (session) => session._id,
            ),
            thesisIds: branchThesis ? [branchThesis._id] : [],
          },
        }),
      );
    }
  }
  return entries;
}

async function deriveFilteredFailureArchive(
  db: DbReader,
  filter: FailureDerivationFilter = {},
): Promise<FailureArchiveEntry[]> {
  const needHypotheses =
    !filter.reason || HYPOTHESIS_REASONS.has(filter.reason);
  const needRecipes = !filter.reason || RECIPE_REASONS.has(filter.reason);
  const needCompositions =
    !filter.reason || COMPOSITION_REASONS.has(filter.reason);

  const parts = await Promise.all([
    needHypotheses ? deriveHypothesisFailures(db, filter) : [],
    needRecipes ? deriveRecipeFailures(db, filter) : [],
    needCompositions ? deriveCompositionFailures(db, filter) : [],
  ]);

  return parts.flat().toSorted((a, b) => b.createdAt - a.createdAt);
}

export async function deriveFailureArchiveEntries(
  db: DbReader,
): Promise<FailureArchiveEntry[]> {
  return deriveFilteredFailureArchive(db);
}

export async function getFailureStatusForComposition(
  db: DbReader,
  compositionId: Id<"compositions">,
): Promise<FailureReason | undefined> {
  const composition = await db.get("compositions", compositionId);
  if (!composition) return undefined;

  const branchCache = new Map<string, BranchFailureContext>();
  const context = await loadCompositionContext(db, composition, branchCache);
  return getLocalFailureStatus(context.localListeningSessions);
}

export async function getBranchFailureStatusForComposition(
  db: DbReader,
  compositionId: Id<"compositions">,
): Promise<FailureReason | undefined> {
  const composition = await db.get("compositions", compositionId);
  if (!composition) return undefined;

  const branch = await loadBranchFailureContext(
    db,
    composition,
    new Map<string, BranchFailureContext>(),
  );
  return getBranchFailureStatus(branch.branchListeningSessions);
}

export const listArchive = query({
  args: {
    reason: v.optional(
      v.union(
        v.literal("contradicted_hypothesis"),
        v.literal("retired_hypothesis"),
        v.literal("archived_recipe"),
        v.literal("low_expandability_composition"),
        v.literal("repeat_no_expand_composition"),
      ),
    ),
    thesisId: v.optional(v.id("theses")),
    limit: v.optional(v.number()),
  },
  returns: v.array(failureArchiveEntryValidator),
  handler: async (ctx, args) => {
    const archive = await deriveFilteredFailureArchive(ctx.db as DbReader, {
      reason: args.reason,
      thesisId: args.thesisId,
    });
    return archive.slice(0, args.limit ?? 100);
  },
});

async function deriveEntryByKey(
  db: DbReader,
  key: string,
): Promise<FailureArchiveEntry | null> {
  const [type, id, suffix] = key.split(":");
  if (!type || !id || !suffix) return null;

  if (type === "hypothesis") {
    const hypothesis = await db.get("hypotheses", id as Id<"hypotheses">);
    if (!hypothesis) return null;
    const reason =
      suffix === "contradicted"
        ? "contradicted_hypothesis"
        : suffix === "retired"
          ? "retired_hypothesis"
          : null;
    if (!reason) return null;
    if (
      (reason === "contradicted_hypothesis" &&
        hypothesis.resolution !== "contradicted") ||
      (reason === "retired_hypothesis" && hypothesis.status !== "retired")
    )
      return null;
    const thesis = hypothesis.thesisId
      ? await db.get("theses", hypothesis.thesisId)
      : null;
    return buildHypothesisEntry(
      hypothesis,
      thesis,
      reason as "contradicted_hypothesis" | "retired_hypothesis",
    );
  }

  if (type === "recipe") {
    const recipe = await db.get("recipes", id as Id<"recipes">);
    if (!recipe || recipe.status !== "archived") return null;
    const hypothesis = await db.get("hypotheses", recipe.hypothesisId);
    const thesis = hypothesis?.thesisId
      ? await db.get("theses", hypothesis.thesisId)
      : null;
    return makeFailureEntry({
      key,
      reason: "archived_recipe",
      createdAt: recipe.updatedAt,
      title: recipe.title,
      summary: recipe.whyThisMatters ?? recipe.bodyMd,
      thesisId: thesis?._id,
      hypothesisId: hypothesis?._id,
      recipeId: recipe._id,
      explanation:
        "This recipe is archived and should be revisited only with clear comparative intent.",
      supportingIds: {
        hypothesisIds: hypothesis ? [hypothesis._id] : [],
        recipeIds: [recipe._id],
        compositionIds: [],
        listeningSessionIds: [],
        thesisIds: thesis ? [thesis._id] : [],
      },
    });
  }

  if (type === "composition") {
    const composition = await db.get("compositions", id as Id<"compositions">);
    if (!composition) return null;
    const branchCache = new Map<string, BranchFailureContext>();
    const context = await loadCompositionContext(db, composition, branchCache);

    if (suffix === "low_expandability") {
      const status = getLocalFailureStatus(context.localListeningSessions);
      if (status !== "low_expandability_composition") return null;
      const latestSession = context.localListeningSessions.toSorted(
        (a, b) => b.createdAt - a.createdAt,
      )[0];
      return makeFailureEntry({
        key,
        reason: "low_expandability_composition",
        createdAt: latestSession?.createdAt ?? composition.updatedAt,
        explanation:
          "The latest listening result indicates low expandability or a no-expand verdict.",
        title: composition.title,
        summary:
          composition.diffNote ??
          composition.projectNotesMd ??
          `Revision variable: ${composition.revisionVariable ?? "not recorded"}`,
        thesisId: context.thesis?._id,
        hypothesisId: context.hypothesis?._id,
        recipeId: context.recipe?._id,
        compositionId: composition._id,
        latestListeningSessionId: context.localSummary.latestListeningSessionId,
        revisionBranchRootId: context.branch.revisionBranchRootId,
        supportingIds: {
          hypothesisIds: context.hypothesis ? [context.hypothesis._id] : [],
          recipeIds: context.recipe ? [context.recipe._id] : [],
          compositionIds: [composition._id],
          listeningSessionIds: context.localListeningSessions.map((s) => s._id),
          thesisIds: context.thesis ? [context.thesis._id] : [],
        },
      });
    }

    if (suffix === "repeat_no_expand") {
      const status = getBranchFailureStatus(
        context.branch.branchListeningSessions,
      );
      if (status !== "repeat_no_expand_composition") return null;
      const branchRecipe = await db.get(
        "recipes",
        context.branch.rootComposition.recipeId,
      );
      const branchHypothesis = branchRecipe
        ? await db.get("hypotheses", branchRecipe.hypothesisId)
        : null;
      const branchThesis = branchHypothesis?.thesisId
        ? await db.get("theses", branchHypothesis.thesisId)
        : null;
      return makeFailureEntry({
        key,
        reason: "repeat_no_expand_composition",
        createdAt: context.branch.branchSummary.latestListeningSessionId
          ? ((
              context.branch.branchListeningSessions.find(
                (session) =>
                  session._id ===
                  context.branch.branchSummary.latestListeningSessionId,
              ) ?? context.branch.branchListeningSessions[0]
            )?.createdAt ?? context.branch.rootComposition.updatedAt)
          : context.branch.rootComposition.updatedAt,
        explanation:
          "Multiple low-yield listening outcomes across this revision branch suggest the branch should remain archived.",
        title: context.branch.rootComposition.title,
        summary:
          context.branch.rootComposition.diffNote ??
          context.branch.rootComposition.projectNotesMd ??
          `Revision variable: ${context.branch.rootComposition.revisionVariable ?? "not recorded"}`,
        thesisId: branchThesis?._id,
        hypothesisId: branchHypothesis?._id,
        recipeId: branchRecipe?._id,
        compositionId: context.branch.revisionBranchRootId,
        latestListeningSessionId:
          context.branch.branchSummary.latestListeningSessionId,
        revisionBranchRootId: context.branch.revisionBranchRootId,
        supportingIds: {
          hypothesisIds: branchHypothesis ? [branchHypothesis._id] : [],
          recipeIds: branchRecipe ? [branchRecipe._id] : [],
          compositionIds: context.branch.branchCompositionIds,
          listeningSessionIds: context.branch.branchListeningSessions.map(
            (s) => s._id,
          ),
          thesisIds: branchThesis ? [branchThesis._id] : [],
        },
      });
    }
  }

  return null;
}

export const getByKey = query({
  args: { key: v.string() },
  returns: v.union(failureArchiveEntryValidator, v.null()),
  handler: async (ctx, args) => {
    const db = ctx.db as DbReader;
    const direct = await deriveEntryByKey(db, args.key);
    if (direct) return direct;

    // Legacy key resolution: try mapping to branch root
    const legacyMatch = args.key.match(
      /^composition:([^:]+):repeat_no_expand$/,
    );
    if (!legacyMatch?.[1]) return null;
    const composition = await db.get(
      "compositions",
      legacyMatch[1] as Id<"compositions">,
    );
    if (!composition) return null;
    const rootId = await getBranchRootId(db, composition);
    if (rootId === (legacyMatch[1] as Id<"compositions">)) return null;
    return deriveEntryByKey(db, `composition:${rootId}:repeat_no_expand`);
  },
});

export const getByKeys = query({
  args: { keys: v.array(v.string()) },
  returns: v.array(failureArchiveEntryValidator),
  handler: async (ctx, args) => {
    const db = ctx.db as DbReader;
    const resolved = await Promise.all(
      args.keys.map(async (key) => {
        const direct = await deriveEntryByKey(db, key);
        if (direct) return direct;

        const legacyMatch = key.match(/^composition:([^:]+):repeat_no_expand$/);
        if (!legacyMatch?.[1]) return null;
        const composition = await db.get(
          "compositions",
          legacyMatch[1] as Id<"compositions">,
        );
        if (!composition) return null;
        const rootId = await getBranchRootId(db, composition);
        if (rootId === (legacyMatch[1] as Id<"compositions">)) return null;
        return deriveEntryByKey(db, `composition:${rootId}:repeat_no_expand`);
      }),
    );

    const seen = new Set<string>();
    return resolved.filter((entry): entry is FailureArchiveEntry => {
      if (!entry || seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    });
  },
});
