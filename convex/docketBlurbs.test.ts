import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import {
  DOCKET_REBUILD_KEY,
  markDocketStale,
  attachDocketNarration,
} from "./docket";
import { generateLlmText } from "./llmNode";
import { DEFAULT_MODEL, modelForTask, TOKEN_BUDGETS } from "./llm";
import {
  anthropicReasoningEffort,
  isDirectAnthropicModel,
} from "./shared/llmPolicy";
import {
  DOCKET_REBUILD_MS,
  DOCKET_REBUILD_LEASE_MS,
  docketBlurbZ,
} from "./shared/docket";
import { readSetting, writeSetting, HOUSE_VOICE_KEY } from "./settings";
import schema from "./schema";

vi.mock("./llmNode", () => ({ generateLlmText: vi.fn() }));
const generated =
  "This draft asks whether a focused listening experiment can clarify the proposed musical relationship. Review the source context and the proposal before deciding what should happen next. A human review can reject the draft, replace it with another draft, or defer it for later attention. No decision has been made yet, and the next step remains yours to choose after reading the available evidence.";
const blurb = { blurbMd: generated, spokenBlurb: generated };
const testModules = {
  ...modules,
  "./docketBlurbs.ts": () => import("./docketBlurbs"),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("DOCKET_PREPARATION_ENABLED", "true");
  vi.mocked(generateLlmText)
    .mockReset()
    .mockResolvedValue({ text: JSON.stringify(blurb) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function setup() {
  const t = convexTest(schema, testModules);
  const draftId = await t.run(async (ctx) => {
    const agentRunId = await ctx.db.insert("agentRuns", {
      graphName: "test",
      status: "needs_review",
      input: null,
      createdAt: 1,
      updatedAt: 1,
    });
    return ctx.db.insert("agentReviewDrafts", {
      agentRunId,
      graphName: "test",
      kind: "hypothesis_draft",
      title: "Review experiment",
      summary: "Usable source text",
      candidateIds: [],
      status: "pending_review",
      createdBy: "agent",
      createdAt: 1,
      updatedAt: 1,
    });
  });
  return { t, draftId };
}
async function state(t: ReturnType<typeof convexTest>) {
  return JSON.parse(
    (await t.run((ctx) => readSetting(ctx, DOCKET_REBUILD_KEY)))!,
  );
}
async function flush(t: ReturnType<typeof convexTest>) {
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
}

test("bounded docket task uses the direct Sonnet adaptive medium policy", () => {
  expect(modelForTask("docket_blurb_v1")).toBe(DEFAULT_MODEL);
  expect(isDirectAnthropicModel(modelForTask("docket_blurb_v1"))).toBe(true);
  expect(anthropicReasoningEffort(modelForTask("docket_blurb_v1"))).toBe(
    "medium",
  );
  expect(TOKEN_BUDGETS.docket_blurb_v1).toBe(1500);
  expect(docketBlurbZ.parse(blurb)).toEqual(blurb);
  for (const count of [59, 91])
    expect(
      docketBlurbZ.safeParse({
        ...blurb,
        blurbMd: Array(count).fill("word").join(" "),
      }).success,
    ).toBe(false);
  for (const suffix of [
    " https://example.com",
    " abcdefghijklmnopqrstuvwxyz123456",
    " [a](url)",
  ])
    expect(
      docketBlurbZ.safeParse({ ...blurb, spokenBlurb: generated + suffix })
        .success,
    ).toBe(false);
});

test("activation is off by default; source text needs neither inference nor voice", async () => {
  vi.stubEnv("DOCKET_PREPARATION_ENABLED", "");
  const { t } = await setup();
  expect((await t.mutation(internal.docket.list, {}))[0]?.blurbMd).toBe(
    "Usable source text",
  );
  expect(await t.mutation(internal.docket.prepare, {})).toBe(false);
  await flush(t);
  expect(generateLlmText).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.query("mediaJobs").collect())).toEqual([]);
});

test("concurrent requests admit once; hourly and stale rebuilds retain generated copy", async () => {
  const { t } = await setup();
  const [cards] = await Promise.all([
    t.mutation(internal.docket.list, {}),
    t.mutation(internal.docket.list, {}),
  ]);
  expect(cards[0]?.spokenBlurb).toBe("");
  expect((await state(t)).token).toBe(1);
  await flush(t);
  expect(generateLlmText).toHaveBeenCalledTimes(1);
  expect((await t.mutation(internal.docket.list, {}))[0]).toMatchObject(blurb);
  expect(await t.mutation(internal.docket.prepare, {})).toBe(false);
  vi.setSystemTime((await state(t)).completedAt + DOCKET_REBUILD_MS);
  expect(await t.mutation(internal.docket.prepare, {})).toBe(true);
  await flush(t);
  await t.run(markDocketStale);
  expect(await t.mutation(internal.docket.prepare, {})).toBe(true);
  await flush(t);
  expect(generateLlmText).toHaveBeenCalledTimes(1);
});

test("inference failure leaves usable text and does not repeat paid attempts for unchanged content", async () => {
  const { t, draftId } = await setup();
  vi.mocked(generateLlmText).mockRejectedValueOnce(new Error("offline"));
  const [card] = await t.mutation(internal.docket.list, {});
  await flush(t);
  expect(
    await t.query(internal.docket.card, { cardId: card!._id }),
  ).toMatchObject({ blurbMd: "Usable source text", spokenBlurb: "" });
  vi.setSystemTime((await state(t)).completedAt + DOCKET_REBUILD_MS);
  await t.mutation(internal.docket.prepare, {});
  await flush(t);
  expect(generateLlmText).toHaveBeenCalledTimes(1);
  await t.run((ctx) =>
    ctx.db.patch(draftId, { summary: "New semantic source" }),
  );
  await t.mutation(internal.docket.list, {});
  await flush(t);
  expect(generateLlmText).toHaveBeenCalledTimes(2);
});

test("save fences edits and expired owners; invalidation during a rebuild survives completion", async () => {
  const { t, draftId } = await setup();
  const [card] = await t.mutation(internal.docket.list, {});
  const version = {
    token: 1,
    cardId: card!._id,
    contentHash: card!.contentHash,
  };
  await t.run(async (ctx) => {
    await ctx.db.patch(draftId, { summary: "Changed during inference" });
    await markDocketStale(ctx);
  });
  expect(
    await t.mutation(internal.docket.saveBlurb, { ...version, blurb }),
  ).toBe(false);
  await t.mutation(internal.docket.finishRebuild, { token: 1 });
  expect(await t.mutation(internal.docket.prepare, {})).toBe(true);
  vi.setSystemTime((await state(t)).startedAt + DOCKET_REBUILD_LEASE_MS);
  const latest = (await t.mutation(internal.docket.list, {}))[0]!;
  expect((await state(t)).token).toBe(3);
  expect(
    await t.mutation(internal.docket.saveBlurb, {
      token: 2,
      cardId: latest._id,
      contentHash: latest.contentHash,
      blurb,
    }),
  ).toBe(false);
  await flush(t);
});

test("rank-only changes preserve blurbs and selecting a voice later queues private narration once", async () => {
  const { t } = await setup();
  await t.mutation(internal.docket.list, {});
  await flush(t);
  const [card] = await t.mutation(internal.docket.list, {});
  await t.run(async (ctx) => {
    await ctx.db.patch(card!._id, { rank: 5 });
    await writeSetting(ctx, HOUSE_VOICE_KEY, "inworld-max");
    await markDocketStale(ctx);
  });
  expect((await t.mutation(internal.docket.list, {}))[0]).toMatchObject({
    ...blurb,
    rank: 0,
  });
  await flush(t);
  const jobs = await t.run((ctx) => ctx.db.query("mediaJobs").collect());
  expect(jobs).toHaveLength(1);
  expect(jobs[0]?.input).toMatchObject({
    kind: "narrate",
    access: "private",
    voiceId: "inworld-max",
    refs: { docketCardId: card!._id },
    assembleOnDone: false,
    script: { paragraphs: [generated] },
  });
  await t.run(markDocketStale);
  await t.mutation(internal.docket.prepare, {});
  await flush(t);
  expect(
    await t.run((ctx) => ctx.db.query("mediaJobs").collect()),
  ).toHaveLength(1);
  expect(generateLlmText).toHaveBeenCalledTimes(1);
});

test("narration enqueue failure preserves generated text", async () => {
  const { t } = await setup();
  await t.run((ctx) => writeSetting(ctx, HOUSE_VOICE_KEY, "unknown-voice"));
  const [card] = await t.mutation(internal.docket.list, {});
  await flush(t);
  expect(
    await t.query(internal.docket.card, { cardId: card!._id }),
  ).toMatchObject(blurb);
  expect(
    await t.run((ctx) => ctx.db.query("mediaJobs").collect()),
  ).toHaveLength(0);
});

async function narrationFixture() {
  const { t, draftId } = await setup();
  await t.run((ctx) => writeSetting(ctx, HOUSE_VOICE_KEY, "inworld-max"));
  const [card] = await t.mutation(internal.docket.list, {});
  await flush(t);
  const job = (await t.run((ctx) => ctx.db.query("mediaJobs").collect()))[0]!;
  const deliveryId = await t.run((ctx) =>
    ctx.db.insert("audioArtifacts", {
      kind: "narration",
      role: "delivery",
      status: "ready",
      metadataStripped: true,
      encoding: { codec: "mp3", sampleRate: 48000, channels: 2 },
      normalization: "applied",
      access: "private",
      title: "Docket narration",
      refs: { docketCardId: card!._id, mediaJobId: job._id },
      contentHash: "audio",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const attach = () =>
    t.run(async (ctx) => {
      const delivery = (await ctx.db.get(deliveryId))!;
      await attachDocketNarration(ctx, job, delivery);
    });
  return { t, card: card!, job, deliveryId, attach, draftId };
}

test("completion attaches current private narration, never creates listening feedback", async () => {
  const { t, card, deliveryId, attach } = await narrationFixture();
  await attach();
  expect(
    await t.query(internal.docket.card, { cardId: card._id }),
  ).toMatchObject({ blurbArtifactId: deliveryId });
  expect(
    await t.run((ctx) => ctx.db.query("listeningSessions").collect()),
  ).toHaveLength(0);
});

test.each(["edited", "deferred", "resolved", "voiceChanged", "hidden"])(
  "completion withholds %s narration",
  async (reason) => {
    const { t, card, deliveryId, attach, draftId } = await narrationFixture();
    await t.run(async (ctx) => {
      if (reason === "edited")
        await ctx.db.patch(draftId, { summary: "Updated before completion" });
      if (reason === "deferred")
        await ctx.db.patch(card._id, { deferredUntil: Date.now() + 10000 });
      if (reason === "resolved")
        await ctx.db.patch(draftId, { status: "rejected" });
      if (reason === "voiceChanged")
        await writeSetting(ctx, HOUSE_VOICE_KEY, "gemini-kore");
      if (reason === "hidden")
        await ctx.db.insert("blindGroups", {
          purpose: "voiceShootout",
          members: [{ memberId: "A", artifactId: deliveryId, label: "Take A" }],
          requiredRatings: ["overall"],
          createdAt: 1,
        });
    });
    await attach();
    expect(
      (await t.run((ctx) => ctx.db.get(card._id)))?.blurbArtifactId,
    ).toBeUndefined();
  },
);

test("completion rejects foreign or public artifacts", async () => {
  const { t, deliveryId, attach } = await narrationFixture();
  await t.run((ctx) => ctx.db.patch(deliveryId, { access: "feed" }));
  await expect(attach()).rejects.toThrow("Invalid docket narration");
});

test("media completion attaches its ready delivery and invalidates the docket without episode assembly", async () => {
  const { t, job, card, deliveryId } = await narrationFixture();
  const claim = await t.mutation(internal.mediaJobs.claimNext, {
    workerId: "mock-worker",
    kinds: ["narrate"],
  });
  const masterId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["mock audio"]));
    const delivery = (await ctx.db.get(deliveryId))!;
    const { _id, _creationTime, ...fields } = delivery;
    const masterId = await ctx.db.insert("audioArtifacts", {
      ...fields,
      role: "masterNormalized",
      status: "pending",
      storageId,
      encoding: { codec: "wav", sampleRate: 48000, channels: 1 },
    });
    await ctx.db.patch(deliveryId, {
      status: "pending",
      masterArtifactId: masterId,
      storageId,
    });
    return masterId;
  });
  const before = await state(t);
  const measurements = {
    durationSecs: 25,
    loudnessLufs: -16,
    truePeakDbtp: -1.5,
  };
  await t.mutation(internal.mediaJobs.complete, {
    jobId: job._id,
    leaseToken: claim!.leaseToken,
    result: {
      kind: "narrate",
      artifacts: [
        { ...measurements, artifactId: masterId, mimeType: "audio/wav" },
        { ...measurements, artifactId: deliveryId, mimeType: "audio/mpeg" },
      ],
      chapters: [{ title: "Docket card", startSecs: 0 }],
    },
  });
  expect(
    (await t.query(internal.docket.card, { cardId: card._id }))
      ?.blurbArtifactId,
  ).toBe(deliveryId);
  expect((await state(t)).revision).toBe(before.revision + 1);
  expect(
    await t.run((ctx) => ctx.db.query("mediaJobs").collect()),
  ).toHaveLength(1);
  expect(
    await t.run((ctx) => ctx.db.query("listeningSessions").collect()),
  ).toHaveLength(0);
});

test("a blurb put into an unrevealed blind group later is withheld on list and card reads", async () => {
  const { t, card, deliveryId, attach } = await narrationFixture();
  await attach();
  await t.run((ctx) =>
    ctx.db.insert("blindGroups", {
      purpose: "voiceShootout",
      members: [{ memberId: "A", artifactId: deliveryId, label: "Take A" }],
      requiredRatings: ["overall"],
      createdAt: 1,
    }),
  );
  expect(
    (await t.query(internal.docket.card, { cardId: card._id }))
      ?.blurbArtifactId,
  ).toBeUndefined();
  expect(
    (await t.mutation(internal.docket.list, {}))[0]?.blurbArtifactId,
  ).toBeUndefined();
});
