import { describe, expect, test } from "vite-plus/test";
import type { Id } from "./_generated/dataModel";
import {
  assertDecisionNote,
  assertDraftPending,
  assertRecipeHypothesisId,
  buildHypothesisInsertFromPayload,
  buildRecipeInsertFromPayload,
  synthesizeDawChecklist,
  synthesizeRecipeBody,
  type AgentDraftHypothesisPayload,
  type AgentDraftRecipePayload,
} from "./agentDraftPromotion";

const provenance = {
  agentRunId: "run-1" as Id<"agentRuns">,
  agentDraftId: "draft-1" as Id<"agentReviewDrafts">,
  traceUrl: "https://smith.langchain.com/trace/abc",
};

const hypPayload: AgentDraftHypothesisPayload = {
  title: "Beating rate and perceived warmth",
  question: "Does a 4 Hz beat rate read as warmer than 12 Hz?",
  statement:
    "If two tones beat at ~4 Hz then listeners report more warmth than at 12 Hz.",
  rationale:
    "Slow amplitude modulation aligns with comfortable breath/heart tempo ranges.",
  whyThisMatters:
    "Warmth is a core studio target; a reliable knob for it saves session time.",
  concepts: ["beating", "amplitude modulation"],
  sourceIds: ["src-1" as Id<"sources">],
  extractionIds: ["ext-1" as Id<"extractions">],
  correspondenceId: "corr-1" as Id<"correspondences">,
};

const recipePayload: AgentDraftRecipePayload = {
  hypothesisId: "hyp-1" as Id<"hypotheses">,
  title: "4 Hz beat micro-study",
  whyThisMatters:
    "Isolates the warmth-from-slow-beating claim in a listenable 60s sketch.",
  parameters: [
    { kind: "tempo", value: "96" },
    { type: "beatRateHz", value: "4" },
  ],
  instrumentationNotes: "Two detuned sines, +/- 2 Hz around 220 Hz.",
};

describe("draft transition guards", () => {
  test("assertDraftPending only accepts pending_review", () => {
    expect(() => assertDraftPending("pending_review")).not.toThrow();
    expect(() => assertDraftPending("approved")).toThrow();
    expect(() => assertDraftPending("rejected")).toThrow();
    expect(() => assertDraftPending("superseded")).toThrow();
  });

  test("assertDecisionNote requires a non-blank note", () => {
    expect(assertDecisionNote("  looks solid ")).toBe("looks solid");
    expect(() => assertDecisionNote("")).toThrow();
    expect(() => assertDecisionNote("   ")).toThrow();
    expect(() => assertDecisionNote(undefined)).toThrow();
  });

  test("assertRecipeHypothesisId rejects a recipe payload with no hypothesis", () => {
    expect(assertRecipeHypothesisId(recipePayload)).toBe("hyp-1");
    expect(() =>
      assertRecipeHypothesisId({ ...recipePayload, hypothesisId: undefined }),
    ).toThrow();
  });
});

describe("recipe field synthesis", () => {
  test("synthesizes a body from payload when bodyMd absent", () => {
    const body = synthesizeRecipeBody(recipePayload);
    expect(body).toContain("4 Hz beat micro-study");
    expect(body).toContain("beatRateHz");
    expect(body).toContain("Instrumentation");
  });

  test("prefers an explicit bodyMd/dawChecklist when provided", () => {
    expect(
      synthesizeRecipeBody({ ...recipePayload, bodyMd: "explicit body" }),
    ).toBe("explicit body");
    expect(
      synthesizeDawChecklist({ ...recipePayload, dawChecklist: ["a", "b"] }),
    ).toEqual(["a", "b"]);
  });

  test("derives a dawChecklist from parameters when absent", () => {
    const checklist = synthesizeDawChecklist(recipePayload);
    expect(checklist[0]).toBe("Set tempo: 96");
    expect(checklist).toContain("Set beatRateHz: 4");
    expect(checklist.at(-1)).toContain("Render micro-study");
  });
});

describe("insert-row builders", () => {
  test("hypothesis row carries provenance and maps payload fields", () => {
    const row = buildHypothesisInsertFromPayload({
      payload: hypPayload,
      provenance,
      createdBy: "system",
      now: 1000,
    });
    expect(row).toEqual({
      title: hypPayload.title,
      question: hypPayload.question,
      hypothesis: hypPayload.statement,
      rationaleMd: hypPayload.rationale,
      whyThisMatters: hypPayload.whyThisMatters,
      correspondenceId: hypPayload.correspondenceId,
      sourceIds: hypPayload.sourceIds,
      extractionIds: hypPayload.extractionIds,
      concepts: hypPayload.concepts,
      status: "draft",
      visibility: "private",
      origin: "agent",
      agentRunId: "run-1",
      agentDraftId: "draft-1",
      traceUrl: "https://smith.langchain.com/trace/abc",
      createdBy: "system",
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  test("recipe row synthesizes required fields and stamps provenance", () => {
    const row = buildRecipeInsertFromPayload({
      payload: recipePayload,
      provenance,
      createdBy: "system",
      now: 2000,
    });
    expect(row.hypothesisId).toBe("hyp-1");
    expect(row.bodyMd.length).toBeGreaterThan(0);
    expect(row.dawChecklist.length).toBeGreaterThan(0);
    expect(row.origin).toBe("agent");
    expect(row.agentDraftId).toBe("draft-1");
    expect(row.status).toBe("draft");
  });

  test("blank whyThisMatters is rejected at build time", () => {
    expect(() =>
      buildHypothesisInsertFromPayload({
        payload: { ...hypPayload, whyThisMatters: "   " },
        provenance,
        createdBy: "system",
        now: 1,
      }),
    ).toThrow();
  });
});
