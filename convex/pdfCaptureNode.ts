"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  capPdfText,
  classifyFirecrawlResponse,
  type FirecrawlPdfResult,
  isPdfMagic,
  PDF_CONTENT_TYPE,
  PDF_MAX_BYTES,
  type PdfFailureCode,
} from "./shared/pdfCapture";

// Lab Firecrawl reads PDFs for Convex: POST /v2/parse with uploaded bytes,
// POST /v2/scrape with a public URL. Its egress proxy blocks private and
// metadata targets after DNS and on redirects, so Convex never fetches a
// user-supplied URL itself. Firecrawl Cloud is never called.
const FIRECRAWL_CLOUD_HOST = "api.firecrawl.dev";
const SCRAPE_TIMEOUT_MS = 45_000;
// Firecrawl refuses a long PDF up front when its page count needs more time
// than the request allows; such a PDF gets one retry with this budget.
const LONG_PDF_TIMEOUT_MS = 180_000;
const PARSE_TIMEOUT_MS = 180_000;
// A 531-page book returns about 1.1 MB of JSON; refuse anything far larger
// before it is buffered.
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

type Failure = { code: PdfFailureCode; httpStatus?: number };

function firecrawlBaseUrl(): string | null {
  const baseUrl = (process.env.FIRECRAWL_API_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (process.env.FIRECRAWL_SCRAPE_EGRESS_GUARDED !== "true" || !baseUrl)
    return null;
  try {
    // Any scheme or port of the Cloud host would send it uploaded bytes.
    const host = new URL(baseUrl).hostname.replace(/\.$/, "");
    if (host === FIRECRAWL_CLOUD_HOST) return null;
  } catch {
    return null;
  }
  return baseUrl;
}

class ResponseTooLarge extends Error {}

/** The response body as text, refusing more than MAX_RESPONSE_BYTES. */
async function readCappedText(response: Response): Promise<string> {
  if (
    Number(response.headers.get("content-length") ?? 0) > MAX_RESPONSE_BYTES
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new ResponseTooLarge();
  }
  if (!response.body) return await response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ResponseTooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function callFirecrawl(
  endpoint: "parse" | "scrape",
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<FirecrawlPdfResult> {
  const response = await fetch(url, {
    ...init,
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  let text: string;
  try {
    text = await readCappedText(response);
  } catch (error) {
    if (error instanceof ResponseTooLarge)
      return {
        ok: false,
        code: "pdf_firecrawl_error",
        httpStatus: response.status,
      };
    // A broken connection or timeout mid-body is a network failure: retry.
    throw error;
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // An error page (for example the proxy's 413 HTML) has no JSON body.
    body = undefined;
  }
  return classifyFirecrawlResponse(endpoint, response.status, body);
}

async function parseUpload(
  baseUrl: string,
  bytes: Blob,
): Promise<FirecrawlPdfResult> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: PDF_CONTENT_TYPE }),
    "upload.pdf",
  );
  return await callFirecrawl(
    "parse",
    `${baseUrl}/v2/parse`,
    { body: form },
    PARSE_TIMEOUT_MS,
  );
}

async function scrapeUrl(
  baseUrl: string,
  url: string,
): Promise<FirecrawlPdfResult> {
  const scrape = (timeoutMs: number) =>
    callFirecrawl(
      "scrape",
      `${baseUrl}/v2/scrape`,
      {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          removeBase64Images: true,
          skipTlsVerification: false,
          timeout: timeoutMs - 5_000,
        }),
      },
      timeoutMs,
    );
  const first = await scrape(SCRAPE_TIMEOUT_MS);
  return !first.ok && first.code === "needs_more_time"
    ? await scrape(LONG_PDF_TIMEOUT_MS)
    : first;
}

/**
 * Run one scheduled PDF capture attempt. The action only reads; the
 * internal mutations in pdfCapture.ts claim the attempt and record its outcome.
 */
export const capturePdf = internalAction({
  args: { sourceId: v.id("sources"), seq: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const plan = await ctx.runMutation(
      internal.pdfCapture.startPdfAttempt,
      args,
    );
    if (!plan) return null;
    const fail = async ({ code, httpStatus }: Failure) => {
      await ctx.runMutation(internal.pdfCapture.recordPdfCapture, {
        ...args,
        outcome: "failed",
        code,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
      });
      return null;
    };

    const baseUrl = firecrawlBaseUrl();
    if (!baseUrl) return await fail({ code: "pdf_capture_unconfigured" });

    let result: FirecrawlPdfResult;
    try {
      if (plan.endpoint === "parse") {
        const blob = await ctx.storage.get(plan.storageId);
        if (!blob) return await fail({ code: "pdf_file_missing" });
        if (blob.size > PDF_MAX_BYTES)
          return await fail({ code: "pdf_too_large" });
        if (!isPdfMagic(new Uint8Array(await blob.slice(0, 5).arrayBuffer())))
          return await fail({ code: "pdf_not_pdf" });
        result = await parseUpload(baseUrl, blob);
      } else {
        result = await scrapeUrl(baseUrl, plan.url);
      }
    } catch {
      // Timeouts, refused connections and oversized responses.
      return await fail({ code: "pdf_fetch_network" });
    }

    if (!result.ok) {
      // A second "needs more time" after the long budget is a fetch failure.
      return await fail(
        result.code === "needs_more_time"
          ? { code: "pdf_fetch_network" }
          : { code: result.code, httpStatus: result.httpStatus },
      );
    }
    const { text, chars, truncated } = capPdfText(result.markdown);
    await ctx.runMutation(internal.pdfCapture.recordPdfCapture, {
      ...args,
      outcome: "captured",
      text,
      chars,
      truncated,
      ...(result.numPages !== undefined ? { numPages: result.numPages } : {}),
    });
    return null;
  },
});
