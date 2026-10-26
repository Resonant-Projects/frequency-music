import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import type { Id } from "../convex/_generated/dataModel";
import type { TournamentResult } from "../agent/src/graphs/hypothesis-tournament/index";
import {
  enableTournamentEnv,
  setupTournament,
  type TournamentFixture,
} from "./fixtures/tournament";

let f: TournamentFixture;
let runId: Id<"agentRuns">;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(1_000_000);
  enableTournamentEnv();
  f = await setupTournament();
  runId = await f.newRun();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const agentRun = () => f.t.run((ctx) => ctx.db.get(runId));
const leaseRow = () =>
  f.t.run((ctx) =>
    ctx.db
      .query("tournamentRuns")
      .withIndex("by_agentRunId", (q) => q.eq("agentRunId", runId))
      .unique(),
  );

describe("hypothesis tournament lease fencing", () => {
  test("a stale attempt's finalization cannot fail or overwrite a newer attempt", async () => {
    const begin = async () =>
      (
        (await f.callTool("beginTournamentRun", {
          agentRunId: runId,
          leaseDurationMs: 1_210_000,
        })) as { lease: { token: string } }
      ).lease.token;
    const stale = await begin();
    vi.setSystemTime((await leaseRow())!.leaseExpiresAt);
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
    vi.setSystemTime((await leaseRow())!.leaseExpiresAt);
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
