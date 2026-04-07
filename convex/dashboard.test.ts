import { describe, expect, test } from "bun:test";
import { computeEditorialSignals } from "./dashboard";

function createQueryResult<T>(rows: T[]) {
  return {
    collect: async () => rows,
    take: async (limit: number) => rows.slice(0, limit),
  };
}

function makeDb(data: {
  concepts: any[];
  hypotheses?: any[];
  recipes?: any[];
  compositions?: any[];
  listeningSessions?: any[];
}) {
  const tables = {
    concepts: data.concepts,
    hypotheses: data.hypotheses ?? [],
    recipes: data.recipes ?? [],
    compositions: data.compositions ?? [],
    listeningSessions: data.listeningSessions ?? [],
  };

  return {
    query: (table: keyof typeof tables) => createQueryResult(tables[table]),
  };
}

describe("editorial signals", () => {
  test("scores concepts beyond the old 200-row cap", async () => {
    const fillerConcepts = Array.from({ length: 200 }, (_, index) => ({
      _id: `concept-filler-${index}`,
      name: `filler-${index}`,
      displayName: `Filler ${index}`,
      domain: "general",
      mentionCount: 0,
      hypothesisCount: 0,
    }));

    const lateHighConcept = {
      _id: "concept-late-high",
      name: "late-high",
      displayName: "Late High",
      domain: "late-high-domain",
      mentionCount: 1,
      hypothesisCount: 1,
    };

    const lateLowConcept = {
      _id: "concept-late-low",
      name: "late-low",
      displayName: "Late Low",
      domain: "late-low-domain",
      mentionCount: 1,
      hypothesisCount: 1,
    };

    const db = makeDb({
      concepts: [...fillerConcepts, lateHighConcept, lateLowConcept],
      hypotheses: [
        {
          _id: "hypothesis-late-high",
          concepts: ["late-high"],
          resolution: "supported",
          status: "active",
        },
        {
          _id: "hypothesis-late-low",
          concepts: ["late-low"],
          resolution: "contradicted",
          status: "retired",
        },
      ],
      recipes: [
        {
          _id: "recipe-late-high",
          hypothesisId: "hypothesis-late-high",
          status: "draft",
        },
        {
          _id: "recipe-late-low",
          hypothesisId: "hypothesis-late-low",
          status: "archived",
        },
      ],
      compositions: [
        {
          _id: "composition-late-high",
          recipeId: "recipe-late-high",
        },
        {
          _id: "composition-late-low",
          recipeId: "recipe-late-low",
        },
      ],
      listeningSessions: [
        {
          _id: "session-late-high",
          compositionId: "composition-late-high",
          createdAt: 100,
          expandVerdict: "yes",
          ratings: { expandability: 5 },
        },
        {
          _id: "session-late-low",
          compositionId: "composition-late-low",
          createdAt: 200,
          expandVerdict: "no",
          ratings: { expandability: 1 },
        },
      ],
    });

    const result = await computeEditorialSignals(db as any, 10);

    expect(result.concepts.some((concept) => concept.conceptName === "late-high")).toBe(true);
    expect(result.highYieldClusters.some((cluster) => cluster.domain === "late-high-domain")).toBe(
      true,
    );
    expect(result.lowYieldClusters.some((cluster) => cluster.domain === "late-low-domain")).toBe(
      true,
    );
  });
});
