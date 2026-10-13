// End-to-end local proof of the production tournament seam: the agent core
// and its production adapters drive the real agent-tool actions over an
// isolated convex-test deployment. Model and embeddings are scripted stubs.
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  runTournament,
  type ModelRequest,
  type TournamentDependencies,
  type TournamentResult,
} from "../agent/src/graphs/hypothesis-tournament/index";
import { createTournamentDependencies } from "../agent/src/graphs/hypothesis-tournament/adapters";
import { createFinalizeNode } from "../agent/src/graphs/hypothesis-tournament/finalize";
import {
  enableTournamentEnv,
  setupTournament,
  stubEmbeddings,
  type TournamentFixture,
} from "./fixtures/tournament";

type Metered = Awaited<ReturnType<TournamentDependencies["model"]>>;
type Override = (
  request: ModelRequest,
) => Metered | undefined | Promise<Metered | undefined>;

function scriptedModel(override: Override = () => undefined) {
  let generated = 0;
  const requests: ModelRequest[] = [];
  const respond = (r: ModelRequest): unknown => {
    switch (r.kind) {
      case "generation": {
        const n = generated++;
        return {
          title: `Title ${n}`,
          question: `Question ${n}`,
          statement: `Statement ${n}`,
          rationale: "Initial rationale",
          whyThisMatters: "Changes how Keith sets tremolo depth in the studio",
          concepts: ["beating"],
        };
      }
      case "grounding":
      case "revision":
        return {
          ...r.candidate.payload,
          rationale: r.candidate.evidenceClaimIds
            .map((id) => `[claim:${id}]`)
            .join(" and "),
        };
      case "selfCheck":
        return {
          pass: true,
          testable: true,
          oneVariable: true,
          evidenceGrounded: true,
          feedback: "Single-variable 60 second test.",
        };
      case "scoring":
        return { stake: 3, novelty: 3, falsifiability: 3 };
      case "duplicate":
        return { kind: "refinement" };
      case "finalist":
        return { winner: "left" };
    }
  };
  const model = vi.fn(async (request: ModelRequest): Promise<Metered> => {
    requests.push(request);
    return (
      (await override(request)) ?? {
        ok: true,
        value: respond(request),
        totalTokens: 10,
      }
    );
  });
  return { model, requests };
}

