import { convexTest } from "convex-test";
import { beforeEach, afterEach, expect, test, vi } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "../harness/modules";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("AGENT_TOOL_SECRET", "service");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: "human",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    const runId = await ctx.db.insert("agentRuns", {
      graphName: "test",
      status: "needs_review",
      input: null,
      createdAt: 1,
      updatedAt: 1,
    });
    const draftId = await ctx.db.insert("agentReviewDrafts", {
      agentRunId: runId,
      graphName: "test",
      kind: "hypothesis_draft",
      title: "Pending draft",
      summary: "Draft context",
      candidateIds: [],
      status: "pending_review",
      createdBy: "agent",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
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
    const composedRecipeId = await ctx.db.insert("recipes", {
      hypothesisId,
      title: "Composed recipe",
      bodyMd: "Protocol",
      parameters: [],
      dawChecklist: [],
      status: "in_use",
      visibility: "private",
      createdBy: "system",
      createdAt: 2,
      updatedAt: 2,
    });
    const compositionId = await ctx.db.insert("compositions", {
      recipeId: composedRecipeId,
      title: "Listening debt",
      artifactType: "microStudy",
      version: "v1",
      status: "rendered",
      visibility: "private",
      createdBy: "system",
      createdAt: 2,
      updatedAt: 2,
    });
    await ctx.db.insert("listeningSessions", {
      compositionId,
      participants: [{ role: "machine" }],
      ratings: {},
      feedbackMd: "Machine analysis",
      visibility: "private",
      createdBy: "system",
      createdAt: 3,
    });
    const feedId = await ctx.db.insert("feeds", {
      name: "Proposed feed",
      url: "https://example.com",
      type: "rss",
      enabled: false,
      metadata: {
        proposal: { agentRunId: runId, rationale: "Useful", sampleItems: [] },
      },
      createdAt: 4,
      updatedAt: 4,
    });
    await ctx.db.insert("feeds", {
      name: "Not a proposal",
      url: "https://example.com/ordinary",
      type: "rss",
      enabled: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const audio = {
      kind: "episode" as const,
      role: "delivery" as const,
      metadataStripped: true,
      status: "ready" as const,
      encoding: { codec: "mp3" as const, sampleRate: 48000, channels: 2 },
      normalization: "applied" as const,
      access: "private" as const,
      title: "Audio debt",
      refs: {},
      contentHash: "audio",
      createdBy: "system" as const,
      createdAt: 5,
      updatedAt: 5,
    };
    const audioId = await ctx.db.insert("audioArtifacts", audio);
    const hiddenId = await ctx.db.insert("audioArtifacts", {
      ...audio,
      title: "Secret blind title",
    });
    await ctx.db.insert("blindGroups", {
      purpose: "voiceShootout",
      members: [
        { memberId: "A", artifactId: hiddenId, label: "Secret engine" },
      ],
      requiredRatings: ["overall"],
      createdAt: 1,
    });
    return {
      userId,
      draftId,
      recipeId,
      compositionId,
      feedId,
      audioId,
      hiddenId,
    };
  });
  return { t, ...ids };
}

test("all five kinds, no age truncation, human/machine distinction, blind membership and ranking", async () => {
  const { t, draftId, compositionId, userId, hiddenId } = await setup();
  const state = await t.query(internal.docket.currentState, {});
  expect(state.map((row) => row.kind)).toEqual([
    "pendingDraft",
    "recipeNoComposition",
    "compositionNoListening",
    "feedProposal",
    "unratedAudio",
  ]);
  expect(state[0]?.targetId).toBe(draftId);
  expect(state.some((row) => row.targetId === hiddenId)).toBe(false);
  expect(new Set(state.map((row) => row.targetId)).size).toBe(state.length);
  await t.run((ctx) =>
    ctx.db.insert("listeningSessions", {
      compositionId,
      participants: [{ role: "self" }],
      ratings: {},
      feedbackMd: "Human response",
      visibility: "private",
      createdBy: userId,
      createdAt: Date.now(),
    }),
  );
  expect(
    (await t.query(internal.docket.currentState, {})).some(
      (row) => row.targetId === compositionId,
    ),
  ).toBe(false);
  expect(await t.mutation(internal.docket.list, { weekly: true })).toHaveLength(
    3,
  );
});

test("confirmed deferral changes only docket data and survives rebuilds", async () => {
  const { t, draftId } = await setup();
  const cards = await t.mutation(internal.docket.list, {});
  const card = cards.find((row) => row.targetId === draftId);
  if (!card) throw new Error("Missing card");
  const proposal = {
    channel: "web",
    conversationId: "conversation",
    messageRef: "message",
    transcript: "Defer for two weeks",
  };
  const intent = await t.mutation(api.decisionIntents.propose, {
    secret: "service",
    command: {
      action: "defer",
      target: { kind: "agentReviewDraft", id: draftId },
      payload: {},
    },
    proposal,
  });
  expect(
    (await t.mutation(internal.docket.list, {})).some(
      (row) => row.targetId === draftId,
    ),
  ).toBe(true);
  expect(
    await t
      .withIdentity({ subject: "human" })
      .mutation(api.decisionIntents.applyWeb, {
        intentId: intent._id,
        digest8: intent.payloadDigest.slice(0, 8),
        eventId: "defer",
      }),
  ).toMatchObject({ status: "applied", appliedRecordId: card._id });
  expect(
    (await t.mutation(internal.docket.list, {})).some(
      (row) => row.targetId === draftId,
    ),
  ).toBe(false);
  expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
    status: "pending_review",
  });
  vi.setSystemTime(Date.now() + 14 * 86400000);
  expect(
    (await t.mutation(internal.docket.list, {})).some(
      (row) => row.targetId === draftId,
    ),
  ).toBe(true);
});

