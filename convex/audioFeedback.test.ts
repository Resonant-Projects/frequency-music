import { convexTest } from "convex-test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "../harness/modules";
import { decisionProposeArgsZ } from "./shared/docketTools";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("AGENT_TOOL_SECRET", "service");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const proposal = {
  channel: "discord",
  conversationId: "conversation",
  messageRef: "message",
  transcript: "Keith said the render felt warm, four overall.",
};

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["audio"]));
    const hypothesisId = await ctx.db.insert("hypotheses", {
      title: "Hypothesis",
      question: "Question",
      hypothesis: "Premise",
      rationaleMd: "Rationale",
      sourceIds: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    const recipeId = await ctx.db.insert("recipes", {
      hypothesisId,
      title: "Recipe debt",
      bodyMd: "Protocol",
      parameters: [],
      dawChecklist: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    const base = {
      role: "delivery" as const,
      metadataStripped: true,
      status: "ready" as const,
      storageId,
      encoding: { codec: "mp3" as const, sampleRate: 48000, channels: 2 },
      normalization: "applied" as const,
      access: "private" as const,
      refs: {},
      createdBy: "system" as const,
      updatedAt: 5,
    };
    const episodeId = await ctx.db.insert("audioArtifacts", {
      ...base,
      kind: "episode",
      title: "Episode",
      contentHash: "episode-v1",
      durationSecs: 600,
      createdAt: 5,
    });
    const renderId = await ctx.db.insert("audioArtifacts", {
      ...base,
      kind: "litmusRender",
      title: "Litmus render",
      contentHash: "render-v1",
      validation: "unvalidated",
      engine: { name: "supercollider", version: "1", params: {} },
      analysis: { version: "a1", roughnessMedian: 0.2 },
      createdAt: 6,
    });
    const hiddenId = await ctx.db.insert("audioArtifacts", {
      ...base,
      kind: "litmusRender",
      title: "Secret blind title",
      contentHash: "hidden",
      createdAt: 7,
    });
    const groupId = await ctx.db.insert("blindGroups", {
      purpose: "studyFamily",
      members: [{ memberId: "m1", artifactId: hiddenId, label: "A" }],
      requiredRatings: [],
      createdAt: 1,
    });
    // Back-reference only: the group itself does not list this artifact.
    const backRefId = await ctx.db.insert("audioArtifacts", {
      ...base,
      kind: "episode",
      title: "Back-referenced blind",
      contentHash: "backref",
      blindGroupId: groupId,
      createdAt: 8,
    });
    const pendingId = await ctx.db.insert("audioArtifacts", {
      ...base,
      status: "pending",
      storageId: undefined,
      kind: "episode",
      title: "Pending",
      contentHash: "pending",
      createdAt: 9,
    });
    const takeId = await ctx.db.insert("audioArtifacts", {
      ...base,
      kind: "shootoutTake",
      title: "Take",
      contentHash: "take",
      createdAt: 10,
    });
    return {
      recipeId,
      episodeId,
      renderId,
      hiddenId,
      groupId,
      backRefId,
      pendingId,
      takeId,
    };
  });
  return { t, human: t.withIdentity({ subject: "human" }), ...ids };
}

describe("general audio feedback", () => {
  test("queue is human-only and blind-safe in both membership directions", async () => {
    const { t, human, episodeId, renderId } = await setup();
    await expect(t.query(api.audioFeedback.queue, {})).rejects.toThrow();
    await expect(
      t.withIdentity({ subject: "system" }).query(api.audioFeedback.queue, {}),
    ).rejects.toThrow("Human authentication required");
    const queue = await human.query(api.audioFeedback.queue, {});
    expect(queue.map((row) => row.artifactId)).toEqual([renderId, episodeId]);
    expect(queue[0]).toEqual({
      artifactId: renderId,
      kind: "litmusRender",
      title: "Litmus render",
      engineName: "supercollider",
      validation: "unvalidated",
      contentHash: "render-v1",
      docketContentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      createdAt: 6,
    });
    const card = (await human.query(api.docket.listWeb, {})).find(
      (row) => row.targetId === renderId,
    );
    expect(queue[0]?.docketContentHash).toBe(card?.contentHash);
    expect(JSON.stringify(queue)).not.toMatch(/Secret|Back-referenced|storage/);
  });

  test("targeted lookup reaches audio outside the queue window, never hidden audio", async () => {
    const { t, human, episodeId, hiddenId, backRefId } = await setup();
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["newer"]));
      for (let index = 0; index < 205; index++) {
        const id = await ctx.db.insert("audioArtifacts", {
          kind: "episode",
          role: "delivery",
          metadataStripped: true,
          status: "ready",
          storageId,
          encoding: { codec: "mp3", sampleRate: 48000, channels: 2 },
          normalization: "applied",
          access: "private",
          refs: {},
          title: `Rated ${index}`,
          contentHash: `rated-${index}`,
          createdBy: "system",
          createdAt: 100 + index,
          updatedAt: 100 + index,
        });
        const userId = await ctx.db.insert("users", {
          clerkUserId: `rater-${index}`,
          role: "collaborator",
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("audioRatings", {
          artifactId: id,
          artifactKind: "episode",
          artifactContentHash: `rated-${index}`,
          scores: { overall: 3 },
          createdBy: userId,
          source: "web",
          requestKey: `seed-${index}`,
          createdAt: 1,
        });
      }
    });
    const queue = await human.query(api.audioFeedback.queue, {});
    expect(queue.some((row) => row.artifactId === episodeId)).toBe(false);
    expect(
      await human.query(api.audioFeedback.item, { artifactId: episodeId }),
    ).toMatchObject({ artifactId: episodeId, contentHash: "episode-v1" });
    const card = (await t.query(internal.docket.currentState, {})).find(
      (row) => row.targetId === episodeId,
    );
    expect(card?.pageUrl).toBe(`/listen?audio=${episodeId}`);
    for (const artifactId of [hiddenId, backRefId, "not-an-id"])
      expect(await human.query(api.audioFeedback.item, { artifactId })).toBe(
        null,
      );
    await expect(
      t.query(api.audioFeedback.item, { artifactId: episodeId }),
    ).rejects.toThrow();
  });

  test("zero is kept, absent stays absent, and machine analysis is never a rating", async () => {
    const { t, human, renderId } = await setup();
    const result = await human.mutation(api.audioFeedback.submit, {
      artifactId: renderId,
      contentHash: "render-v1",
      clientRequestId: "request-0001",
      payload: {
        scores: { overall: 0, goosebumps: 4 },
        conditions: { listeningMethod: "headphones", timeOfDay: "evening" },
        notes: "  Thin low end  ",
      },
    });
    expect(result.replayed).toBe(false);
    const row = await t.run((ctx) => ctx.db.get(result.ratingId));
    expect(row).toMatchObject({
      artifactKind: "litmusRender",
      artifactContentHash: "render-v1",
      artifactValidation: "unvalidated",
      scores: { overall: 0, goosebumps: 4 },
      notes: "Thin low end",
      source: "web",
    });
    expect(Object.keys(row!.scores).sort()).toEqual(["goosebumps", "overall"]);
    await expect(
      human.mutation(api.audioFeedback.submit, {
        artifactId: renderId,
        contentHash: "render-v1",
        clientRequestId: "request-0002",
        payload: {
          scores: { overall: 3, consonanceComputed: 0.4 } as never,
        },
      }),
    ).rejects.toThrow();
    // The artifact's measured analysis is untouched by a human rating.
    expect((await t.run((ctx) => ctx.db.get(renderId)))?.analysis).toEqual({
      version: "a1",
      roughnessMedian: 0.2,
    });
  });

  test.each([
    [{ scores: {} }, "Invalid audio rating"],
    [{ scores: { overall: 6 } }, "Invalid audio rating"],
    [{ scores: { overall: Number.NaN } }, "Invalid audio rating"],
    [
      { scores: { overall: 2 }, notes: "x".repeat(4001) },
      "Invalid audio rating",
    ],
    [{ scores: { pacing: 2 } }, "Scores not used for this audio: pacing"],
  ])(
    "rejects unbounded or kind-mismatched payload %#",
    async (payload, error) => {
      const { human, renderId } = await setup();
      await expect(
        human.mutation(api.audioFeedback.submit, {
          artifactId: renderId,
          contentHash: "render-v1",
          clientRequestId: "request-bounds",
          payload,
        }),
      ).rejects.toThrow(error);
    },
  );

  test("submission is idempotent per user request and stale content is refused", async () => {
    const { t, human, episodeId, renderId } = await setup();
    const args = {
      artifactId: episodeId,
      contentHash: "episode-v1",
      clientRequestId: "retry-0001",
      payload: { scores: { clarity: 5 } },
    };
    const first = await human.mutation(api.audioFeedback.submit, args);
    expect(await human.mutation(api.audioFeedback.submit, args)).toEqual({
      ratingId: first.ratingId,
      replayed: true,
    });
    await expect(
      human.mutation(api.audioFeedback.submit, {
        ...args,
        artifactId: renderId,
        contentHash: "render-v1",
        payload: { scores: { overall: 1 } },
      }),
    ).rejects.toThrow("Client request ID was already used");
    // Another person may reuse the same client ID without colliding.
    const other = await t
      .withIdentity({ subject: "someone-else" })
      .mutation(api.audioFeedback.submit, args);
    expect(other.replayed).toBe(false);
    await expect(
      human.mutation(api.audioFeedback.submit, {
        ...args,
        artifactId: renderId,
        contentHash: "render-v0",
        clientRequestId: "stale-0001",
        payload: { scores: { overall: 1 } },
      }),
    ).rejects.toThrow("This audio changed since you opened it");
    expect(
      await t.run((ctx) => ctx.db.query("audioRatings").collect()),
    ).toHaveLength(2);
  });

  test.each(["hiddenId", "backRefId", "pendingId", "takeId"] as const)(
    "refuses %s without revealing it",
    async (key) => {
      const ids = await setup();
      await expect(
        ids.human.mutation(api.audioFeedback.submit, {
          artifactId: ids[key],
          contentHash: "anything",
          clientRequestId: "blind-0001",
          payload: { scores: { overall: 3 } },
        }),
      ).rejects.toThrow("This audio is not available for rating.");
      expect(
        await ids.human.query(api.audioFeedback.forArtifact, {
          artifactId: ids[key],
        }),
      ).toEqual([]);
    },
  );

  test("a rating clears queue and docket debt only for the heard content version", async () => {
    const { t, human, episodeId } = await setup();
    await human.mutation(api.audioFeedback.submit, {
      artifactId: episodeId,
      contentHash: "episode-v1",
      clientRequestId: "clear-0001",
      payload: { scores: {}, notes: "Heard it" },
    });
    expect(
      (await human.query(api.audioFeedback.queue, {})).map((r) => r.title),
    ).toEqual(["Litmus render"]);
    const docket = async () =>
      (await t.query(internal.docket.currentState, {}))
        .filter((row) => row.kind === "unratedAudio")
        .map((row) => row.targetId);
    expect(await docket()).not.toContain(episodeId);
    await t.run((ctx) =>
      ctx.db.patch(episodeId, { contentHash: "episode-v2" }),
    );
    expect(await docket()).toContain(episodeId);
    const history = await human.query(api.audioFeedback.forArtifact, {
      artifactId: episodeId,
    });
    expect(history).toMatchObject([{ current: false, notes: "Heard it" }]);
  });
});