let f: TournamentFixture;
let runId: Id<"agentRuns">;
beforeEach(async () => {
  enableTournamentEnv();
  f = await setupTournament();
  runId = await f.newRun();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function run(
  model: TournamentDependencies["model"],
  callTool: TournamentFixture["callTool"] = f.callTool,
  seedHint?: string,
) {
  return runTournament(
    { runId, seedHint },
    createTournamentDependencies({ callTool, model }),
  );
}
const drafts = () =>
  f.t.run((ctx) =>
    ctx.db
      .query("agentReviewDrafts")
      .filter((q) => q.eq(q.field("agentRunId"), runId))
      .collect(),
  );
const archive = () =>
  f.t.run((ctx) =>
    ctx.db
      .query("hypothesisCandidates")
      .withIndex("by_agentRunId_batchIndex", (q) => q.eq("agentRunId", runId))
      .collect(),
  );
const leaseRow = () =>
  f.t.run((ctx) =>
    ctx.db
      .query("tournamentRuns")
      .withIndex("by_agentRunId", (q) => q.eq("agentRunId", runId))
      .unique(),
  );
const agentRun = () => f.t.run((ctx) => ctx.db.get(runId));
/** The graph's real summarize node, through the real agent tools. */
const finalize = (result: TournamentResult, leaseToken?: string) =>
  createFinalizeNode(f.callTool)({ agentRunId: runId, result, leaseToken });

describe("hypothesis tournament over durable Convex state", () => {
  test("submits one grounded human-review draft from production seeds and evidence", async () => {
    const embeddings = stubEmbeddings();
    const m = scriptedModel();
    const result = await run(m.model, f.callTool, "Slow beating as pulse");
    expect(result.reason).toBe("submitted");
    // Correspondence, two claim seeds, one inversion and the hint.
    expect(result.candidates.map((c) => c.seedFamily).toSorted()).toEqual([
      "claim",
      "claim",
      "correspondence",
      "hint",
      "inversion",
    ]);
    const rows = await drafts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      _id: result.draftId,
      status: "pending_review",
      createdBy: "agent",
      dedupeKey: `tournament:${runId}`,
      graphName: "hypothesis-tournament",
    });
    const winner = result.candidates.find((c) => c.outcome === "submitted")!;
    expect(winner.draftId).toBe(result.draftId);
    // Provenance comes only from hydrated claims of this database.
    const payload = rows[0]!.payload as { sourceIds: string[] };
    expect(new Set(payload.sourceIds)).toEqual(new Set(f.ids.sourceIds));
    expect(new Set(winner.evidenceClaimIds)).toEqual(new Set(f.ids.claimIds));
    expect(await agentRun()).toMatchObject({ status: "needs_review" });
    // The summary reports the durable run status, not the no-op outcome.
    expect((await finalize(result)).summary).toBe(
      `hypothesis-tournament needs_review: submitted, draft ${result.draftId} awaits human review`,
    );
    const archived = await archive();
    expect(archived.map((row) => row.outcome).toSorted()).toEqual(
      result.candidates.map((c) => c.outcome).toSorted(),
    );
    expect(archived.find((row) => row.outcome === "submitted")?.draftId).toBe(
      result.draftId,
    );
    // Statement vectors live on archive rows, not in the saved result.
    expect(
      archived.every((row) => row.statementEmbedding?.length === 1536),
    ).toBe(true);
    expect((await leaseRow())?.result.candidates[0]).not.toHaveProperty(
      "statementEmbedding",
    );
    // Real metered usage: 10 per model call plus 3 per embedded text.
    expect(result.budget.totalTokens).toBeGreaterThan(m.requests.length * 10);
    expect(embeddings.calls.length).toBeGreaterThan(0);

    // A retried run replays the saved result: no new calls, no second draft.
    const replayModel = scriptedModel();
    const replay = await run(replayModel.model);
    expect(replay).toEqual(result);
    expect(replayModel.model).not.toHaveBeenCalled();
    expect(await drafts()).toHaveLength(1);
  });

  test("a lost submission response replays the committed draft on retry", async () => {
    stubEmbeddings();
    const lossy: TournamentFixture["callTool"] = async (name, args) => {
      const value = await f.callTool(name, args);
      if (name === "submitTournamentDraft")
        throw new Error("connection reset after commit");
      return value;
    };
    const first = await run(scriptedModel().model, lossy);
    expect(first.reason).toBe("dependency_error");
    expect(first.draftId).toBeUndefined();
    // The graph's terminal write cannot fail a run whose draft committed.
    expect((await finalize(first)).summary).toBe(
      "hypothesis-tournament needs_review: dependency_error",
    );
    expect(await agentRun()).toMatchObject({ status: "needs_review" });
    const committed = await drafts();
    expect(committed).toHaveLength(1);
    // The terminal archive after the lost response could not overwrite the
    // committed result: the lease was closed by the draft transaction.
    expect((await leaseRow())?.status).toBe("completed");

    const retry = await run(scriptedModel().model);
    expect(retry.reason).toBe("submitted");
    expect(retry.draftId).toBe(committed[0]!._id);
    expect(await drafts()).toHaveLength(1);
    expect((await finalize(retry)).summary).toBe(
      `hypothesis-tournament needs_review: submitted, draft ${retry.draftId} awaits human review`,
    );
  });

  test("budget exhaustion archives every candidate and persists a replayable no-draft result", async () => {
    stubEmbeddings();
    // Generation is cheap; the first scoring call crosses the run budget.
    const m = scriptedModel((r) =>
      r.kind === "scoring"
        ? {
            ok: true,
            value: { stake: 3, novelty: 3, falsifiability: 3 },
            totalTokens: 300_000,
          }
        : undefined,
    );
    const result = await run(m.model);
    expect(result.budget.totalTokens).toBeGreaterThanOrEqual(300_000);
    expect(result.budget.calls.scoring).toBe(1);
    expect(result.reason).toBe("budget_exhausted");
    expect(result.events).toContainEqual({ kind: "stopped", reason: "tokens" });
    expect(await drafts()).toHaveLength(0);
    expect(result.candidates.every((c) => c.outcome !== "submitted")).toBe(
      true,
    );
    const row = await leaseRow();
    expect(row).toMatchObject({ status: "completed" });
    expect(row?.result.reason).toBe("budget_exhausted");
    const archived = await archive();
    expect(archived.length).toBe(result.candidates.length);
    expect(archived.every((c) => c.outcome !== "candidate")).toBe(true);

    const replay = await run(scriptedModel().model);
    expect(replay.reason).toBe("budget_exhausted");
    expect((await finalize(replay)).summary).toBe(
      "hypothesis-tournament completed: budget_exhausted",
    );
    expect(await agentRun()).toMatchObject({ status: "completed" });
  });

  test("a statement the production tools cannot accept is invalid output, not a dependency failure", async () => {
    stubEmbeddings();
    let first = true;
    const m = scriptedModel((r) => {
      if (r.kind !== "generation" || !first) return undefined;
      first = false;
      return {
        ok: true,
        totalTokens: 1,
        value: {
          title: "Too long",
          question: "Q",
          statement: "s".repeat(4_001),
          rationale: "R",
          whyThisMatters: "Changes the studio choice",
        },
      };
    });
    const result = await run(m.model);
    expect(result.events).toContainEqual({
      kind: "attempt_failed",
      reason: "invalid_generation",
      batchIndex: 0,
    });
    expect(result.reason).toBe("submitted");
  });

  test("calls that cannot fit the remaining allowance are refused before any provider request", async () => {
    const embeddings = stubEmbeddings();
    // Generation leaves 5 tokens: less than the byte bound of any statement.
    const m = scriptedModel((r) =>
      r.kind === "generation"
        ? {
            ok: true,
            totalTokens: 299_995,
            value: {
              title: "T",
              question: "Q",
              statement: "Statement 0",
              rationale: "R",
              whyThisMatters: "Changes the studio choice",
            },
          }
        : undefined,
    );
    const result = await run(m.model);
    expect(result.reason).toBe("budget_exhausted");
    expect(result.budget.totalTokens).toBe(299_995);
    expect(embeddings.calls).toHaveLength(0);
    expect(m.model).toHaveBeenCalledTimes(1);
  });

  test("a stale attempt's finalization cannot fail or overwrite a newer attempt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
    const begin = async () =>
      (
        (await f.callTool("beginTournamentRun", {
          agentRunId: runId,
          leaseDurationMs: 1_210_000,
        })) as { lease: { token: string } }
      ).lease.token;
    const stale = await begin();
    vi.setSystemTime(1_000_000 + 1_210_000);
    const current = await begin();
    const finalizeWith = (leaseToken?: string) =>
      f.callTool("finalizeTournamentRun", {
        agentRunId: runId,
        ...(leaseToken ? { leaseToken } : {}),
        summary: "hypothesis-tournament failed: dependency_error",
      });
    for (const token of [stale, undefined])
      expect(await finalizeWith(token)).toMatchObject({ status: "untouched" });
    expect(await agentRun()).toMatchObject({ status: "running" });
    // The live attempt's own failure releases its lease and fails the run.
    expect(await finalizeWith(current)).toMatchObject({ status: "failed" });
    await expect(
      f.callTool("recordHypothesisCandidates", {
        agentRunId: runId,
        leaseToken: current,
        stage: "terminal",
        candidates: [],
        pairs: [],
      }),
    ).rejects.toThrow(/StaleTournamentLease/);
    expect(await finalizeWith(current)).toMatchObject({ status: "untouched" });
  });

  test("a stale lease cannot write after another worker reclaims the run", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
    const first = (await f.callTool("beginTournamentRun", {
      agentRunId: runId,
      leaseDurationMs: 1_210_000,
    })) as { status: string; lease: { token: string } };
    expect(first.status).toBe("acquired");
    expect(
      await f.callTool("beginTournamentRun", {
        agentRunId: runId,
        leaseDurationMs: 1_210_000,
      }),
    ).toEqual({ status: "busy" });
    vi.setSystemTime(1_000_000 + 1_210_000);
    const second = (await f.callTool("beginTournamentRun", {
      agentRunId: runId,
      leaseDurationMs: 1_210_000,
    })) as { status: string; lease: { token: string } };
    expect(second.status).toBe("acquired");
    expect(second.lease.token).not.toBe(first.lease.token);
    for (const [name, extra] of [
      [
        "recordHypothesisCandidates",
        { stage: "duplicates", candidates: [], pairs: [] },
      ],
      ["completeTournamentRun", { result: emptyResult("capacity") }],
    ] as const)
      await expect(
        f.callTool(name, {
          agentRunId: runId,
          leaseToken: first.lease.token,
          ...extra,
        }),
      ).rejects.toThrow(/StaleTournamentLease/);
    await f.callTool("completeTournamentRun", {
      agentRunId: runId,
      leaseToken: second.lease.token,
      result: emptyResult("capacity"),
    });
    // Closed leases reject every token, including the one that closed them.
    await expect(
      f.callTool("completeTournamentRun", {
        agentRunId: runId,
        leaseToken: second.lease.token,
        result: emptyResult("capacity"),
      }),
    ).rejects.toThrow(/StaleTournamentLease/);
  });

  test("a full run whose lease expires mid-flight stops without a draft", async () => {
    stubEmbeddings();
    let reclaimed = false;
    const m = scriptedModel(async (r) => {
      if (r.kind === "selfCheck" && !reclaimed) {
        reclaimed = true;
        // Simulate the lease expiring and a second worker reclaiming it.
        await f.t.run(async (ctx) => {
          const row = await ctx.db
            .query("tournamentRuns")
            .withIndex("by_agentRunId", (q) => q.eq("agentRunId", runId))
            .unique();
          await ctx.db.patch(row!._id, {
            epoch: row!.epoch + 1,
            leaseToken: "other-worker",
          });
        });
      }
      return undefined;
    });
    const result = await run(m.model);
    expect(result.reason).toBe("dependency_error");
    expect(await drafts()).toHaveLength(0);
    expect((await leaseRow())?.status).toBe("leased");
  });

  test("capacity is checked before work and again atomically at submission", async () => {
    stubEmbeddings();
    for (const n of [1, 2, 3]) await f.pendingDraft(runId, n);
    const early = scriptedModel();
    expect((await run(early.model)).reason).toBe("capacity");
    expect(early.model).not.toHaveBeenCalled();

    const racing = await setupTournament();
    f = racing;
    runId = await f.newRun();
    const otherRun = await f.newRun();
    let filled = false;
    const m = scriptedModel(async (r) => {
      if (r.kind === "selfCheck" && !filled) {
        filled = true;
        for (const n of [1, 2, 3]) await f.pendingDraft(otherRun, n);
      }
      return undefined;
    });
    const result = await run(m.model);
    expect(result.reason).toBe("capacity");
    expect(result.candidates.some((c) => c.outcome === "submitted")).toBe(
      false,
    );
    expect(await drafts()).toHaveLength(0);
    expect((await leaseRow())?.result.reason).toBe("capacity");
    expect((await archive()).some((c) => c.outcome === "ineligible")).toBe(
      true,
    );
  });

  test("model failures are counted missing judgments, not retries outside the budget", async () => {
    stubEmbeddings();
    const m = scriptedModel((r) =>
      r.kind === "scoring" && r.judgeIndex === 0
        ? { ok: false, totalTokens: 7 }
        : undefined,
    );
    const result = await run(m.model);
    expect(result.reason).toBe("submitted");
    const scored = result.candidates.filter(
      (c) =>
        c.outcome !== "dropped_evidence" && c.outcome !== "dropped_duplicate",
    );
    expect(result.budget.calls.scoring).toBe(scored.length * 3);
    expect(result.candidates.every((c) => c.scores.length <= 2)).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({ kind: "attempt_failed", reason: "scoring" }),
    );
  });

  test("embedding provider failure fails open per candidate and is flagged", async () => {
    // Claim search embeds each statement first; fail only the second embed
    // of "Statement 1", which is its candidate vector.
    let seen = 0;
    stubEmbeddings({
      fail: (texts) => texts[0] === "Statement 1" && ++seen === 2,
    });
    const result = await run(scriptedModel().model);
    expect(result.reason).toBe("submitted");
    expect(
      result.candidates.filter((c) =>
        c.flags.includes("embedding_failed_open"),
      ),
    ).toHaveLength(1);
  });

  test("hydrated provenance is enforced: unread claims never ground a candidate", async () => {
    stubEmbeddings();
    const m = scriptedModel((r) =>
      r.kind === "grounding" && r.seed.family === "correspondence"
        ? {
            ok: true,
            totalTokens: 10,
            value: {
              ...r.candidate.payload,
              rationale: `${r.candidate.evidenceClaimIds.map((id) => `[claim:${id}]`).join(" ")} [claim:invented]`,
            },
          }
        : undefined,
    );
    const result = await run(m.model);
    expect(
      result.candidates.find((c) => c.seedFamily === "correspondence")?.outcome,
    ).toBe("dropped_evidence");
  });

  test("duplicate neighbors include unembedded hypotheses re-embedded at query time", async () => {
    stubEmbeddings();
    const duplicateId = await f.t.run((ctx) =>
      ctx.db.insert("hypotheses", {
        title: "Existing",
        question: "Q",
        hypothesis: "Statement 0",
        rationaleMd: "R",
        sourceIds: [],
        status: "active",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const m = scriptedModel((r) =>
      r.kind === "duplicate" && r.neighbor.id === `hypothesis:${duplicateId}`
        ? { ok: true, value: { kind: "duplicate" }, totalTokens: 5 }
        : undefined,
    );
    const result = await run(m.model);
    const first = result.candidates.find((c) => c.batchIndex === 0)!;
    expect(first.outcome).toBe("dropped_duplicate");
    expect(first.duplicateOf).toBe(`hypothesis:${duplicateId}`);
    expect(result.reason).toBe("submitted");
  });

  test("too many stale hypothesis vectors fail closed until backfilled", async () => {
    const embeddings = stubEmbeddings();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 40; i++)
        await ctx.db.insert("hypotheses", {
          title: `H${i}`,
          question: "Q",
          hypothesis: `Unembedded hypothesis ${i}`,
          rationaleMd: "R",
          sourceIds: [],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        });
    });
    const blocked = await run(scriptedModel().model);
    expect(blocked.reason).toBe("dependency_error");
    expect(await drafts()).toHaveLength(0);

    let cursor: string | null = null;
    let stored = 0;
    do {
      const page: { stored: number; cursor: string | null; done: boolean } =
        await f.t.action(
          internal.hypothesisTournamentNode.backfillHypothesisEmbeddings,
          { cursor, batchSize: 25 },
        );
      stored += page.stored;
      cursor = page.done ? null : page.cursor;
    } while (cursor);
    expect(stored).toBe(41);
    const again = await f.t.action(
      internal.hypothesisTournamentNode.backfillHypothesisEmbeddings,
      { cursor: null, batchSize: 100 },
    );
    expect(again.stored).toBe(0);
    expect(embeddings.calls.length).toBeGreaterThan(0);
  });

  test("the disabled gate issues no lease and spends nothing, but replay still works", async () => {
    stubEmbeddings();
    const done = await run(scriptedModel().model);
    expect(done.reason).toBe("submitted");
    enableTournamentEnv(false);
    const replay = await run(scriptedModel().model);
    expect(replay.draftId).toBe(done.draftId);

    runId = await f.newRun();
    const m = scriptedModel();
    const blocked = await run(m.model);
    expect(blocked.reason).toBe("dependency_error");
    expect(m.model).not.toHaveBeenCalled();
    expect(await leaseRow()).toBeNull();
    expect((await finalize(blocked)).summary).toBe(
      "hypothesis-tournament failed: dependency_error",
    );
    expect(await agentRun()).toMatchObject({ status: "failed" });
    await expect(f.callTool("requestTournamentRun", {})).rejects.toThrow(
      /TournamentDisabled/,
    );
  });
});

function emptyResult(reason: TournamentResult["reason"]): TournamentResult {
  return {
    reason,
    candidates: [],
    pairs: [],
    events: [],
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
