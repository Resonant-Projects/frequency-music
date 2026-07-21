import { describe, expect, test } from "vite-plus/test";
import type { Id, TableNames } from "./_generated/dataModel";
import {
  deriveFailureArchiveEntries,
  getBranchFailureStatusForComposition,
  getFailureStatusForComposition,
  projectFailureArchiveHitsForHypotheses,
} from "./failures";

function makeId<TableName extends TableNames>(value: string) {
  return value as Id<TableName>;
}

function sortRows<T extends { createdAt?: number; updatedAt?: number }>(
  rows: T[],
) {
  return [...rows].toSorted(
    (a, b) =>
      (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
  );
}

function createQueryResult<
  T extends { createdAt?: number; updatedAt?: number },
>(rows: T[]) {
  return {
    collect: async () => rows,
    first: async () => rows[0] ?? null,
    take: async (limit: number) => rows.slice(0, limit),
    order: (_direction: "asc" | "desc") => createQueryResult(sortRows(rows)),
  };
}

function makeDb(data: {
  theses?: any[];
  hypotheses?: any[];
  recipes?: any[];
  compositions?: any[];
  listeningSessions?: any[];
}) {
  const tables = {
    theses: data.theses ?? [],
    hypotheses: data.hypotheses ?? [],
    recipes: data.recipes ?? [],
    compositions: data.compositions ?? [],
    listeningSessions: data.listeningSessions ?? [],
  };

  return {
    get: async (table: keyof typeof tables, id: string) =>
      tables[table].find((row) => String(row._id) === String(id)) ?? null,
    query: (table: keyof typeof tables) => ({
      collect: async () => tables[table],
      withIndex: (index: string, builder: (q: any) => { value: string }) => {
        const constraint = builder({
          eq: (_field: string, value: string) => ({ value }),
        });
        const value = constraint.value;

        if (table === "hypotheses" && index === "by_thesisId_updatedAt") {
          return createQueryResult(
            sortRows(
              tables.hypotheses.filter(
                (row) => String(row.thesisId) === String(value),
              ),
            ),
          );
        }

        if (
          table === "compositions" &&
          index === "by_revisionParentId_updatedAt"
        ) {
          return createQueryResult(
            sortRows(
              tables.compositions.filter(
                (row) => String(row.revisionParentId) === String(value),
              ),
            ),
          );
        }

        if (table === "recipes" && index === "by_hypothesisId_updatedAt") {
          return createQueryResult(
            sortRows(
              tables.recipes.filter(
                (row) => String(row.hypothesisId) === String(value),
              ),
            ),
          );
        }

        if (table === "compositions" && index === "by_recipeId_updatedAt") {
          return createQueryResult(
            sortRows(
              tables.compositions.filter(
                (row) => String(row.recipeId) === String(value),
              ),
            ),
          );
        }

        if (
          table === "listeningSessions" &&
          index === "by_compositionId_createdAt"
        ) {
          return createQueryResult(
            sortRows(
              tables.listeningSessions.filter(
                (row) => String(row.compositionId) === String(value),
              ),
            ),
          );
        }

        return createQueryResult([]);
      },
    }),
  };
}

describe("failure archive derivation", () => {
  test("keeps local failure status separate from branch status", async () => {
    const thesisId = makeId<"theses">("thesis-1");
    const hypothesisId = makeId<"hypotheses">("hypothesis-1");
    const recipeId = makeId<"recipes">("recipe-1");
    const rootId = makeId<"compositions">("composition-root");
    const testedChildId = makeId<"compositions">("composition-tested");
    const untouchedChildId = makeId<"compositions">("composition-untouched");

    const db = makeDb({
      theses: [
        {
          _id: thesisId,
          title: "Root thesis",
        },
      ],
      hypotheses: [
        {
          _id: hypothesisId,
          title: "Root hypothesis",
          thesisId,
          status: "active",
        },
      ],
      recipes: [
        {
          _id: recipeId,
          title: "Recipe",
          hypothesisId,
          status: "draft",
        },
      ],
      compositions: [
        {
          _id: rootId,
          title: "Root composition",
          recipeId,
          status: "idea",
          artifactType: "microStudy",
          version: "v1",
          updatedAt: 100,
        },
        {
          _id: testedChildId,
          title: "Tested revision",
          recipeId,
          status: "idea",
          artifactType: "microStudy",
          version: "v2",
          revisionParentId: rootId,
          revisionVariable: "filter cutoff",
          updatedAt: 200,
        },
        {
          _id: untouchedChildId,
          title: "Untouched revision",
          recipeId,
          status: "idea",
          artifactType: "microStudy",
          version: "v3",
          revisionParentId: rootId,
          revisionVariable: "rhythm",
          updatedAt: 300,
        },
      ],
      listeningSessions: [
        {
          _id: makeId<"listeningSessions">("session-1"),
          compositionId: testedChildId,
          createdAt: 400,
          expandVerdict: "no",
          ratings: { expandability: 1 },
        },
        {
          _id: makeId<"listeningSessions">("session-2"),
          compositionId: testedChildId,
          createdAt: 500,
          expandVerdict: "no",
          ratings: { expandability: 2 },
        },
      ],
    });

    expect(await getFailureStatusForComposition(db as any, testedChildId)).toBe(
      "low_expandability_composition",
    );
    expect(
      await getFailureStatusForComposition(db as any, untouchedChildId),
    ).toBeUndefined();

    expect(
      await getBranchFailureStatusForComposition(db as any, untouchedChildId),
    ).toBe("repeat_no_expand_composition");
  });

  test("anchors repeat-no-expand entries to the branch root and resolves legacy keys", async () => {
    const thesisId = makeId<"theses">("thesis-1");
    const hypothesisId = makeId<"hypotheses">("hypothesis-1");
    const recipeId = makeId<"recipes">("recipe-1");
    const rootId = makeId<"compositions">("composition-root");
    const childId = makeId<"compositions">("composition-child");

    const db = makeDb({
      theses: [{ _id: thesisId, title: "Root thesis" }],
      hypotheses: [
        {
          _id: hypothesisId,
          title: "Root hypothesis",
          thesisId,
          status: "active",
        },
      ],
      recipes: [
        {
          _id: recipeId,
          title: "Recipe",
          hypothesisId,
          status: "draft",
        },
      ],
      compositions: [
        {
          _id: rootId,
          title: "Root composition",
          recipeId,
          status: "idea",
          artifactType: "microStudy",
          version: "v1",
          updatedAt: 100,
        },
        {
          _id: childId,
          title: "Child composition",
          recipeId,
          status: "idea",
          artifactType: "microStudy",
          version: "v2",
          revisionParentId: rootId,
          revisionVariable: "filter cutoff",
          updatedAt: 200,
        },
      ],
      listeningSessions: [
        {
          _id: makeId<"listeningSessions">("session-1"),
          compositionId: childId,
          createdAt: 400,
          expandVerdict: "no",
          ratings: { expandability: 1 },
        },
        {
          _id: makeId<"listeningSessions">("session-2"),
          compositionId: childId,
          createdAt: 500,
          expandVerdict: "no",
          ratings: { expandability: 1 },
        },
      ],
    });

    const entries = await deriveFailureArchiveEntries(db as any);
    const repeatEntries = entries.filter(
      (entry) => entry.reason === "repeat_no_expand_composition",
    );
    expect(repeatEntries).toHaveLength(1);
    expect(repeatEntries[0]?.compositionId).toBe(rootId);
    expect(repeatEntries[0]?.revisionBranchRootId).toBe(rootId);

    const lowEntries = entries.filter(
      (entry) => entry.reason === "low_expandability_composition",
    );
    expect(lowEntries).toHaveLength(1);
    expect(lowEntries[0]?.compositionId).toBe(childId);

    // Legacy key resolution is handled at the query layer (getByKey/getByKeys)
    // Verify the archive key is always anchored to branch root
    expect(repeatEntries[0]?.key).toBe(
      `composition:${rootId}:repeat_no_expand`,
    );
  });

  test("finds the true branch root beyond bounded projection reads", async () => {
    const hypothesisId = makeId<"hypotheses">("hypothesis-deep");
    const recipeId = makeId<"recipes">("recipe-deep");
    const compositionIds = Array.from({ length: 12 }, (_, index) =>
      makeId<"compositions">(`composition-${index}`),
    );
    const hypothesis = {
      _id: hypothesisId,
      title: "Deep hypothesis",
      status: "active",
    };
    const db = makeDb({
      hypotheses: [hypothesis],
      recipes: [
        {
          _id: recipeId,
          title: "Deep recipe",
          hypothesisId,
          status: "draft",
          updatedAt: 1,
        },
      ],
      compositions: compositionIds.map((compositionId, index) => ({
        _id: compositionId,
        title: index === 0 ? "True root" : `Revision ${index}`,
        recipeId,
        status: "idea",
        artifactType: "microStudy",
        version: `v${index + 1}`,
        ...(index > 0 ? { revisionParentId: compositionIds[index - 1] } : {}),
        updatedAt: index,
      })),
      listeningSessions: [1, 2].map((index) => ({
        _id: makeId<"listeningSessions">(`session-${index}`),
        compositionId: compositionIds[index],
        createdAt: index,
        expandVerdict: "no",
        ratings: { expandability: 1 },
      })),
    });

    const hits = await projectFailureArchiveHitsForHypotheses(db as any, [
      hypothesis as any,
    ]);

    expect(
      hits.find(({ reason }) => reason === "repeat_no_expand_composition")
        ?.title,
    ).toBe("True root");
  });
});
