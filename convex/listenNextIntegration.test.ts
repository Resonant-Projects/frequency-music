// Cross-lane flows for the Listen-first next tracks. Each lane tests its own
// module; these drive the real render pipeline into general audio feedback,
// the docket and signed decisions, and a tournament draft into the shared
// human-review path, so a regression at a seam fails here.
import { convexTest } from "convex-test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import {
  enableTournamentEnv,
  setupTournament,
} from "../harness/fixtures/tournament";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import type { TournamentCandidate } from "./shared/hypothesisTournament";
import {
  type ClaimedMediaJob,
  RENDERER_VERSION_FOR_JOBS,
} from "./shared/mediaJobs";

type T = ReturnType<typeof convexTest>;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const proposal = {
  channel: "discord",
  conversationId: "conversation",
  messageRef: "message",
  transcript: "Keith said the render felt warm, four overall.",
};

const baselinePlan = {
  version: 1,
  engine: "sc-litmus",
  tuning: { kind: "edo", divisions: 19 },
  referenceHz: 432,
  normalize: true,
  tempoBpm: 120,
  durationSecs: 2,
  seed: [
    { degree: 1, octave: 0, startBeat: 0, beats: 1, velocity: 100 },
    { degree: 2, octave: 0, startBeat: 1, beats: 1, velocity: 90 },
  ],
} as const;

const familyPlan = {
  ...baselinePlan,
  variable: { kind: "referenceHz", variants: [440] },
} as const;

