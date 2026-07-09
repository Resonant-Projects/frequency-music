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
  test("preserves normalized concept-to-hypothesis linkage", async () => {
    const db = makeDb({
      concepts: [
        {
          _id: "concept-cymatics",
          name: "cymatics",
          displayName: "Cymatics",
          domain: "wave",
          mentionCount: 2,
          hypothesisCount: 2,
        },
        {
          _id: "concept-resonance",
          name: "resonance",
          displayName: "Resonance",
          domain: "wave",
          mentionCount: 2,
          hypothesisCount: 2,
        },
      ],
      hypotheses: [
        {
          _id: "hypothesis-shared",
          concepts: [" Cymatics ", " RESONANCE "],
          resolution: "supported",
          status: "active",
        },
        {
          _id: "hypothesis-cymatics",
          concepts: ["CYMATICS"],
          resolution: "contradicted",
          status: "retired",
        },
        {
          _id: "hypothesis-resonance",
          concepts: ["resonance"],
          resolution: "inconclusive",
          status: "active",
        },
      ],
      recipes: [
        {
          _id: "recipe-shared",
          hypothesisId: "hypothesis-shared",
          status: "draft",
        },
        {
          _id: "recipe-cymatics",
          hypothesisId: "hypothesis-cymatics",
          status: "archived",
        },
        {
          _id: "recipe-resonance",
          hypothesisId: "hypothesis-resonance",
          status: "draft",
        },
      ],
      compositions: [
        {
          _id: "composition-shared",
          recipeId: "recipe-shared",
        },
        {
          _id: "composition-cymatics",
          recipeId: "recipe-cymatics",
        },
      ],
      listeningSessions: [
        {
          _id: "session-shared",
          compositionId: "composition-shared",
          createdAt: 100,
          expandVerdict: "yes",
          ratings: { expandability: 5 },
        },
        {
          _id: "session-cymatics",
          compositionId: "composition-cymatics",
          createdAt: 200,
          expandVerdict: "no",
          ratings: { expandability: 1 },
        },
      ],
    });

    const result = await computeEditorialSignals(db as any);
    const cymatics = result.concepts.find(
      (concept) => concept.conceptName === "cymatics",
    );
    const resonance = result.concepts.find(
      (concept) => concept.conceptName === "resonance",
    );

    expect(cymatics?.linkedRecipes).toBe(2);
    expect(cymatics?.linkedCompositions).toBe(2);
    expect(resonance?.linkedRecipes).toBe(2);
    expect(resonance?.linkedCompositions).toBe(1);
  });

  test("returns empty signals when every table is empty", async () => {
    const result = await computeEditorialSignals(
      makeDb({ concepts: [] }) as any,
    );

    expect(result).toEqual({
      concepts: [],
      highYieldClusters: [],
      lowYieldClusters: [],
    });
  });

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

    expect(
      result.concepts.some((concept) => concept.conceptName === "late-high"),
    ).toBe(true);
    expect(
      result.highYieldClusters.some(
        (cluster) => cluster.domain === "late-high-domain",
      ),
    ).toBe(true);
    expect(
      result.lowYieldClusters.some(
        (cluster) => cluster.domain === "late-low-domain",
      ),
    ).toBe(true);
  });
});