test("delivery admission suppresses crashes, admits changed content and binds completion", async () => {
  const { t, draftId } = await setup();
  const [card] = await t.mutation(internal.docket.list, {});
  if (!card) throw new Error("Missing card");
  const args = {
    cardId: card._id,
    channel: "telegram:chat",
    contentHash: card.contentHash,
    phase: "posting" as const,
  };
  const first = await t.mutation(internal.docket.recordDelivery, args);
  expect(first.admitted).toBe(true);
  const duplicate = await t.mutation(internal.docket.recordDelivery, args);
  expect(duplicate).toMatchObject({
    admitted: false,
    deliveryId: first.deliveryId,
  });
  await expect(
    t.mutation(internal.docket.recordDelivery, {
      ...args,
      phase: "posted",
      messageRef: "message",
    }),
  ).rejects.toThrow("Posting receipt");
  await t.mutation(internal.docket.recordDelivery, {
    ...args,
    phase: "posted",
    deliveryId: first.deliveryId,
    messageRef: "message",
  });
  vi.setSystemTime(Date.now() + 2 * 86400000);
  expect(
    (await t.mutation(internal.docket.recordDelivery, args)).admitted,
  ).toBe(false);
  await t.run((ctx) =>
    ctx.db.patch(draftId, { summary: "Updated context", revision: 1 }),
  );
  const [changed] = await t.mutation(internal.docket.list, {});
  if (!changed) throw new Error("Missing changed card");
  expect(changed._id).toBe(card._id);
  expect(changed.contentHash).not.toBe(card.contentHash);
  await expect(
    t.mutation(internal.docket.recordDelivery, args),
  ).rejects.toThrow("changed");
  const changedArgs = { ...args, contentHash: changed.contentHash };
  const updated = await t.mutation(internal.docket.recordDelivery, changedArgs);
  expect(updated).toMatchObject({ admitted: true, updated: true });
  expect(
    (await t.mutation(internal.docket.recordDelivery, changedArgs)).admitted,
  ).toBe(false);
  vi.setSystemTime(Date.now() + 86400000);
  expect(
    (await t.mutation(internal.docket.recordDelivery, changedArgs)).admitted,
  ).toBe(true);
});

test("direct card reads refresh edited recipe and composition content without a list call", async () => {
  const { t, recipeId, compositionId } = await setup();
  const cards = await t.mutation(internal.docket.list, {});
  for (const targetId of [recipeId, compositionId]) {
    const card = cards.find((row) => row.targetId === targetId)!;
    await t.run(async (ctx) => {
      await ctx.db.patch(card._id, {
        blurbMd: "Old generated copy",
        spokenBlurb: "Old spoken copy",
      });
      if (targetId === recipeId)
        await ctx.db.patch(recipeId, {
          title: "Edited recipe",
          bodyMd: "Edited protocol",
        });
      else
        await ctx.db.patch(compositionId, {
          title: "Edited composition",
          projectNotesMd: "Edited notes",
        });
    });
    const fresh = await t.query(internal.docket.card, { cardId: card._id });
    expect(fresh?.contentHash).not.toBe(card.contentHash);
    expect(fresh?.blurbMd).toBe(
      targetId === recipeId ? "Edited protocol" : "Edited notes",
    );
    expect(fresh?.spokenBlurb).toBe("");
    expect(fresh?.blurbArtifactId).toBeUndefined();
    expect(fresh?._id).toBe(card._id);
  }
});
