import { describe, expect, test } from "bun:test";
import type { Id } from "./_generated/dataModel";

import {
  buildAgentReviewDraftInsert,
  safeAgentReviewDraft,
  summarizeAgentReviewDraft,
  summarizeAgentReviewDraftPublic,
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

describe("structured payload handling", () => {
  const hypPayload = {
    title: "Beating and warmth",
    question: "Does 4 Hz beat as warm?",
    statement: "If tones beat at 4 Hz then warmth rises.",
    rationale: "Slow AM aligns with breath tempo.",
    whyThisMatters: "Warmth is a core studio target worth a reliable knob.",
    concepts: ["beating"],
    sourceIds: ["src-1"],
    extractionIds: ["ext-1"],
  };

  test("safeAgentReviewDraft attaches a payload when present", () => {
    const safe = safeAgentReviewDraft({
      kind: "hypothesis_draft",
      title: "Draft",
      summary: "Summary",
      candidateIds: ["ext-1"],
      needsReview: true,
      payload: hypPayload,
    });
    expect(safe?.payload).toEqual(hypPayload);
  });

  test("legacy payload-less drafts round-trip without a payload key", () => {
    const safe = safeAgentReviewDraft({
      kind: "hypothesis_draft",
      title: "Draft",
      summary: "Summary",
      candidateIds: ["ext-1"],
      needsReview: true,
    });
    expect(safe && "payload" in safe).toBe(false);
  });

  test("buildAgentReviewDraftInsert rejects a blank whyThisMatters in the payload", () => {
    expect(() =>
      buildAgentReviewDraftInsert({
        agentRunId: "run-1" as Id<"agentRuns">,
        graphName: "research-pipeline",
        draft: {
          kind: "hypothesis_draft",
          title: "Draft",
          summary: "Summary",
          candidateIds: ["ext-1"],
          needsReview: true,
          payload: { ...hypPayload, whyThisMatters: "   " },
        },
      }),
    ).toThrow();
  });

  test("buildAgentReviewDraftInsert rejects a missing whyThisMatters in the payload", () => {
    expect(() =>
      buildAgentReviewDraftInsert({
        agentRunId: "run-1" as Id<"agentRuns">,
        graphName: "research-pipeline",
        draft: {
          kind: "hypothesis_draft",
          title: "Draft",
          summary: "Summary",
          candidateIds: ["ext-1"],
          needsReview: true,
          payload: { ...hypPayload, whyThisMatters: undefined },
        },
      }),
    ).toThrow(/payload\.whyThisMatters/);
  });

  test("public summaries omit payload and human decision details", () => {
    const summary = summarizeAgentReviewDraftPublic({
      _id: "draft-1" as Id<"agentReviewDrafts">,
      _creationTime: 1,
      agentRunId: "run-1" as Id<"agentRuns">,
      graphName: "research-pipeline",
      kind: "hypothesis_draft",
      title: "Draft",
      summary: "Summary",
      candidateIds: ["ext-1"],
      status: "approved",
      createdBy: "agent",
      createdAt: 10,
      updatedAt: 20,
      payload: hypPayload,
      decidedAt: 20,
      decidedBy: "human",
      decisionNote: "private review note",
      promotedId: "hyp-9",
    } as never);
    expect(summary).toEqual({
      _id: "draft-1",
      _creationTime: 1,
      agentRunId: "run-1",
      graphName: "research-pipeline",
      kind: "hypothesis_draft",
      title: "Draft",
      summary: "Summary",
      candidateIds: ["ext-1"],
      status: "approved",
      createdAt: 10,
      updatedAt: 20,
    });
    expect("payload" in summary).toBe(false);
    expect("decisionNote" in summary).toBe(false);
  });

  test("summaries surface decision fields once a draft is decided", () => {
    const summary = summarizeAgentReviewDraft({
      _id: "draft-1" as Id<"agentReviewDrafts">,
      _creationTime: 1,
      agentRunId: "run-1" as Id<"agentRuns">,
      graphName: "research-pipeline",
      kind: "hypothesis_draft",
      title: "Draft",
      summary: "Summary",
      candidateIds: ["ext-1"],
      status: "approved",
      createdBy: "agent",
      createdAt: 10,
      updatedAt: 20,
      decidedAt: 20,
      decidedBy: "human",
      decisionNote: "solid",
      promotedId: "hyp-9",
    } as never);
    expect(summary).toMatchObject({
      status: "approved",
      decidedBy: "human",
      decisionNote: "solid",
      promotedId: "hyp-9",
    });
  });
});
