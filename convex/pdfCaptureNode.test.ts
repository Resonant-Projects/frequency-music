import { convexTest } from "convex-test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "../harness/modules";
import { SOURCE_TEXT_MAX_CHARS } from "./shared/sourceText";

type T = ReturnType<typeof convexTest>;

const FIRECRAWL = "http://firecrawl.lab.test:3002";
const prose =
  "Meantone temperament narrows the fifth so that major thirds come out pure, which suits keyboard music in a few keys. ".repeat(
    4,
  );

type Call = { url: string; init: RequestInit };
let calls: Call[];

function respondWith(
  ...responses: Array<{ status: number; body: unknown } | Error>
) {
  const queue = [...responses];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      const next = queue.shift();
      if (!next) throw new Error("unexpected fetch");
      if (next instanceof Error) throw next;
      return new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

const pdfSuccess = (markdown: string, numPages = 12, metadata = {}) => ({
  status: 200,
  body: {
    success: true,
    data: {
      markdown,
      metadata: {
        statusCode: 200,
        contentType: "application/pdf",
        numPages,
        ...metadata,
      },
    },
  },
});

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  vi.stubEnv("FIRECRAWL_API_URL", `${FIRECRAWL}/`);
  vi.stubEnv("FIRECRAWL_SCRAPE_EGRESS_GUARDED", "true");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const reader = (t: T) => t.withIdentity({ subject: "reader" });
const source = (t: T, id: Id<"sources">) =>
  t.run((ctx) => ctx.db.get("sources", id));

async function uploaded(t: T, body = "%PDF-1.7\nbytes") {
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([body])));
  const { id } = await reader(t).mutation(api.pdfCapture.createFromPdfUpload, {
    storageId,
    fileName: "grant.pdf",
  });
  return id;
}

async function fromUrl(t: T, url = "https://example.org/paper.pdf") {
  const { id } = await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
    url,
  });
  return id;
}

async function capture(t: T, id: Id<"sources">) {
  const seq = (await source(t, id))!.metadata.pdfCapture.seq as number;
  await t.action(internal.pdfCaptureNode.capturePdf, { sourceId: id, seq });
}

