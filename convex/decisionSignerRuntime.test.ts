import type { webcrypto } from "node:crypto";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import type { DecisionEvent } from "./shared/decisionIntents";
import { discordSignerHttp, telegramSignerHttp } from "./decisionSignerRuntime";
const runtimeModules = {
  ...modules,
  "./decisionSignerRuntime.ts": () => import("./decisionSignerRuntime"),
};
const callbackAck = makeFunctionReference<
  "action",
  { callbackQueryId: string },
  null
>("decisionSignerRuntime:callbackAck");
const deliver = makeFunctionReference<
  "action",
  { intentId: Id<"decisionIntents"> },
  null
>("decisionSignerRuntime:deliver");
const refresh = makeFunctionReference<
  "action",
  { intentId: Id<"decisionIntents"> },
  null
>("decisionSignerRuntime:refresh");
const admit = makeFunctionReference<
  "mutation",
  { event: DecisionEvent },
  string
>("decisionSignerRuntime:admit");
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("DECISION_SIGNERS_ENABLED", "false");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function setup(enabled = true) {
  const t = convexTest(schema, runtimeModules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: "human",
      role: "collaborator",
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
    return { userId, draftId };
  });
  const intent = await t.mutation(internal.decisionIntents.proposeInternal, {
    command: {
      action: "reject",
      target: { kind: "agentReviewDraft", id: ids.draftId },
      payload: { note: "Unsupported premise" },
    },
    proposal: {
      channel: "telegram",
      conversationId: "-123",
      messageRef: "1",
      transcript: "Reject unsupported premise",
    },
  });
  vi.stubEnv("DECISION_SIGNERS_ENABLED", String(enabled));
  vi.stubEnv(
    "DECISION_SIGNERS",
    JSON.stringify({ "telegram:321": ids.userId, "discord:321": ids.userId }),
  );
  vi.stubEnv("DECISION_TELEGRAM_BOT_TOKEN", "123:test-token");
  vi.stubEnv("DECISION_TELEGRAM_CHAT_ID", "-123");
  vi.stubEnv("DECISION_TELEGRAM_PATH_SECRET", "path-secret");
  vi.stubEnv("DECISION_TELEGRAM_HEADER_SECRET", "header-secret");
  const fetchMock = vi.fn().mockImplementation(async () =>
    Response.json({
      ok: true,
      result: { message_id: 42, chat: { id: -123 } },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const event: DecisionEvent = {
    intentId: intent._id,
    platform: "telegram",
    chatId: "-123",
    messageId: "42",
    signerId: "321",
    eventId: "1",
    verb: "confirm",
    digest8: intent.payloadDigest.slice(0, 8),
  };
  return { t, intent, event, fetchMock, ...ids };
}

async function processQueued(t: ReturnType<typeof convexTest>) {
  const jobs = await t.run((ctx) => ctx.db.query("settings").collect());
  const processRef = makeFunctionReference<
    "mutation",
    { admissionId: Id<"settings"> },
    null
  >("decisionSignerRuntime:processAdmission");
  for (const job of jobs)
    if (job.key.startsWith("decisionSigner.event:"))
      await t.mutation(processRef, { admissionId: job._id });
}

function context(t: ReturnType<typeof convexTest>): ActionCtx {
  return { runQuery: t.query, runMutation: t.mutation } as unknown as ActionCtx;
}
const telegramRequest = (intentId: string, secret = "header-secret") =>
  new Request("https://example.test/telegram/webhook/path-secret", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": secret },
    body: JSON.stringify({
      update_id: 1,
      callback_query: {
        id: "callback-1",
        from: { id: 321, is_bot: false },
        message: { message_id: 42, chat: { id: -123 } },
        data: `${intentId}:cancel`,
      },
    }),
  });

test("disabled delivery and routes make no provider or backend calls", async () => {
  const { t, intent, fetchMock } = await setup(false);
  await t.action(deliver, { intentId: intent._id });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.query("settings").collect())).toHaveLength(
    1,
  );
  const ctx = {} as ActionCtx;
  expect(
    (await telegramSignerHttp(ctx, telegramRequest(intent._id))).status,
  ).toBe(404);
  expect(
    (
      await discordSignerHttp(
        ctx,
        new Request("https://example.test/discord/interactions"),
      )
    ).status,
  ).toBe(404);
});

