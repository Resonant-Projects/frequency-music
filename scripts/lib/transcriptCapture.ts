import { ConvexError } from "convex/values";

type CaptureResult =
  | { ok: true; chars: number }
  | { ok: false; error: unknown; statusError?: string };

/** Capture one source without letting a stale or failed write abort its batch. */
export async function captureTranscript(operations: {
  fetch: () => Promise<string>;
  save: (transcript: string) => Promise<unknown>;
  markFailed: (details: string) => Promise<unknown>;
}): Promise<CaptureResult> {
  try {
    const transcript = await operations.fetch();
    if (!transcript) throw new Error("Empty transcript");
    await operations.save(transcript);
    return { ok: true, chars: transcript.length };
  } catch (error) {
    if (
      error instanceof ConvexError &&
      typeof error.data === "object" &&
      error.data !== null &&
      "code" in error.data &&
      error.data.code === "CONFLICT"
    ) {
      // The snapshot no longer owns the source. Preserve the newer state.
      return { ok: false, error };
    }
    try {
      await operations.markFailed(`Transcript fetch failed: ${String(error)}`);
      return { ok: false, error };
    } catch (statusError) {
      return { ok: false, error, statusError: String(statusError) };
    }
  }
}
