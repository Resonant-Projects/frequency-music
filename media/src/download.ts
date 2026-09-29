// Fetches a blob (a Convex storage URL) to disk. Storage URLs are
// capability-bearing, so an error never repeats the URL: only the status, or
// "request error" when the fetch itself failed (a refused redirect, DNS,
// connection reset).
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

export async function downloadTo(
  url: string,
  path: string,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: "error", signal });
  } catch (error) {
    // The caller's deadline is not a download failure; surface it as is.
    if (signal?.aborted) throw error;
    throw new Error("download failed: request error", { cause: error });
  }
  if (!response.ok || !response.body) {
    // Release the socket; the body is never read into the error.
    await response.body?.cancel();
    throw new Error(`download failed: ${response.status}`);
  }
  await pipeline(
    Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
    createWriteStream(path),
    { signal },
  );
}