describe("capturePdf: uploads", () => {
  test("sends the stored bytes to Lab Firecrawl /v2/parse and stores the text", async () => {
    const t = convexTest(schema, modules);
    const id = await uploaded(t);
    respondWith(pdfSuccess(prose, 12));
    await capture(t, id);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${FIRECRAWL}/v2/parse`);
    expect(calls[0]!.init.method).toBe("POST");
    const form = calls[0]!.init.body as FormData;
    const file = form.get("file") as File;
    expect(file.type).toBe("application/pdf");
    expect(await file.text()).toBe("%PDF-1.7\nbytes");
    expect(await source(t, id)).toMatchObject({
      status: "text_ready",
      rawText: prose.trim(),
      metadata: {
        pdfCapture: {
          state: "captured",
          endpoint: "parse",
          numPages: 12,
          truncated: false,
        },
      },
    });
  });

  test("keeps the first SOURCE_TEXT_MAX_CHARS characters of a long book", async () => {
    const t = convexTest(schema, modules);
    const id = await uploaded(t);
    const book = prose.repeat(
      Math.ceil((SOURCE_TEXT_MAX_CHARS * 2) / prose.length),
    );
    respondWith(pdfSuccess(book, 531));
    await capture(t, id);
    const row = (await source(t, id))!;
    expect(row.rawText!.length).toBe(SOURCE_TEXT_MAX_CHARS);
    expect(row.metadata.pdfCapture).toMatchObject({
      truncated: true,
      chars: book.trim().length,
      numPages: 531,
    });
  });

  test("a file that is not a PDF blocks before any Firecrawl call", async () => {
    const t = convexTest(schema, modules);
    const id = await uploaded(t, "<html>not a pdf</html>");
    respondWith();
    await capture(t, id);
    expect(calls).toEqual([]);
    expect(await source(t, id)).toMatchObject({
      status: "review_needed",
      blockedReason: "pdf_parse_error",
      metadata: { pdfCapture: { code: "pdf_not_pdf" } },
    });
  });

  test("a PDF Firecrawl cannot read blocks with pdf_parse_error", async () => {
    const t = convexTest(schema, modules);
    const id = await uploaded(t);
    respondWith({
      status: 500,
      body: { success: false, code: "SCRAPE_ALL_ENGINES_FAILED" },
    });
    await capture(t, id);
    expect(await source(t, id)).toMatchObject({
      status: "review_needed",
      blockedReason: "pdf_parse_error",
      metadata: { pdfCapture: { code: "pdf_unreadable" } },
    });
  });

  test("a network failure waits for a retry", async () => {
    const t = convexTest(schema, modules);
    const id = await uploaded(t);
    respondWith(new TypeError("fetch failed"));
    await capture(t, id);
    expect(await source(t, id)).toMatchObject({
      status: "ingested",
      metadata: {
        pdfCapture: { state: "waiting", code: "pdf_fetch_network", tries: 2 },
      },
    });
  });
});

describe("capturePdf: URLs", () => {
  test("asks Lab Firecrawl /v2/scrape for the URL, with TLS verification on", async () => {
    const t = convexTest(schema, modules);
    const id = await fromUrl(t);
    respondWith(pdfSuccess(prose, 15));
    await capture(t, id);
    expect(calls[0]!.url).toBe(`${FIRECRAWL}/v2/scrape`);
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({
      url: "https://example.org/paper.pdf",
      formats: ["markdown"],
      onlyMainContent: true,
      removeBase64Images: true,
      skipTlsVerification: false,
    });
    expect(await source(t, id)).toMatchObject({
      status: "text_ready",
      metadata: { pdfCapture: { endpoint: "scrape", numPages: 15 } },
    });
  });

  test("retries once with the longer budget when Firecrawl needs more time", async () => {
    const t = convexTest(schema, modules);
    const id = await fromUrl(t);
    respondWith(
      {
        status: 408,
        body: { success: false, code: "SCRAPE_PDF_INSUFFICIENT_TIME_ERROR" },
      },
      pdfSuccess(prose, 531),
    );
    await capture(t, id);
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[1]!.init.body as string).timeout).toBeGreaterThan(
      JSON.parse(calls[0]!.init.body as string).timeout,
    );
    expect((await source(t, id))!.status).toBe("text_ready");
  });

  test("a 404 page that Firecrawl reports as success blocks no_text", async () => {
    const t = convexTest(schema, modules);
    const id = await fromUrl(t);
    respondWith(
      pdfSuccess("Sorry, page not found", 0, {
        statusCode: 404,
        contentType: "text/html; charset=utf-8",
      }),
    );
    await capture(t, id);
    expect(await source(t, id)).toMatchObject({
      status: "review_needed",
      blockedReason: "no_text",
      blockedDetails: "The server returned HTTP 404.",
    });
  });
});

describe("capturePdf: configuration", () => {
  test.each([
    ["no Firecrawl URL", { FIRECRAWL_API_URL: "" }],
    ["egress not guarded", { FIRECRAWL_SCRAPE_EGRESS_GUARDED: "false" }],
    ["Firecrawl Cloud", { FIRECRAWL_API_URL: "https://api.firecrawl.dev" }],
  ])("%s blocks without a call", async (_label, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const t = convexTest(schema, modules);
    const id = await fromUrl(t);
    respondWith();
    await capture(t, id);
    expect(calls).toEqual([]);
    expect(await source(t, id)).toMatchObject({
      status: "review_needed",
      blockedReason: "no_text",
      metadata: { pdfCapture: { code: "pdf_capture_unconfigured" } },
    });
  });

  test("a stale attempt makes no Firecrawl call", async () => {
    const t = convexTest(schema, modules);
    const id = await fromUrl(t);
    respondWith();
    await t.action(internal.pdfCaptureNode.capturePdf, {
      sourceId: id,
      seq: 9,
    });
    expect(calls).toEqual([]);
    expect((await source(t, id))!.metadata.pdfCapture.state).toBe("queued");
  });
});
