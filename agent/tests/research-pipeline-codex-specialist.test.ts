import { afterEach, describe, expect, test } from "bun:test";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ResearchDraftSpecialistInput } from "../src/agents/research-pipeline/deepAgent";
import { createSpecialistOutcome } from "../src/graphs/research-pipeline/nodes";
import type { ResearchPipelineDraft } from "../src/state/researchPipelineState";
import type {
  RunCodexTaskInput,
  RunCodexTaskResult,
} from "../src/subagents/codexWorker";

// Stands in for the OpenRouter/deep-agent model so tests exercising the
// OpenRouter fallback path never make a live model call; mirrors the DI
// pattern already used in codex-deep-agent.test.ts. Rejecting here exercises
// the same "model unavailable -> fallback draft" path createResearchDeepAgentDraft
// already handles, without hitting a real provider.
const failingModel = {
  generate: () =>
    Promise.reject(new Error("model provider unavailable in test")),
} as unknown as BaseChatModel;

const fallbackDraft: ResearchPipelineDraft = {
  kind: "hypothesis_draft",
  title: "Review draft: fallback",
  summary: "Fallback summary.",
  candidateIds: ["candidate-1"],
  needsReview: true,
};

const specialistInput: ResearchDraftSpecialistInput = {
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
};

describe("CODEX_SPECIALIST routing decision", () => {
  const previousFlag = process.env.CODEX_SPECIALIST;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.CODEX_SPECIALIST;
    else process.env.CODEX_SPECIALIST = previousFlag;
  });

  test("flag off: takes the OpenRouter path and never calls the Codex runner", async () => {
    delete process.env.CODEX_SPECIALIST;
    let calls = 0;
    const codexRunner = async (): Promise<RunCodexTaskResult> => {
      calls += 1;
      throw new Error("should not be invoked when CODEX_SPECIALIST is off");
    };

    const outcome = await createSpecialistOutcome(specialistInput, {
      runCodexTask: codexRunner,
      model: failingModel,
    });

    expect(calls).toBe(0);
    // The injected model fails closed to the fallback draft — this test only
    // asserts the Codex runner was never reached when the flag is off.
    expect(outcome.draft).toEqual(fallbackDraft);
  });

  test("flag on: routes through Codex and threads the draft/provider/threadId/usage", async () => {
    process.env.CODEX_SPECIALIST = "true";
    const codexRunner = async (
      input: RunCodexTaskInput,
    ): Promise<RunCodexTaskResult> => {
      expect(input.instructions).toContain(
        "research-pipeline deep-agent specialist",
      );
      return {
        output: {
          kind: "hypothesis_draft",
          title: "Codex thread proposal",
          summary:
            "Candidate should become a human-reviewed hypothesis proposal.",
          candidateIds: ["candidate-1"],
          needsReview: true,
        },
        rawText: "{}",
        threadId: "thread-codex-1",
        usage: { input_tokens: 10, output_tokens: 20 },
        workdir: "/tmp/codex-task-test",
      };
    };

    const outcome = await createSpecialistOutcome(specialistInput, {
      runCodexTask: codexRunner,
    });

    expect(outcome.usedFallback).toBe(false);
    expect(outcome.provider).toBe("codex-sdk");
    expect(outcome.draft.title).toBe("Codex thread proposal");
    expect(outcome.modelCall?.provider).toBe("codex-sdk");
    expect(outcome.modelCall?.threadId).toBe("thread-codex-1");
    expect(outcome.modelCall?.usage).toEqual({
      input_tokens: 10,
      output_tokens: 20,
    });
  });

  test("flag on + Codex runner throws: falls back to OpenRouter and never fails the run", async () => {
    process.env.CODEX_SPECIALIST = "true";
    const codexRunner = async (): Promise<RunCodexTaskResult> => {
      throw new Error("codex CLI unavailable");
    };

    const outcome = await createSpecialistOutcome(specialistInput, {
      runCodexTask: codexRunner,
      model: failingModel,
    });

    expect(outcome.usedFallback).toBe(true);
    expect(outcome.warning).toContain("Codex specialist unavailable");
    expect(outcome.warning).toContain("codex CLI unavailable");
    // Falls all the way back to the fallback draft since the injected
    // OpenRouter model also fails in this test.
    expect(outcome.draft).toEqual(fallbackDraft);
  });
});
