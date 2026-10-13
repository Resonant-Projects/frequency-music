import { durableStore } from "./store.js";
import { afterEach, expect, test, vi } from "vite-plus/test";
import {
  TOURNAMENT_FAMILIES,
  tournamentDraftZ,
  tournamentSelfCheckZ,
} from "../../../../convex/shared/hypothesisTournament.js";
import {
  runTournament,
  rotateSeeds,
  type ModelRequest,
  type TournamentDependencies,
} from "../../../src/graphs/hypothesis-tournament/index.js";
import {
  TournamentBudget,
  BudgetExhausted,
  TOURNAMENT_LIMITS,
} from "../../../src/graphs/hypothesis-tournament/budget.js";
const ok = <T>(value: T, totalTokens = 1) => ({
  ok: true as const,
  value,
  totalTokens,
});
const failed = (totalTokens = 1) => ({ ok: false as const, totalTokens });
const checked = {
  pass: true,
  testable: true,
  oneVariable: true,
  evidenceGrounded: true,
  feedback: "Grounded single-variable 60 second test.",
};
const stores: ReturnType<typeof durableStore>[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.cleanup();
});
function fixture(store = durableStore()) {
  stores.push(store);
  const persistence = store.connect();
  let generated = 0;
  const snapshots: Parameters<TournamentDependencies["record"]>[0][] = [];
  const requests: ModelRequest[] = [];
  const response = (r: ModelRequest): unknown => {
    switch (r.kind) {
      case "generation": {
        const n = generated++;
        return {
          title: `Title ${n}`,
          question: `Question ${n}`,
          statement: `Statement ${n}`,
          rationale: "Initial rationale",
          whyThisMatters: "Changes studio choices",
          concepts: ["spacing"],
        };
      }
      case "grounding":
        return {
          ...r.candidate.payload,
          rationale: r.candidate.evidenceClaimIds
            .map((id) => `[claim:${id}]`)
            .join(" and "),
        };
      case "revision":
        return {
          ...r.candidate.payload,
          statement: `${r.candidate.payload.statement} revised`,
        };
      case "selfCheck":
        return checked;
      case "scoring":
        return { stake: 3, novelty: 3, falsifiability: 3 };
      case "duplicate":
        return { kind: "refinement" };
      case "finalist":
        return { winner: "left" };
    }
  };
  let override: (
    r: ModelRequest,
  ) => ReturnType<typeof ok> | ReturnType<typeof failed> | undefined = () =>
    undefined;
  const d: TournamentDependencies = {
    ...persistence,
    now: () => 100,
    countPendingDrafts: vi.fn(async () => 0),
    loadSeeds: vi.fn(async (family) => [
      {
        family,
        refs: [`${family}-id`],
        context: family,
        ...(family === "correspondence"
          ? { correspondenceId: "correspondence-id" }
          : {}),
      },
    ]),
    searchClaimsSemantic: vi.fn(async () => ok(["claim-1", "claim-2"])),
    hydrateClaims: vi.fn(async () =>
      [1, 2].map((n) => ({
        claimId: `claim-${n}`,
        text: `Evidence ${n}`,
        sourceId: `source-${n}`,
        extractionId: `extraction-${n}`,
      })),
    ),
    model: vi.fn(async (r) => {
      requests.push(r);
      return override(r) ?? ok(response(r));
    }),
    embed: vi.fn(async (statement) =>
      ok(
        Array.from({ length: 8 }, (_, i) =>
          i === Number(statement.match(/\d+/)?.[0]) ? 1 : 0,
        ),
      ),
    ),
    neighbors: vi.fn(async () => ok([])),
    record: vi.fn(async (s) => {
      await persistence.record(s);
      snapshots.push(s);
    }),
    createDraft: vi.fn(persistence.createDraft),
  };
  return {
    d,
    store,
    response,
    snapshots,
    requests,
    override: (fn: typeof override) => {
      override = fn;
    },
    run: (seedHint?: string) => runTournament({ runId: "run-1", seedHint }, d),
  };
}

