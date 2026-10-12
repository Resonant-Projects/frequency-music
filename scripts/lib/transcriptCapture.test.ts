import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vite-plus/test";
import { captureTranscript } from "./transcriptCapture";

describe("transcript capture batch isolation", () => {
  test("a stale capture preserves newer state and the next source is saved", async () => {
    const markFailed = vi.fn();
    const save = vi
      .fn()
      .mockRejectedValueOnce(
        new ConvexError({ code: "CONFLICT", message: "Source changed" }),
      )
      .mockResolvedValueOnce(null);
    const results = [];
    for (const transcript of ["stale transcript", "next transcript"]) {
      results.push(
        await captureTranscript({
          fetch: () => Promise.resolve(transcript),
          save,
          markFailed,
        }),
      );
    }
    expect(results[0]?.ok).toBe(false);
    expect(results[1]).toEqual({ ok: true, chars: 15 });
    expect(markFailed).not.toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith("next transcript");
  });

  test.each([
    new ConvexError({ code: "CONFLICT", message: "Source changed" }),
    new Error("Status write unavailable"),
  ])(
    "a failure-status write error is reported and the batch continues: %s",
    async (statusError) => {
      const fetchError = new Error("Fabric unavailable");
      const fetch = vi
        .fn()
        .mockRejectedValueOnce(fetchError)
        .mockResolvedValueOnce("next transcript");
      const markFailed = vi.fn().mockRejectedValue(statusError);
      const save = vi.fn().mockResolvedValue(null);
      const results = [];
      for (let index = 0; index < 2; index++) {
        results.push(await captureTranscript({ fetch, save, markFailed }));
      }
      expect(results[0]).toEqual({
        ok: false,
        error: fetchError,
        statusError: String(statusError),
      });
      expect(results[1]).toEqual({ ok: true, chars: 15 });
      expect(markFailed).toHaveBeenCalledOnce();
      expect(markFailed).toHaveBeenCalledWith(
        "Transcript fetch failed: Error: Fabric unavailable",
      );
      expect(save).toHaveBeenCalledWith("next transcript");
    },
  );

  test("an empty transcript records the no-text failure", async () => {
    const markFailed = vi.fn().mockResolvedValue(null);
    const save = vi.fn();
    const result = await captureTranscript({
      fetch: () => Promise.resolve(""),
      save,
      markFailed,
    });
    expect(result.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(
      "Transcript fetch failed: Error: Empty transcript",
    );
  });
});