describe("signed audio and recipe decisions", () => {
  const webApply = api.decisionIntents.applyWeb;

  test("rateAudio applies once with signer attribution and leaves voice ratings alone", async () => {
    const { t, human, renderId } = await setup();
    const intent = await t.mutation(api.decisionIntents.propose, {
      secret: "service",
      command: {
        action: "rateAudio",
        target: { kind: "audioArtifact", id: renderId },
        payload: { scores: { overall: 4, musicality: 0 } },
      },
      proposal,
    });
    expect(intent.targetContentHash).toBe("render-v1");
    expect(intent.targetRevision).toBeUndefined();
    const args = {
      intentId: intent._id,
      digest8: intent.payloadDigest.slice(0, 8),
      eventId: "web-rate-1",
    };
    const result = await human.mutation(webApply, args);
    expect(result.status).toBe("applied");
    expect(await human.mutation(webApply, args)).toEqual(result);
    const ratings = await t.run((ctx) =>
      ctx.db.query("audioRatings").collect(),
    );
    expect(ratings).toHaveLength(1);
    expect(ratings[0]).toMatchObject({
      _id: result.appliedRecordId,
      decisionIntentId: intent._id,
      requestKey: `intent:${intent._id}`,
      scores: { overall: 4, musicality: 0 },
      source: "web",
    });
    expect(
      await t.run((ctx) => ctx.db.query("voiceRatings").collect()),
    ).toEqual([]);
  });

  test("audio content change or blind hiding terminally rejects a pending rating", async () => {
    const { t, human, renderId, episodeId, groupId } = await setup();
    const propose = (id: Id<"audioArtifacts">, scores: object) =>
      t.mutation(api.decisionIntents.propose, {
        secret: "service",
        command: {
          action: "rateAudio",
          target: { kind: "audioArtifact", id },
          payload: { scores },
        },
        proposal,
      });
    const changed = await propose(renderId, { overall: 2 });
    await t.run((ctx) => ctx.db.patch(renderId, { contentHash: "render-v2" }));
    expect(
      await human.mutation(webApply, {
        intentId: changed._id,
        digest8: changed.payloadDigest.slice(0, 8),
        eventId: "changed-1",
      }),
    ).toEqual({ status: "rejected", error: "Target changed: content" });
    const hidden = await propose(episodeId, { clarity: 3 });
    await t.run((ctx) => ctx.db.patch(episodeId, { blindGroupId: groupId }));
    expect(
      await human.mutation(webApply, {
        intentId: hidden._id,
        digest8: hidden.payloadDigest.slice(0, 8),
        eventId: "hidden-1",
      }),
    ).toEqual({ status: "rejected", error: "Target changed: unavailable" });
    expect(await t.run((ctx) => ctx.db.get(hidden._id))).toMatchObject({
      status: "rejected",
    });
    expect(
      await t.run((ctx) => ctx.db.query("audioRatings").collect()),
    ).toEqual([]);
  });

  test("proposals refuse unrateable audio and kind-mismatched scores at apply", async () => {
    const { t, human, hiddenId, episodeId } = await setup();
    await expect(
      t.mutation(api.decisionIntents.propose, {
        secret: "service",
        command: {
          action: "rateAudio",
          target: { kind: "audioArtifact", id: hiddenId },
          payload: { scores: { overall: 3 } },
        },
        proposal,
      }),
    ).rejects.toThrow("This audio is not available for rating.");
    const mismatched = await t.mutation(api.decisionIntents.propose, {
      secret: "service",
      command: {
        action: "rateAudio",
        target: { kind: "audioArtifact", id: episodeId },
        payload: { scores: { goosebumps: 3 } },
      },
      proposal,
    });
    expect(
      await human.mutation(webApply, {
        intentId: mismatched._id,
        digest8: mismatched.payloadDigest.slice(0, 8),
        eventId: "mismatch-1",
      }),
    ).toEqual({
      status: "rejected",
      error: "Scores not used for this audio: goosebumps",
    });
  });

  test("recipe deferral is signed, content-checked and only touches the docket card", async () => {
    const { t, human, recipeId } = await setup();
    const cards = await t.mutation(internal.docket.list, {});
    expect(cards.find((row) => row.targetId === recipeId)?.decisions).toEqual([
      "defer",
    ]);
    const defer = () =>
      t.mutation(api.decisionIntents.propose, {
        secret: "service",
        command: {
          action: "defer",
          target: { kind: "recipe", id: recipeId },
          payload: { note: "After the render ladder" },
        },
        proposal,
      });
    const stale = await defer();
    await t.run((ctx) => ctx.db.patch(recipeId, { bodyMd: "Revised" }));
    expect(
      await human.mutation(webApply, {
        intentId: stale._id,
        digest8: stale.payloadDigest.slice(0, 8),
        eventId: "recipe-stale",
      }),
    ).toEqual({ status: "rejected", error: "Target changed: content" });
    for (const [index, patch] of [
      { parameters: [{ kind: "beat", value: "2 Hz" }] },
      { dawChecklist: ["Bounce stems"] },
      { updatedAt: 99 },
    ].entries()) {
      const pending = await defer();
      await t.run((ctx) => ctx.db.patch(recipeId, patch as never));
      expect(
        await human.mutation(webApply, {
          intentId: pending._id,
          digest8: pending.payloadDigest.slice(0, 8),
          eventId: `recipe-field-${index}`,
        }),
      ).toMatchObject(
        index === 2
          ? { status: "applied" }
          : { status: "rejected", error: "Target changed: content" },
      );
      if (index === 2)
        await t.run(async (ctx) => {
          const card = await ctx.db
            .query("docketCards")
            .withIndex("by_targetId", (q) => q.eq("targetId", recipeId))
            .unique();
          await ctx.db.patch(card!._id, { deferredUntil: undefined });
        });
    }
    await t.mutation(internal.docket.list, {});
    const fresh = await defer();
    const before = await t.run((ctx) => ctx.db.get(recipeId));
    const result = await human.mutation(webApply, {
      intentId: fresh._id,
      digest8: fresh.payloadDigest.slice(0, 8),
      eventId: "recipe-fresh",
    });
    expect(result.status).toBe("applied");
    expect(await t.run((ctx) => ctx.db.get(recipeId))).toEqual(before);
    expect(
      (await t.mutation(internal.docket.list, {})).some(
        (row) => row.targetId === recipeId,
      ),
    ).toBe(false);
  });

  test("agent proposal contract accepts rateAudio but not authority or machine fields", () => {
    const command = {
      action: "rateAudio",
      target: { kind: "audioArtifact", id: "artifact" },
      payload: { scores: { overall: 3 } },
    };
    expect(decisionProposeArgsZ.safeParse({ command, proposal }).success).toBe(
      true,
    );
    for (const scores of [
      { overall: 3, consonanceComputed: 1 },
      { overall: 3, roughness: 1 },
    ])
      expect(
        decisionProposeArgsZ.safeParse({
          command: { ...command, payload: { scores } },
          proposal,
        }).success,
      ).toBe(false);
    expect(
      decisionProposeArgsZ.safeParse({
        command: {
          ...command,
          payload: { ...command.payload, createdBy: "someone" },
        },
        proposal,
      }).success,
    ).toBe(false);
  });
});

