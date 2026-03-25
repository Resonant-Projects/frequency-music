import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import {
  type FailureArchiveEntry,
  type FailureReason,
  inferFailureAction,
  summarizeListeningSessions,
} from "./phase2";
import { failureArchiveEntryValidator } from "./validators";

type DbReader = {
  get: <T extends keyof DataModelMap>(
    table: T,
    id: Id<T>,
  ) => Promise<DataModelMap[T] | null>;
  query: <T extends keyof DataModelMap>(table: T) => any;
};

type DataModelMap = {
  theses: Doc<"theses">;
  hypotheses: Doc<"hypotheses">;
  recipes: Doc<"recipes">;
  compositions: Doc<"compositions">;
  listeningSessions: Doc<"listeningSessions">;
};

async function getBranchRootId(
  db: DbReader,
  composition: Doc<"compositions">,
): Promise<Id<"compositions">> {
  let current = composition;
  while (current.revisionParentId) {
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

  return sessions.flat().sort((a, b) => b.createdAt - a.createdAt);
}

async function loadCompositionContext(
  db: DbReader,
  composition: Doc<"compositions">,
) {
  const recipe = await db.get("recipes", composition.recipeId);
  const hypothesis = recipe ? await db.get("hypotheses", recipe.hypothesisId) : null;
  const thesis =
    hypothesis?.thesisId ? await db.get("theses", hypothesis.thesisId) : null;
  const revisionBranchRootId = await getBranchRootId(db, composition);
  const branchCompositionIds = await getBranchCompositionIds(db, revisionBranchRootId);
  const branchListeningSessions = await getListeningSessionsForCompositionIds(
    db,
    branchCompositionIds,
  );
  const branchSummary = summarizeListeningSessions(branchListeningSessions);

  return {
    recipe,
    hypothesis,
    thesis,
    revisionBranchRootId,
    branchCompositionIds,
    branchListeningSessions,
    branchSummary,
  };
}

function makeFailureEntry(args: Omit<FailureArchiveEntry, "recommendedNextAction">) {
  return {
    ...args,
    recommendedNextAction: inferFailureAction(args.reason),
  };
}

export async function deriveFailureArchiveEntries(
  db: DbReader,
): Promise<FailureArchiveEntry[]> {
  const entries: FailureArchiveEntry[] = [];
  const [hypotheses, recipes, compositions] = await Promise.all([
    db.query("hypotheses").collect(),
    db.query("recipes").collect(),
    db.query("compositions").collect(),
  ]);

  for (const hypothesis of hypotheses) {
    const thesis = hypothesis.thesisId
      ? await db.get("theses", hypothesis.thesisId)
      : null;
    if (hypothesis.resolution === "contradicted") {
      entries.push(
        makeFailureEntry({
          key: `hypothesis:${hypothesis._id}:contradicted`,
          reason: "contradicted_hypothesis",
          createdAt: hypothesis.updatedAt,
          title: hypothesis.title,
          summary: hypothesis.hypothesis,
          thesisId: thesis?._id,
          hypothesisId: hypothesis._id,
          explanation: "This hypothesis is marked contradicted and should remain visible as a reversal.",
          supportingIds: {
            hypothesisIds: [hypothesis._id],
            recipeIds: [],
            compositionIds: [],
            listeningSessionIds: [],
            thesisIds: thesis ? [thesis._id] : [],
          },
        }),
      );
    }
    if (hypothesis.status === "retired") {
      entries.push(
        makeFailureEntry({
          key: `hypothesis:${hypothesis._id}:retired`,
          reason: "retired_hypothesis",
          createdAt: hypothesis.updatedAt,
          title: hypothesis.title,
          summary: hypothesis.hypothesis,
          thesisId: thesis?._id,
          hypothesisId: hypothesis._id,
          explanation: "This hypothesis has been retired and should be treated as completed or intentionally shelved learning.",
          supportingIds: {
            hypothesisIds: [hypothesis._id],
            recipeIds: [],
            compositionIds: [],
            listeningSessionIds: [],
            thesisIds: thesis ? [thesis._id] : [],
          },
        }),
      );
    }
  }

  for (const recipe of recipes) {
    if (recipe.status !== "archived") continue;
    const hypothesis = await db.get("hypotheses", recipe.hypothesisId);
    const thesis =
      hypothesis?.thesisId ? await db.get("theses", hypothesis.thesisId) : null;
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
        explanation: "This recipe is archived and should be revisited only with clear comparative intent.",
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

  for (const composition of compositions) {
    const context = await loadCompositionContext(db, composition);
    const latestSession = context.branchListeningSessions[0];
    const lowOutcomeCount = context.branchSummary.lowOutcomeCount;
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
      latestListeningSessionId: context.branchSummary.latestListeningSessionId,
      revisionBranchRootId: context.revisionBranchRootId,
      supportingIds: {
        hypothesisIds: context.hypothesis ? [context.hypothesis._id] : [],
        recipeIds: context.recipe ? [context.recipe._id] : [],
        compositionIds: context.branchCompositionIds,
        listeningSessionIds: context.branchListeningSessions.map((session) => session._id),
        thesisIds: context.thesis ? [context.thesis._id] : [],
      },
    };

    if (
      latestSession &&
      (latestSession.expandVerdict === "no" ||
        (latestSession.ratings.expandability ?? Number.POSITIVE_INFINITY) <= 2)
    ) {
      entries.push(
        makeFailureEntry({
          key: `composition:${composition._id}:low_expandability`,
          reason: "low_expandability_composition",
          createdAt: latestSession.createdAt,
          explanation: "The latest listening result indicates low expandability or a no-expand verdict.",
          ...baseEntry,
        }),
      );
    }

    if (lowOutcomeCount >= 2) {
      entries.push(
        makeFailureEntry({
          key: `composition:${composition._id}:repeat_no_expand`,
          reason: "repeat_no_expand_composition",
          createdAt: latestSession?.createdAt ?? composition.updatedAt,
          explanation: "Multiple low-yield listening outcomes across this revision branch suggest it should remain archived.",
          ...baseEntry,
        }),
      );
    }
  }

  return entries.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getFailureStatusForComposition(
  db: DbReader,
  compositionId: Id<"compositions">,
): Promise<FailureReason | undefined> {
  const archive = await deriveFailureArchiveEntries(db);
  const matching = archive.find((entry) => entry.compositionId === compositionId);
  return matching?.reason;
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
    const archive = await deriveFailureArchiveEntries(ctx.db as DbReader);
    return archive
      .filter((entry) => (args.reason ? entry.reason === args.reason : true))
      .filter((entry) => (args.thesisId ? entry.thesisId === args.thesisId : true))
      .slice(0, args.limit ?? 100);
  },
});

export const getByKey = query({
  args: { key: v.string() },
  returns: v.union(failureArchiveEntryValidator, v.null()),
  handler: async (ctx, args) => {
    const archive = await deriveFailureArchiveEntries(ctx.db as DbReader);
    return archive.find((entry) => entry.key === args.key) ?? null;
  },
});
