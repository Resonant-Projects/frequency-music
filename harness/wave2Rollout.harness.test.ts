import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import type { DecisionEvent } from "../convex/shared/decisionIntents";
import { DECISION_TTL_MS } from "../convex/shared/decisionIntents";
import {
  backfillOutcome,
  initialBackfillState,
  runRevisionBackfill,
} from "../scripts/lib/wave2-rollout";
import { modules } from "./modules";

// Local fixture rehearsal of the post-deployment acceptance sequence in
// docs/wave2-rollout-packet.md. It is not evidence of live acceptance.
const SECRET = "local-rehearsal-secret";
const proposeDecision = makeFunctionReference<"action">(
  "agentTools:proposeDecision",
);
const proposal = (messageRef: string) => ({
  channel: "telegram",
  conversationId: "rehearsal-chat",
  messageRef,
  transcript: "Reject it; the premise is unsupported.",
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("AGENT_TOOL_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function seed() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: "keith",
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
    // Legacy rows: no `revision`, as before the Wave 2 deployment.
    const draft = (title: string) =>
      ctx.db.insert("agentReviewDrafts", {
        agentRunId: runId,
        graphName: "test",
        kind: "hypothesis_draft",
        title,
        summary: "Summary",
        candidateIds: [],
        status: "pending_review",
        createdBy: "agent",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    return {
      userId,
      signed: await draft("Signed rejection"),
      expiring: await draft("Expiring rejection"),
      web: await draft("Web rejection"),
    };
  });
  vi.stubEnv(
    "DECISION_SIGNERS",
    JSON.stringify({ "telegram:keith-telegram": ids.userId }),
  );
  return { t, ...ids };
}

async function proposeReject(
  t: ReturnType<typeof convexTest>,
  draftId: Id<"agentReviewDrafts">,
  messageRef: string,
) {
  const result = await t.action(proposeDecision, {
    agentSecret: SECRET,
    command: {
      action: "reject",
      target: { kind: "agentReviewDraft", id: draftId },
      payload: { note: "Unsupported premise" },
    },
    proposal: proposal(messageRef),
  });
  expect(result).toMatchObject({ status: "proposed" });
  const intent = await t.query(internal.decisionIntents.getInternal, {
    intentId: result.intentId,
  });
  if (!intent) throw new Error("Missing intent");
  return intent;
}

test("rehearses backfill, docket receipts, signed and web confirmation, replay and expiry", async () => {
  const { t, userId, signed, expiring, web } = await seed();

  // 1. Revision backfill, then a verification pass with zero updates.
  const backfill = await runRevisionBackfill({
    state: initialBackfillState("https://convex.resonantprojects.art", 2),
    call: (args) =>
      t.mutation(internal.decisionIntentsMigrations.backfillRevisions, args),
    checkpoint: () => {},
  });
  expect(backfillOutcome(backfill)).toMatchObject({
    complete: true,
    verified: true,
    tables: { agentReviewDrafts: { backfilled: 3, verifyUpdated: 0 } },
  });

  // 2. Docket text card and an at-most-once delivery receipt.
  const cards = await t.mutation(internal.docket.list, {});
  const card = cards.find((row) => row.targetId === signed);
  if (!card) throw new Error("Missing docket card");
  const delivery = {
    cardId: card._id,
    channel: "telegram:rehearsal-chat",
    contentHash: card.contentHash,
    phase: "posting" as const,
  };
  const reserved = await t.mutation(internal.docket.recordDelivery, delivery);
  expect(reserved.admitted).toBe(true);
  await t.mutation(internal.docket.recordDelivery, {
    ...delivery,
    phase: "posted",
    deliveryId: reserved.deliveryId,
    messageRef: "message-1",
  });
  expect(
    await t.mutation(internal.docket.recordDelivery, delivery),
  ).toMatchObject({ admitted: false, deliveryId: reserved.deliveryId });

  // 3. Agent proposal has no domain effect.
  const intent = await proposeReject(t, signed, "voice-1");
  expect(intent.targetRevision).toBe(0);
  expect(await t.run((ctx) => ctx.db.get(signed))).toMatchObject({
    status: "pending_review",
    revision: 0,
  });

  // 4. Verified signer confirmation after a card binding.
  await t.mutation(internal.decisionIntents.bindSignerCard, {
    intentId: intent._id,
    signerCard: {
      platform: "telegram",
      chatId: "rehearsal-chat",
      messageId: "card-1",
    },
  });
  const event: DecisionEvent = {
    intentId: intent._id,
    platform: "telegram",
    chatId: "rehearsal-chat",
    messageId: "card-1",
    signerId: "keith-telegram",
    eventId: "callback-1",
    verb: "confirm",
    digest8: intent.payloadDigest.slice(0, 8),
  };
  const applied = await t.mutation(internal.decisionIntents.apply, { event });
  expect(applied).toMatchObject({ status: "applied" });
  expect(await t.run((ctx) => ctx.db.get(signed))).toMatchObject({
    status: "rejected",
    revision: 1,
    decisionSource: "telegram",
    decisionIntentId: intent._id,
  });

  // 5. Replay and a new event both return the saved result without a second write.
  expect(await t.mutation(internal.decisionIntents.apply, { event })).toEqual(
    applied,
  );
  expect(
    await t.mutation(internal.decisionIntents.apply, {
      event: { ...event, eventId: "callback-2" },
    }),
  ).toEqual(applied);
  expect(await t.run((ctx) => ctx.db.get(signed))).toMatchObject({
    revision: 1,
  });

  // 6. The decided draft leaves the docket.
  expect(
    (await t.mutation(internal.docket.list, {})).some(
      (row) => row.targetId === signed,
    ),
  ).toBe(false);

  // 7. Expiry terminates an unsigned proposal and leaves the target untouched.
  const stale = await proposeReject(t, expiring, "voice-2");
  await t.mutation(internal.decisionIntents.bindSignerCard, {
    intentId: stale._id,
    signerCard: {
      platform: "telegram",
      chatId: "rehearsal-chat",
      messageId: "card-2",
    },
  });
  vi.setSystemTime(Date.now() + DECISION_TTL_MS + 1);
  const expiredEvent = {
    ...event,
    intentId: stale._id,
    messageId: "card-2",
    eventId: "callback-3",
    digest8: stale.payloadDigest.slice(0, 8),
  };
  const expired = await t.mutation(internal.decisionIntents.apply, {
    event: expiredEvent,
  });
  expect(expired).toMatchObject({ status: "expired" });
  expect(
    await t.mutation(internal.decisionIntents.apply, { event: expiredEvent }),
  ).toEqual(expired);
  expect(await t.run((ctx) => ctx.db.get(expiring))).toMatchObject({
    status: "pending_review",
    revision: 0,
  });

  // 8. Web fallback: a wrong digest does not consume the proposal; replay is stable.
  const fallback = await proposeReject(t, web, "voice-3");
  const human = t.withIdentity({ subject: "keith" });
  expect(
    await human.mutation(api.decisionIntents.applyWeb, {
      intentId: fallback._id,
      digest8: "00000000",
      eventId: "click-1",
    }),
  ).toMatchObject({ status: "rejected" });
  const webArgs = {
    intentId: fallback._id,
    digest8: fallback.payloadDigest.slice(0, 8),
    eventId: "click-2",
  };
  const webResult = await human.mutation(api.decisionIntents.applyWeb, webArgs);
  expect(webResult).toMatchObject({ status: "applied" });
  expect(await human.mutation(api.decisionIntents.applyWeb, webArgs)).toEqual(
    webResult,
  );
  expect(await t.run((ctx) => ctx.db.get(web))).toMatchObject({
    status: "rejected",
    revision: 1,
    decisionSource: "web",
  });

  // One receipt per distinct platform/web event; replays add none.
  const receipts = await t.run((ctx) =>
    ctx.db.query("webhookEvents").collect(),
  );
  expect(
    Object.fromEntries(receipts.map((row) => [row.eventId, row.result.status])),
  ).toEqual({
    "callback-1": "applied",
    "callback-2": "applied",
    "callback-3": "expired",
    [`${userId}:click-1`]: "rejected",
    [`${userId}:click-2`]: "applied",
  });
  expect(receipts).toHaveLength(5);
  expect(await t.run((ctx) => ctx.db.get(fallback._id))).toMatchObject({
    status: "applied",
    signature: { userId },
  });
});
