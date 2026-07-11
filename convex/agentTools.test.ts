import { describe, expect, test } from "vite-plus/test";
import { summarizeSelfImprovementWindow } from "./agentTools";

const windowStart = 1_000;
const windowEnd = 2_000;

describe("summarizeSelfImprovementWindow", () => {
  test("all-empty window degrades gracefully to zero counts and no notes", () => {
    const result = summarizeSelfImprovementWindow({
      editCaptures: [],
      decidedDrafts: [],
      runEvents: [],
      windowStart,
      windowEnd,
    });

    expect(result).toEqual({
      windowStart,
      windowEnd,
      editCaptures: { count: 0 },
      drafts: { approved: 0, rejected: 0, rejectionNotes: [] },
      memoryRecalls: { count: 0, notes: [] },
    });
  });

  test("counts edit captures inside the window and excludes ones outside it", () => {
    const result = summarizeSelfImprovementWindow({
      editCaptures: [
        { editedAt: windowStart },
        { editedAt: 1_500 },
        { editedAt: windowEnd },
        { editedAt: windowStart - 1 }, // before window
        { editedAt: windowEnd + 1 }, // after window
      ],
      decidedDrafts: [],
      runEvents: [],
      windowStart,
      windowEnd,
    });

    expect(result.editCaptures.count).toBe(3);
  });

  test("splits decided drafts into approved/rejected and collects rejection notes", () => {
    const result = summarizeSelfImprovementWindow({
      editCaptures: [],
      decidedDrafts: [
        { status: "approved", updatedAt: 1_100 },
        { status: "approved", updatedAt: 1_200 },
        {
          status: "rejected",
          updatedAt: 1_300,
          decisionNote: "Not grounded in an extraction",
        },
        {
          status: "rejected",
          updatedAt: 1_400,
          decisionNote: "  Duplicate of an archived failure  ",
        },
        // outside window - ignored
        {
          status: "rejected",
          updatedAt: windowEnd + 100,
          decisionNote: "late",
        },
        // pending drafts never reach this input in practice, but should be
        // ignored defensively if they slip through
        { status: "pending_review", updatedAt: 1_150 },
      ],
      runEvents: [],
      windowStart,
      windowEnd,
    });

    expect(result.drafts.approved).toBe(2);
    expect(result.drafts.rejected).toBe(2);
    expect(result.drafts.rejectionNotes).toEqual([
      "Not grounded in an extraction",
      "Duplicate of an archived failure",
    ]);
  });

  test("ignores rejected drafts with a blank decision note", () => {
    const result = summarizeSelfImprovementWindow({
      editCaptures: [],
      decidedDrafts: [
        { status: "rejected", updatedAt: 1_100, decisionNote: "   " },
        { status: "rejected", updatedAt: 1_200 },
      ],
      runEvents: [],
      windowStart,
      windowEnd,
    });

    expect(result.drafts.rejected).toBe(2);
    expect(result.drafts.rejectionNotes).toEqual([]);
  });

  test("only counts memory_recall events, ignoring other kinds and out-of-window rows", () => {
    const result = summarizeSelfImprovementWindow({
      editCaptures: [],
      decidedDrafts: [],
      runEvents: [
        {
          kind: "memory_recall",
          createdAt: 1_100,
          message: "skipped Schumann×D-root: contradicted in run abc",
        },
        { kind: "decision", createdAt: 1_100, message: "not a recall" },
        {
          kind: "memory_recall",
          createdAt: windowStart - 1,
          message: "out of window",
        },
      ],
      windowStart,
      windowEnd,
    });

    expect(result.memoryRecalls.count).toBe(1);
    expect(result.memoryRecalls.notes).toEqual([
      "skipped Schumann×D-root: contradicted in run abc",
    ]);
  });

  test("caps rejection notes and memory recall notes at 10", () => {
    const decidedDrafts = Array.from({ length: 15 }, (_, i) => ({
      status: "rejected",
      updatedAt: windowStart + i,
      decisionNote: `note-${i}`,
    }));
    const runEvents = Array.from({ length: 15 }, (_, i) => ({
      kind: "memory_recall",
      createdAt: windowStart + i,
      message: `recall-${i}`,
    }));

    const result = summarizeSelfImprovementWindow({
      editCaptures: [],
      decidedDrafts,
      runEvents,
      windowStart,
      windowEnd,
    });

    expect(result.drafts.rejected).toBe(15);
    expect(result.drafts.rejectionNotes).toHaveLength(10);
    expect(result.memoryRecalls.count).toBe(15);
    expect(result.memoryRecalls.notes).toHaveLength(10);
  });
});
