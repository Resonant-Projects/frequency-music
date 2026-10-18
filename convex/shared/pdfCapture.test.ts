import { describe, expect, test } from "vite-plus/test";
import {
  capPdfText,
  classifyFirecrawlResponse,
  isPdfMagic,
  isRetryablePdfFailure,
  PDF_FAILURES,
  PDF_MAX_BYTES,
  pdfFailureDetail,
  pdfRecoveryReason,
  pdfUploadProblem,
  sha256ToHex,
} from "./pdfCapture";
import { SOURCE_TEXT_MAX_CHARS } from "./sourceText";

describe("capPdfText", () => {
  test("keeps short text whole", () => {
    expect(capPdfText("  Preface text.  ")).toEqual({
      text: "Preface text.",
      chars: 13,
      truncated: false,
    });
  });

  test("keeps the first SOURCE_TEXT_MAX_CHARS characters and records the rest", () => {
    const result = capPdfText("a".repeat(SOURCE_TEXT_MAX_CHARS + 5));
    expect(result.text.length).toBe(SOURCE_TEXT_MAX_CHARS);
    expect(result).toMatchObject({
      chars: SOURCE_TEXT_MAX_CHARS + 5,
      truncated: true,
    });
  });

  test("drops a lone high surrogate the cut leaves at the end", () => {
    const text = `${"a".repeat(SOURCE_TEXT_MAX_CHARS - 1)}😀tail`;
    const result = capPdfText(text);
    expect(result.text).toBe("a".repeat(SOURCE_TEXT_MAX_CHARS - 1));
    expect(result.truncated).toBe(true);
  });
});

