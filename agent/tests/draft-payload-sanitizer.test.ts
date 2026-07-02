import { describe, expect, test } from "bun:test";

import {
  sanitizeDraftPayload,
  sanitizeSpecialistDraft,
} from "../src/agents/research-pipeline/deepAgent";
import type { ResearchPipelineDraft } from "../src/state/researchPipelineState";

const fallbackDraft: ResearchPipelineDraft = {
  kind: "hypothesis_draft",
  title: "Review draft: fallback",
  summary: "Fallback summary.",
  candidateIds: ["candidate-1"],
  needsReview: true,
};

const validHypothesisPayload = {
  title: "Astrolabe consonance",
  question: "Does polygon-angle tuning raise perceived consonance?",
  statement: "Polygon-angle temperament increases consonance ratings.",
  rationale: "Grounded in the geometric-temperament extraction.",
  whyThisMatters: "Bridges geometry and psychoacoustics.",
  concepts: ["temperament", "consonance"],
  sourceIds: ["src_1"],
  extractionIds: ["ext_1"],
  thesisId: "thesis_1",
  confidence: 0.6,
};

const validRecipePayload = {
  hypothesisId: "hyp_1",
  title: "Litmus study",
  parameters: [{ value: "440Hz base", kind: "tuning", type: "frequency" }],
  protocol: {
    studyType: "litmus",
    durationSecs: 90,
    panelPlanned: ["listener-a"],
    whatVaries: ["tuning"],
    whatStaysConstant: ["timbre"],
  },
  whyThisMatters: "Validates the hypothesis empirically.",
  dawChecklist: ["load tuning file"],
};

describe("sanitizeDraftPayload", () => {
  test("parses a valid hypothesis payload", () => {
    const parsed = sanitizeDraftPayload(
      "hypothesis_draft",
      validHypothesisPayload,
    );
    expect(parsed).toBeDefined();
    expect((parsed as { statement: string }).statement).toBe(
      "Polygon-angle temperament increases consonance ratings.",
    );
  });

  test("parses a valid recipe payload", () => {
    const parsed = sanitizeDraftPayload("recipe_draft", validRecipePayload);
    expect(parsed).toBeDefined();
    expect((parsed as { hypothesisId?: string }).hypothesisId).toBe("hyp_1");
  });

  test("strips unknown keys but keeps the known shape", () => {
    const parsed = sanitizeDraftPayload("hypothesis_draft", {
      ...validHypothesisPayload,
      secretPrompt: "leak",
    }) as Record<string, unknown>;
    expect(parsed.secretPrompt).toBeUndefined();
    expect(parsed.title).toBe("Astrolabe consonance");
  });

  test("drops a payload missing whyThisMatters to undefined", () => {
    const { whyThisMatters: _whyThisMatters, ...withoutWhy } =
      validHypothesisPayload;
    expect(
      sanitizeDraftPayload("hypothesis_draft", withoutWhy),
    ).toBeUndefined();
  });

  test("drops a hypothesis payload with a blank whyThisMatters", () => {
    expect(
      sanitizeDraftPayload("hypothesis_draft", {
        ...validHypothesisPayload,
        whyThisMatters: "",
      }),
    ).toBeUndefined();
  });

  test("drops a recipe-shaped payload requested as hypothesis", () => {
    expect(
      sanitizeDraftPayload("hypothesis_draft", validRecipePayload),
    ).toBeUndefined();
  });

  test("drops non-object values", () => {
    expect(sanitizeDraftPayload("recipe_draft", "nope")).toBeUndefined();
    expect(sanitizeDraftPayload("recipe_draft", undefined)).toBeUndefined();
  });
});

describe("sanitizeSpecialistDraft with payload", () => {
  test("attaches a valid hypothesis payload", () => {
    const draft = sanitizeSpecialistDraft(
      {
        kind: "hypothesis_draft",
        title: "Deep-agent proposal",
        summary: "A candidate hypothesis for review.",
        candidateIds: ["ext_1"],
        needsReview: true,
        payload: validHypothesisPayload,
      },
      fallbackDraft,
    );
    expect(draft?.payload).toBeDefined();
    expect(draft?.payload && "statement" in draft.payload).toBe(true);
  });

  test("omits the payload key entirely when the payload is malformed", () => {
    const draft = sanitizeSpecialistDraft(
      {
        kind: "hypothesis_draft",
        title: "Deep-agent proposal",
        summary: "A candidate hypothesis for review.",
        candidateIds: ["ext_1"],
        needsReview: true,
        payload: { title: "incomplete" },
      },
      fallbackDraft,
    );
    expect(draft).toBeDefined();
    expect(draft && "payload" in draft).toBe(false);
  });

  test("stays payload-less and structurally identical when no payload is given", () => {
    const draft = sanitizeSpecialistDraft(
      {
        kind: "recipe_draft",
        title: "Spectral astrolabe tuning study",
        summary: "Propose a recipe for review.",
        candidateIds: ["candidate-1", "candidate-2"],
        needsReview: false,
      },
      fallbackDraft,
    );
    expect(draft).toEqual({
      kind: "recipe_draft",
      title: "Spectral astrolabe tuning study",
      summary: "Propose a recipe for review.",
      candidateIds: ["candidate-1", "candidate-2"],
      needsReview: true,
    });
  });
});
