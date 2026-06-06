import { describe, expect, test } from "bun:test";
import type { Id } from "./_generated/dataModel";

import {
  buildAgentReviewDraftInsert,
  safeAgentReviewDraft,
  summarizeAgentReviewDraft,
} from "./agentDrafts";

describe("agent review draft helpers", () => {
  test("sanitizes human-review drafts without exposing raw model context", () => {
    expect(
      safeAgentReviewDraft({
        kind: "hypothesis_draft",
        title: "Review draft: harmonic lattice",
        summary: "Candidate hypothesis for human review.",
        candidateIds: ["extraction-1"],
        needsReview: true,
        rawPrompt: "private prompt",
        rawResponse: "private response",
      }),
    ).toEqual({
      kind: "hypothesis_draft",
      title: "Review draft: harmonic lattice",
      summary: "Candidate hypothesis for human review.",
      candidateIds: ["extraction-1"],
      needsReview: true,
    });

    expect(
      safeAgentReviewDraft({
        kind: "hypothesis_draft",
        title: "Review draft",
        summary: "token=should-not-render should be redacted.",
        candidateIds: ["api_key=abc123456789"],
        needsReview: true,
      }),
    ).toEqual({
      kind: "hypothesis_draft",
      title: "Review draft",
      summary: "token=[REDACTED] should be redacted.",
      candidateIds: ["api_key=[REDACTED]"],
      needsReview: true,
    });

    expect(
      safeAgentReviewDraft({ kind: "dry_run_summary", title: "Nope" }),
    ).toBeUndefined();
    expect(
      safeAgentReviewDraft({
        kind: "recipe_draft",
        title: "No ids",
        summary: "x",
        candidateIds: [],
      }),
    ).toBeUndefined();
    expect(safeAgentReviewDraft(null)).toBeUndefined();
  });

  test("builds pending draft rows linked to an agent run", () => {
    const agentRunId = "run-1" as Id<"agentRuns">;
    const row = buildAgentReviewDraftInsert({
      agentRunId,
      graphName: "research-pipeline",
      draft: {
        kind: "recipe_draft",
        title: "Review draft: spectrogram protocol",
        summary: "Draft a recipe from the selected hypothesis.",
        candidateIds: ["hypothesis-1"],
        needsReview: true,
      },
      now: 1234,
    });

    expect(row).toEqual({
      agentRunId,
      graphName: "research-pipeline",
      kind: "recipe_draft",
      title: "Review draft: spectrogram protocol",
      summary: "Draft a recipe from the selected hypothesis.",
      candidateIds: ["hypothesis-1"],
      status: "pending_review",
      createdBy: "agent",
      createdAt: 1234,
      updatedAt: 1234,
    });
  });

  test("public summaries include safe draft fields and omit operational internals", () => {
    const draftId = "draft-1" as Id<"agentReviewDrafts">;
    const agentRunId = "run-1" as Id<"agentRuns">;
    const summary = summarizeAgentReviewDraft({
      _id: draftId,
      _creationTime: 1,
      agentRunId,
      graphName: "research-pipeline",
      kind: "hypothesis_draft",
      title: "Review draft: cymatics",
      summary: "Draft for review.",
      candidateIds: ["extraction-1"],
      status: "pending_review",
      createdBy: "agent",
      createdAt: 10,
      updatedAt: 20,
      internalNotes: "private",
    } as never);

    expect(summary).toEqual({
      _id: draftId,
      _creationTime: 1,
      agentRunId,
      graphName: "research-pipeline",
      kind: "hypothesis_draft",
      title: "Review draft: cymatics",
      summary: "Draft for review.",
      candidateIds: ["extraction-1"],
      status: "pending_review",
      createdAt: 10,
      updatedAt: 20,
    });
    expect("createdBy" in summary).toBe(false);
    expect("internalNotes" in summary).toBe(false);
  });
});
