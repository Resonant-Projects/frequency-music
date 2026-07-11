/* eslint-disable no-underscore-dangle */
import { describe, expect, test } from "vite-plus/test";
import type { Id } from "./_generated/dataModel";
import { selectUnlinkedExtractionCandidates } from "./hypotheses";

function extraction(id: string, claims: number, compositionParameters: number) {
  return {
    _id: id as Id<"extractions">,
    claims: Array.from({ length: claims }),
    compositionParameters: Array.from({ length: compositionParameters }),
  };
}

describe("batch hypothesis candidate selection", () => {
  test("skips linked and ineligible extractions without consuming the limit", async () => {
    const linked = new Set(["linked"]);
    const candidates = await selectUnlinkedExtractionCandidates(
      [
        extraction("linked", 3, 1),
        extraction("too-few-claims", 1, 1),
        extraction("no-parameters", 3, 0),
        extraction("candidate-1", 2, 1),
        extraction("candidate-2", 4, 2),
      ],
      {
        limit: 2,
        minClaims: 2,
        isLinked: async (id) => linked.has(String(id)),
      },
    );

    expect(candidates.map((candidate) => String(candidate._id))).toEqual([
      "candidate-1",
      "candidate-2",
    ]);
  });

  test("returns no candidates for a zero limit", async () => {
    expect(
      await selectUnlinkedExtractionCandidates(
        [extraction("candidate", 2, 1)],
        {
          limit: 0,
          minClaims: 2,
          isLinked: async () => false,
        },
      ),
    ).toEqual([]);
  });
});