test("delivery binds real response once and permanent claims suppress action retries", async () => {
  const { t, intent, fetchMock } = await setup();
  await t.action(deliver, { intentId: intent._id });
  await t.action(deliver, { intentId: intent._id });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[0]).toBe(
    "https://api.telegram.org/bot123:test-token/sendMessage",
  );
  expect(
    await t.query(internal.decisionIntents.getInternal, {
      intentId: intent._id,
    }),
  ).toMatchObject({
    signerCard: { platform: "telegram", chatId: "-123", messageId: "42" },
  });
});

test.each(["network", "wrong-chat", "oversize"])(
  "ambiguous %s leaves an unbound claim and never reposts",
  async (mode) => {
    const { t, intent, fetchMock } = await setup();
    fetchMock.mockImplementation(async () => {
      if (mode === "network") throw new Error("private upstream details");
      if (mode === "oversize") return new Response("x".repeat(65_537));
      return Response.json({
        ok: true,
        result: { message_id: 42, chat: { id: -999 } },
      });
    });
    await t.action(deliver, { intentId: intent._id });
    await t.action(deliver, { intentId: intent._id });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (
        await t.query(internal.decisionIntents.getInternal, {
          intentId: intent._id,
        })
      )?.signerCard,
    ).toBeUndefined();
  },
);

test("admission audits unknown signers without consuming or disabling a card; replay applies once", async () => {
  const { t, intent, event, fetchMock } = await setup();
  await t.action(deliver, { intentId: intent._id });
  expect(
    await t.mutation(admit, {
      event: { ...event, eventId: "unknown", signerId: "999" },
    }),
  ).toBe("signers_only");
  await processQueued(t);
  expect(
    await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
  ).toHaveLength(1);
  await t.action(refresh, { intentId: intent._id });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await t.mutation(admit, { event })).toBe("queued");
  await processQueued(t);
  expect(await t.mutation(admit, { event })).toBe("queued");
  await processQueued(t);
  expect(
    await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
  ).toHaveLength(2);
  await t.action(refresh, { intentId: intent._id });
  const edit = JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body);
  expect(edit.text).toBe("Decision applied.");
  expect(edit.reply_markup.inline_keyboard).toEqual([]);
});

test("Telegram verification gates apply; verified callbacks ACK and replay safely", async () => {
  const { t, intent, fetchMock } = await setup();
  await t.action(deliver, { intentId: intent._id });
  expect(
    (await telegramSignerHttp(context(t), telegramRequest(intent._id, "wrong")))
      .status,
  ).toBe(401);
  expect(
    await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
  ).toHaveLength(0);
  expect(
    (await telegramSignerHttp(context(t), telegramRequest(intent._id))).status,
  ).toBe(200);
  expect(
    (await telegramSignerHttp(context(t), telegramRequest(intent._id))).status,
  ).toBe(200);
  await processQueued(t);
  expect(
    await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
  ).toHaveLength(1);
  await t.action(callbackAck, { callbackQueryId: "callback-1" });
  expect(
    fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith("answerCallbackQuery"),
    ),
  ).toHaveLength(1);
  expect(
    (
      await t.query(internal.decisionIntents.getInternal, {
        intentId: intent._id,
      })
    )?.status,
  ).toBe("cancelled");
});

