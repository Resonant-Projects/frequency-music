export type QueueFailureCode =
  | "transport_failure"
  | "deadline_exceeded"
  | "http_failure"
  | "response_too_large"
  | "invalid_json"
  | "invalid_timestamp"
  | "convex_error"
  | "invalid_envelope"
  | "value_decode_failure"
  | "invalid_page_shape"
  | "split_required"
  | "pause_changed"
  | "invalid_counts"
  | "invalid_page_total"
  | "invalid_cursor"
  | "page_limit"
  | "invalid_input";

export type QueueDiagnostic = {
  stage: "input" | "timestamp" | "query" | "page";
  pageNumber: number;
  httpStatus?: number;
  envelope?: "success" | "error" | "other";
};

/** All fields originate in our code, never in backend error messages. */
export class QueueEvidenceFailure extends Error {
  constructor(
    readonly code: QueueFailureCode,
    readonly diagnostic: QueueDiagnostic,
  ) {
    super(code);
  }
}

export function queueFailureReport(error: unknown) {
  return error instanceof QueueEvidenceFailure
    ? { complete: false, code: error.code, ...error.diagnostic }
    : { complete: false, code: "invalid_input", stage: "input", pageNumber: 0 };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Bound buffering before the SDK sees a response. No body text escapes errors. */
export async function inspectQueueResponse(
  response: Response,
  diagnostic: QueueDiagnostic,
) {
  diagnostic.httpStatus = response.status;
  if (!response.ok)
    throw new QueueEvidenceFailure("http_failure", { ...diagnostic });
  if (!response.body)
    throw new QueueEvidenceFailure("invalid_json", { ...diagnostic });
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 64 * 1024)
        throw new QueueEvidenceFailure("response_too_large", { ...diagnostic });
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks);
  let body: unknown;
  try {
    body = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new QueueEvidenceFailure("invalid_json", { ...diagnostic });
  }
  if (diagnostic.stage === "timestamp") {
    if (
      !isRecord(body) ||
      typeof body.ts !== "string" ||
      !body.ts ||
      body.ts.length > 1024
    ) {
      throw new QueueEvidenceFailure("invalid_timestamp", { ...diagnostic });
    }
  } else {
    diagnostic.envelope =
      isRecord(body) && (body.status === "success" || body.status === "error")
        ? body.status
        : "other";
    if (diagnostic.envelope === "error")
      throw new QueueEvidenceFailure("convex_error", { ...diagnostic });
    if (diagnostic.envelope !== "success")
      throw new QueueEvidenceFailure("invalid_envelope", { ...diagnostic });
  }
  return new Response(bytes, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
