import type { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import {
  createDiscordInteractionHandler,
  parseDiscordDecision,
  verifyDiscordSignature,
} from "./discordInteractions";

const now = 1_800_000_000_000;
let keys: webcrypto.CryptoKeyPair;
let publicKey: string;
const hex = (bytes: ArrayBuffer) => Buffer.from(bytes).toString("hex");
const payload = {
  type: 3,
  application_id: "123",
  id: "456",
  channel_id: "789",
  member: { user: { id: "321" } },
  message: { id: "654" },
  data: { component_type: 2, custom_id: "intent:confirm:0123abcd" },
};
async function signed(body: string, timestamp = String(now / 1000)) {
  const signature = hex(
    await crypto.subtle.sign(
      "Ed25519",
      keys.privateKey,
      new TextEncoder().encode(timestamp + body),
    ),
  );
  return {
    signature,
    timestamp,
    rawBody: new TextEncoder().encode(body),
    publicKey,
    now,
  };
}
async function request(body = JSON.stringify(payload), timestamp?: string) {
  const signature = await signed(body, timestamp);
  return new Request("https://example.test/discord/interactions", {
    method: "POST",
    body,
    headers: {
      "X-Signature-Ed25519": signature.signature,
      "X-Signature-Timestamp": signature.timestamp,
    },
  });
}
beforeAll(async () => {
  const generated = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);
  if (!("privateKey" in generated)) throw new Error("Expected keypair");
  keys = generated;
  publicKey = hex(await crypto.subtle.exportKey("raw", keys.publicKey));
});

describe("Discord signer verification", () => {
  it("verifies the exact raw bytes including whitespace", async () => {
    const input = await signed('{ "type": 1 }');
    expect(await verifyDiscordSignature(input)).toBe(true);
    expect(
      await verifyDiscordSignature({
        ...input,
        rawBody: new TextEncoder().encode('{"type":1}'),
      }),
    ).toBe(false);
  });
  it("rejects forged, malformed, old and future signatures", async () => {
    const input = await signed("private body");
    for (const signature of [null, "not-hex", "00".repeat(64)])
      expect(await verifyDiscordSignature({ ...input, signature })).toBe(false);
    expect(
      await verifyDiscordSignature(
        await signed("body", String(now / 1000 - 300)),
      ),
    ).toBe(true);
    expect(
      await verifyDiscordSignature(
        await signed("body", String(now / 1000 - 301)),
      ),
    ).toBe(false);
    expect(
      await verifyDiscordSignature(
        await signed("body", String(now / 1000 + 1)),
      ),
    ).toBe(false);
  });
  it("extracts guild member identity and preserves tampered digest for canonical validation", () => {
    expect(
      parseDiscordDecision({
        ...payload,
        signerId: "forged",
        user: { id: "999" },
      }),
    ).toMatchObject({
      platform: "discord",
      signerId: "321",
      chatId: "789",
      messageId: "654",
      eventId: "456",
      digest8: "0123abcd",
    });
    expect(
      parseDiscordDecision({
        ...payload,
        member: undefined,
        user: { id: "321" },
      }),
    ).toBeNull();
    expect(
      parseDiscordDecision({
        ...payload,
        member: { user: { id: "321", bot: true } },
      }),
    ).toBeNull();
    expect(
      parseDiscordDecision({
        ...payload,
        data: { ...payload.data, custom_id: "intent:confirm:fedcba98" },
      }),
    ).toMatchObject({ digest8: "fedcba98" });
  });
  it("handles signed ping and enqueues before ephemeral acknowledgement", async () => {
    const enqueue = vi.fn(async () => "queued" as const);
    const handler = createDiscordInteractionHandler({
      publicKey,
      applicationId: "123",
      now: () => now,
      enqueue,
    });
    expect(
      await (
        await handler(
          await request(JSON.stringify({ type: 1, application_id: "123" })),
        )
      ).json(),
    ).toEqual({ type: 1 });
    expect(enqueue).not.toHaveBeenCalled();
    const response = await handler(await request());
    expect(enqueue).toHaveBeenCalledExactlyOnceWith(
      parseDiscordDecision(payload),
    );
    expect(await response.json()).toMatchObject({
      type: 4,
      data: { flags: 64 },
    });
  });
  it("rejects unauthenticated/wrong app/malformed events without enqueue or leaks", async () => {
    const enqueue = vi.fn(async () => "queued" as const);
    const handler = createDiscordInteractionHandler({
      publicKey,
      applicationId: "123",
      now: () => now,
      enqueue,
    });
    const invalid = new Request("https://example.test", {
      method: "POST",
      body: "private raw body",
    });
    expect(await (await handler(invalid)).text()).toBe("Unauthorized");
    expect(
      (
        await handler(
          await request(JSON.stringify({ ...payload, application_id: "999" })),
        )
      ).status,
    ).toBe(401);
    expect(
      (await handler(await request(JSON.stringify({ ...payload, data: {} }))))
        .status,
    ).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("does not claim durable acceptance when enqueue fails", async () => {
    const handler = createDiscordInteractionHandler({
      publicKey,
      applicationId: "123",
      now: () => now,
      enqueue: async () => {
        throw new Error("secret raw body");
      },
    });
    const response = await handler(await request());
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Temporarily unavailable");
  });
  it("privately rejects an unmapped signer without disabling the card", async () => {
    const enqueue = vi.fn(async () => "signers_only" as const);
    const handler = createDiscordInteractionHandler({
      publicKey,
      applicationId: "123",
      now: () => now,
      enqueue,
    });
    const response = await handler(await request());
    expect(await response.json()).toMatchObject({
      type: 4,
      data: { content: "Signers only.", flags: 64 },
    });
  });
});
