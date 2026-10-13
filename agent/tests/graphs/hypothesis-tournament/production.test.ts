import { describe, expect, test, vi } from "vite-plus/test";
import { ANTHROPIC_MODELS } from "../../../../convex/shared/llmPolicy.js";
import { BudgetExhausted } from "../../../src/graphs/hypothesis-tournament/budget.js";
import {
  buildTournamentGraph,
  createRunTournamentNode,
  createSummarizeNode,
  terminalFor,
} from "../../../src/graphs/hypothesis-tournament/graph.js";
import {
  createTournamentModel,
  inputTokenBound,
  PROVIDER_SCHEMAS,
  type StructuredInvoker,
} from "../../../src/graphs/hypothesis-tournament/model.js";
import { tournamentPrompt } from "../../../src/graphs/hypothesis-tournament/prompts.js";
import type {
  ModelRequest,
  TournamentResult,
} from "../../../src/graphs/hypothesis-tournament/types.js";
import { buildGraphInvocation } from "../../../src/worker/graphInput.js";

const seed = { family: "hint" as const, refs: [], context: "Slow beating" };
const generation: ModelRequest = { kind: "generation", seed };
const context = (maxTotalTokens = 300_000) => ({
  signal: new AbortController().signal,
  maxTotalTokens,
});
const usage = (total_tokens: unknown) => ({ usage_metadata: { total_tokens } });