describe("web docket deferral", () => {
  test("creates and signs one canonical defer intent per click without delivery", async () => {
    const { t, human, episodeId } = await setup();
    const card = (await human.query(api.docket.listWeb, {})).find(
      (row) => row.targetId === episodeId,
    );
    expect(card?.decisions).toEqual(["rateAudio", "defer"]);
    const args = {
      targetId: episodeId,
      contentHash: card!.contentHash,
      eventId: "defer-click-1",
      note: "Next week",
    };
    await expect(
      t
        .withIdentity({ subject: "system" })
        .mutation(api.decisionIntents.deferWeb, args),
    ).rejects.toThrow("Human authentication required");
    const result = await human.mutation(api.decisionIntents.deferWeb, args);
    expect(result.status).toBe("applied");
    expect(await human.mutation(api.decisionIntents.deferWeb, args)).toEqual(
      result,
    );
    const intents = await t.run((ctx) =>
      ctx.db.query("decisionIntents").collect(),
    );
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      action: "defer",
      target: { kind: "audioArtifact", id: episodeId },
      targetContentHash: "episode-v1",
      payload: { note: "Next week" },
      proposal: { channel: "web", transcript: "Next week" },
      signature: { source: "web" },
      status: "applied",
    });
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
      ),
    ).toEqual([]);
    expect(
      (await human.query(api.audioFeedback.queue, {})).map((r) => r.artifactId),
    ).not.toContain(episodeId);
    expect(
      (await human.query(api.docket.listWeb, {})).some(
        (row) => row.targetId === episodeId,
      ),
    ).toBe(false);
  });

  test("a stale or ineligible card is refused without consuming the click", async () => {
    const { t, human, renderId } = await setup();
    const card = (await human.query(api.docket.listWeb, {})).find(
      (row) => row.targetId === renderId,
    );
    const args = {
      targetId: renderId,
      contentHash: card!.contentHash,
      eventId: "defer-stale-1",
    };
    await t.run((ctx) => ctx.db.patch(renderId, { title: "Renamed" }));
    await expect(
      human.mutation(api.decisionIntents.deferWeb, args),
    ).rejects.toThrow("Docket card changed or is no longer eligible");
    await expect(
      human.mutation(api.decisionIntents.deferWeb, {
        ...args,
        eventId: "bad id with spaces",
      }),
    ).rejects.toThrow("Invalid event ID");
    expect(
      await t.run((ctx) => ctx.db.query("decisionIntents").collect()),
    ).toEqual([]);
    const fresh = (await human.query(api.docket.listWeb, {})).find(
      (row) => row.targetId === renderId,
    );
    expect(
      await human.mutation(api.decisionIntents.deferWeb, {
        ...args,
        contentHash: fresh!.contentHash,
      }),
    ).toMatchObject({ status: "applied" });
  });
});
