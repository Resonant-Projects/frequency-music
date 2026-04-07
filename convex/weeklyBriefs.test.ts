import { describe, expect, test } from "bun:test";
import type { Doc } from "./_generated/dataModel";
import { makeDb } from "./testHelpers";
import { generateBriefCore, parseBriefResponse, selectRecentBriefInputs } from "./weeklyBriefs";

describe("weekly brief response parsing", () => {
  test("extracts todo items and prompt variants while stripping the JSON block", () => {
    const response = `# Week of March 26

Research summary.

\`\`\`json
{
  "todo": ["Try branch A", "Print comparison bounce"],
  "studioPrompts": {
    "tenMinuteMd": "Ten minute prompt",
    "thirtyMinuteMd": "Thirty minute prompt",
    "ninetyMinuteMd": "Ninety minute prompt"
  }
}
\`\`\``;

    const parsed = parseBriefResponse(response);

    expect(parsed.todo).toEqual(["Try branch A", "Print comparison bounce"]);
    expect(parsed.studioPrompts.tenMinuteMd).toBe("Ten minute prompt");
    expect(parsed.studioPrompts.thirtyMinuteMd).toBe("Thirty minute prompt");
    expect(parsed.studioPrompts.ninetyMinuteMd).toBe("Ninety minute prompt");
    expect(parsed.cleanBodyMd).toBe("# Week of March 26\n\nResearch summary.");
  });

  test("filters hypotheses, recipes, and source ids to the recency window", () => {
    const recentSourceId = "source-recent" as Doc<"sources">["_id"];
    const oldSourceId = "source-old" as Doc<"sources">["_id"];
    const recentHypothesisId = "hyp-recent" as Doc<"hypotheses">["_id"];
    const oldHypothesisId = "hyp-old" as Doc<"hypotheses">["_id"];

    const result = selectRecentBriefInputs({
      cutoff: 100,
      hypotheses: [
        {
          _id: oldHypothesisId,
          sourceIds: [oldSourceId],
          createdAt: 50,
        } as Doc<"hypotheses">,
        {
          _id: recentHypothesisId,
          sourceIds: [recentSourceId],
          createdAt: 150,
        } as Doc<"hypotheses">,
      ],
      recipes: [
        {
          _id: "recipe-old",
          createdAt: 75,
        } as Doc<"recipes">,
        {
          _id: "recipe-recent",
          createdAt: 125,
        } as Doc<"recipes">,
      ],
    });

    expect(result.recentHypotheses.map((hypothesis) => hypothesis._id)).toEqual([
      recentHypothesisId,
    ]);
    expect(result.recentRecipes.map((recipe) => recipe._id)).toEqual(["recipe-recent"]);
    expect(result.sourceIds).toEqual([recentSourceId]);
  });

  test("fails brief generation when the scoped hypotheses are all stale", async () => {
    const now = Date.now();
    const oldCreatedAt = now - 14 * 24 * 60 * 60 * 1000;

    const db = makeDb({
      campaigns: [],
      theses: [],
      hypotheses: [
        {
          _id: "hyp-old",
          title: "Old hypothesis",
          question: "What if this worked?",
          hypothesis: "It did once",
          rationaleMd: "Old rationale",
          sourceIds: [],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: oldCreatedAt,
          updatedAt: oldCreatedAt,
        },
      ],
      recipes: [],
      compositions: [],
      listeningSessions: [],
    });

    await expect(
      generateBriefCore({ db } as any, {
        daysBack: 7,
      }),
    ).rejects.toThrow("No recent hypotheses or recipes found. Generate some first.");
  });
});
