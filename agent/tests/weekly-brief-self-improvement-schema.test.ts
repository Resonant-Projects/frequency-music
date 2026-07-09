import { describe, expect, test } from "bun:test";

import { weeklyBriefOutputSchema } from "../src/agents/weekly-brief/schema";

const baseBrief = {
  title: "Weekly Brief",
  summaryMd: "Summary of the week.",
  experimentCards: [
    {
      title: "Card 1",
      whyThisMatters: "Because it matters.",
      durationBucket: "10-minute" as const,
    },
    {
      title: "Card 2",
      whyThisMatters: "Because it matters.",
      durationBucket: "30-minute" as const,
    },
    {
      title: "Card 3",
      whyThisMatters: "Because it matters.",
      durationBucket: "90-minute" as const,
    },
  ],
  studioPrompts: {
    tenMinuteMd: "10-minute prompt",
    thirtyMinuteMd: "30-minute prompt",
    ninetyMinuteMd: "90-minute prompt",
  },
};

describe("weeklyBriefOutputSchema whatTheSystemLearned", () => {
  test("parses without whatTheSystemLearned at all (fully omitted)", () => {
    const parsed = weeklyBriefOutputSchema.parse(baseBrief);
    expect(parsed.whatTheSystemLearned).toBeUndefined();
  });

  test("parses an all-zero 'nothing new this week' section", () => {
    const parsed = weeklyBriefOutputSchema.parse({
      ...baseBrief,
      whatTheSystemLearned: {
        summaryMd: "Nothing new this week.",
        editCapturesCount: 0,
        draftsApproved: 0,
        draftsRejected: 0,
      },
    });
    expect(parsed.whatTheSystemLearned).toEqual({
      summaryMd: "Nothing new this week.",
      editCapturesCount: 0,
      draftsApproved: 0,
      draftsRejected: 0,
      rejectionThemes: [],
      memoryRecallNotes: [],
      promptPromotions: [],
    });
  });

  test("parses a fully populated section", () => {
    const parsed = weeklyBriefOutputSchema.parse({
      ...baseBrief,
      whatTheSystemLearned: {
        summaryMd: "4 edits captured; 3 drafts approved, 2 rejected.",
        editCapturesCount: 4,
        draftsApproved: 3,
        draftsRejected: 2,
        rejectionThemes: [
          "not grounded in an extraction",
          "duplicate hypothesis",
        ],
        memoryRecallNotes: ["skipped Schumann×D-root: contradicted in run abc"],
        promptPromotions: [],
      },
    });
    expect(parsed.whatTheSystemLearned?.editCapturesCount).toBe(4);
    expect(parsed.whatTheSystemLearned?.rejectionThemes).toHaveLength(2);
    expect(parsed.whatTheSystemLearned?.memoryRecallNotes).toHaveLength(1);
  });

  test("rejects a negative count (never a fabricated/invalid number)", () => {
    expect(() =>
      weeklyBriefOutputSchema.parse({
        ...baseBrief,
        whatTheSystemLearned: {
          summaryMd: "bad",
          editCapturesCount: -1,
          draftsApproved: 0,
          draftsRejected: 0,
        },
      }),
    ).toThrow();
  });

  test("rejects a blank summaryMd", () => {
    expect(() =>
      weeklyBriefOutputSchema.parse({
        ...baseBrief,
        whatTheSystemLearned: {
          summaryMd: "",
          editCapturesCount: 0,
          draftsApproved: 0,
          draftsRejected: 0,
        },
      }),
    ).toThrow();
  });
});
