// Pure cross-runtime contract for PDF capture: the web form checks files
// against these limits, Convex intake checks the _storage row again, and the
// capture action classifies Lab Firecrawl responses with the same vocabulary.
// May import only convex/values, convex-helpers/validators, or zod.
import type { SourceBlockedReason } from "./statuses";
import { SOURCE_TEXT_MAX_CHARS } from "./sourceText";
import { truncateText } from "./truncateText";

// Lab Firecrawl's proxy accepts a 30 MB upload and refuses 50 MB (2026-10-17);
// the largest research PDF on hand is 11.8 MB.
export const PDF_MAX_BYTES = 25 * 1024 * 1024;
export const PDF_CONTENT_TYPE = "application/pdf";
// Failed attempts in one capture run before the Source is parked.
export const PDF_MAX_ATTEMPTS = 3;
// Delay before attempt 2 and attempt 3.
export const PDF_RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;
// Node actions stop at 10 minutes; an attempt still open after this failed.
export const PDF_ATTEMPT_DEADLINE_MS = 12 * 60_000;
export const PDF_DETAIL_MAX_CHARS = 500;

type PdfFailure = {
  reason: SourceBlockedReason;
  retryable: boolean | "http";
  detail: string;
};

export const PDF_FAILURES = {
  // The bytes or their text are the problem: another try cannot help.
  pdf_unreadable: {
    reason: "pdf_parse_error",
    retryable: false,
    detail:
      "Firecrawl could not read this PDF. It can be scanned, damaged or protected.",
  },
  pdf_no_text: {
    reason: "pdf_parse_error",
    retryable: false,
    detail: "This PDF gave almost no text. Its pages can be images.",
  },
  pdf_not_pdf: {
    reason: "pdf_parse_error",
    retryable: false,
    detail: "The file is not a PDF.",
  },
  pdf_too_large: {
    reason: "pdf_parse_error",
    retryable: false,
    detail: "The PDF is over 25 MB.",
  },
  // The text could not be fetched, as for any URL Source.
  pdf_fetch_network: {
    reason: "no_text",
    retryable: true,
    detail: "Firecrawl did not answer, or timed out.",
  },
  pdf_fetch_http: {
    reason: "no_text",
    retryable: "http",
    detail: "The server returned HTTP {status}.",
  },
  pdf_firecrawl_error: {
    reason: "no_text",
    retryable: "http",
    detail: "Firecrawl returned HTTP {status}.",
  },
  // Scrape engines also fail on fetch timeouts, so a 5xx failure retries.
  pdf_scrape_failed: {
    reason: "no_text",
    retryable: "http",
    detail: "Firecrawl could not fetch or read the PDF at this URL.",
  },
  pdf_action_stale: {
    reason: "no_text",
    retryable: true,
    detail: "The extraction stopped before it finished.",
  },
  pdf_capture_unconfigured: {
    reason: "no_text",
    retryable: false,
    detail: "PDF capture through Lab Firecrawl is off in this deployment.",
  },
  pdf_file_missing: {
    reason: "no_text",
    retryable: false,
    detail: "The uploaded PDF file is no longer in storage.",
  },
} as const satisfies Record<string, PdfFailure>;

export type PdfFailureCode = keyof typeof PDF_FAILURES;
export const PDF_FAILURE_CODES = Object.keys(PDF_FAILURES) as PdfFailureCode[];

export function isRetryablePdfFailure(
  code: PdfFailureCode,
  httpStatus?: number,
): boolean {
  const { retryable } = PDF_FAILURES[code] as PdfFailure;
  if (retryable !== "http") return retryable;
  return (
    httpStatus === 408 ||
    httpStatus === 429 ||
    (httpStatus !== undefined && httpStatus >= 500)
  );
}

export function pdfFailureDetail(
  code: PdfFailureCode,
  httpStatus?: number,
): string {
  return PDF_FAILURES[code].detail.replace(
    "{status}",
    httpStatus === undefined ? "an error" : String(httpStatus),
  );
}

/**
 * Keep the first SOURCE_TEXT_MAX_CHARS characters of captured text. Convex
 * rejects a string that ends in a lone high surrogate, so the cut never
 * splits a surrogate pair.
 */
export function capPdfText(markdown: string): {
  text: string;
  chars: number;
  truncated: boolean;
} {
  const full = markdown.trim();
  const text = truncateText(full, SOURCE_TEXT_MAX_CHARS);
  return { text, chars: full.length, truncated: text.length < full.length };
}