describe("tournament model adapter", () => {
  test("routes by shared policy with one attempt and bounded output", async () => {
    const invoke = vi.fn<StructuredInvoker>(async () => ({
      raw: usage(42),
      parsed: { title: "t" },
    }));
    const model = createTournamentModel(invoke);
    expect(await model(generation, context())).toEqual({
      ok: true,
      value: { title: "t" },
      totalTokens: 42,
    });
    expect(invoke.mock.calls[0]![0]).toMatchObject({
      model: ANTHROPIC_MODELS.opus,
      maxTokens: 6000,
    });
    await model(
      {
        kind: "duplicate",
        statement: "a",
        neighbor: { id: "n", statement: "b", similarity: 0.9 },
      },
      context(),
    );
    expect(invoke.mock.calls[1]![0]).toMatchObject({
      model: ANTHROPIC_MODELS.haiku,
      maxTokens: 1500,
    });
  });

  test("input plus maximum output never exceeds the remaining allowance", async () => {
    const invoke = vi.fn<StructuredInvoker>(async () => ({
      raw: usage(1),
      parsed: {},
    }));
    const model = createTournamentModel(invoke);
    const bound = inputTokenBound(
      tournamentPrompt(generation),
      PROVIDER_SCHEMAS.generation,
    );
    await model(generation, context(bound + 2000));
    expect(invoke.mock.calls[0]![0].maxTokens).toBe(2000);
    await expect(
      model(generation, context(bound + 100)),
    ).rejects.toBeInstanceOf(BudgetExhausted);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test("invalid output is a metered miss; unknown usage or aborts stop the run", async () => {
    let next: () => Promise<unknown> = async () => ({
      raw: usage(9),
      parsed: null,
    });
    const model = createTournamentModel(
      () => next() as ReturnType<StructuredInvoker>,
    );
    expect(await model(generation, context())).toEqual({
      ok: false,
      totalTokens: 9,
    });
    next = async () => ({ raw: usage(undefined), parsed: {} });
    await expect(model(generation, context())).rejects.toThrow(/usage missing/);
    next = async () => {
      throw Object.assign(new Error("overloaded"), { status: 529 });
    };
    expect(await model(generation, context())).toEqual({
      ok: false,
      totalTokens: 0,
    });
    next = async () => {
      throw new Error("socket hang up");
    };
    await expect(model(generation, context())).rejects.toThrow(/socket/);
    const aborted = new AbortController();
    aborted.abort();
    next = async () => {
      throw Object.assign(new Error("aborted"), { status: 499 });
    };
    await expect(
      model(generation, { signal: aborted.signal, maxTotalTokens: 300_000 }),
    ).rejects.toThrow(/aborted/);
  });

  test("statement vectors never enter prompts", () => {
    const prompt = tournamentPrompt({
      kind: "scoring",
      seed,
      candidate: {
        agentRunId: "run",
        batchIndex: 0,
        seedFamily: "hint",
        seedRefs: [],
        payload: {
          title: "t",
          question: "q",
          statement: "s",
          rationale: "r",
          whyThisMatters: "w",
          sourceIds: [],
          extractionIds: [],
        },
        evidenceClaimIds: [],
        evidence: [],
        statementEmbedding: [0.123456789, 0.987654321],
        relations: [],
        scores: [],
        outcome: "candidate",
        flags: [],
        createdAt: 1,
      },
    });
    expect(prompt).not.toContain("0.123456789");
    expect(prompt).not.toContain("statementEmbedding");
  });
});

function result(
  reason: TournamentResult["reason"],
  events: TournamentResult["events"] = [],
): TournamentResult {
  return {
    reason,
    candidates: [],
    pairs: [],
    events,
    ...(reason === "submitted" ? { draftId: "draft-1" } : {}),
    budget: {
      calls: {
        generation: 0,
        grounding: 0,
        scoring: 0,
        duplicate: 0,
        finalist: 0,
        selfCheck: 0,
        revision: 0,
        duplicateRecheck: 0,
      },
      duplicateCalls: {},
      totalTokens: 0,
      elapsedMs: 0,
    },
  };
}

describe("tournament graph terminal ownership", () => {
  test("maps every outcome to exactly one terminal owner", () => {
    expect(terminalFor(result("submitted"))).toBe("needs_review");
    expect(terminalFor(result("busy"))).toBe("untouched");
    expect(terminalFor(result("dependency_error"))).toBe("failed");
    expect(
      terminalFor(
        result("budget_exhausted", [
          { kind: "stopped", reason: "run_persistence_failed" },
        ]),
      ),
    ).toBe("failed");
    for (const reason of [
      "capacity",
      "insufficient_seeds",
      "no_eligible_candidates",
      "failed_self_check",
      "duplicate_revision",
      "budget_exhausted",
    ] as const)
      expect(terminalFor(result(reason))).toBe("completed");
  });

  test("submitted runs are not re-marked; failures and completions are", async () => {
    for (const [reason, expected] of [
      ["submitted", []],
      ["busy", []],
      ["capacity", ["markAgentRunCompleted"]],
      ["dependency_error", ["markAgentRunFailed"]],
    ] as const) {
      const callTool = vi.fn(async () => null);
      await createSummarizeNode(callTool)({
        agentRunId: "run-1",
        seedHint: undefined,
        traceUrl: undefined,
        result: result(reason),
        summary: undefined,
      });
      expect(callTool.mock.calls.map((call) => call[0])).toEqual(expected);
    }
  });

  test("the compiled graph runs the core once and summarizes", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "beginTournamentRun"
        ? { status: "replay", result: result("submitted") }
        : null,
    );
    const graph = buildTournamentGraph({
      run: createRunTournamentNode({ callTool }),
      summarize: createSummarizeNode(callTool),
    });
    const state = await graph.invoke({ agentRunId: "run-1" });
    expect(state.result?.reason).toBe("submitted");
    expect(callTool.mock.calls.map((call) => call[0])).toEqual([
      "beginTournamentRun",
      "appendAgentRunEvent",
    ]);
  });
});

describe("worker input mapping", () => {
  test("passes a bounded seed hint and the claimed run id", () => {
    expect(
      buildGraphInvocation({
        runId: "run-1",
        graphName: "hypothesis-tournament",
        input: { seedHint: `  ${"h".repeat(600)}  `, requestedBy: "freq" },
        status: "running",
        workerId: "w",
        startedAt: 1,
      }),
    ).toEqual({
      graphName: "hypothesis-tournament",
      input: { agentRunId: "run-1", seedHint: "h".repeat(500) },
    });
  });
});
