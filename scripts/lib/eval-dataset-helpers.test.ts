import { describe, expect, test } from "vite-plus/test";
import {
  enrichHypothesis,
  resolveHypothesisExtractions,
  withPlaceholderTheses,
  type EvalQuery,
} from "./eval-dataset-helpers";

const BRIEF = {
  activeThesisIds: ["t1", "t2", "t3"],
  bodyMd: "cites `e2e-111` then `e2e-222` then `e2e-333`",
};

/** Stub query resolving `name:id` keys, returning null for anything unlisted. */
function stubQuery(rows: Record<string, unknown>): EvalQuery {
  return async (name, args) => {
    if (name === "extractions:getBySourceId") {
      return rows[`bySource:${String(args.sourceId)}`] ?? [];
    }
    return rows[`${name}:${String(args.id)}`] ?? null;
  };
}

describe("withPlaceholderTheses", () => {
  test("synthesizes a placeholder for every id when no rows survive", () => {
    expect(withPlaceholderTheses(BRIEF, [])).toMatchObject([
      { _id: "t1", title: "e2e-111" },
      { _id: "t2", title: "e2e-222" },
      { _id: "t3", title: "e2e-333" },
    ]);
  });

  test("keeps missing ids as placeholders when only some rows survive", () => {
    const result = withPlaceholderTheses(BRIEF, [
      { _id: "t2", title: "Real thesis", statement: "kept" },
    ]);

    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({ _id: "t2", title: "Real thesis" });
    expect(result.map((thesis) => thesis._id)).toEqual(["t1", "t2", "t3"]);
    expect(result[0]!.statement).toMatch(/Historical placeholder/);
  });

  test("returns rows in activeThesisIds order regardless of query order", () => {
    const result = withPlaceholderTheses(BRIEF, [
      { _id: "t3", title: "third" },
      { _id: "t1", title: "first" },
      { _id: "t2", title: "second" },
    ]);

    expect(result.map((thesis) => thesis.title)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  test("falls back to the stored rows when the brief cites no theses", () => {
    const stored = [{ _id: "t9", title: "orphan" }];
    expect(withPlaceholderTheses({ bodyMd: "" }, stored)).toBe(stored);
  });
});

describe("resolveHypothesisExtractions", () => {
  const hypothesis = { extractionIds: ["e1", "e2"], sourceIds: ["s1"] };

  test("throws on a dangling extraction id under the golden policy", async () => {
    const query = stubQuery({ "extractions:get:e1": { _id: "e1" } });

    await expect(
      resolveHypothesisExtractions(query, hypothesis, "throw"),
    ).rejects.toThrow("extractions:get did not return e2");
  });

  test("drops a dangling extraction id under the candidate policy", async () => {
    const query = stubQuery({ "extractions:get:e1": { _id: "e1" } });

    expect(
      await resolveHypothesisExtractions(query, hypothesis, "skip"),
    ).toEqual([{ _id: "e1" }]);
  });

  test("falls back to one extraction per source when none are linked", async () => {
    const query = stubQuery({
      "bySource:s1": [{ _id: "newest" }, { _id: "older" }],
    });

    expect(
      await resolveHypothesisExtractions(query, { sourceIds: ["s1"] }, "throw"),
    ).toEqual([{ _id: "newest" }]);
  });
});

describe("enrichHypothesis", () => {
  test("aggregates claims, parameters, and deduped topics onto the row", async () => {
    const query = stubQuery({
      "sources:get:s1": { title: "A Paper" },
      "extractions:get:e1": {
        claims: [{ text: "one" }],
        compositionParameters: [{ kind: "tempo" }],
        topics: ["shared", "only-e1"],
      },
      "extractions:get:e2": {
        claims: [{ text: "two" }],
        compositionParameters: [],
        topics: ["shared", "only-e2"],
      },
    });

    expect(
      await enrichHypothesis(
        query,
        { _id: "h1", extractionIds: ["e1", "e2"], sourceIds: ["s1"] },
        "throw",
      ),
    ).toMatchObject({
      _id: "h1",
      sourceTitle: "A Paper",
      claims: [{ text: "one" }, { text: "two" }],
      compositionParameters: [{ kind: "tempo" }],
      topics: ["shared", "only-e1", "only-e2"],
    });
  });

  test("labels an unresolvable source rather than dropping the field", async () => {
    const enriched = await enrichHypothesis(
      stubQuery({}),
      { _id: "h1", sourceIds: [] },
      "skip",
    );

    expect(enriched.sourceTitle).toBe("(untitled source)");
    expect(enriched.claims).toEqual([]);
  });
});
