import { describe, expect, it, vi } from "vite-plus/test";
import {
  postSignerCard,
  renderSignerCard,
  updateSignerCard,
} from "./decisionSignerDelivery";

const card = {
  intentId: "intent",
  code: "D-17",
  actionLabel: "approve",
  targetTitle: "Target @everyone <@123>",
  note: "A *note*",
  payloadSummary: "Exact payload summary",
  payloadDigest: "0123abcd".repeat(8),
};
const destination = { platform: "discord" as const, chatId: "123" };

describe("signer card transport", () => {
  it("renders only confirm and cancel and prevents Discord mention/markdown injection", () => {
    const rendered = renderSignerCard("discord", card);
    expect(rendered.platform).toBe("discord");
    expect(JSON.stringify(rendered)).toContain("intent:confirm:0123abcd");
    expect(JSON.stringify(rendered)).toContain("intent:cancel");
    expect(JSON.stringify(rendered)).not.toContain("@everyone");
    if (rendered.platform !== "discord") throw new Error("Wrong platform");
    expect(rendered.payload.allowed_mentions.parse).toEqual([]);
    expect(rendered.payload.components[0]?.components).toHaveLength(2);
    expect(rendered.payload.content).toContain("\\*note\\*");
  });
  it("uses Telegram plain text and bounds content without truncating", () => {
    const rendered = renderSignerCard("telegram", card);
    expect(rendered.payload).not.toHaveProperty("parse_mode");
    expect(() =>
      renderSignerCard("telegram", {
        ...card,
        payloadSummary: "x".repeat(701),
      }),
    ).toThrow("Invalid signer card display");
    expect(() =>
      renderSignerCard("discord", { ...card, targetTitle: "bad\u202etext" }),
    ).toThrow();
  });
  it("persists only the actual returned platform binding after successful send", async () => {
    const order: string[] = [];
    const result = await postSignerCard({
      destination,
      card,
      post: async () => {
        order.push("post");
        return { id: "456", channel_id: "123" };
      },
      persistBinding: async (id, binding) => {
        order.push("persist");
        expect(id).toBe("intent");
        expect(binding).toEqual({ ...destination, messageId: "456" });
      },
    });
    expect(order).toEqual(["post", "persist"]);
    expect(result.status).toBe("posted");
  });
  it("validates Telegram's ok envelope and returned chat/message", async () => {
    const persistBinding = vi.fn(async () => {});
    expect(
      (
        await postSignerCard({
          destination: { platform: "telegram", chatId: "-123" },
          card,
          post: async () => ({
            ok: true,
            result: { message_id: 456, chat: { id: -123 } },
          }),
          persistBinding,
        })
      ).status,
    ).toBe("posted");
    expect(persistBinding).toHaveBeenCalledExactlyOnceWith("intent", {
      platform: "telegram",
      chatId: "-123",
      messageId: "456",
    });
  });
  it("never persists or retries a failed/ambiguous post or mismatched response", async () => {
    for (const response of [
      { id: "456", channel_id: "999" },
      {},
      { ok: false, description: "secret" },
    ]) {
      const post = vi.fn(async () => response);
      const persistBinding = vi.fn(async () => {});
      expect(
        await postSignerCard({ destination, card, post, persistBinding }),
      ).toEqual({ status: "post_unconfirmed" });
      expect(post).toHaveBeenCalledTimes(1);
      expect(persistBinding).not.toHaveBeenCalled();
    }
    const persistBinding = vi.fn(async () => {});
    expect(
      await postSignerCard({
        destination,
        card,
        post: async () => {
          throw new Error("bot-token");
        },
        persistBinding,
      }),
    ).toEqual({ status: "post_unconfirmed" });
    expect(persistBinding).not.toHaveBeenCalled();
  });
  it("retains a real binding on persistence failure for reconciliation", async () => {
    expect(
      await postSignerCard({
        destination,
        card,
        post: async () => ({ id: "456", channel_id: "123" }),
        persistBinding: async () => {
          throw new Error("private database error");
        },
      }),
    ).toEqual({
      status: "binding_unconfirmed",
      binding: { ...destination, messageId: "456" },
    });
  });
  it("does not send malformed display data", async () => {
    const post = vi.fn(async () => ({}));
    expect(
      await postSignerCard({
        destination,
        card: { ...card, intentId: "intent:forged" },
        post,
        persistBinding: async () => {},
      }),
    ).toEqual({ status: "invalid_card" });
    expect(post).not.toHaveBeenCalled();
  });
  it("updates terminal states with fixed text and removes buttons", async () => {
    for (const result of [
      "applied",
      "cancelled",
      "expired",
      "rejected",
    ] as const) {
      const edit = vi.fn(async () => {});
      expect(
        await updateSignerCard({
          binding: { ...destination, messageId: "456" },
          result,
          edit,
        }),
      ).toEqual({ status: "updated" });
      expect(edit.mock.calls[0]).toEqual([
        { ...destination, messageId: "456" },
        expect.objectContaining({
          payload: expect.objectContaining({ components: [] }),
        }),
        expect.any(AbortSignal),
      ]);
    }
  });
  it("keeps valid buttons on unknown-signer rejection and sanitizes edit failures", async () => {
    const edit = vi.fn(async () => {
      throw new Error("bot-token");
    });
    expect(
      await updateSignerCard({
        binding: { ...destination, messageId: "456" },
        result: "signersOnly",
        edit,
      }),
    ).toEqual({ status: "update_failed" });
    expect(edit).not.toHaveBeenCalled();
    expect(
      await updateSignerCard({
        binding: { ...destination, messageId: "456" },
        result: "applied",
        edit,
      }),
    ).toEqual({ status: "update_failed" });
  });
});