test("rotates six families over two rounds, caps eight and skips exhausted families", () => {
  const families = Object.fromEntries(
    TOURNAMENT_FAMILIES.map((family) => [
      family,
      [0, 1, 2].map((n) => ({ family, refs: [`${n}`], context: "seed" })),
    ]),
  );
  expect(rotateSeeds(families).map((s) => s.family)).toEqual([
    ...TOURNAMENT_FAMILIES,
    "correspondence",
    "claim",
  ]);
  expect(rotateSeeds({ claim: families.claim }).map((s) => s.refs)).toEqual([
    ["0"],
    ["1"],
  ]);
});
test("complete run preserves evidence, archives transitions, and submits one human-reviewed draft", async () => {
  const f = fixture();
  const r = await f.run();
  expect(r.reason).toBe("submitted");
  expect(r.budget.calls).toMatchObject({
    generation: 3,
    grounding: 3,
    scoring: 9,
    finalist: 3,
    selfCheck: 1,
    revision: 0,
  });
  expect(r.candidates.map((c) => c.outcome)).toEqual([
    "submitted",
    "lost",
    "lost",
  ]);
  expect(f.d.createDraft).toHaveBeenCalledTimes(1);
  expect(r.draft).toMatchObject({
    dedupeKey: "tournament:run-1",
    draft: {
      kind: "hypothesis_draft",
      needsReview: true,
      payload: {
        sourceIds: ["source-1", "source-2"],
        extractionIds: ["extraction-1", "extraction-2"],
        correspondenceId: "correspondence-id",
      },
    },
  });
  expect(r.draft?.draft.payload).not.toHaveProperty("seedFamily");
  expect(r.draft?.draft.summary).toContain("Title 1; Title 2");
  expect(f.snapshots.map((s) => s.stage)).toEqual([
    "duplicates",
    "finalists",
    "self_check",
  ]);
  expect(f.snapshots[0].candidates[0].outcome).toBe("candidate");
  expect(f.store.read().snapshots.at(-1)?.candidates[0]).toMatchObject({
    draftId: "draft-1",
    outcome: "submitted",
  });
  expect(r.events).toEqual(
    expect.arrayContaining([
      {
        kind: "family_skipped",
        family: "listening",
        reason: "no_eligible_validated_human_sessions",
      },
      {
        kind: "family_skipped",
        family: "doctrine",
        reason: "passages_unavailable",
      },
    ]),
  );
  // Includes one metered evidence search per candidate.
  expect(r.budget.totalTokens).toBe(28);
  for (const req of f.requests)
    if (req.kind === "scoring") expect(req.candidate.scores).toEqual([]);
});
test("provider-valid oversized text stays within the durable bounds", async () => {
  const f = fixture();
  f.override((r) => {
    if (r.kind === "generation") {
      const value = f.response(r) as Record<string, string>;
      // The first title is too long to persist; long statements and feedback
      // are legitimate and must not make the draft or archive unwritable.
      return ok({
        ...value,
        title: value.title === "Title 0" ? "T".repeat(241) : value.title,
        statement: `${value.statement} ${"s".repeat(9_000)}`,
      });
    }
    if (r.kind === "selfCheck")
      return ok({ ...checked, feedback: "f".repeat(5_000) });
    return undefined;
  });
  const r = await f.run();
  expect(r.reason).toBe("submitted");
  expect(r.candidates.every((c) => c.payload.title.length <= 240)).toBe(true);
  expect(() => tournamentDraftZ.parse(r.draft)).not.toThrow();
  for (const candidate of r.candidates)
    if (candidate.selfCheck)
      expect(() =>
        tournamentSelfCheckZ.parse(candidate.selfCheck),
      ).not.toThrow();
});
test("bounds each available family to two and includes the hint", async () => {
  const f = fixture();
  f.d.loadSeeds = async (family) =>
    Array.from({ length: 20 }, (_, n) => ({
      family,
      refs: [`${family}-${n}`],
      context: family,
      ...(family === "correspondence"
        ? { correspondenceId: `${family}-${n}` }
        : {}),
    }));
  const r = await f.run("hint");
  expect(r.candidates.map((c) => c.seedFamily)).toEqual([
    "correspondence",
    "claim",
    "inversion",
    "hint",
    "correspondence",
    "claim",
    "inversion",
  ]);
  expect(r.budget.calls).toMatchObject({ generation: 7, scoring: 21 });
});
test("cap three stops before seeds or models", async () => {
  const f = fixture();
  f.d.countPendingDrafts = async () => 3;
  expect((await f.run()).reason).toBe("capacity");
  expect(f.d.model).not.toHaveBeenCalled();
  expect(f.d.loadSeeds).not.toHaveBeenCalled();
});
test("malformed capacity fails closed and failed families are recorded", async () => {
  const f = fixture();
  f.d.countPendingDrafts = async () => Number.NaN;
  expect((await f.run()).reason).toBe("dependency_error");
  f.store.expire("run-1");
  f.d.countPendingDrafts = async () => 0;
  f.d.loadSeeds = async () => {
    throw new Error("offline");
  };
  const r = await f.run();
  expect(r.reason).toBe("insufficient_seeds");
  expect(r.events.filter((e) => e.reason === "tool_failure")).toHaveLength(3);
  expect(f.d.model).not.toHaveBeenCalled();
});
test("repeated or unsearched hydrated IDs cannot satisfy two claims", async () => {
  const f = fixture();
  f.d.searchClaimsSemantic = async () => ok(["claim-1", "claim-1"]);
  const r = await f.run();
  expect(r.candidates.every((c) => c.outcome === "dropped_evidence")).toBe(
    true,
  );
  expect(r.candidates[0].evidenceClaimIds).toEqual(["claim-1"]);
  expect(r.budget.calls.grounding).toBe(0);
});
test.each([
  "sourceIds",
  "extractionIds",
  "correspondenceId",
  "thesisId",
  "evidenceClaimIds",
])("rejects fabricated %s", async (field) => {
  const f = fixture();
  f.override((r) =>
    r.kind === "grounding"
      ? ok({
          ...(f.response(r) as object),
          [field]: field.endsWith("Ids") ? ["invented"] : "invented",
        })
      : undefined,
  );
  expect(
    (await f.run()).candidates.every((c) => c.outcome === "dropped_evidence"),
  ).toBe(true);
  expect(f.d.createDraft).not.toHaveBeenCalled();
});
test.each(["missing_citations", "changed_statement"])(
  "rejects %s during grounding",
  async (problem) => {
    const f = fixture();
    f.override((r) =>
      r.kind === "grounding"
        ? ok({
            ...(f.response(r) as object),
            ...(problem === "missing_citations"
              ? { rationale: "unsupported" }
              : { statement: "changed" }),
          })
        : undefined,
    );
    expect(
      (await f.run()).candidates.every((c) => c.outcome === "dropped_evidence"),
    ).toBe(true);
  },
);
test("nearest three only, inversions and refinements kept and named", async () => {
  const f = fixture();
  f.d.neighbors = async () =>
    ok(
      [0.85, 0.86, 0.9, 0.99, 0.88].map((similarity) => ({
        id: `n-${similarity}`,
        statement: "Other",
        similarity,
      })),
    );
  f.override((r) =>
    r.kind === "duplicate"
      ? ok({
          kind: r.neighbor.similarity === 0.99 ? "inversion" : "refinement",
        })
      : undefined,
  );
  const r = await f.run();
  expect(r.reason).toBe("submitted");
  expect(r.budget.duplicateCalls).toEqual({ 0: 3, 1: 3, 2: 3 });
  expect(
    f.requests
      .filter((r) => r.kind === "duplicate")
      .map((r) => r.kind === "duplicate" && r.neighbor.similarity),
  ).toEqual([0.99, 0.9, 0.88, 0.99, 0.9, 0.88, 0.99, 0.9, 0.88]);
  expect(r.draft?.draft.summary).toContain("inversion: n-0.99");
  expect(r.draft?.draft.summary).toContain("refinement: n-0.9");
});
test("later sibling duplicates are excluded before scoring", async () => {
  const f = fixture();
  f.d.embed = async () => ok([1, 0]);
  f.override((r) =>
    r.kind === "duplicate" ? ok({ kind: "duplicate" }) : undefined,
  );
  const r = await f.run();
  expect(r.candidates.map((c) => c.outcome)).toEqual([
    "submitted",
    "dropped_duplicate",
    "dropped_duplicate",
  ]);
  expect(r.budget.calls.scoring).toBe(3);
  expect(r.candidates[1].duplicateOf).toBe("tournament:run-1:0");
});
test("external duplicates at inclusive 0.86 threshold are excluded", async () => {
  const f = fixture();
  f.d.neighbors = async () =>
    ok([{ id: "existing", statement: "same", similarity: 0.86 }]);
  f.override((r) =>
    r.kind === "duplicate" ? ok({ kind: "duplicate" }) : undefined,
  );
  expect(
    (await f.run()).candidates.every((c) => c.outcome === "dropped_duplicate"),
  ).toBe(true);
  expect(f.d.createDraft).not.toHaveBeenCalled();
});
test("embedding failure explicitly fails open in review summary", async () => {
  const f = fixture();
  f.d.embed = async () => failed(4);
  const r = await f.run();
  expect(r.reason).toBe("submitted");
  expect(r.draft?.draft.summary).toContain("embedding_failed_open");
  expect(f.d.neighbors).not.toHaveBeenCalled();
});
test("missing duplicate judgment does not silently pass novelty", async () => {
  const f = fixture();
  f.d.neighbors = async () =>
    ok([{ id: "other", statement: "other", similarity: 0.9 }]);
  f.override((r) => (r.kind === "duplicate" ? failed(10) : undefined));
  expect(
    (await f.run()).candidates.every((c) => c.outcome === "ineligible"),
  ).toBe(true);
});
test.each([1, 2])(
  "%s missing scoring judgments consume calls without becoming draws",
  async (missing) => {
    const f = fixture();
    f.override((r) =>
      r.kind === "scoring" && r.judgeIndex! < missing ? failed(5) : undefined,
    );
    const r = await f.run();
    expect(r.reason).toBe(
      missing === 1 ? "submitted" : "no_eligible_candidates",
    );
    expect(r.candidates.every((c) => c.scores.length === 3 - missing)).toBe(
      true,
    );
    expect(r.budget.calls.scoring).toBe(9);
  },
);
test("top three by mean resolve pairwise ties by falsifiability", async () => {
  const f = fixture();
  f.override((r) =>
    r.kind === "scoring"
      ? ok({ stake: 3, novelty: 3, falsifiability: r.candidate.batchIndex + 1 })
      : r.kind === "finalist"
        ? ok({ winner: "tie" })
        : undefined,
  );
  const r = await f.run("fourth seed");
  expect(r.candidates[3].outcome).toBe("submitted");
  expect(r.candidates[0].outcome).toBe("lost");
  expect(r.pairs).toHaveLength(3);
  expect(r.pairs.flatMap((p) => [p.left, p.right])).not.toContain(0);
});
test("missing finalist comparison is not a draw", async () => {
  const f = fixture();
  f.override((r) => (r.kind === "finalist" ? failed() : undefined));
  const r = await f.run();
  expect(r.reason).toBe("dependency_error");
  expect(r.pairs.every((p) => p.status === "missing")).toBe(true);
  expect(r.candidates.every((c) => c.outcome === "finalist")).toBe(true);
  expect(f.d.createDraft).not.toHaveBeenCalled();
});
test("one revision rechecks a changed statement and refreshes embedding", async () => {
  const f = fixture();
  let checks = 0;
  f.override((r) =>
    r.kind === "selfCheck" && checks++ === 0
      ? ok({ ...checked, pass: false })
      : undefined,
  );
  const r = await f.run();
  expect(r.reason).toBe("submitted");
  expect(r.budget.calls).toMatchObject({
    revision: 1,
    selfCheck: 2,
    duplicateRecheck: 1,
  });
  expect(r.candidates[0].finalPayload?.statement).toBe("Statement 0 revised");
  expect(r.draft?.draft.payload.statement).toBe("Statement 0 revised");
  expect(f.d.embed).toHaveBeenCalledTimes(4);
  expect(f.d.neighbors).toHaveBeenLastCalledWith(
    expect.objectContaining({ statement: "Statement 0 revised" }),
    expect.anything(),
  );
});
test("unchanged revision skips recheck, inconsistent pass fails after two checks", async () => {
  const f = fixture();
  f.override((r) =>
    r.kind === "selfCheck"
      ? ok({ ...checked, oneVariable: false })
      : r.kind === "revision"
        ? ok(r.candidate.payload)
        : undefined,
  );
  const r = await f.run();
  expect(r.reason).toBe("failed_self_check");
  expect(r.budget.calls).toMatchObject({
    revision: 1,
    selfCheck: 2,
    duplicateRecheck: 0,
  });
  expect(r.candidates[0].outcome).toBe("failed_self_check");
  expect(f.d.createDraft).not.toHaveBeenCalled();
});
test.each(["duplicate", "fabricated"])(
  "rejects %s revision",
  async (problem) => {
    const f = fixture();
    f.d.neighbors = async ({ statement }) =>
      ok(
        statement.endsWith("revised")
          ? [{ id: "prior", statement: "same", similarity: 1 }]
          : [],
      );
    f.override((r) =>
      r.kind === "selfCheck"
        ? ok({ ...checked, pass: false })
        : r.kind === "duplicate"
          ? ok({ kind: "duplicate" })
          : r.kind === "revision" && problem === "fabricated"
            ? ok({ ...r.candidate.payload, sourceIds: ["unread"] })
            : undefined,
    );
    expect((await f.run()).reason).toBe(
      problem === "duplicate" ? "duplicate_revision" : "failed_self_check",
    );
    expect(f.d.createDraft).not.toHaveBeenCalled();
  },
);
test("atomic cap rejection marks candidates ineligible", async () => {
  const f = fixture();
  f.d.createDraft = vi.fn(async () => ({ status: "cap_reached" }));
  const r = await f.run();
  expect(r.reason).toBe("capacity");
  expect(r.draft).toBeUndefined();
  expect(r.candidates.every((c) => c.outcome === "ineligible")).toBe(true);
});
test("lost submission response replays the atomic submitted archive", async () => {
  const f = fixture();
  const create = f.d.createDraft;
  f.d.createDraft = async (...args) => {
    await create(...args);
    throw new Error("response lost");
  };
  expect((await f.run()).reason).toBe("dependency_error");
  const retry = fixture(f.store);
  const result = await retry.run();
  expect(result.reason).toBe("submitted");
  expect(result.draftId).toBe("draft-1");
  expect(result.candidates[0].draftId).toBe("draft-1");
  expect(retry.d.model).not.toHaveBeenCalled();
  expect(retry.d.record).not.toHaveBeenCalled();
});
test("every separate call allowance is enforced", () => {
  for (const [kind, limit] of Object.entries(TOURNAMENT_LIMITS)) {
    if (kind === "tokens" || kind === "wallMs" || kind === "cleanupMs")
      continue;
    const b = new TournamentBudget(() => 0);
    const key = kind as Parameters<TournamentBudget["count"]>[0];
    for (let i = 0; i < limit; i++) b.count(key, 0);
    expect(() => b.count(key, 0)).toThrow(BudgetExhausted);
    if (kind === "duplicate")
      expect(() => b.count("duplicate", 1)).not.toThrow();
  }
});
test.each(["scoring", "finalist", "selfCheck"] as const)(
  "token exhaustion during %s archives the correct phase",
  async (stage) => {
    const f = fixture();
    let count = 0;
    f.override((r) =>
      r.kind === stage &&
      ++count === (stage === "scoring" ? 3 : stage === "finalist" ? 2 : 1)
        ? ok(f.response(r), 300_000)
        : undefined,
    );
    const r = await f.run();
    expect(r.reason).toBe("budget_exhausted");
    expect(r.draft).toBeUndefined();
    expect(f.d.createDraft).not.toHaveBeenCalled();
    if (stage === "scoring") expect(r.candidates[0].outcome).toBe("lost");
    if (stage === "finalist") {
      expect(r.candidates.every((c) => c.outcome === "finalist")).toBe(true);
      expect(r.pairs).toHaveLength(1);
    }
    if (stage === "selfCheck")
      expect(r.candidates.map((c) => c.outcome)).toEqual([
        "finalist",
        "lost",
        "lost",
      ]);
    expect(f.snapshots.at(-1)?.stage).toBe("terminal");
  },
);
test("wall-clock exhaustion stops before another model call", async () => {
  const f = fixture();
  let now = 0;
  f.d.now = () => now;
  f.override((r) => {
    if (r.kind === "generation") now = 20 * 60_000;
    return undefined;
  });
  expect((await f.run()).reason).toBe("budget_exhausted");
  expect(f.d.model).toHaveBeenCalledTimes(1);
});
test("hung tool terminates at deadline with cancellation", async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    f.d.now = Date.now;
    let signal: AbortSignal | undefined;
    f.d.countPendingDrafts = async (context) => {
      signal = context.signal;
      return await new Promise<number>(() => {});
    };
    const pending = f.run();
    await vi.advanceTimersByTimeAsync(20 * 60_000 + 1);
    expect((await pending).reason).toBe("budget_exhausted");
    expect(signal?.aborted).toBe(true);
    expect(f.d.model).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
test("unknown usage fails closed", async () => {
  const f = fixture();
  f.override(() => ok({}, Number.NaN));
  expect((await f.run()).reason).toBe("dependency_error");
  expect(f.d.createDraft).not.toHaveBeenCalled();
});
test("revision duplicate recheck shares the three classification calls", async () => {
  const f = fixture();
  f.d.neighbors = async () =>
    ok(
      [1, 2, 3].map((n) => ({
        id: `prior-${n}`,
        statement: "prior",
        similarity: 0.9,
      })),
    );
  f.override((r) =>
    r.kind === "selfCheck" ? ok({ ...checked, pass: false }) : undefined,
  );
  const r = await f.run();
  expect(r.reason).toBe("budget_exhausted");
  expect(r.budget.duplicateCalls[0]).toBe(3);
  expect(r.budget.calls.duplicateRecheck).toBe(1);
  expect(r.candidates[0].outcome).toBe("finalist");
  expect(f.d.createDraft).not.toHaveBeenCalled();
});

test("second self-check audits the revision rather than the original payload", async () => {
  const f = fixture();
  f.override((r) =>
    r.kind === "selfCheck"
      ? ok({
          ...checked,
          pass: r.candidate.payload.statement.endsWith("revised"),
        })
      : undefined,
  );
  expect((await f.run()).reason).toBe("submitted");
  const calls = f.requests.filter((r) => r.kind === "selfCheck");
  expect(
    calls.map((r) => r.kind === "selfCheck" && r.candidate.payload.statement),
  ).toEqual(["Statement 0", "Statement 0 revised"]);
});

test("conflicting hydration provenance stops the run without a draft", async () => {
  const f = fixture();
  f.d.hydrateClaims = async () =>
    ["source-a", "source-b"].map((sourceId) => ({
      claimId: "claim-1",
      text: "same",
      sourceId,
      extractionId: "extraction-1",
    }));
  expect((await f.run()).reason).toBe("dependency_error");
  expect(f.d.createDraft).not.toHaveBeenCalled();
});

test("remaining token allowance includes failed responses and embedding usage", async () => {
  const budget = new TournamentBudget(() => 0);
  await budget.metered(async () => failed(25));
  await budget.metered(async (context) => {
    expect(context.maxTotalTokens).toBe(299_975);
    return ok([1, 0], 10);
  });
  expect(budget.tokens).toBe(35);
});

test("repeat runId replays original payload before capacity, generation or archive writes", async () => {
  const first = fixture();
  const original = await first.run();
  const before = first.store.read();
  const retry = fixture(first.store);
  retry.d.countPendingDrafts = vi.fn(async () => 3);
  retry.override(() => ok({ title: "New winner must never be generated" }));
  expect(await retry.run("different hint")).toEqual(original);
  expect(retry.d.countPendingDrafts).not.toHaveBeenCalled();
  expect(retry.d.model).not.toHaveBeenCalled();
  expect(retry.d.record).not.toHaveBeenCalled();
  expect(retry.d.createDraft).not.toHaveBeenCalled();
  expect(first.store.read()).toEqual(before);
});

test("overlapping independent adapters return busy without writes, then replay", async () => {
  const first = fixture();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  first.d.countPendingDrafts = async () => {
    entered();
    await blocked;
    return 0;
  };
  const active = first.run();
  await started;
  const overlap = fixture(first.store);
  expect((await overlap.run()).reason).toBe("busy");
  expect(overlap.d.model).not.toHaveBeenCalled();
  expect(overlap.d.record).not.toHaveBeenCalled();
  expect(overlap.d.createDraft).not.toHaveBeenCalled();
  release();
  const original = await active;
  expect(original.reason).toBe("submitted");
  expect(await overlap.run()).toEqual(original);
});

test("expired attempt cannot overwrite the replacement attempt's submitted result", async () => {
  const first = fixture();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const record = first.d.record;
  first.d.record = async (...args) => {
    entered();
    await blocked;
    return record(...args);
  };
  const active = first.run();
  await started;
  first.store.expire("run-1");
  const replacement = fixture(first.store);
  const original = await replacement.run();
  const saved = first.store.read();
  release();
  expect((await active).reason).toBe("dependency_error");
  expect(first.d.createDraft).not.toHaveBeenCalled();
  expect(first.store.read()).toEqual(saved);
  expect(await fixture(first.store).run()).toEqual(original);
});

test.each(["throw", "tokens", "timeout", "before_recheck"] as const)(
  "revised text never archives the old embedding on %s",
  async (failure) => {
    if (failure === "timeout") vi.useFakeTimers();
    try {
      const f = fixture();
      if (failure === "timeout") f.d.now = Date.now;
      const embed = f.d.embed;
      let signal: AbortSignal | undefined;
      f.d.embed = async (statement, context) => {
        if (!statement.endsWith("revised")) return embed(statement, context);
        if (failure === "throw") throw new Error("embedding unavailable");
        if (failure === "tokens") return ok([0, 0, 1], 300_000);
        signal = context.signal;
        return new Promise(() => {});
      };
      f.override((r) =>
        r.kind === "selfCheck" ? ok({ ...checked, pass: false }) : undefined,
      );
      // Exhaust the budget between accepting the revision and counting recheck.
      let expired = false;
      if (failure === "before_recheck") {
        f.d.now = () => (expired ? 20 * 60_000 : 0);
        const original = f.response;
        f.override((r) => {
          if (r.kind === "selfCheck") return ok({ ...checked, pass: false });
          if (r.kind === "revision") {
            const value = original(r) as Record<string, unknown>;
            Object.defineProperty(value, "rationale", {
              get() {
                expired = true;
                return r.candidate.payload.rationale;
              },
            });
            return ok(value);
          }
          return undefined;
        });
      }
      const pending = f.run();
      if (failure === "timeout")
        await vi.advanceTimersByTimeAsync(20 * 60_000 + 10);
      const result = await pending;
      expect(result.reason).toBe(
        failure === "throw" ? "dependency_error" : "budget_exhausted",
      );
      expect(result.candidates[0].finalPayload?.statement).toBe(
        "Statement 0 revised",
      );
      expect(result.candidates[0].statementEmbedding).toBeUndefined();
      expect(
        f.snapshots.at(-1)?.candidates[0].statementEmbedding,
      ).toBeUndefined();
      expect(f.snapshots.at(-1)?.candidates[0].finalPayload?.statement).toBe(
        "Statement 0 revised",
      );
      expect(f.d.createDraft).not.toHaveBeenCalled();
      if (failure === "timeout") expect(signal?.aborted).toBe(true);
    } finally {
      if (failure === "timeout") vi.useRealTimers();
    }
  },
);

test.each([
  "[claim:claim999999]",
  "claim999999",
  "claim-999999",
  "[claim:unread-opaque-id]",
  "[claim:claim-1-extra]",
  "[claim:claim-1",
  "[CLAIM:claim-1]",
  "jx7abcdef1234567890abcdef12345678",
])(
  "rejects extra unread or malformed rationale citation %s in grounding and revision",
  async (citation) => {
    for (const stage of ["grounding", "revision"] as const) {
      const f = fixture();
      f.override((r) =>
        r.kind === stage
          ? ok({
              ...(f.response(r) as object),
              rationale: `[claim:claim-1] and [claim:claim-2] plus ${citation}`,
            })
          : stage === "revision" && r.kind === "selfCheck"
            ? ok({ ...checked, pass: false })
            : undefined,
      );
      const result = await f.run();
      expect(result.reason).toBe(
        stage === "grounding" ? "no_eligible_candidates" : "failed_self_check",
      );
      expect(f.d.createDraft).not.toHaveBeenCalled();
    }
  },
);

test("literal substring matches cannot substitute for exact claim citations", async () => {
  const f = fixture();
  f.override((r) =>
    r.kind === "grounding"
      ? ok({
          ...(f.response(r) as object),
          rationale: "[claim:claim-10] and [claim:claim-20]",
        })
      : undefined,
  );
  expect((await f.run()).reason).toBe("no_eligible_candidates");
});

test("delayed terminal archive and completion close the lease after the work deadline", async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    f.d.now = Date.now;
    const startedAt = Date.now();
    const begin = f.d.beginRun;
    f.d.beginRun = vi.fn(begin);
    f.d.countPendingDrafts = async () => new Promise<number>(() => {});
    const signals: AbortSignal[] = [];
    const record = f.d.record;
    f.d.record = async (snapshot, context) => {
      signals.push(context.signal);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(context.signal.aborted).toBe(false);
      await record(snapshot, context);
    };
    const complete = f.d.completeRun;
    f.d.completeRun = async (input, context) => {
      signals.push(context.signal);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(context.signal.aborted).toBe(false);
      await complete(input, context);
    };
    const pending = f.run();
    await vi.advanceTimersByTimeAsync(TOURNAMENT_LIMITS.wallMs + 20);
    const result = await pending;
    expect(result.reason).toBe("budget_exhausted");
    expect(result.events).not.toContainEqual({
      kind: "stopped",
      reason: "archive_failed",
    });
    expect(result.events).not.toContainEqual({
      kind: "stopped",
      reason: "run_persistence_failed",
    });
    expect(f.snapshots.at(-1)?.stage).toBe("terminal");
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
    expect(f.d.beginRun).toHaveBeenCalledWith(
      {
        runId: "run-1",
        leaseDurationMs: TOURNAMENT_LIMITS.wallMs + TOURNAMENT_LIMITS.cleanupMs,
      },
      expect.anything(),
    );
    expect(f.store.read().rows["run-1"].expiresAt).toBe(
      startedAt + TOURNAMENT_LIMITS.wallMs + TOURNAMENT_LIMITS.cleanupMs,
    );
    // Completed results outlive the lease: no regeneration even after expiry.
    await vi.advanceTimersByTimeAsync(TOURNAMENT_LIMITS.cleanupMs);
    const retry = fixture(f.store);
    expect(await retry.run()).toEqual(result);
    expect(retry.d.model).not.toHaveBeenCalled();
    expect(retry.d.record).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test.each(["archive", "completion"] as const)(
  "hanging %s shares one bounded cleanup allowance without resetting it",
  async (stage) => {
    vi.useFakeTimers();
    try {
      const f = fixture();
      f.d.now = Date.now;
      const startedAt = Date.now();
      f.d.countPendingDrafts = async () => new Promise<number>(() => {});
      let hangingSignal: AbortSignal | undefined;
      const record = f.d.record;
      f.d.record = async (snapshot, context) => {
        if (stage === "archive") {
          hangingSignal = context.signal;
          return new Promise<void>(() => {});
        }
        await new Promise((resolve) =>
          setTimeout(resolve, TOURNAMENT_LIMITS.cleanupMs - 10),
        );
        await record(snapshot, context);
      };
      f.d.completeRun = vi.fn(async (_input, context) => {
        hangingSignal = context.signal;
        return new Promise<void>(() => {});
      });
      let settled = false;
      const pending = f.run().then((result) => {
        settled = true;
        return result;
      });
      await vi.advanceTimersByTimeAsync(
        TOURNAMENT_LIMITS.wallMs + TOURNAMENT_LIMITS.cleanupMs - 1,
      );
      expect(settled).toBe(false);
      expect(hangingSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const result = await pending;
      expect(Date.now() - startedAt).toBe(
        TOURNAMENT_LIMITS.wallMs + TOURNAMENT_LIMITS.cleanupMs,
      );
      expect(result.reason).toBe("budget_exhausted");
      expect(hangingSignal?.aborted).toBe(true);
      expect(result.events).toContainEqual({
        kind: "stopped",
        reason: "run_persistence_failed",
      });
      expect(f.d.completeRun).toHaveBeenCalledTimes(
        stage === "archive" ? 0 : 1,
      );
      expect(f.store.read().rows["run-1"].result).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  },
);

test("early cleanup also shares one allowance and refuses calls after it expires", async () => {
  vi.useFakeTimers();
  try {
    const budget = new TournamentBudget(Date.now);
    const first = budget.call(async () => {
      await new Promise((resolve) => setTimeout(resolve, 6_000));
    }, true);
    await vi.advanceTimersByTimeAsync(6_000);
    await first;
    let signal: AbortSignal | undefined;
    const second = budget.call(async (context) => {
      signal = context.signal;
      return new Promise<void>(() => {});
    }, true);
    const rejection = expect(second).rejects.toMatchObject({
      dimension: "cleanupMs",
    });
    await vi.advanceTimersByTimeAsync(4_000);
    await rejection;
    expect(signal?.aborted).toBe(true);
    const afterDeadline = vi.fn(async () => {});
    await expect(budget.call(afterDeadline, true)).rejects.toMatchObject({
      dimension: "cleanupMs",
    });
    expect(afterDeadline).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
