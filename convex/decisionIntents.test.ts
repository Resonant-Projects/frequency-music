import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { internalAction, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { modules } from "../harness/modules";
import type {
  DecisionCommand,
  DecisionEvent,
  DecisionResult,
} from "./shared/decisionIntents";

const proposal = {
  channel: "telegram",
  conversationId: "chat",
  messageRef: "voice-1",
  transcript: "Please reject this because the premise is unsupported.",
};
const propose = makeFunctionReference<
  "mutation",
  { secret: string; command: DecisionCommand; proposal: typeof proposal },
  Doc<"decisionIntents">
>("decisionIntents:propose");
const apply = makeFunctionReference<
  "mutation",
  { event: DecisionEvent },
  DecisionResult
>("decisionIntents:apply");
const bind = makeFunctionReference<
  "mutation",
  {
    intentId: Id<"decisionIntents">;
    signerCard: { platform: "telegram"; chatId: string; messageId: string };
  },
  null
>("decisionIntents:bindSignerCard");
const webApply = makeFunctionReference<
  "mutation",
  { intentId: Id<"decisionIntents">; digest8: string; eventId: string },
  DecisionResult
>("decisionIntents:applyWeb");
const migrate = makeFunctionReference<
  "mutation",
  {
    table: "feeds" | "agentReviewDrafts";
    cursor: string | null;
    batchSize?: number;
  },
  { cursor: string; done: boolean; updated: number }
>("decisionIntentsMigrations:backfillRevisions");
async function setup(testModules = modules) {
  const t = convexTest(schema, testModules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: "human",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    const runId = await ctx.db.insert("agentRuns", {
      graphName: "research-pipeline",
      status: "needs_review",
      input: null,
      createdAt: 1,
      updatedAt: 1,
    });
    const draftId = await ctx.db.insert("agentReviewDrafts", {
      agentRunId: runId,
      graphName: "research-pipeline",
      kind: "hypothesis_draft",
      title: "Draft",
      summary: "Summary",
      candidateIds: [],
      status: "pending_review",
      createdBy: "agent",
      createdAt: 1,
      updatedAt: 1,
    });
    return { userId, runId, draftId };
  });
  vi.stubEnv(
    "DECISION_SIGNERS",
    JSON.stringify({ "telegram:signer": ids.userId }),
  );
  const intent = await t.mutation(propose, {
    secret: "service",
    command: {
      action: "reject",
      target: { kind: "agentReviewDraft", id: ids.draftId },
      payload: { note: "Unsupported premise" },
    },
    proposal,
  });
  await t.mutation(bind, {
    intentId: intent._id,
    signerCard: { platform: "telegram", chatId: "chat", messageId: "card" },
  });
  const event: DecisionEvent = {
    intentId: intent._id,
    platform: "telegram",
    chatId: "chat",
    messageId: "card",
    signerId: "signer",
    eventId: "event-1",
    verb: "confirm",
    digest8: intent.payloadDigest.slice(0, 8),
  };
  return { t, ...ids, intent, event };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("AGENT_TOOL_SECRET", "service");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("immutable human decision application", () => {
  test("proposal has no domain effect; signed reject preserves transcript, increments revision and reconciles run", async () => {
    const { t, intent, event, draftId, runId } = await setup();
    expect(intent.code).toBe("D-1");
    expect(intent.expiresAt - intent.createdAt).toBe(1800000);
    expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
      status: "pending_review",
    });
    const result = await t.mutation(apply, { event });
    expect(result).toEqual({ status: "applied", appliedRecordId: draftId });
    expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
      status: "rejected",
      revision: 1,
      decidedBy: "human",
      decisionSource: "telegram",
      decisionTranscript: proposal.transcript,
      decisionIntentId: intent._id,
    });
    expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({
      status: "completed",
    });
    expect(
      await t.mutation(apply, {
        event: { ...event, signerId: "changed", digest8: "invalid" },
      }),
    ).toEqual(result);
    expect(
      await t.mutation(apply, { event: { ...event, eventId: "event-2" } }),
    ).toEqual(result);
    expect(
      await t.run((ctx) => ctx.db.query("agentRunEvents").collect()),
    ).toHaveLength(2);
  });
  test.each([
    { signerId: "unknown" },
    { chatId: "elsewhere" },
    { messageId: "elsewhere" },
    { digest8: "invalid" },
    { platform: "discord" as const },
  ])(
    "rejects mismatched binding %j without consuming the intent",
    async (patch) => {
      const { t, event, intent } = await setup();
      expect(
        await t.mutation(apply, { event: { ...event, ...patch } }),
      ).toMatchObject({ status: "rejected" });
      expect(await t.run((ctx) => ctx.db.get(intent._id))).toMatchObject({
        status: "proposed",
      });
      expect(
        await t.mutation(apply, { event: { ...event, eventId: "good" } }),
      ).toMatchObject({ status: "applied" });
    },
  );
  test("missing card cannot confirm, cancel ignores digest and revision after signer check", async () => {
    const { t, event, intent, draftId } = await setup();
    await t.run((ctx) => ctx.db.patch(intent._id, { signerCard: undefined }));
    expect(await t.mutation(apply, { event })).toMatchObject({
      error: "Signer card mismatch",
    });
    await t.mutation(bind, {
      intentId: intent._id,
      signerCard: { platform: "telegram", chatId: "chat", messageId: "card" },
    });
    await t.run((ctx) => ctx.db.patch(draftId, { revision: 10 }));
    expect(
      await t.mutation(apply, {
        event: {
          ...event,
          eventId: "cancel",
          verb: "cancel",
          digest8: undefined,
        },
      }),
    ).toEqual({ status: "cancelled" });
    expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
      status: "pending_review",
    });
  });
  test("expiry precedes card/signer checks and stale revisions reject after digest", async () => {
    const { t, event, intent } = await setup();
    await t.run((ctx) => ctx.db.patch(intent._id, { expiresAt: 0 }));
    expect(
      await t.mutation(apply, { event: { ...event, signerId: "unknown" } }),
    ).toMatchObject({ status: "expired" });
    const other = await setup();
    await other.t
      .withIdentity({ subject: "human" })
      .mutation(api.agentDrafts.reject, {
        draftId: other.draftId,
        decisionNote: "Already reviewed",
      });
    expect(await other.t.mutation(apply, { event: other.event })).toMatchObject(
      { status: "rejected", error: "Target changed: rejected" },
    );
  });
  test("web does not require a signer card but does require an authenticated human", async () => {
    const { t, intent } = await setup();
    const args = {
      intentId: intent._id,
      digest8: intent.payloadDigest.slice(0, 8),
      eventId: "web-1",
    };
    vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("AUTH_BYPASS_SECRET", "bypass");
    await expect(t.mutation(webApply, args)).rejects.toThrow();
    await expect(
      t.withIdentity({ subject: "system" }).mutation(webApply, args),
    ).rejects.toThrow("Human authentication required");
    await t.run((ctx) => ctx.db.patch(intent._id, { signerCard: undefined }));
    expect(
      await t.withIdentity({ subject: "human" }).mutation(webApply, args),
    ).toMatchObject({ status: "applied" });
  });
  test("a previously authenticated unmapped human can read and decide without manual provisioning", async () => {
    const { t, intent, draftId } = await setup();
    const human = t.withIdentity({ subject: "new-human", name: "New human" });
    expect(
      await human.query(api.decisionIntents.get, { intentId: intent._id }),
    ).toMatchObject({ _id: intent._id });
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      1,
    );
    await human.mutation(api.agentDrafts.reject, {
      draftId,
      decisionNote: "Reviewed by its authenticated user",
    });
    const mapped = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", "new-human"))
        .unique(),
    );
    expect(mapped).toMatchObject({
      clerkUserId: "new-human",
      displayName: "New human",
      role: "collaborator",
    });
    expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
      decidedBy: "human",
      decisionSource: "web",
      status: "rejected",
    });
  });
  test("feed polling invalidates proposals and bounded migration is idempotent", async () => {
    const { t, userId } = await setup();
    const feedId = await t.run((ctx) =>
      ctx.db.insert("feeds", {
        name: "Feed",
        url: "https://example.com/rss",
        type: "rss",
        enabled: false,
        metadata: {
          proposal: { agentRunId: "run", rationale: "Useful", sampleItems: [] },
        },
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const intent = await t.mutation(propose, {
      secret: "service",
      command: {
        action: "enableFeed",
        target: { kind: "feedProposal", id: feedId },
        payload: {},
      },
      proposal,
    });
    expect(intent.targetRevision).toBe(0);
    const batch = await t.mutation(migrate, {
      table: "feeds",
      cursor: null,
      batchSize: 1,
    });
    expect(batch.updated).toBe(1);
    expect(
      (await t.mutation(migrate, { table: "feeds", cursor: null })).updated,
    ).toBe(0);
    await t.mutation(internal.feeds.updateLastPolled, {
      id: feedId,
      lastPolledAt: 20,
    });
    expect(await t.run((ctx) => ctx.db.get(feedId))).toMatchObject({
      revision: 1,
    });
    expect(
      (await t.mutation(migrate, { table: "feeds", cursor: null })).updated,
    ).toBe(0);
    expect(userId).toBeTruthy();
    expect(
      await t.withIdentity({ subject: "human" }).mutation(webApply, {
        intentId: intent._id,
        eventId: "poll",
        digest8: intent.payloadDigest.slice(0, 8),
      }),
    ).toMatchObject({ status: "rejected", error: "Target changed: disabled" });
  });
  test("payload-less approval fails domain validation before promotion", async () => {
    const { t, draftId } = await setup();
    const intent = await t.mutation(propose, {
      secret: "service",
      command: {
        action: "approve",
        target: { kind: "agentReviewDraft", id: draftId },
        payload: {},
      },
      proposal,
    });
    expect(
      await t.withIdentity({ subject: "human" }).mutation(webApply, {
        intentId: intent._id,
        digest8: intent.payloadDigest.slice(0, 8),
        eventId: "no-payload",
      }),
    ).toMatchObject({ status: "rejected" });
    expect(await t.run((ctx) => ctx.db.query("hypotheses").collect())).toEqual(
      [],
    );
    expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
      status: "pending_review",
    });
  });

  test("late promotion failure rolls back domain writes and scheduling but commits the rejection receipt", async () => {
    const lateFailure = "Injected failure after hypothesis promotion";
    const promoted = vi.fn();
    const linkConcepts = vi.fn(async () => null);
    const { t, draftId, runId, userId, event } = await setup({
      ...modules,
      "./decisionIntents.ts": async () => {
        const real = await import("./decisionIntents");
        // Replace only the nested mutation entry point. The real handler runs
        // with convex-test's untouched context and transaction implementation.
        const handler = (
          real.applyDomain as unknown as {
            _handler: (
              ctx: MutationCtx,
              args: {
                intentId: Id<"decisionIntents">;
                userId: Id<"users">;
                source: "web" | "discord" | "telegram";
              },
            ) => Promise<string>;
          }
        )._handler;
        return {
          ...real,
          applyDomain: internalMutation({
            handler: async (ctx, args: Parameters<typeof handler>[1]) => {
              const id = await handler(ctx, args);
              // Observe the actual writes inside the subtransaction before
              // throwing, so an early validation failure cannot pass this test.
              promoted({
                hypothesis: await ctx.db.get(id as Id<"hypotheses">),
                draft: await ctx.db.get(draftId),
                run: await ctx.db.get(runId),
                events: await ctx.db.query("agentRunEvents").collect(),
                jobs: await ctx.db.system
                  .query("_scheduled_functions")
                  .collect(),
              });
              throw new ConvexError(lateFailure);
            },
          }),
        };
      },
      "./graph.ts": async () => ({
        // Observe execution without allowing a regression to call inference.
        linkHypothesisConcepts: internalAction({ handler: linkConcepts }),
      }),
    });
    await t.run((ctx) =>
      ctx.db.patch(draftId, {
        payload: {
          title: "Beating and warmth",
          question: "Does 4 Hz beating increase perceived warmth?",
          statement: "Tones beating at 4 Hz increase perceived warmth.",
          rationale: "Slow amplitude modulation may affect perceived warmth.",
          whyThisMatters: "A repeatable warmth control helps shape a mix.",
          concepts: ["beating"],
          sourceIds: [],
          extractionIds: [],
        },
      }),
    );
    const before = await t.run(async (ctx) => ({
      draft: await ctx.db.get(draftId),
      run: await ctx.db.get(runId),
    }));
    const intent = await t.mutation(propose, {
      secret: "service",
      command: {
        action: "approve",
        target: { kind: "agentReviewDraft", id: draftId },
        payload: {},
      },
      proposal,
    });
    await t.mutation(bind, {
      intentId: intent._id,
      signerCard: { platform: "telegram", chatId: "chat", messageId: "card" },
    });
    const confirmation = {
      ...event,
      intentId: intent._id,
      digest8: intent.payloadDigest.slice(0, 8),
      eventId: "late-promotion-failure",
    };
    const rejected = { status: "rejected", error: lateFailure };
    expect(await t.mutation(apply, { event: confirmation })).toEqual(rejected);
    expect(promoted).toHaveBeenCalledTimes(1);
    const writes = promoted.mock.calls[0]![0];
    expect(writes.hypothesis).toMatchObject({
      title: "Beating and warmth",
      agentDraftId: draftId,
      createdBy: userId,
    });
    expect(writes.draft).toMatchObject({
      status: "approved",
      revision: 1,
      promotedId: writes.hypothesis._id,
      decisionIntentId: intent._id,
    });
    expect(writes.run).toMatchObject({ status: "completed" });
    expect(writes.events).toHaveLength(2);
    expect(writes.jobs).toHaveLength(1);
    expect(writes.jobs[0]).toMatchObject({
      name: "graph:linkHypothesisConcepts",
      args: [{ hypothesisId: writes.hypothesis._id }],
      state: { kind: "pending" },
    });

    const committed = await t.run(async (ctx) => ({
      hypotheses: await ctx.db.query("hypotheses").collect(),
      draft: await ctx.db.get(draftId),
      run: await ctx.db.get(runId),
      events: await ctx.db.query("agentRunEvents").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      intent: await ctx.db.get(intent._id),
      receipts: await ctx.db.query("webhookEvents").collect(),
    }));
    expect(committed.hypotheses).toEqual([]);
    expect(committed.draft).toEqual(before.draft);
    expect(committed.run).toEqual(before.run);
    expect(committed.events).toEqual([]);
    expect(committed.jobs).toEqual([]);
    expect(committed.intent).toMatchObject({
      status: "rejected",
      result: rejected,
      decidedAt: expect.any(Number),
    });
    expect(committed.receipts).toHaveLength(1);
    expect(committed.receipts[0]).toMatchObject({
      platform: "telegram",
      eventId: confirmation.eventId,
      intentId: intent._id,
      result: rejected,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(linkConcepts).not.toHaveBeenCalled();
    expect(await t.mutation(apply, { event: confirmation })).toEqual(rejected);
    expect(promoted).toHaveBeenCalledTimes(1);
    expect(
      await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
    ).toEqual(committed.receipts);
  });
});

async function seedComposition(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const hypothesisId = await ctx.db.insert("hypotheses", {
      title: "Hypothesis",
      question: "Question",
      hypothesis: "Statement",
      rationaleMd: "Rationale",
      concepts: [],
      sourceIds: [],
      extractionIds: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    const recipeId = await ctx.db.insert("recipes", {
      hypothesisId,
      title: "Recipe",
      whyThisMatters: "Makes it testable",
      bodyMd: "Protocol",
      parameters: [],
      dawChecklist: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("compositions", {
      recipeId,
      title: "Composition",
      artifactType: "microStudy",
      version: "v1",
      status: "rendered",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
  });
}

test("listening confirmation stores only spoken ratings, conditions and human attribution exactly once", async () => {
  const { t, userId } = await setup();
  const compositionId = await seedComposition(t);
  const intent = await t.mutation(propose, {
    secret: "service",
    command: {
      action: "createListeningSession",
      target: { kind: "composition", id: compositionId },
      payload: {
        conditions: { listeningMethod: "car", timeOfDay: "morning" },
        ratings: { goosebumps: 4 },
        expandVerdict: "maybe",
      },
    },
    proposal,
  });
  expect(
    await t.run((ctx) => ctx.db.query("listeningSessions").collect()),
  ).toEqual([]);
  const asHuman = t.withIdentity({ subject: "human" });
  const args = {
    intentId: intent._id,
    digest8: intent.payloadDigest.slice(0, 8),
    eventId: "listen",
  };
  const result = await asHuman.mutation(webApply, args);
  expect(result.status).toBe("applied");
  expect(
    await asHuman.mutation(webApply, { ...args, eventId: "another" }),
  ).toEqual(result);
  const sessions = await t.run((ctx) =>
    ctx.db.query("listeningSessions").collect(),
  );
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({
    compositionId,
    createdBy: userId,
    feedbackMd: proposal.transcript,
    ratings: { goosebumps: 4 },
    conditions: { listeningMethod: "car", timeOfDay: "morning" },
    decisionIntentId: intent._id,
  });
  expect(sessions[0]?.ratings).toEqual({ goosebumps: 4 });
  await asHuman.mutation(api.listening.updateVisibility, {
    id: sessions[0]!._id,
    visibility: "public",
  });
  expect(await t.run((ctx) => ctx.db.get(sessions[0]!._id))).toMatchObject({
    visibility: "public",
  });
  await expect(
    t
      .withIdentity({ subject: "another-human" })
      .mutation(api.listening.updateVisibility, {
        id: sessions[0]!._id,
        visibility: "private",
      }),
  ).rejects.toThrow("Not authorized");
});

test("direct listening creation reuses its mapped human identity for ownership", async () => {
  const { t } = await setup();
  const compositionId = await seedComposition(t);
  const human = t.withIdentity({ subject: "new-listener" });
  const args = {
    compositionId,
    participants: [],
    feedbackMd: "A human listening note",
  };
  const first = await human.mutation(api.listening.create, args);
  await human.mutation(api.listening.create, args);
  await human.mutation(api.listening.updateVisibility, {
    id: first,
    visibility: "followers",
  });
  const users = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", "new-listener"))
      .collect(),
  );
  expect(users).toHaveLength(1);
  expect(users[0]?.role).toBe("collaborator");
  expect(await t.run((ctx) => ctx.db.get(first))).toMatchObject({
    createdBy: users[0]!._id,
    visibility: "followers",
  });
});

test("web approval and signed approval share promotion invariants and amended provenance", async () => {
  const run = async (signed: boolean) => {
    const { t, draftId, userId } = await setup();
    const payload = {
      title: "Proposed",
      question: "Question",
      statement: "Statement",
      rationale: "Rationale",
      whyThisMatters: "Worth listening to test",
      sourceIds: [],
      extractionIds: [],
    };
    const amendedPayload = { ...payload, title: "Human amendment" };
    await t.run((ctx) => ctx.db.patch(draftId, { payload }));
    if (signed) {
      const intent = await t.mutation(propose, {
        secret: "service",
        command: {
          action: "approve",
          target: { kind: "agentReviewDraft", id: draftId },
          payload: { note: "Yes", amendedPayload },
        },
        proposal,
      });
      expect(
        (
          await t.withIdentity({ subject: "human" }).mutation(webApply, {
            intentId: intent._id,
            digest8: intent.payloadDigest.slice(0, 8),
            eventId: "approve",
          })
        ).status,
      ).toBe("applied");
    } else
      await t
        .withIdentity({ subject: "human" })
        .mutation(api.agentDrafts.approve, {
          draftId,
          decisionNote: "Yes",
          amendedPayload,
        });
    const rows = await t.run((ctx) => ctx.db.query("hypotheses").collect());
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error("Missing promotion");
    expect(row.createdBy).toBe(userId);
    expect(row.agentDraftId).toBe(draftId);
    expect(row.approvedWithEdits).toBe(true);
    expect(row.editedFields).toEqual(["title"]);
    expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
      status: "approved",
      revision: 1,
      amendedPayload,
      payload,
    });
    const {
      _id,
      _creationTime,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      agentDraftId: _agentDraftId,
      agentRunId: _agentRunId,
      createdBy: _createdBy,
      ...stable
    } = row;
    return stable;
  };
  expect(await run(true)).toEqual(await run(false));
});

test("all feed insertion and row-update entry points initialize or increment revision", async () => {
  const { t, runId } = await setup();
  const human = t.withIdentity({ subject: "human" });
  const id = await human.mutation(api.feeds.create, {
    name: "Feed",
    url: "https://example.com/one",
    type: "rss",
  });
  expect(await t.query(api.feeds.get, { id })).toMatchObject({ revision: 0 });
  await human.mutation(api.feeds.setEnabled, { id, enabled: false });
  expect(await t.query(api.feeds.get, { id })).toMatchObject({ revision: 1 });
  await human.mutation(api.admin.setFeedEnabled, { id, enabled: true });
  expect(await t.query(api.feeds.get, { id })).toMatchObject({ revision: 2 });
  await t.mutation(internal.feeds.updateLastPolled, { id, lastPolledAt: 50 });
  expect(await t.query(api.feeds.get, { id })).toMatchObject({ revision: 3 });
  const adminId = await human.mutation(api.admin.createFeed, {
    name: "Admin feed",
    url: "https://example.com/two",
    type: "rss",
  });
  expect(await t.query(api.feeds.get, { id: adminId })).toMatchObject({
    revision: 0,
  });
  const proposed = await t.mutation(internal.feeds.proposeFeed, {
    name: "Proposed",
    url: "https://example.com/three",
    type: "rss",
    rationale: "Useful",
    sampleItems: [],
    agentRunId: runId,
  });
  expect(await t.query(api.feeds.get, { id: proposed.id })).toMatchObject({
    revision: 0,
    enabled: false,
  });
  const intent = await t.mutation(propose, {
    secret: "service",
    command: {
      action: "enableFeed",
      target: { kind: "feedProposal", id: proposed.id },
      payload: {},
    },
    proposal,
  });
  expect(
    (
      await human.mutation(webApply, {
        intentId: intent._id,
        digest8: intent.payloadDigest.slice(0, 8),
        eventId: "enable",
      })
    ).status,
  ).toBe("applied");
  expect(await t.query(api.feeds.get, { id: proposed.id })).toMatchObject({
    revision: 1,
    enabled: true,
  });
  const seeded = await t.mutation(internal.feeds.seedInitialFeeds, {});
  for (const seed of seeded)
    expect(await t.query(api.feeds.get, { id: seed.id })).toMatchObject({
      revision: 0,
    });
});

test("draft migration spans bounded pages and leaves existing revisions unchanged", async () => {
  const { t, draftId } = await setup();
  await t.run(async (ctx) => {
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new Error("Missing fixture");
    const { _id, _creationTime, ...fields } = draft;
    await ctx.db.insert("agentReviewDrafts", { ...fields, revision: 7 });
    await ctx.db.insert("agentReviewDrafts", fields);
  });
  let cursor: string | null = null;
  let updated = 0;
  for (;;) {
    const result: { cursor: string; done: boolean; updated: number } =
      await t.mutation(migrate, {
        table: "agentReviewDrafts",
        cursor,
        batchSize: 1,
      });
    expect(result.updated).toBeLessThanOrEqual(1);
    updated += result.updated;
    if (result.done) break;
    cursor = result.cursor;
  }
  expect(updated).toBe(2);
  expect(
    (await t.run((ctx) => ctx.db.query("agentReviewDrafts").collect())).map(
      (row) => row.revision,
    ),
  ).toEqual([0, 7, 0]);
  expect(
    (await t.mutation(migrate, { table: "agentReviewDrafts", cursor: null }))
      .updated,
  ).toBe(0);
});

test("draft insertion initializes revision and superseding increments only the decided draft", async () => {
  const { t, runId, draftId } = await setup();
  const result = await t.mutation(internal.agentDrafts.createFromAgentRun, {
    agentRunId: runId,
    draft: {
      kind: "recipe_draft",
      title: "Replacement",
      summary: "Ready for review",
      candidateIds: ["candidate"],
      needsReview: true,
    },
  });
  expect(await t.run((ctx) => ctx.db.get(result.draftId))).toMatchObject({
    revision: 0,
  });
  await t
    .withIdentity({ subject: "human" })
    .mutation(api.agentDrafts.supersede, {
      draftId,
      byDraftId: result.draftId,
    });
  expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
    revision: 1,
    status: "superseded",
  });
  expect(await t.run((ctx) => ctx.db.get(result.draftId))).toMatchObject({
    revision: 0,
    status: "pending_review",
  });
});

test.each([
  "bodilyPleasantness",
  "goosebumps",
  "perceivedConsonance",
  "musicality",
  "easeOfComposability",
  "expandability",
])("direct human listening rejects invalid %s too", async (field) => {
  const { t } = await setup();
  const compositionId = await seedComposition(t);
  await expect(
    t.withIdentity({ subject: "human" }).mutation(api.listening.create, {
      compositionId,
      participants: [],
      feedbackMd: "Feedback",
      ratings: { [field]: 6 },
    }),
  ).rejects.toThrow();
  expect(
    await t.run((ctx) => ctx.db.query("listeningSessions").collect()),
  ).toEqual([]);
});