test("Discord malformed authentication never admits an event", async () => {
  const { t, fetchMock } = await setup();
  vi.stubEnv("DECISION_DISCORD_BOT_TOKEN", "test-token");
  vi.stubEnv("DECISION_DISCORD_CHANNEL_ID", "123");
  vi.stubEnv("DECISION_DISCORD_APPLICATION_ID", "456");
  vi.stubEnv("DECISION_DISCORD_PUBLIC_KEY", "0".repeat(64));
  const response = await discordSignerHttp(
    context(t),
    new Request("https://example.test/discord/interactions", {
      method: "POST",
      body: "{}",
    }),
  );
  expect(response.status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(
    await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
  ).toHaveLength(0);
});

test("missing configuration preserves proposal/web fallback without scheduling", async () => {
  const { t, intent, fetchMock } = await setup();
  vi.stubEnv("DECISION_TELEGRAM_BOT_TOKEN", "");
  await t.action(deliver, { intentId: intent._id });
  const next = await t.mutation(internal.decisionIntents.proposeInternal, {
    command: {
      action: intent.action,
      target: intent.target,
      payload: intent.payload,
    } as Parameters<
      typeof t.mutation<typeof internal.decisionIntents.proposeInternal>
    >[1]["command"],
    proposal: intent.proposal,
  });
  expect(next.status).toBe("proposed");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(
    await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
  ).toHaveLength(0);
});

test("configured proposal schedules exactly one delivery job", async () => {
  const { t, intent } = await setup();
  await t.mutation(internal.decisionIntents.proposeInternal, {
    command: {
      action: "reject",
      target: {
        kind: "agentReviewDraft",
        id: intent.target.id as Id<"agentReviewDrafts">,
      },
      payload: { note: "Unsupported premise" },
    },
    proposal: intent.proposal,
  });
  expect(
    await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
  ).toHaveLength(1);
});

test("a verified webhook on an unposted intent cannot apply or create a binding", async () => {
  const { t, intent } = await setup();
  expect(
    (await telegramSignerHttp(context(t), telegramRequest(intent._id))).status,
  ).toBe(200);
  await processQueued(t);
  const row = await t.query(internal.decisionIntents.getInternal, {
    intentId: intent._id,
  });
  expect(row?.status).toBe("proposed");
  expect(row?.signerCard).toBeUndefined();
  expect(
    (await t.run((ctx) => ctx.db.query("webhookEvents").collect()))[0]?.result
      .error,
  ).toBe("Signer card mismatch");
});

test("a successful send whose canonical bind fails retains the real binding and never reposts", async () => {
  const { t, intent, fetchMock } = await setup();
  fetchMock.mockImplementation(async () => {
    await t.run((ctx) =>
      ctx.db.patch(intent._id, { expiresAt: Date.now() - 1 }),
    );
    return Response.json({
      ok: true,
      result: { message_id: 42, chat: { id: -123 } },
    });
  });
  await t.action(deliver, { intentId: intent._id });
  await t.action(deliver, { intentId: intent._id });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const row = await t.run((ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) =>
        q.eq("key", `decisionSigner.delivery:${intent._id}`),
      )
      .unique(),
  );
  expect(JSON.parse(row!.value)).toMatchObject({
    state: "binding_unconfirmed",
    binding: { platform: "telegram", chatId: "-123", messageId: "42" },
  });
});