describe("rendered audio in general feedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("AGENT_TOOL_SECRET", "service");
  });

  async function insertRecipe(t: T, renderPlan: unknown) {
    return await t.run(async (ctx) => {
      const hypothesisId = await ctx.db.insert("hypotheses", {
        title: "Hypothesis",
        question: "Question",
        hypothesis: "Hypothesis",
        rationaleMd: "Rationale",
        sourceIds: [],
        status: "draft",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("recipes", {
        hypothesisId,
        title: "Nineteen",
        bodyMd: "Recipe",
        parameters: [],
        dawChecklist: [],
        status: "draft",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
        renderPlan: renderPlan as never,
      });
    });
  }

  /** The media worker's path for one admitted render: claim, mint a master
   * and its delivery per member, upload, and complete under the lease. */
  async function render(t: T, recipeId: Id<"recipes">, members: number) {
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = (await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "worker",
      kinds: ["litmusRender"],
      rendererVersion: RENDERER_VERSION_FOR_JOBS,
    })) as ClaimedMediaJob | null;
    if (!job) throw new Error("no job claimed");
    const jobId = job.jobId as Id<"mediaJobs">;
    const base = {
      kind: "litmusRender",
      metadataStripped: true,
      normalization: "applied",
      access: "private",
      title: "Litmus render",
      engine: { name: "sc-litmus", version: "0.3.0", params: {} },
    };
    const mint = async (artifact: Record<string, unknown>) => {
      const { artifactId } = await t.mutation(
        internal.mediaToolsInternal.generateAudioUploadUrl,
        { jobId, leaseToken: job.leaseToken, artifact },
      );
      const storageId = await t.run((ctx) =>
        ctx.storage.store(new Blob([String(artifact.contentHash)])),
      );
      await t.mutation(internal.mediaToolsInternal.attachAudioStorage, {
        jobId,
        leaseToken: job.leaseToken,
        artifactId,
        storageId,
      });
      return artifactId as Id<"audioArtifacts">;
    };
    const results = [];
    for (let member = 0; member < members; member++) {
      const tag = `${jobId}-${member}`;
      const master = await mint({
        ...base,
        role: "masterNormalized",
        encoding: { codec: "wav", sampleRate: 48000, channels: 2 },
        contentHash: `master-${tag}`,
      });
      const delivery = await mint({
        ...base,
        role: "delivery",
        masterArtifactId: master,
        encoding: {
          codec: "mp3",
          bitrateKbps: 256,
          sampleRate: 48000,
          channels: 2,
        },
        contentHash: `delivery-${tag}`,
      });
      const measured = (artifactId: Id<"audioArtifacts">, mime: string) => ({
        artifactId,
        durationSecs: 2,
        loudnessLufs: -18,
        truePeakDbtp: -2,
        mimeType: mime,
      });
      results.push({
        member,
        master: measured(master, "audio/wav"),
        delivery: measured(delivery, "audio/mpeg"),
      });
    }
    await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: job.leaseToken,
      result: { kind: "litmusRender", members: results },
    });
    return results.map((row) => ({
      master: row.master.artifactId,
      delivery: row.delivery.artifactId,
    }));
  }

  const human = (t: T) => t.withIdentity({ subject: "human" });
  const setGate = (t: T, value: string) =>
    t.mutation(internal.settings.set, { key: "renderValidation", value });
  const queueIds = async (t: T) =>
    (await human(t).query(api.audioFeedback.queue, {})).map(
      (row) => row.artifactId as string,
    );
  const docketCards = async (t: T) =>
    await t.query(internal.docket.currentState, {});
  const contentHash = async (t: T, id: Id<"audioArtifacts">) =>
    (await t.run((ctx) => ctx.db.get(id)))!.contentHash;
  const proposeRating = (t: T, id: Id<"audioArtifacts">) =>
    t.mutation(api.decisionIntents.propose, {
      secret: "service",
      command: {
        action: "rateAudio",
        target: { kind: "audioArtifact", id },
        payload: { scores: { overall: 4, musicality: 0 } },
      },
      proposal,
    });

  test("an unvalidated render projects once, as its delivery, and a rating clears it", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, baselinePlan);
    const [{ master, delivery }] = (await render(t, recipeId, 1)) as [
      { master: Id<"audioArtifacts">; delivery: Id<"audioArtifacts"> },
    ];
    expect(await queueIds(t)).toEqual([delivery]);
    const cards = await docketCards(t);
    expect(cards.filter((card) => card.kind === "unratedAudio")).toMatchObject([
      {
        targetId: delivery,
        title: "Nineteen — litmus render",
        pageUrl: `/listen?audio=${delivery}`,
        decisions: ["rateAudio", "defer"],
      },
    ]);
    // An unvalidated render opens no composition debt; the recipe card stays.
    expect(cards.map((card) => card.kind)).not.toContain(
      "compositionNoListening",
    );
    expect(
      cards.some(
        (card) =>
          card.kind === "recipeNoComposition" && card.targetId === recipeId,
      ),
    ).toBe(true);
    expect(
      await human(t).query(api.audioFeedback.item, { artifactId: master }),
    ).toBeNull();
    await expect(
      human(t).mutation(api.audioFeedback.submit, {
        artifactId: master,
        contentHash: await contentHash(t, master),
        clientRequestId: "render-master-1",
        payload: { scores: { overall: 4 } },
      }),
    ).rejects.toThrow("This audio is not available for rating.");
    await human(t).mutation(api.audioFeedback.submit, {
      artifactId: delivery,
      contentHash: await contentHash(t, delivery),
      clientRequestId: "render-delivery-1",
      payload: { scores: { overall: 0, goosebumps: 3 } },
    });
    const ratings = await t.run((ctx) =>
      ctx.db.query("audioRatings").collect(),
    );
    expect(ratings).toMatchObject([
      {
        artifactId: delivery,
        artifactKind: "litmusRender",
        artifactValidation: "unvalidated",
        scores: { overall: 0, goosebumps: 3 },
      },
    ]);
    expect(await queueIds(t)).toEqual([]);
    expect(
      (await docketCards(t)).filter((card) => card.kind === "unratedAudio"),
    ).toEqual([]);
    // A rating is not a validation: the render stays unvalidated.
    expect((await t.run((ctx) => ctx.db.get(delivery)))?.validation).toBe(
      "unvalidated",
    );
  });

  test("a validated render keeps rating and listening-session debt distinct", async () => {
    const t = convexTest(schema, modules);
    await setGate(t, "go");
    const recipeId = await insertRecipe(t, baselinePlan);
    const [{ delivery }] = (await render(t, recipeId, 1)) as [
      { master: Id<"audioArtifacts">; delivery: Id<"audioArtifacts"> },
    ];
    const composition = (await t.run((ctx) =>
      ctx.db.query("compositions").first(),
    ))!;
    const cards = await docketCards(t);
    const forRender = cards
      .filter(
        (card) =>
          card.targetId === delivery || card.targetId === composition._id,
      )
      .map((card) => `${card.kind}:${card.targetId}`);
    expect(forRender.toSorted((a, b) => a.localeCompare(b))).toEqual([
      `compositionNoListening:${composition._id}`,
      `unratedAudio:${delivery}`,
    ]);
  });

  test("a study family stays out of feedback, docket and proposals until reveal", async () => {
    const t = convexTest(schema, modules);
    await setGate(t, "go");
    const recipeId = await insertRecipe(t, familyPlan);
    const members = await render(t, recipeId, 2);
    const deliveries = members.map((m) => m.delivery as string);
    const masters = members.map((m) => m.master as string);
    const group = (await t.run((ctx) => ctx.db.query("blindGroups").first()))!;
    expect(group.purpose).toBe("studyFamily");

    expect(await queueIds(t)).toEqual([]);
    const blindCards = await docketCards(t);
    expect(
      blindCards.filter((card) =>
        [...deliveries, ...masters].includes(card.targetId),
      ),
    ).toEqual([]);
    expect(blindCards.map((card) => card.kind)).not.toContain(
      "compositionNoListening",
    );
    expect(JSON.stringify(blindCards)).not.toMatch(/study family member/);
    for (const id of members.map((m) => m.delivery)) {
      expect(
        await human(t).query(api.audioFeedback.item, { artifactId: id }),
      ).toBeNull();
      await expect(proposeRating(t, id)).rejects.toThrow(
        "This audio is not available for rating.",
      );
    }

    await t.mutation(internal.blindGroups.reveal, { groupId: group._id });
    expect((await queueIds(t)).toSorted()).toEqual(deliveries.toSorted());
    const revealed = await docketCards(t);
    expect(
      revealed
        .filter((card) => card.kind === "unratedAudio")
        .map((card) => card.targetId)
        .toSorted(),
    ).toEqual(deliveries.toSorted());
    expect(revealed.filter((card) => masters.includes(card.targetId))).toEqual(
      [],
    );
    expect(
      revealed.filter((card) => card.kind === "compositionNoListening"),
    ).toHaveLength(2);
    const intent = await proposeRating(t, members[0]!.delivery);
    expect(intent.targetContentHash).toBe(
      await contentHash(t, members[0]!.delivery),
    );
  });

  test("a signed rating binds to the rendered delivery's current content", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, baselinePlan);
    const [first] = await render(t, recipeId, 1);
    await expect(proposeRating(t, first!.master)).rejects.toThrow(
      "This audio is not available for rating.",
    );
    const intent = await proposeRating(t, first!.delivery);
    expect(intent.targetContentHash).toBe(
      await contentHash(t, first!.delivery),
    );
    const args = {
      intentId: intent._id,
      digest8: intent.payloadDigest.slice(0, 8),
      eventId: "render-rate-1",
    };
    const applied = await human(t).mutation(api.decisionIntents.applyWeb, args);
    expect(applied.status).toBe("applied");
    expect(await human(t).mutation(api.decisionIntents.applyWeb, args)).toEqual(
      applied,
    );
    expect(
      await t.run((ctx) => ctx.db.query("audioRatings").collect()),
    ).toMatchObject([
      {
        _id: applied.appliedRecordId,
        artifactId: first!.delivery,
        artifactContentHash: await contentHash(t, first!.delivery),
        decisionIntentId: intent._id,
        source: "web",
      },
    ]);

    // Editing the plan is a new revision; its render is new debt that the
    // earlier rating does not cover, and a rating proposed for the old
    // delivery stays bound to the old delivery.
    const stale = await proposeRating(t, first!.delivery);
    await human(t).mutation(api.renders.setPlan, {
      recipeId,
      renderPlan: { ...baselinePlan, referenceHz: 440 },
    });
    const [second] = await render(t, recipeId, 1);
    expect(await queueIds(t)).toEqual([second!.delivery]);
    await human(t).mutation(api.decisionIntents.applyWeb, {
      intentId: stale._id,
      digest8: stale.payloadDigest.slice(0, 8),
      eventId: "render-rate-2",
    });
    expect(
      (await t.run((ctx) => ctx.db.query("audioRatings").collect())).map(
        (row) => row.artifactId,
      ),
    ).toEqual([first!.delivery, first!.delivery]);
    expect(await queueIds(t)).toEqual([second!.delivery]);
  });
});

