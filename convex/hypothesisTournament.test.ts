import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { fetchMeteredEmbeddings } from "./hypothesisTournamentNode";
import type {
  TournamentCandidate,
  TournamentResult,
} from "./shared/hypothesisTournament";
import {
  enableTournamentEnv,
  setupTournament,
  stubEmbeddings,
  vectorFor,
  type TournamentFixture,
} from "../harness/fixtures/tournament";

let f: TournamentFixture;
let runId: Id<"agentRuns">;
let token: string;

beforeEach(async () => {
  enableTournamentEnv();
  f = await setupTournament();
  runId = await f.newRun();
  token = (
    (await f.callTool("beginTournamentRun", {
      agentRunId: runId,
      leaseDurationMs: 1_210_000,
    })) as { lease: { token: string } }
  ).lease.token;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function evidence(indexes = [0, 1]) {
  return await f.t.run(async (ctx) =>
    Promise.all(
      indexes.map(async (i) => {
        const claim = (await ctx.db.get(f.ids.claimIds[i]!))!;
        return {
          claimId: claim._id as string,
          text: claim.text,
          sourceId: claim.sourceId as string,
          extractionId: claim.extractionId as string,
        };
      }),
    ),
  );
}

async function candidate(
  overrides: Partial<TournamentCandidate> = {},
): Promise<TournamentCandidate> {
  const claims = await evidence();
  return {
    agentRunId: runId,
    batchIndex: 0,
    seedFamily: "claim",
    seedRefs: [f.ids.claimIds[0]!],
    payload: {
      title: "Title",
      question: "Question",
      statement: "Statement",
      rationale: claims.map((c) => `[claim:${c.claimId}]`).join(" "),
      whyThisMatters: "Changes tremolo depth choices",
      sourceIds: [...new Set(claims.map((c) => c.sourceId))] as never,
      extractionIds: [...new Set(claims.map((c) => c.extractionId))] as never,
    },
    evidenceClaimIds: claims.map((c) => c.claimId),
    evidence: claims,
    relations: [],
    scores: [{ stake: 3, novelty: 3, falsifiability: 3 }],
    outcome: "candidate",
    flags: [],
    createdAt: 1,
    ...overrides,
  };
}

function result(
  reason: TournamentResult["reason"],
  candidates: TournamentCandidate[] = [],
): TournamentResult {
  return {
    reason,
    candidates,
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

const record = (candidates: TournamentCandidate[]) =>
  f.callTool("recordHypothesisCandidates", {
    agentRunId: runId,
    leaseToken: token,
    stage: "duplicates",
    candidates,
    pairs: [],
  });

async function submission(winner: TournamentCandidate) {
  const payload = winner.finalPayload ?? winner.payload;
  return {
    agentRunId: runId,
    leaseToken: token,
    draft: {
      agentRunId: runId,
      dedupeKey: `tournament:${runId}`,
      draft: {
        kind: "hypothesis_draft",
        title: payload.title,
        summary: payload.statement,
        candidateIds: [...winner.seedRefs, ...winner.evidenceClaimIds],
        needsReview: true,
        payload,
      },
    },
    result: result("submitted", [winner]),
  };
}

describe("tournament leases", () => {
  test("only a running tournament run with a bounded lease is admitted", async () => {
    const queued = await f.newRun("queued");
    await expect(
      f.callTool("beginTournamentRun", {
        agentRunId: queued,
        leaseDurationMs: 1_210_000,
      }),
    ).rejects.toThrow(/TournamentRunUnavailable/);
    const other = await f.newRun();
    for (const leaseDurationMs of [1, 31 * 60_000])
      await expect(
        f.callTool("beginTournamentRun", {
          agentRunId: other,
          leaseDurationMs,
        }),
      ).rejects.toThrow(/InvalidLease/);
  });
});

describe("candidate archive", () => {
  test("upserts by batch index and clears a vector the revision invalidated", async () => {
    await record([
      await candidate({ statementEmbedding: vectorFor("Statement") }),
    ]);
    const revised = await candidate();
    revised.finalPayload = { ...revised.payload, statement: "Revised" };
    await record([revised]);
    const rows = await f.t.run((ctx) =>
      ctx.db.query("hypothesisCandidates").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.finalPayload?.statement).toBe("Revised");
    expect(rows[0]!.statementEmbedding).toBeUndefined();
  });

  test("rejects unread provenance, forged claims, foreign rows and bad vectors", async () => {
    const base = await candidate();
    const cases: TournamentCandidate[] = [
      {
        ...base,
        payload: {
          ...base.payload,
          sourceIds: [f.ids.contradictedId] as never,
        },
      },
      {
        ...base,
        evidence: [
          { ...base.evidence[0]!, text: "Forged text" },
          base.evidence[1]!,
        ],
      },
      {
        ...base,
        payload: { ...base.payload, correspondenceId: f.ids.correspondenceId },
      },
      { ...base, agentRunId: await f.newRun() },
      { ...base, statementEmbedding: [1, 0, 0] },
    ];
    for (const bad of cases) await expect(record([bad])).rejects.toThrow();
    expect(
      await f.t.run((ctx) => ctx.db.query("hypothesisCandidates").collect()),
    ).toHaveLength(0);
  });
});

describe("draft submission", () => {
  test("rejects any draft that is not exactly the grounded winner", async () => {
    const winner = await candidate({ outcome: "submitted" });
    const valid = await submission(winner);
    const ungrounded = await candidate({
      outcome: "submitted",
      payload: { ...winner.payload, rationale: "No citations" },
    });
    const cases = [
      { ...valid, draft: { ...valid.draft, dedupeKey: "tournament:other" } },
      {
        ...valid,
        draft: {
          ...valid.draft,
          draft: {
            ...valid.draft.draft,
            payload: { ...winner.payload, statement: "Changed" },
          },
        },
      },
      {
        ...valid,
        draft: {
          ...valid.draft,
          draft: { ...valid.draft.draft, candidateIds: ["unread"] },
        },
      },
      await submission(ungrounded),
      {
        ...valid,
        result: result("submitted", [winner, { ...winner, batchIndex: 1 }]),
      },
    ];
    for (const args of cases)
      await expect(f.callTool("submitTournamentDraft", args)).rejects.toThrow();
    expect(
      await f.t.run((ctx) => ctx.db.query("agentReviewDrafts").collect()),
    ).toHaveLength(0);
    const created = (await f.callTool("submitTournamentDraft", valid)) as {
      status: string;
      result: TournamentResult;
    };
    expect(created.status).toBe("created");
    // The lease is closed by the same transaction: a second submit fails.
    await expect(f.callTool("submitTournamentDraft", valid)).rejects.toThrow(
      /StaleTournamentLease/,
    );
  });

  test("a correspondence that gained a pending draft is unavailable", async () => {
    const claims = await evidence();
    const winner = await candidate({
      outcome: "submitted",
      seedFamily: "correspondence",
      seedRefs: [f.ids.correspondenceId],
    });
    winner.payload = {
      ...winner.payload,
      correspondenceId: f.ids.correspondenceId,
    };
    const other = await f.newRun();
    await f.t.run((ctx) =>
      ctx.db.insert("agentReviewDrafts", {
        agentRunId: other,
        graphName: "hypothesis-drafter",
        kind: "hypothesis_draft",
        title: "Same target",
        summary: "Same target",
        candidateIds: [claims[0]!.claimId],
        payload: { ...winner.payload },
        status: "pending_review",
        createdBy: "agent",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      f.callTool("submitTournamentDraft", await submission(winner)),
    ).rejects.toThrow(/DraftTargetUnavailable/);
  });

  test("cap reached returns cap_reached and keeps the lease for the terminal write", async () => {
    for (const n of [1, 2, 3]) await f.pendingDraft(runId, n);
    expect(
      await f.callTool(
        "submitTournamentDraft",
        await submission(await candidate({ outcome: "submitted" })),
      ),
    ).toEqual({ status: "cap_reached" });
    await f.callTool("completeTournamentRun", {
      agentRunId: runId,
      leaseToken: token,
      result: result("capacity", [await candidate({ outcome: "ineligible" })]),
    });
  });

  test("completeRun refuses submitted results", async () => {
    await expect(
      f.callTool("completeTournamentRun", {
        agentRunId: runId,
        leaseToken: token,
        result: result("submitted"),
      }),
    ).rejects.toThrow(/InvalidTournamentResult/);
  });
});

describe("seeds, evidence and requests", () => {
  test("each family yields bounded, provenance-tagged seeds", async () => {
    const seeds = async (family: string) =>
      (await f.callTool("listTournamentSeeds", { family })) as Array<{
        family: string;
        refs: string[];
        correspondenceId?: string;
      }>;
    expect(await seeds("correspondence")).toEqual([
      expect.objectContaining({
        family: "correspondence",
        refs: [f.ids.correspondenceId],
        correspondenceId: f.ids.correspondenceId,
      }),
    ]);
    const claims = await seeds("claim");
    expect(claims).toHaveLength(2);
    expect(claims.every((seed) => seed.family === "claim")).toBe(true);
    expect(await seeds("inversion")).toEqual([
      expect.objectContaining({
        family: "inversion",
        refs: [`hypothesis:${f.ids.contradictedId}:contradicted`],
      }),
    ]);
  });

  test("hydrateClaims returns only active claims for valid ids", async () => {
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.claimIds[1]!, { status: "superseded" }),
    );
    const hydrated = (await f.callTool("hydrateClaims", {
      claimIds: [f.ids.claimIds[0], f.ids.claimIds[1], "not-an-id"],
    })) as Array<{ claimId: string }>;
    expect(hydrated.map((c) => c.claimId)).toEqual([f.ids.claimIds[0]]);
  });

  test("requests are gated, bounded and deduplicated to one active run", async () => {
    await expect(
      f.callTool("requestTournamentRun", { seedHint: "x".repeat(501) }),
    ).rejects.toThrow();
    // The beforeEach run is already running.
    expect(await f.callTool("requestTournamentRun", {})).toMatchObject({
      runId,
      created: false,
    });
    await f.t.run((ctx) => ctx.db.patch(runId, { status: "completed" }));
    const queued = (await f.callTool("requestTournamentRun", {
      seedHint: "  Slow beating as pulse  ",
    })) as { runId: Id<"agentRuns">; created: boolean };
    expect(queued.created).toBe(true);
    expect(await f.t.run((ctx) => ctx.db.get(queued.runId))).toMatchObject({
      graphName: "hypothesis-tournament",
      status: "queued",
      input: { requestedBy: "freq", seedHint: "Slow beating as pulse" },
    });
  });

  test("prune deletes only old unsubmitted archive rows", async () => {
    const old = Date.now() - 181 * 24 * 60 * 60 * 1000;
    await record([
      await candidate({ createdAt: old, outcome: "lost" }),
      await candidate({ batchIndex: 1, createdAt: old, outcome: "ineligible" }),
      await candidate({
        batchIndex: 2,
        createdAt: Date.now(),
        outcome: "lost",
      }),
    ]);
    await f.t.run(async (ctx) => {
      const row = await ctx.db.query("hypothesisCandidates").first();
      await ctx.db.insert("hypothesisCandidates", {
        ...row!,
        _id: undefined,
        _creationTime: undefined,
        batchIndex: 3,
        outcome: "submitted",
        createdAt: old,
      } as never);
    });
    expect(
      await f.t.mutation(internal.hypothesisTournament.pruneCandidates, {}),
    ).toEqual({ deleted: 2, done: true });
    const left = await f.t.run((ctx) =>
      ctx.db.query("hypothesisCandidates").collect(),
    );
    expect(left.map((row) => row.outcome).toSorted()).toEqual([
      "lost",
      "submitted",
    ]);
  });
});

describe("metered embeddings", () => {
  test("one attempt; unbilled HTTP failures report zero; missing usage throws", async () => {
    let status = 503;
    let usage = true;
    const fetchImpl = vi.fn(async () =>
      status === 200
        ? Response.json({
            data: [{ index: 0, embedding: vectorFor("a") }],
            ...(usage ? { usage: { total_tokens: 4 } } : {}),
          })
        : new Response("down", { status }),
    ) as unknown as typeof fetch;
    expect(
      await fetchMeteredEmbeddings(["a"], { apiKey: "k", fetchImpl }),
    ).toEqual({ ok: false, totalTokens: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    status = 200;
    expect(
      await fetchMeteredEmbeddings(["a"], { apiKey: "k", fetchImpl }),
    ).toMatchObject({ ok: true, totalTokens: 4 });
    usage = false;
    await expect(
      fetchMeteredEmbeddings(["a"], { apiKey: "k", fetchImpl }),
    ).rejects.toThrow(/usage missing/);
  });

  test("neighbor search excludes this run's archive and reports usage", async () => {
    stubEmbeddings();
    await record([
      await candidate({ statementEmbedding: vectorFor("Statement") }),
    ]);
    const neighbors = (await f.callTool("findTournamentNeighbors", {
      agentRunId: runId,
      statement: "Statement",
      embedding: vectorFor("Statement"),
    })) as { ok: boolean; value: Array<{ id: string }>; totalTokens: number };
    expect(neighbors.ok).toBe(true);
    // The contradicted fixture hypothesis has no vector: re-embedded (3 tokens).
    expect(neighbors.totalTokens).toBe(3);
    expect(
      neighbors.value.some((n) => n.id.startsWith(`candidate:${runId}`)),
    ).toBe(false);
  });
});