/** Convex stores _storage.sha256 as base64; dedupe keys use lowercase hex. */
export function sha256ToHex(digest: string): string {
  if (/^[0-9a-f]{64}$/i.test(digest)) return digest.toLowerCase();
  return Array.from(atob(digest), (char) =>
    char.charCodeAt(0).toString(16).padStart(2, "0"),
  ).join("");
}

/** Why an uploaded file cannot become a PDF Source, or null when it can. */
export function pdfUploadProblem(file: {
  size: number;
  contentType?: string;
}): string | null {
  if (file.size > PDF_MAX_BYTES) return "Upload a PDF of 25 MB or less.";
  if (
    file.size === 0 ||
    (file.contentType && file.contentType !== PDF_CONTENT_TYPE)
  )
    return "Upload a PDF file.";
  return null;
}

export function isPdfMagic(bytes: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
  return magic.every((byte, index) => bytes[index] === byte);
}

export type FirecrawlPdfResult =
  | { ok: true; markdown: string; numPages?: number }
  | {
      ok: false;
      code: PdfFailureCode | "needs_more_time";
      httpStatus?: number;
    };

/**
 * Classify one Lab Firecrawl response. `parse` is POST /v2/parse with the
 * uploaded bytes; `scrape` is POST /v2/scrape with a public URL. Firecrawl
 * reports success for an error page it fetched, so the page's own status
 * and content type decide.
 */
export function classifyFirecrawlResponse(
  endpoint: "parse" | "scrape",
  httpStatus: number,
  body: unknown,
): FirecrawlPdfResult {
  const payload = (body && typeof body === "object" ? body : {}) as {
    success?: unknown;
    code?: unknown;
    data?: { markdown?: unknown; metadata?: Record<string, unknown> };
  };
  if (payload.code === "SCRAPE_PDF_INSUFFICIENT_TIME_ERROR")
    return { ok: false, code: "needs_more_time" };
  // For uploaded bytes this is deterministic (scanned, damaged or truncated
  // files all give it); for a URL it can also be a fetch timeout.
  if (payload.code === "SCRAPE_ALL_ENGINES_FAILED")
    return endpoint === "parse"
      ? { ok: false, code: "pdf_unreadable" }
      : { ok: false, code: "pdf_scrape_failed", httpStatus };
  if (httpStatus === 413) return { ok: false, code: "pdf_too_large" };
  if (
    httpStatus < 200 ||
    httpStatus >= 300 ||
    payload.success !== true ||
    typeof payload.data?.markdown !== "string"
  )
    return { ok: false, code: "pdf_firecrawl_error", httpStatus };
  const metadata = payload.data.metadata ?? {};
  if (typeof metadata.statusCode === "number" && metadata.statusCode >= 400)
    return {
      ok: false,
      code: "pdf_fetch_http",
      httpStatus: metadata.statusCode,
    };
  if (
    typeof metadata.contentType === "string" &&
    !metadata.contentType.toLowerCase().includes(PDF_CONTENT_TYPE)
  )
    return { ok: false, code: "pdf_not_pdf" };
  return {
    ok: true,
    markdown: payload.data.markdown,
    ...(typeof metadata.numPages === "number"
      ? { numPages: metadata.numPages }
      : {}),
  };
}

/** The recovery panel's sentence for a PDF Source that still has no text. */
export function pdfRecoveryReason(
  capture: { state?: string; code?: string; detail?: string } | undefined,
): string {
  if (capture?.state === "queued" || capture?.state === "parsing")
    return "Lab Firecrawl is reading this PDF. Its text appears here when the capture finishes.";
  if (capture?.state === "waiting" && capture.detail)
    return `${capture.detail} Another attempt runs automatically.`;
  const failure =
    capture?.code && capture.code in PDF_FAILURES
      ? PDF_FAILURES[capture.code as PdfFailureCode]
      : undefined;
  if (capture?.state === "blocked" && failure && capture.detail)
    return failure.reason === "pdf_parse_error"
      ? `${capture.detail} Provide its text, or upload a copy that has a text layer.`
      : `${capture.detail} Provide its text, or choose Access changed after the PDF opens for you.`;
  return "This PDF has no text yet. Provide its text, or choose Access changed to try again.";
}
