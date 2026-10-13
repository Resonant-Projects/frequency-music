import { describe, expect, it, vi } from "vite-plus/test";
import { postSignerCard } from "./decisionSignerDelivery";
import { withSignerDeadline } from "./decisionSignerTransport";

describe("signer operation deadlines", () => {
  it("aborts a stuck transport and never persists a late post response", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      let complete: ((value: unknown) => void) | undefined;
      const persistBinding = vi.fn(async () => {});
      const result = postSignerCard({
        destination: { platform: "discord", chatId: "123" },
        card: {
          intentId: "intent",
          code: "D-17",
          actionLabel: "approve",
          targetTitle: "Title",
          note: "Note",
          payloadSummary: "Summary",
          payloadDigest: "a".repeat(64),
        },
        post: (_destination, _card, abort) => {
          signal = abort;
          return new Promise((resolve) => {
            complete = resolve;
          });
        },
        persistBinding,
      });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await result).toEqual({ status: "post_unconfirmed" });
      expect(signal?.aborted).toBe(true);
      complete?.({ id: "456", channel_id: "123" });
      await vi.advanceTimersByTimeAsync(1);
      expect(persistBinding).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("clears the deadline after an operation succeeds or throws", async () => {
    vi.useFakeTimers();
    try {
      expect(await withSignerDeadline(async () => "ok")).toBe("ok");
      await expect(
        withSignerDeadline(async () => {
          throw new Error("failed");
        }),
      ).rejects.toThrow("failed");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