describe("tournament drafts in the shared review path", () => {
  async function submittedTournamentDraft() {
    enableTournamentEnv();
    const f = await setupTournament();
    const runId = await f.newRun();
    const { lease } = (await f.callTool("beginTournamentRun", {
      agentRunId: runId,
      leaseDurationMs: 1_210_000,
    })) as { lease: { token: string } };
    const claims = await f.t.run(async (ctx) =>
      Promise.all(
        [0, 1].map(async (i) => {
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
    const winner: TournamentCandidate = {
      agentRunId: runId,
      batchIndex: 0,
      seedFamily: "claim",
      seedRefs: [f.ids.claimIds[0]!],
      payload: {
        title: "Beating as tremolo",
        question: "Does 4 Hz beating read as tremolo?",
        statement: "Beating near 4 Hz is heard as tremolo",
        rationale: claims.map((c) => `[claim:${c.claimId}]`).join(" "),
        whyThisMatters: "Changes tremolo depth choices",
        sourceIds: [...new Set(claims.map((c) => c.sourceId))] as never,
        extractionIds: [...new Set(claims.map((c) => c.extractionId))] as never,
      },
      evidenceClaimIds: claims.map((c) => c.claimId),
      evidence: claims,
      relations: [],
      scores: [{ stake: 3, novelty: 3, falsifiability: 3 }],
      outcome: "submitted",
      flags: [],
      createdAt: 1,
    };
    const submit = () =>
      f.callTool("submitTournamentDraft", {
        agentRunId: runId,
        leaseToken: lease.token,
        draft: {
          agentRunId: runId,
          dedupeKey: `tournament:${runId}`,
          draft: {
            kind: "hypothesis_draft",
            title: winner.payload.title,
            summary: winner.payload.statement,
            candidateIds: [...winner.seedRefs, ...winner.evidenceClaimIds],
            needsReview: true,
            payload: winner.payload,
          },
        },
        result: {
          reason: "submitted",
          candidates: [winner],
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
        },
      }) as Promise<{ status: string; result?: { draftId?: string } }>;
    return { f, runId, submit };
  }

  test("tournament tools refuse new work while the gate is off", async () => {
    enableTournamentEnv(false);
    const f = await setupTournament();
    const runId = await f.newRun();
    await expect(f.callTool("requestTournamentRun", {})).rejects.toThrow(
      /TournamentDisabled/,
    );
    await expect(
      f.callTool("beginTournamentRun", {
        agentRunId: runId,
        leaseDurationMs: 1_210_000,
      }),
    ).rejects.toThrow(/HYPOTHESIS_TOURNAMENT_ENABLED/);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("agentRuns")
          .filter((q) => q.eq(q.field("graphName"), "hypothesis-tournament"))
          .collect(),
      ),
    ).toHaveLength(1);
  });

  test("the canonical pending cap counts drafter and tournament drafts together", async () => {
    const { f, runId, submit } = await submittedTournamentDraft();
    const drafter = await f.t.run((ctx) =>
      ctx.db.insert("agentRuns", {
        graphName: "hypothesis-drafter",
        status: "running",
        input: null,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    for (const n of [1, 2]) await f.pendingDraft(drafter, n);
    const pending = () =>
      f.t.query(internal.agentDrafts.countPending, {
        kind: "hypothesis_draft",
      });
    expect(await pending()).toBe(2);
    expect((await submit()).status).toBe("created");
    expect(await pending()).toBe(3);
    expect(
      await f.t.run(async (ctx) => (await ctx.db.get(runId))?.status),
    ).toBe("needs_review");
    // The drafter's own write path now refuses: one cap for both producers.
    await expect(
      f.t.mutation(internal.agentDrafts.createFromAgentRun, {
        agentRunId: drafter,
        draft: {
          kind: "hypothesis_draft",
          title: "Fourth",
          summary: "Fourth",
          candidateIds: ["x"],
          needsReview: true,
          payload: {
            title: "Fourth",
            question: "Q",
            statement: "Fourth statement",
            rationale: "R",
            whyThisMatters: "It changes how Keith voices the pad layer.",
            sourceIds: [],
            extractionIds: [],
          },
        },
      }),
    ).rejects.toThrow(/capped at 3/);
  });

  test("drafter drafts at the cap stop a tournament submission without a draft", async () => {
    const { f, submit } = await submittedTournamentDraft();
    const drafter = await f.newRun();
    for (const n of [1, 2, 3]) await f.pendingDraft(drafter, n);
    expect(await submit()).toEqual({ status: "cap_reached" });
    expect(
      await f.t.query(internal.agentDrafts.countPending, {
        kind: "hypothesis_draft",
      }),
    ).toBe(3);
  });

  test("a tournament draft reaches the docket and publishes only by a signed human decision", async () => {
    const { f, runId, submit } = await submittedTournamentDraft();
    const created = await submit();
    const draftId = created.result!.draftId as Id<"agentReviewDrafts">;
    expect(
      await f.t.run((ctx) => ctx.db.query("hypotheses").collect()),
    ).toHaveLength(1); // only the fixture's contradicted hypothesis
    const cards = await f.t.query(internal.docket.currentState, {});
    expect(cards.find((card) => card.targetId === draftId)).toMatchObject({
      kind: "pendingDraft",
      pageUrl: `/agent-drafts?draft=${draftId}`,
      decisions: ["approve", "reject", "supersede", "defer"],
    });
    vi.stubEnv("AGENT_TOOL_SECRET", "service");
    const intent = await f.t.mutation(api.decisionIntents.propose, {
      secret: "service",
      command: {
        action: "approve",
        target: { kind: "agentReviewDraft", id: draftId },
        payload: { note: "Worth testing" },
      },
      proposal,
    });
    // A proposal is not publication.
    expect(
      await f.t.run((ctx) => ctx.db.query("hypotheses").collect()),
    ).toHaveLength(1);
    const applied = await f.t
      .withIdentity({ subject: "human" })
      .mutation(api.decisionIntents.applyWeb, {
        intentId: intent._id,
        digest8: intent.payloadDigest.slice(0, 8),
        eventId: "tournament-approve-1",
      });
    expect(applied.status).toBe("applied");
    const promoted = (
      await f.t.run((ctx) => ctx.db.query("hypotheses").collect())
    ).filter((row) => row.agentDraftId === draftId);
    expect(promoted).toHaveLength(1);
    expect(promoted[0]!.createdBy).not.toBe("agent");
    expect(await f.t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
      status: "approved",
      dedupeKey: `tournament:${runId}`,
    });
  });
});