test("provider timeout aborts the request and retains the permanent claim", async () => {
  const { t, intent, fetchMock } = await setup();
  let signal: AbortSignal | undefined;
  fetchMock.mockImplementation(async (_url, init) => {
    signal = init.signal;
    return await new Promise(() => {});
  });
  const work = t.action(deliver, { intentId: intent._id });
  // Let Convex action/query admission reach the mocked fetch before advancing.
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(10_000);
  await work;
  expect(signal?.aborted).toBe(true);
  await t.action(deliver, { intentId: intent._id });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("signed Discord interaction commits its receipt before ACK and replay creates no second receipt", async () => {
  const { t, intent, event } = await setup();
  vi.stubEnv("DECISION_DISCORD_BOT_TOKEN", "test-token");
  vi.stubEnv("DECISION_DISCORD_CHANNEL_ID", "123");
  vi.stubEnv("DECISION_DISCORD_APPLICATION_ID", "456");
  const keys = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as webcrypto.CryptoKeyPair;
  vi.stubEnv(
    "DECISION_DISCORD_PUBLIC_KEY",
    Buffer.from(await crypto.subtle.exportKey("raw", keys.publicKey)).toString(
      "hex",
    ),
  );
  await t.mutation(internal.decisionIntents.bindSignerCard, {
    intentId: intent._id,
    signerCard: { platform: "discord", chatId: "123", messageId: "42" },
  });
  const body = JSON.stringify({
    type: 3,
    application_id: "456",
    id: "789",
    channel_id: "123",
    member: { user: { id: "321" } },
    message: { id: "42" },
    data: {
      component_type: 2,
      custom_id: `${intent._id}:confirm:${event.digest8}`,
    },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = Buffer.from(
    await crypto.subtle.sign(
      "Ed25519",
      keys.privateKey,
      new TextEncoder().encode(timestamp + body),
    ),
  ).toString("hex");
  const request = () =>
    new Request("https://example.test/discord/interactions", {
      method: "POST",
      body,
      headers: {
        "X-Signature-Ed25519": signature,
        "X-Signature-Timestamp": timestamp,
      },
    });
  const response = await discordSignerHttp(context(t), request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ type: 4, data: { flags: 64 } });
  const admission = await t.run((ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) =>
        q.eq("key", "decisionSigner.event:discord:789"),
      )
      .unique(),
  );
  expect(JSON.parse(admission!.value)).toMatchObject({
    admission: "queued",
    processed: false,
  });
  expect(
    (
      await t.query(internal.decisionIntents.getInternal, {
        intentId: intent._id,
      })
    )?.status,
  ).toBe("proposed");
  await processQueued(t);
  expect(
    (
      await t.query(internal.decisionIntents.getInternal, {
        intentId: intent._id,
      })
    )?.status,
  ).toBe("applied");
  expect((await discordSignerHttp(context(t), request())).status).toBe(200);
  await processQueued(t);
  expect(
    await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
  ).toHaveLength(1);
});

test("authenticated malformed intent IDs are permanent rejects without provider writes", async () => {
  const { t, fetchMock } = await setup();
  const response = await telegramSignerHttp(
    context(t),
    telegramRequest("not_a_convex_id"),
  );
  expect(response.status).toBe(200);
  expect(
    await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
  ).toHaveLength(0);
  expect(
    fetchMock.mock.calls.every((call) =>
      String(call[0]).endsWith("answerCallbackQuery"),
    ),
  ).toBe(true);
});

test("concurrent delivery actions acquire only one durable send claim", async () => {
  const { t, intent, fetchMock } = await setup();
  await Promise.all([
    t.action(deliver, { intentId: intent._id }),
    t.action(deliver, { intentId: intent._id }),
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([400, 429, 503])(
  "Telegram ACK %s never retries canonical processing and has a durable retry cap",
  async (status) => {
    const { t, intent, fetchMock } = await setup();
    fetchMock.mockImplementation(async () =>
      Response.json(
        {
          ok: false,
          error_code: status,
          description: "private upstream error",
        },
        { status },
      ),
    );
    for (let i = 0; i < 3; i++) {
      expect(
        (await telegramSignerHttp(context(t), telegramRequest(intent._id)))
          .status,
      ).toBe(200);
      await t.finishAllScheduledFunctions(() => vi.runAllTimersAsync());
    }
    expect(fetchMock).toHaveBeenCalledTimes(status === 400 ? 1 : 3);
    expect(
      fetchMock.mock.calls.every((call) =>
        String(call[0]).endsWith("answerCallbackQuery"),
      ),
    ).toBe(true);
    expect(
      await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
    ).toHaveLength(1);
    const receipt = await t.run((ctx) =>
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) =>
          q.eq("key", "decisionSigner.ack:callback-1"),
        )
        .unique(),
    );
    expect(JSON.parse(receipt!.value)).toEqual({
      attempts: status === 400 ? 1 : 3,
      done: true,
    });
  },
);

test.each(["expiry", "web"])(
  "a card delivered after %s is cleaned up without creating signer authority",
  async (terminal) => {
    const { t, intent, fetchMock } = await setup();
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("sendMessage")) {
        if (terminal === "expiry")
          await t.run((ctx) =>
            ctx.db.patch(intent._id, { expiresAt: Date.now() - 1 }),
          );
        else
          await t
            .withIdentity({ subject: "human" })
            .mutation(api.decisionIntents.cancelWeb, {
              intentId: intent._id,
              eventId: "web-during-send",
            });
        return Response.json({
          ok: true,
          result: { message_id: 42, chat: { id: -123 } },
        });
      }
      return Response.json({ ok: true });
    });
    await t.action(deliver, { intentId: intent._id });
    await t.finishAllScheduledFunctions(() => vi.runAllTimersAsync());
    await t.action(deliver, { intentId: intent._id });
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).endsWith("sendMessage"),
      ),
    ).toHaveLength(1);
    const edits = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith("editMessageText"),
    );
    expect(edits).toHaveLength(1);
    expect(JSON.parse(edits[0]![1].body)).toMatchObject({
      chat_id: "-123",
      message_id: 42,
      text:
        terminal === "expiry"
          ? "Decision expired. Propose a new decision."
          : "Decision cancelled.",
      reply_markup: { inline_keyboard: [] },
    });
    const row = await t.query(internal.decisionIntents.getInternal, {
      intentId: intent._id,
    });
    expect(row?.signerCard).toBeUndefined();
    expect(row?.signature?.source).toBe(terminal === "web" ? "web" : undefined);
  },
);

