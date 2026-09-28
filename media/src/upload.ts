// Transport for artifact bytes. Convex storage upload URLs accept a POST with
// the file body and the content-type header, and answer { storageId }.
import { readFile } from "node:fs/promises";
import { callTool } from "./convex";
import type { ToolClient } from "./jobs/types";

export async function uploadBytes(
  uploadUrl: string,
  path: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<{ storageId: string }> {
  const bytes = await readFile(path);
  const timeout = AbortSignal.timeout(10 * 60 * 1000);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": mimeType },
    body: bytes,
    // The upload URL is single-use and same-origin by construction; never
    // follow a redirect that could carry the bytes elsewhere.
    redirect: "error",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`upload failed: ${response.status}`);
  return (await response.json()) as { storageId: string };
}

// Only returns closures; no I/O happens until a method is called.
export function liveTools(): ToolClient {
  return {
    generateAudioUploadUrl: (args) => callTool("generateAudioUploadUrl", args),
    attachAudioStorage: (args) => callTool("attachAudioStorage", args),
    uploadBytes,
  };
}
