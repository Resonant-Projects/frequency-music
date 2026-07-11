import { afterEach, describe, expect, test } from "vite-plus/test";
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
  const previousModel = process.env.CODEX_MODEL;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.CODEX_SPECIALIST;
    else process.env.CODEX_SPECIALIST = previousFlag;
    if (previousModel === undefined) delete process.env.CODEX_MODEL;
    else process.env.CODEX_MODEL = previousModel;
  });

  test("flag off: takes the OpenRouter path and never calls the Codex runner", async () => {
    delete process.env.CODEX_SPECIALIST;
    let calls = 0;
    const codexRunner = async <T = unknown>(
      _input: RunCodexTaskInput,
    ): Promise<RunCodexTaskResult<T>> => {
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
    const codexRunner = async <T = unknown>(
      input: RunCodexTaskInput,
    ): Promise<RunCodexTaskResult<T>> => {
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
        } as T,
        rawText: "{}",
        threadId: "thread-codex-1",
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cached_input_tokens: 0,
          reasoning_output_tokens: 0,
        },
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
      cached_input_tokens: 0,
      reasoning_output_tokens: 0,
    });
  });

  test("flag on + CODEX_MODEL set: forwards the model to the Codex thread and audits the same value", async () => {
    process.env.CODEX_SPECIALIST = "true";
    process.env.CODEX_MODEL = "gpt-5-codex";
    let forwardedModel: string | undefined;
    const codexRunner = async <T = unknown>(
      input: RunCodexTaskInput,
    ): Promise<RunCodexTaskResult<T>> => {
      forwardedModel = input.model;
      return {
        output: {
          kind: "hypothesis_draft",
          title: "Codex thread proposal",
          summary:
            "Candidate should become a human-reviewed hypothesis proposal.",
          candidateIds: ["candidate-1"],
          needsReview: true,
        } as T,
        rawText: "{}",
        threadId: "thread-codex-2",
        usage: null,
        workdir: "/tmp/codex-task-test",
      };
    };

    const outcome = await createSpecialistOutcome(specialistInput, {
      runCodexTask: codexRunner,
    });

    // The thread must run with the operator's override, and the audit event
    // must report the same value the thread actually received.
    expect(forwardedModel).toBe("gpt-5-codex");
    expect(outcome.modelCall?.model).toBe("gpt-5-codex");
  });

  test("flag on + Codex runner throws: falls back to OpenRouter and never fails the run", async () => {
    process.env.CODEX_SPECIALIST = "true";
    const codexRunner = async <T = unknown>(
      _input: RunCodexTaskInput,
    ): Promise<RunCodexTaskResult<T>> => {
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
