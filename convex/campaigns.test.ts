import { describe, expect, test } from "bun:test";
import type { Doc } from "./_generated/dataModel";
import { computeRecommendedActionContext } from "./campaigns";

type TableName =
  | "campaigns"
  | "theses"
  | "hypotheses"
  | "recipes"
  | "compositions"
  | "listeningSessions";

type Tables = Record<TableName, any[]>;

class FakeQuery<T extends Record<string, any>> {
  constructor(private rows: T[]) {}

  withIndex(_name: string, apply?: (q: any) => any) {
    if (!apply) return this;
    const conditions: Array<[string, unknown]> = [];
    const q = {
      eq: (field: string, value: unknown) => {
        conditions.push([field, value]);
        return q;
      },
    };
    apply(q);
    return new FakeQuery(
      this.rows.filter((row) =>
        conditions.every(([field, value]) => row[field] === value),
      ),
    );
  }

  order(direction: "asc" | "desc") {
    const sorted = [...this.rows].toSorted((a, b) =>
      direction === "desc"
        ? (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
        : (a.updatedAt ?? a.createdAt ?? 0) - (b.updatedAt ?? b.createdAt ?? 0),
    );
    return new FakeQuery(sorted);
  }

  collect() {
    return Promise.resolve([...this.rows]);
  }

  take(limit: number) {
    return Promise.resolve(this.rows.slice(0, limit));
  }

  first() {
    return Promise.resolve(this.rows[0] ?? null);
  }
}

function makeDb(tables: Tables) {
  return {
    get(table: TableName, id: string) {
      return Promise.resolve(
        (tables[table] ?? []).find((row) => row._id === id) ?? null,
      );
    },
    query(table: TableName) {
      return new FakeQuery(tables[table] ?? []);
    },
  };
}

describe("campaign recommendation context", () => {
  test("prefers untested recipes and recipe-less active hypotheses inside the active campaign", async () => {
    const campaignId = "campaign-1" as Doc<"campaigns">["_id"];
    const thesisId = "thesis-1" as Doc<"theses">["_id"];
    const hypothesisWithRecipeId = "hyp-1" as Doc<"hypotheses">["_id"];
    const hypothesisWithoutRecipeId = "hyp-2" as Doc<"hypotheses">["_id"];
    const contradictedHypothesisId = "hyp-3" as Doc<"hypotheses">["_id"];
    const recipeId = "recipe-1" as Doc<"recipes">["_id"];

    const db = makeDb({
      campaigns: [
        {
          _id: campaignId,
          title: "Campaign",
          question: "What should survive?",
          thesisIds: [thesisId],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 10,
        },
      ],
      theses: [
        {
          _id: thesisId,
          title: "Thesis",
          statement: "Test the drift idea",
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 10,
        },
      ],
      hypotheses: [
        {
          _id: hypothesisWithRecipeId,
          title: "Recipe-backed hypothesis",
          question: "Q1",
          hypothesis: "H1",
          rationaleMd: "R1",
          thesisId,
          sourceIds: [],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 10,
        },
        {
          _id: hypothesisWithoutRecipeId,
          title: "No recipe hypothesis",
          question: "Q2",
          hypothesis: "H2",
          rationaleMd: "R2",
          thesisId,
          sourceIds: [],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 2,
          updatedAt: 11,
        },
        {
          _id: contradictedHypothesisId,
          title: "Contradicted hypothesis",
          question: "Q3",
          hypothesis: "H3",
          rationaleMd: "R3",
          thesisId,
          sourceIds: [],
          status: "evaluated",
          resolution: "contradicted",
          visibility: "private",
          createdBy: "system",
          createdAt: 3,
          updatedAt: 12,
        },
      ],
      recipes: [
        {
          _id: recipeId,
          hypothesisId: hypothesisWithRecipeId,
          title: "Untested recipe",
          bodyMd: "Body",
          parameters: [],
          dawChecklist: [],
          status: "draft",
          visibility: "private",
          createdBy: "system",
          createdAt: 3,
          updatedAt: 12,
        },
      ],
      compositions: [],
      listeningSessions: [],
    });

    const result = await computeRecommendedActionContext(db as any, {
      campaignId,
      limit: 5,
    });

    expect(result.campaign?._id).toBe(campaignId);
    expect(result.actions.some((action) => action.kind === "advance_recipe")).toBe(
      true,
    );
    expect(
      result.actions.some(
        (action) =>
          action.kind === "prototype_hypothesis" &&
          action.targetId === hypothesisWithoutRecipeId,
      ),
    ).toBe(true);
    expect(
      result.actions.some((action) => action.targetId === contradictedHypothesisId),
    ).toBe(false);
  });
});
