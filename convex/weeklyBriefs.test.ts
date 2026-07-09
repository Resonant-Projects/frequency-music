import { describe, expect, test } from "bun:test";
import type { Doc } from "./_generated/dataModel";
import {
  type BriefEditableContent,
  briefContentChanged,
  computeBriefEditCapture,
  generateBriefCore,
  mergeBriefContent,
  parseBriefResponse,
  selectBriefContent,
  selectRecentBriefInputs,
} from "./weeklyBriefs";

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

    expect(result.recentHypotheses.map((hypothesis) => hypothesis._id)).toEqual(
      [recentHypothesisId],
    );
    expect(result.recentRecipes.map((recipe) => recipe._id)).toEqual([
      "recipe-recent",
    ]);
    expect(result.sourceIds).toEqual([recentSourceId]);
  });

  test("fails brief generation when the scoped hypotheses are all stale", async () => {
    const now = Date.now();
    const oldCreatedAt = now - 14 * 24 * 60 * 60 * 1000;

    // generateBriefCore runs in an action context (no ctx.db); it reads all
    // DB-derived context via ctx.runQuery(loadBriefContext). Fake that boundary
    // with a stale-only context and assert the recency gate throws before any
    // AI call. (Previously this test passed a bare { db } — the buggy interface.)
    const ctx = {
      runQuery: async () => ({
        recommendationContext: {
          campaign: null,
          theses: [],
          hypotheses: [
            {
              _id: "hyp-old",
              sourceIds: [],
              createdAt: oldCreatedAt,
            } as unknown as Doc<"hypotheses">,
          ],
          recipes: [],
          actions: [],
          failureArchive: [],
        },
        extraActiveTheses: [],
        editorialSignals: { highYieldClusters: [], lowYieldClusters: [] },
      }),
      runAction: async () => ({ text: "" }),
    };

    await expect(
      generateBriefCore(ctx as any, {
        daysBack: 7,
      }),
    ).rejects.toThrow(
      "No recent hypotheses or recipes found. Generate some first.",
    );
  });
});

function baseBrief(): BriefEditableContent & {
  promptVersion: string;
  model: string;
} {
  return {
    bodyMd: "# Week of March 26\n\nOriginal body.",
    todo: ["Try branch A"],
    studioPrompts: {
      tenMinuteMd: "Ten minute prompt",
      thirtyMinuteMd: "Thirty minute prompt",
      ninetyMinuteMd: "Ninety minute prompt",
    },
    promptVersion: "v2.phase3",
    model: "anthropic/claude-sonnet-4-6",
  };
}

describe("weekly brief edit capture", () => {
  test("selectBriefContent picks only the editable fields", () => {
    const brief = baseBrief();
    expect(selectBriefContent(brief)).toEqual({
      bodyMd: brief.bodyMd,
      todo: brief.todo,
      studioPrompts: brief.studioPrompts,
    });
  });

  test("mergeBriefContent falls back to existing values for omitted fields", () => {
    const existing = selectBriefContent(baseBrief());
    const merged = mergeBriefContent(existing, { bodyMd: "# Edited body" });
    expect(merged.bodyMd).toBe("# Edited body");
    expect(merged.todo).toEqual(existing.todo);
    expect(merged.studioPrompts).toEqual(existing.studioPrompts);
  });

  test("briefContentChanged returns false for identical content and true when a field differs", () => {
    const content = selectBriefContent(baseBrief());
    expect(briefContentChanged(content, { ...content })).toBe(false);
    expect(
      briefContentChanged(content, { ...content, bodyMd: "Changed" }),
    ).toBe(true);
  });

  test("computeBriefEditCapture fires on AI-origin edit with content change", () => {
    const brief = baseBrief();
    const capture = computeBriefEditCapture(brief, {
      bodyMd: "# Human-edited body",
    });

    expect(capture).not.toBeNull();
    expect(capture?.promptVersion).toBe("v2.phase3");
    expect(capture?.model).toBe("anthropic/claude-sonnet-4-6");
    expect(capture?.generated.bodyMd).toBe(brief.bodyMd);
    expect(capture?.edited.bodyMd).toBe("# Human-edited body");
    // Untouched fields carry through unchanged on both sides.
    expect(capture?.generated.todo).toEqual(brief.todo);
    expect(capture?.edited.todo).toEqual(brief.todo);
  });

  test("computeBriefEditCapture does not fire when no fields are provided", () => {
    expect(computeBriefEditCapture(baseBrief(), {})).toBeNull();
  });

  test("computeBriefEditCapture does not fire when the provided value matches the stored value", () => {
    const brief = baseBrief();
    expect(computeBriefEditCapture(brief, { bodyMd: brief.bodyMd })).toBeNull();
  });

  test("computeBriefEditCapture fires on a todo-only edit even when bodyMd is untouched", () => {
    const brief = baseBrief();
    const capture = computeBriefEditCapture(brief, { todo: ["Try branch B"] });
    expect(capture).not.toBeNull();
    expect(capture?.edited.todo).toEqual(["Try branch B"]);
    expect(capture?.generated.todo).toEqual(["Try branch A"]);
  });

  // Note: weekly briefs have no `origin` field and no human-authored insert
  // path (`create` is an internalMutation only called from the AI generation
  // pipeline in generateBriefCore), so there is no "non-AI row" case to
  // cover for this entity -- every row qualifies.
});