describe("sha256ToHex", () => {
  test("converts the base64 digest Convex stores to lowercase hex", () => {
    // sha256("") in base64 and hex.
    expect(sha256ToHex("47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  test("keeps a digest that is already hex, in lowercase", () => {
    expect(
      sha256ToHex(
        "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
      ),
    ).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("pdfUploadProblem", () => {
  test("accepts a PDF up to PDF_MAX_BYTES, with or without a content type", () => {
    expect(
      pdfUploadProblem({ size: PDF_MAX_BYTES, contentType: "application/pdf" }),
    ).toBeNull();
    expect(pdfUploadProblem({ size: 10 })).toBeNull();
  });

  test("refuses an empty file, a file over the cap, and other content types", () => {
    expect(pdfUploadProblem({ size: 0 })).toBe("Upload a PDF file.");
    expect(pdfUploadProblem({ size: PDF_MAX_BYTES + 1 })).toBe(
      "Upload a PDF of 25 MB or less.",
    );
    expect(pdfUploadProblem({ size: 10, contentType: "text/html" })).toBe(
      "Upload a PDF file.",
    );
  });
});

describe("isPdfMagic", () => {
  test("accepts bytes that start with %PDF-", () => {
    expect(isPdfMagic(new TextEncoder().encode("%PDF-1.7\n..."))).toBe(true);
  });

  test("rejects other bytes", () => {
    expect(isPdfMagic(new TextEncoder().encode("<html>"))).toBe(false);
    expect(isPdfMagic(new Uint8Array())).toBe(false);
  });
});

describe("PDF failure vocabulary", () => {
  test("unreadable bytes block with pdf_parse_error and never retry on their own", () => {
    for (const code of [
      "pdf_unreadable",
      "pdf_no_text",
      "pdf_not_pdf",
      "pdf_too_large",
    ] as const) {
      expect(PDF_FAILURES[code].reason).toBe("pdf_parse_error");
      expect(isRetryablePdfFailure(code)).toBe(false);
    }
  });

  test("fetch failures block with no_text, like any URL Source", () => {
    for (const code of [
      "pdf_fetch_network",
      "pdf_fetch_http",
      "pdf_firecrawl_error",
      "pdf_scrape_failed",
      "pdf_action_stale",
      "pdf_capture_unconfigured",
      "pdf_file_missing",
    ] as const) {
      expect(PDF_FAILURES[code].reason).toBe("no_text");
    }
  });

  test("HTTP failures retry only for 408, 429 and 5xx", () => {
    expect(isRetryablePdfFailure("pdf_fetch_http", 503)).toBe(true);
    expect(isRetryablePdfFailure("pdf_fetch_http", 429)).toBe(true);
    expect(isRetryablePdfFailure("pdf_fetch_http", 408)).toBe(true);
    expect(isRetryablePdfFailure("pdf_fetch_http", 404)).toBe(false);
    expect(isRetryablePdfFailure("pdf_firecrawl_error", 502)).toBe(true);
    expect(isRetryablePdfFailure("pdf_firecrawl_error", 400)).toBe(false);
    expect(isRetryablePdfFailure("pdf_fetch_network")).toBe(true);
    expect(isRetryablePdfFailure("pdf_action_stale")).toBe(true);
    expect(isRetryablePdfFailure("pdf_capture_unconfigured")).toBe(false);
  });

  test("details name the HTTP status when there is one", () => {
    expect(pdfFailureDetail("pdf_fetch_http", 404)).toBe(
      "The server returned HTTP 404.",
    );
    expect(pdfFailureDetail("pdf_unreadable")).toMatch(/could not read/);
  });
});

const pdfData = (markdown: string, metadata: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    markdown,
    metadata: {
      statusCode: 200,
      contentType: "application/pdf",
      ...metadata,
    },
  },
});

describe("classifyFirecrawlResponse", () => {
  test("returns markdown and the page count of a PDF", () => {
    expect(
      classifyFirecrawlResponse(
        "scrape",
        200,
        pdfData("Text", { numPages: 15 }),
      ),
    ).toEqual({ ok: true, markdown: "Text", numPages: 15 });
  });

  test("treats a success body that wraps a 404 page as an HTTP failure", () => {
    expect(
      classifyFirecrawlResponse(
        "scrape",
        200,
        pdfData("Sorry, page not found", {
          statusCode: 404,
          contentType: "text/html; charset=utf-8",
        }),
      ),
    ).toEqual({ ok: false, code: "pdf_fetch_http", httpStatus: 404 });
  });

  test("refuses a scraped URL that is not a PDF", () => {
    expect(
      classifyFirecrawlResponse(
        "scrape",
        200,
        pdfData("An HTML article", { contentType: "text/html" }),
      ),
    ).toEqual({ ok: false, code: "pdf_not_pdf" });
  });

  test("refuses a scrape that does not say it read a PDF", () => {
    for (const contentType of [undefined, 42])
      expect(
        classifyFirecrawlResponse(
          "scrape",
          200,
          pdfData("Some page", { contentType }),
        ),
      ).toEqual({ ok: false, code: "pdf_firecrawl_error", httpStatus: 200 });
  });

  test("accepts a parse of uploaded bytes without a content type", () => {
    expect(
      classifyFirecrawlResponse(
        "parse",
        200,
        pdfData("Text", { contentType: undefined }),
      ),
    ).toEqual({ ok: true, markdown: "Text" });
  });

  test("maps a parse that all engines failed to pdf_unreadable", () => {
    expect(
      classifyFirecrawlResponse("parse", 500, {
        success: false,
        code: "SCRAPE_ALL_ENGINES_FAILED",
      }),
    ).toEqual({ ok: false, code: "pdf_unreadable" });
  });

  test("maps a scrape that all engines failed to a retryable pdf_scrape_failed", () => {
    const result = classifyFirecrawlResponse("scrape", 500, {
      success: false,
      code: "SCRAPE_ALL_ENGINES_FAILED",
    });
    expect(result).toEqual({
      ok: false,
      code: "pdf_scrape_failed",
      httpStatus: 500,
    });
    // Engines also fail on fetch timeouts, so a 5xx scrape failure retries.
    expect(isRetryablePdfFailure("pdf_scrape_failed", 500)).toBe(true);
    expect(isRetryablePdfFailure("pdf_scrape_failed", 400)).toBe(false);
  });

  test("asks for the longer budget when Firecrawl needs more time", () => {
    expect(
      classifyFirecrawlResponse("scrape", 408, {
        success: false,
        code: "SCRAPE_PDF_INSUFFICIENT_TIME_ERROR",
      }),
    ).toEqual({ ok: false, code: "needs_more_time" });
  });

  test("maps 413 to pdf_too_large and other errors to pdf_firecrawl_error", () => {
    expect(classifyFirecrawlResponse("parse", 413, undefined)).toEqual({
      ok: false,
      code: "pdf_too_large",
    });
    expect(classifyFirecrawlResponse("parse", 502, undefined)).toEqual({
      ok: false,
      code: "pdf_firecrawl_error",
      httpStatus: 502,
    });
  });

  test("treats a malformed success body as a Firecrawl error", () => {
    expect(classifyFirecrawlResponse("parse", 200, { success: true })).toEqual({
      ok: false,
      code: "pdf_firecrawl_error",
      httpStatus: 200,
    });
  });
});

describe("pdfRecoveryReason", () => {
  test("says the capture is running while it is queued or parsing", () => {
    for (const state of ["queued", "parsing"] as const)
      expect(pdfRecoveryReason({ state })).toBe(
        "Lab Firecrawl is reading this PDF. Its text appears here when the capture finishes.",
      );
  });

  test("names the failure and the automatic retry while it waits", () => {
    expect(
      pdfRecoveryReason({
        state: "waiting",
        detail: "Firecrawl did not answer, or timed out.",
      }),
    ).toBe(
      "Firecrawl did not answer, or timed out. Another attempt runs automatically.",
    );
  });

  test("points an unreadable PDF to pasted text or a copy with a text layer", () => {
    expect(
      pdfRecoveryReason({
        state: "blocked",
        code: "pdf_unreadable",
        detail:
          "Firecrawl could not read this PDF. It can be scanned, damaged or protected.",
      }),
    ).toBe(
      "Firecrawl could not read this PDF. It can be scanned, damaged or protected. Provide its text, or upload a copy that has a text layer.",
    );
  });

  test("points a fetch failure to pasted text or Access changed", () => {
    expect(
      pdfRecoveryReason({
        state: "blocked",
        code: "pdf_fetch_http",
        detail: "The server returned HTTP 403.",
      }),
    ).toBe(
      "The server returned HTTP 403. Provide its text, or choose Access changed after the PDF opens for you.",
    );
  });

  test("falls back when no capture ran", () => {
    expect(pdfRecoveryReason(undefined)).toBe(
      "This PDF has no text yet. Provide its text, or choose Access changed to try again.",
    );
  });
});
