import { describe, expect, test } from "bun:test";
import { AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ChatResult } from "@langchain/core/outputs";

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

const specialistDraftText = JSON.stringify({
  kind: "hypothesis_draft",
  title: "Deep-agent proposal",
  summary: "Candidate should become a human-reviewed hypothesis proposal.",
  candidateIds: ["candidate-1"],
  needsReview: true,
});

/**
 * Real BaseChatModel subclass (not a mocked `.generate()`): drives LangChain's
 * actual generate() pipeline, which does NOT aggregate the per-generation
 * llmOutput into result.llmOutput unless `_combineLLMOutput` is implemented —
 * and none of our production models implement it. LangChain instead merges it
 * into the message's response_metadata. Mock-only tests missed exactly that.
 */
class StubResponseModel extends BaseChatModel {
  constructor(private readonly stubLlmOutput: Record<string, unknown>) {
    super({});
  }
  _llmType() {
    return "stub-response";
  }
  async _generate(): Promise<ChatResult> {
    return {
      generations: [
        {
          text: specialistDraftText,
          message: new AIMessage(specialistDraftText),
        },
      ],
      llmOutput: this.stubLlmOutput,
    };
  }
}

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
      generate: () => Promise.reject(new Error("local Codex unavailable")),
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
    const text = JSON.stringify({
      kind: "hypothesis_draft",
      title: "Deep-agent proposal",
      summary: "Candidate should become a human-reviewed hypothesis proposal.",
      candidateIds: ["candidate-1"],
      needsReview: true,
    });
    const model = {
      generate: () =>
        Promise.resolve({
          generations: [[{ text, message: new AIMessage(text) }]],
          llmOutput: {
            provider: "codex-sdk",
            model: "codex-default",
            usage: { total_tokens: 42 },
            threadId: "thread-abc",
          },
        }),
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
    // llmOutput threads through so the graph node can build the per-model-
    // call audit event (provider/model/usage/threadId).
    expect(result.llmOutput?.provider).toBe("codex-sdk");
    expect(result.llmOutput?.threadId).toBe("thread-abc");
  });

  test("surfaces llmOutput through a REAL generate() pipeline (response_metadata path)", async () => {
    const model = new StubResponseModel({
      provider: "codex-sdk",
      model: "codex-default",
      usage: { total_tokens: 42 },
      threadId: "thread-real",
    });

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
    expect(result.llmOutput?.provider).toBe("codex-sdk");
    expect(result.llmOutput?.model).toBe("codex-default");
    expect(result.llmOutput?.threadId).toBe("thread-real");
    expect(result.llmOutput?.usage).toEqual({ total_tokens: 42 });
  });

  test("maps ChatAnthropic-style tokenUsage metadata onto the usage audit field", async () => {
    const model = new StubResponseModel({
      model: "claude-sonnet-4-6",
      tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

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

    expect(result.llmOutput?.usage).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
  });
});
