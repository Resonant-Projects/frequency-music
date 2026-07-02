import { describe, expect, test } from "bun:test";
import { AIMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  createResearchDeepAgentDraft,
  sanitizeSpecialistDraft,
} from "../src/agents/research-pipeline/deepAgent";
import { getConfiguredModelProvider } from "../src/models/index";
import type { ResearchPipelineDraft } from "../src/state/researchPipelineState";

const fallbackDraft: ResearchPipelineDraft = {
  kind: "hypothesis_draft",
  title: "Review draft: fallback",
  summary: "Fallback summary.",
  candidateIds: ["candidate-1"],
  needsReview: true,
};

describe("Codex/deep-agent research draft integration", () => {
  test("selects Codex SDK provider when enabled for non-tool specialist calls", () => {
    const previous = process.env.CODEX_ENABLED;
    process.env.CODEX_ENABLED = "true";
    try {
      expect(getConfiguredModelProvider()).toBe("codex-sdk");
      expect(getConfiguredModelProvider({ requiresToolBinding: true })).toBe(
        "openrouter-anthropic",
      );
    } finally {
      if (previous === undefined) delete process.env.CODEX_ENABLED;
      else process.env.CODEX_ENABLED = previous;
    }
  });

  test("sanitizes specialist JSON into a review-only draft", () => {
    expect(
      sanitizeSpecialistDraft(
        {
          kind: "recipe_draft",
          title: "Spectral astrolabe tuning study",
          summary:
            "Use the candidate extraction to propose a recipe for review.",
          candidateIds: ["candidate-1", "candidate-2"],
          needsReview: false,
          rawPrompt: "private",
        },
        fallbackDraft,
      ),
    ).toEqual({
      kind: "recipe_draft",
      title: "Spectral astrolabe tuning study",
      summary: "Use the candidate extraction to propose a recipe for review.",
      candidateIds: ["candidate-1", "candidate-2"],
      needsReview: true,
    });
  });

  test("falls back safely when the specialist model fails", async () => {
    const failingModel = {
      invoke: () => Promise.reject(new Error("local Codex unavailable")),
    } as unknown as BaseChatModel;

    const result = await createResearchDeepAgentDraft(
      {
        selectedCandidate: undefined,
        candidates: [],
        scope: {
          activeTheses: [],
          recentExtractions: [],
          recentHypotheses: [],
          recentRecipes: [],
          failureArchive: [],
          editorialSignals: [],
        },
        fallbackDraft,
      },
      { model: failingModel },
    );

    expect(result.usedFallback).toBe(true);
    expect(result.draft).toEqual(fallbackDraft);
    expect(result.warning).toContain("local Codex unavailable");
  });

  test("uses model JSON when the specialist returns a valid draft", async () => {
    const model = {
      invoke: () =>
        Promise.resolve(
          new AIMessage(
            JSON.stringify({
              kind: "hypothesis_draft",
              title: "Deep-agent proposal",
              summary:
                "Candidate should become a human-reviewed hypothesis proposal.",
              candidateIds: ["candidate-1"],
              needsReview: true,
            }),
          ),
        ),
    } as unknown as BaseChatModel;

    const result = await createResearchDeepAgentDraft(
      {
        selectedCandidate: undefined,
        candidates: [],
        scope: {
          activeTheses: [],
          recentExtractions: [],
          recentHypotheses: [],
          recentRecipes: [],
          failureArchive: [],
          editorialSignals: [],
        },
        fallbackDraft,
      },
      { model },
    );

    expect(result.usedFallback).toBe(false);
    expect(result.draft.title).toBe("Deep-agent proposal");
    expect(result.draft.needsReview).toBe(true);
  });
});
