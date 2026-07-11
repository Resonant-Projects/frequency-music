import { describe, expect, test } from "vite-plus/test";
import { computeEditorialSignals, computeLoopHealth } from "./dashboard";

describe("loop health", () => {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  test("marks only timestamps older than their staleness thresholds", () => {
    const now = 10 * day;

    expect(computeLoopHealth(now, now - day, now - 8 * day)).toMatchObject({
      extractionStale: false,
      briefStale: false,
      staleCount: 0,
    });
    expect(
      computeLoopHealth(now, now - day - 1, now - 8 * day - 1),
    ).toMatchObject({
      extractionStale: true,
      briefStale: true,
      staleCount: 2,
    });
  });

  test("treats missing pipeline output as stale", () => {
    expect(computeLoopHealth(10 * day, null, null)).toEqual({
      extractionStale: true,
      briefStale: true,
      staleCount: 2,
    });
  });
});

function makeDb(data: {
  concepts: any[];
  edges?: any[];
  hypotheses?: any[];
  recipes?: any[];
  compositions?: any[];
  listeningSessions?: any[];
}) {
  const calls: Array<{ table: string; operation: string; value?: unknown }> =
    [];
  const tables = {
    concepts: data.concepts,
    edges: data.edges ?? [],
    hypotheses: data.hypotheses ?? [],
    recipes: data.recipes ?? [],
    compositions: data.compositions ?? [],
    listeningSessions: data.listeningSessions ?? [],
  };

  const rowsById = new Map(
    Object.values(tables)
      .flat()
      .map((row) => [row._id, row]),
  );

  const query = (table: keyof typeof tables) => {
    let rows = [...tables[table]];
    let indexName: string | undefined;
    const builder = {
      withIndex: (name: string, apply?: (q: any) => unknown) => {
        calls.push({ table, operation: "withIndex", value: name });
        indexName = name;
        if (apply) {
          const predicates: Array<[string, unknown]> = [];
          const q = {
            eq: (field: string, value: unknown) => {
              predicates.push([field, value]);
              return q;
            },
          };
          apply(q);
          rows = rows.filter((row) =>
            predicates.every(([field, value]) => row[field] === value),
          );
        }
        return builder;
      },
      order: (direction: "asc" | "desc") => {
        calls.push({ table, operation: "order", value: direction });
        const orderField =
          indexName === "by_mentionCount" ? "mentionCount" : "createdAt";
        rows.sort((a, b) =>
          direction === "desc"
            ? (b[orderField] ?? 0) - (a[orderField] ?? 0)
            : (a[orderField] ?? 0) - (b[orderField] ?? 0),
        );
        return builder;
      },
      take: async (limit: number) => {
        calls.push({ table, operation: "take", value: limit });
        return rows.slice(0, limit);
      },
      first: async () => {
        calls.push({ table, operation: "first" });
        return rows[0] ?? null;
      },
    };
    return builder;
  };

  return {
    query,
    get: async (_table: string, id: string) => rowsById.get(id) ?? null,
    calls,
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
      edges: [
        {
          _id: "edge-shared-cymatics",
          fromType: "hypothesis",
          fromId: "hypothesis-shared",
          toType: "concept",
          toId: "cymatics",
        },
        {
          _id: "edge-shared-resonance",
          fromType: "hypothesis",
          fromId: "hypothesis-shared",
          toType: "concept",
          toId: "resonance",
        },
        {
          _id: "edge-cymatics",
          fromType: "hypothesis",
          fromId: "hypothesis-cymatics",
          toType: "concept",
          toId: "cymatics",
        },
        {
          _id: "edge-resonance",
          fromType: "hypothesis",
          fromId: "hypothesis-resonance",
          toType: "concept",
          toId: "resonance",
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

  test("bounds candidates by mention index while preserving yield ranking", async () => {
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
      mentionCount: 10,
      hypothesisCount: 1,
    };

    const lateLowConcept = {
      _id: "concept-late-low",
      name: "late-low",
      displayName: "Late Low",
      domain: "late-low-domain",
      mentionCount: 9,
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
      edges: [
        {
          _id: "edge-late-high",
          fromType: "hypothesis",
          fromId: "hypothesis-late-high",
          toType: "concept",
          toId: "late-high",
        },
        {
          _id: "edge-late-low",
          fromType: "hypothesis",
          fromId: "hypothesis-late-low",
          toType: "concept",
          toId: "late-low",
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
    expect(db.calls).toContainEqual({
      table: "concepts",
      operation: "withIndex",
      value: "by_mentionCount",
    });
    expect(db.calls).toContainEqual({
      table: "concepts",
      operation: "take",
      value: 100,
    });
  });
});
