import { describe, expect, test, vi } from "vite-plus/test";
import { ANTHROPIC_MODELS } from "../../../../convex/shared/llmPolicy.js";
import { BudgetExhausted } from "../../../src/graphs/hypothesis-tournament/budget.js";
import {
  buildTournamentGraph,
  createRunTournamentNode,
  createSummarizeNode,
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
  test("summarize delegates the terminal status to the fenced backend", async () => {
    for (const leaseToken of ["1:lease", undefined]) {
      const callTool = vi.fn(async () => ({ status: "failed" }));
      const update = await createSummarizeNode(callTool)({
        agentRunId: "run-1",
        seedHint: undefined,
        traceUrl: undefined,
        result: result("dependency_error"),
        leaseToken,
        summary: undefined,
      });
      expect(callTool.mock.calls).toEqual([
        [
          "finalizeTournamentRun",
          {
            agentRunId: "run-1",
            ...(leaseToken ? { leaseToken } : {}),
            summary: "hypothesis-tournament failed: dependency_error",
          },
        ],
      ]);
      expect(update.summary).toBe(
        "hypothesis-tournament failed: dependency_error",
      );
    }
  });

  test("a finalization failure is reported, not thrown", async () => {
    const callTool = vi.fn(async () => {
      throw new Error("network");
    });
    const update = await createSummarizeNode(callTool)({
      agentRunId: "run-1",
      seedHint: undefined,
      traceUrl: undefined,
      result: result("submitted"),
      leaseToken: undefined,
      summary: undefined,
    });
    expect(update.summary).toBe("hypothesis-tournament unfinalized: submitted");
  });

  test("the compiled graph keeps the acquired lease for finalization", async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const callTool = vi.fn(
      async (name: string, args: Record<string, unknown>) => {
        calls.push([name, args]);
        if (name === "beginTournamentRun")
          return {
            status: "acquired",
            lease: { runId: "run-1", token: "7:t" },
          };
        if (name === "countPendingDrafts") return 3;
        return { status: "completed" };
      },
    );
    const graph = buildTournamentGraph({
      run: createRunTournamentNode({ callTool }),
      summarize: createSummarizeNode(callTool),
    });
    const state = await graph.invoke({ agentRunId: "run-1" });
    expect(state.result?.reason).toBe("capacity");
    expect(state.leaseToken).toBe("7:t");
    expect(calls.map(([name]) => name)).toEqual([
      "beginTournamentRun",
      "countPendingDrafts",
      "completeTournamentRun",
      "appendAgentRunEvent",
      "finalizeTournamentRun",
    ]);
    expect(calls.at(-1)![1]).toMatchObject({ leaseToken: "7:t" });
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
