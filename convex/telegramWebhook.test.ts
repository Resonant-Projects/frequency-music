import { describe, expect, it, vi } from "vite-plus/test";
import {
  createTelegramWebhookHandler,
  parseTelegramDecision,
  verifyTelegramSecrets,
} from "./telegramWebhook";

const config = {
  pathSecret: "test-path-secret",
  headerSecret: "test-header-secret",
};
const message = {
  message_id: 42,
  chat: { id: -123 },
  from: { id: 456, is_bot: false },
  text: "confirm D-17",
};
const callback = {
  update_id: 10,
  callback_query: {
    id: "callback_1",
    from: { id: 456, is_bot: false },
    message: { message_id: 7, chat: { id: -123 } },
    data: "intent:confirm:0123abcd",
  },
};
const card = {
  intentId: "intent",
  payloadDigest: "0123abcd".repeat(8),
  signerCard: { platform: "telegram", chatId: "-123", messageId: "7" },
};
function request(
  body: unknown = callback,
  path = config.pathSecret,
  header = config.headerSecret,
) {
  return new Request(`https://example.test/telegram/webhook/${path}`, {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": header },
    body: JSON.stringify(body),
  });
}
function dependencies() {
  return {
    ...config,
    apply: vi.fn(async () => {}),
    resolveCode: vi.fn(async () => card),
    acknowledgeCallback: vi.fn(async () => {}),
  };
}

describe("Telegram signer webhook", () => {
  it("requires both exact secrets and fails closed for empty configuration", async () => {
    expect(await verifyTelegramSecrets(request(), config)).toBe(true);
    for (const req of [
      request(callback, "wrong"),
      request(callback, config.pathSecret, "wrong"),
      request(callback, config.pathSecret, ""),
      request(callback, `${config.pathSecret}/extra`),
      request(callback, `%74est-path-secret`),
    ])
      expect(await verifyTelegramSecrets(req, config)).toBe(false);
    expect(
      await verifyTelegramSecrets(request(), { ...config, headerSecret: "" }),
    ).toBe(false);
    const deps = dependencies();
    const response = await createTelegramWebhookHandler(deps)(
      request(callback, "wrong"),
    );
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(deps.apply).not.toHaveBeenCalled();
    expect(deps.resolveCode).not.toHaveBeenCalled();
  });
  it("uses callback.from, not message author or caller identity", async () => {
    const deps = dependencies();
    const body = {
      ...callback,
      signerId: "999",
      callback_query: {
        ...callback.callback_query,
        message: { ...callback.callback_query.message, from: { id: 999 } },
      },
    };
    expect(
      (await createTelegramWebhookHandler(deps)(request(body))).status,
    ).toBe(200);
    expect(deps.apply).toHaveBeenCalledExactlyOnceWith({
      platform: "telegram",
      intentId: "intent",
      verb: "confirm",
      digest8: "0123abcd",
      signerId: "456",
      chatId: "-123",
      messageId: "7",
      eventId: "10",
    });
    expect(deps.acknowledgeCallback).toHaveBeenCalledExactlyOnceWith(
      "callback_1",
    );
  });
  it("binds typed confirmation to the stored card and stored digest", async () => {
    const deps = dependencies();
    expect(
      (
        await createTelegramWebhookHandler(deps)(
          request({ update_id: 11, message }),
        )
      ).status,
    ).toBe(200);
    expect(deps.resolveCode).toHaveBeenCalledExactlyOnceWith("D-17");
    expect(deps.apply).toHaveBeenCalledExactlyOnceWith({
      platform: "telegram",
      intentId: "intent",
      verb: "confirm",
      digest8: "0123abcd",
      signerId: "456",
      chatId: "-123",
      messageId: "7",
      eventId: "11",
    });
    expect(deps.acknowledgeCallback).not.toHaveBeenCalled();
  });
  it("rejects typed codes from another chat, an unposted intent or another platform", async () => {
    for (const resolved of [
      null,
      { ...card, signerCard: undefined },
      { ...card, signerCard: { ...card.signerCard, chatId: "999" } },
      { ...card, signerCard: { ...card.signerCard, platform: "discord" } },
    ]) {
      const deps = {
        ...dependencies(),
        resolveCode: vi.fn(async () => resolved),
      };
      expect(
        (
          await createTelegramWebhookHandler(deps)(
            request({ update_id: 11, message }),
          )
        ).status,
      ).toBe(200);
      expect(deps.apply).not.toHaveBeenCalled();
    }
  });
  it("passes cancel with no digest and preserves event ids across replay", async () => {
    const deps = dependencies();
    const handler = createTelegramWebhookHandler(deps);
    const body = {
      update_id: 11,
      message: { ...message, text: "cancel D-17" },
    };
    await handler(request(body));
    await handler(request(body));
    expect(deps.apply.mock.calls[0]).toEqual(deps.apply.mock.calls[1]);
    expect(deps.apply.mock.calls[0]).toEqual([
      {
        platform: "telegram",
        intentId: "intent",
        verb: "cancel",
        signerId: "456",
        chatId: "-123",
        messageId: "7",
        eventId: "11",
      },
    ]);
  });
  it("rejects bots, anonymous/unsafe senders, forwarded commands and malformed callbacks", () => {
    for (const from of [
      { id: 456, is_bot: true },
      { id: 456 },
      { id: Number.MAX_SAFE_INTEGER + 1, is_bot: false },
    ])
      expect(
        parseTelegramDecision({ update_id: 1, message: { ...message, from } }),
      ).toBeNull();
    expect(
      parseTelegramDecision({
        update_id: 1,
        message: { ...message, sender_chat: { id: -123 } },
      }),
    ).toBeNull();
    expect(
      parseTelegramDecision({
        update_id: 1,
        message: { ...message, forward_origin: {} },
      }),
    ).toBeNull();
    expect(
      parseTelegramDecision({
        ...callback,
        callback_query: {
          ...callback.callback_query,
          data: "intent:confirm:bad",
        },
      }),
    ).toBeNull();
    expect(parseTelegramDecision({ ...callback, message })).toBeNull();
  });
  it("passes attributed but unauthorized sender to canonical apply without claiming success", async () => {
    const deps = {
      ...dependencies(),
      apply: vi.fn(async () => {
        throw new Error("raw body token secret");
      }),
    };
    const response = await createTelegramWebhookHandler(deps)(
      request(callback),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Temporarily unavailable");
    expect(deps.acknowledgeCallback).not.toHaveBeenCalled();
  });
  it("does not log raw bodies or secrets on failures", async () => {
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    try {
      const response = await createTelegramWebhookHandler(dependencies())(
        request({ privateBody: "private contents" }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
  it("acknowledges ordinary authenticated messages without applying a decision", async () => {
    const deps = dependencies();
    const response = await createTelegramWebhookHandler(deps)(
      request({ update_id: 12, message: { ...message, text: "/start" } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deps.apply).not.toHaveBeenCalled();
    expect(deps.resolveCode).not.toHaveBeenCalled();
  });
});

it("returns 200 after durable admission even when callback ACK delivery fails", async () => {
  const deps = {
    ...dependencies(),
    acknowledgeCallback: vi.fn(async () => {
      throw new Error("query too old");
    }),
  };
  const handler = createTelegramWebhookHandler(deps);
  for (let i = 0; i < 3; i++)
    expect((await handler(request())).status).toBe(200);
  expect(deps.apply).toHaveBeenCalledTimes(3);
});
