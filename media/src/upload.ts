// Transport for artifact bytes. Convex storage upload URLs accept a POST with
// the file body and the content-type header, and answer { storageId }.
import { Effect } from "effect";
import { attempt } from "./effects";
import { readFile } from "node:fs/promises";
import { callTool } from "./convex";
import { MAX_UPLOAD_BYTES } from "../../convex/shared/uploadLimits";
import type { ToolClient } from "./jobs/types";

// The cap is shared with Convex, which checks it before minting a human
// studio upload URL; see convex/shared/uploadLimits.ts.
export { MAX_UPLOAD_BYTES };

export function assertUnderUploadCap(role: string, bytes: number): void {
  if (bytes <= MAX_UPLOAD_BYTES) return;
  const mb = (bytes / 1e6).toFixed(1);
  throw new Error(
    `${role} is ${mb} MB, over the ${MAX_UPLOAD_BYTES / 1e6} MB upload cap (Cloudflare); split the script or move masters to FLAC`,
  );
}

export function uploadBytes(
  uploadUrl: string,
  path: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<{ storageId: string }> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const bytes = yield* attempt(() => readFile(path));
      const timeout = AbortSignal.timeout(10 * 60 * 1000);
      const response = yield* attempt((fiberSignal) =>
        fetch(uploadUrl, {
          method: "POST",
          headers: { "content-type": mimeType },
          body: bytes,
          // The upload URL is single-use and same-origin by construction; never
          // follow a redirect that could carry the bytes elsewhere.
          redirect: "error",
          signal: AbortSignal.any([
            fiberSignal,
            timeout,
            ...(signal ? [signal] : []),
          ]),
        }),
      );
      if (!response.ok) throw new Error(`upload failed: ${response.status}`);
      return (yield* attempt(() => response.json())) as { storageId: string };
    }),
  );
}

// Only returns closures; no I/O happens until a method is called. The signal
// is the job's deadline: every tool call and upload made for the job is
// abandoned with it.
export function liveTools(signal?: AbortSignal): ToolClient {
  return {
    generateAudioUploadUrl: (args) =>
      callTool("generateAudioUploadUrl", args, signal),
    attachAudioStorage: (args) => callTool("attachAudioStorage", args, signal),
    uploadBytes: (uploadUrl, path, mimeType, callSignal) =>
      uploadBytes(
        uploadUrl,
        path,
        mimeType,
        callSignal && signal
          ? AbortSignal.any([callSignal, signal])
          : (callSignal ?? signal),
      ),
  };
}