test("orphan card cleanup stops after four attempts without reposting or binding", async () => {
  const { t, intent, fetchMock } = await setup();
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith("sendMessage")) {
      await t.run((ctx) =>
        ctx.db.patch(intent._id, { expiresAt: Date.now() - 1 }),
      );
      return Response.json({
        ok: true,
        result: { message_id: 42, chat: { id: -123 } },
      });
    }
    return Response.json({ ok: false }, { status: 503 });
  });
  await t.action(deliver, { intentId: intent._id });
  await t.finishAllScheduledFunctions(() => vi.runAllTimersAsync());
  expect(
    fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith("sendMessage"),
    ),
  ).toHaveLength(1);
  expect(
    fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith("editMessageText"),
    ),
  ).toHaveLength(4);
  expect(
    (
      await t.query(internal.decisionIntents.getInternal, {
        intentId: intent._id,
      })
    )?.signerCard,
  ).toBeUndefined();
});

test.each([false, true])(
  "cleanup budget is shared by concurrent watchers and verified events (success=%s)",
  async (succeeds) => {
    const { t, intent, fetchMock } = await setup();
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("sendMessage")) {
        await t
          .withIdentity({ subject: "human" })
          .mutation(api.decisionIntents.cancelWeb, {
            intentId: intent._id,
            eventId: "web-during-send",
          });
        return Response.json({
          ok: true,
          result: { message_id: 42, chat: { id: -123 } },
        });
      }
      if (String(url).endsWith("answerCallbackQuery") || succeeds)
        return Response.json({ ok: true });
      return Response.json({ ok: false }, { status: 503 });
    });
    await t.action(deliver, { intentId: intent._id });
    const sendEvent = async (updateId: number) => {
      const original = telegramRequest(intent._id);
      const body = {
        update_id: updateId,
        callback_query: {
          id: `callback-${updateId}`,
          from: { id: 321, is_bot: false },
          message: { message_id: 42, chat: { id: -123 } },
          data: `${intent._id}:cancel`,
        },
      };
      expect(
        (
          await telegramSignerHttp(
            context(t),
            new Request(original.url, {
              method: "POST",
              headers: original.headers,
              body: JSON.stringify(body),
            }),
          )
        ).status,
      ).toBe(200);
    };
    await sendEvent(10);
    // The delivery watcher and this actual handler's processAdmission both enqueue
    // refresh. Add concurrent refreshes to contend on the same durable budget.
    await processQueued(t);
    await Promise.all(
      Array.from({ length: 8 }, () =>
        t.action(refresh, { intentId: intent._id }),
      ),
    );
    await t.finishAllScheduledFunctions(() => vi.runAllTimersAsync());
    const before = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith("editMessageText"),
    ).length;
    expect(before).toBeLessThanOrEqual(4);
    if (!succeeds) expect(before).toBe(4);
    for (const updateId of [11, 12, 13]) await sendEvent(updateId);
    await t.finishAllScheduledFunctions(() => vi.runAllTimersAsync());
    await t.action(deliver, { intentId: intent._id });
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).endsWith("editMessageText"),
      ),
    ).toHaveLength(before);
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).endsWith("sendMessage"),
      ),
    ).toHaveLength(1);
    const receipt = await t.run((ctx) =>
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) =>
          q.eq("key", `decisionSigner.cleanup:${intent._id}:telegram:-123:42`),
        )
        .unique(),
    );
    expect(JSON.parse(receipt!.value)).toMatchObject({
      attempts: before,
      done: true,
      updated: succeeds,
    });
    const stored = await t.query(internal.decisionIntents.getInternal, {
      intentId: intent._id,
    });
    expect(stored?.signerCard).toBeUndefined();
    expect(stored?.signature?.source).toBe("web");
  },
);
