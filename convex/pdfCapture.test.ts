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
import { PDF_MAX_ATTEMPTS, PDF_MAX_BYTES } from "./shared/pdfCapture";

type T = ReturnType<typeof convexTest>;

const prose =
  "Just intonation tunes each interval to a small whole-number ratio, and the scale that results depends on which ratios the composer allows. ".repeat(
    4,
  );
const pdfBytes = (body = "text") => new Blob([`%PDF-1.7\n${body}`]);

beforeEach(() => {
  // Scheduled captures must not run on their own: each test drives them.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const reader = (t: T) => t.withIdentity({ subject: "reader" });

async function upload(
  t: T,
  body = "text",
  fileName = "tuning-and-temperament.pdf",
) {
  const storageId = await t.run((ctx) => ctx.storage.store(pdfBytes(body)));
  const result = await reader(t).mutation(api.pdfCapture.createFromPdfUpload, {
    storageId,
    fileName,
    tags: ["tuning"],
  });
  return { ...result, storageId };
}

const source = (t: T, id: Id<"sources">) =>
  t.run((ctx) => ctx.db.get("sources", id));

const scheduled = (t: T) =>
  t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());

async function startAttempt(t: T, id: Id<"sources">) {
  const seq = (await source(t, id))!.metadata.pdfCapture.seq as number;
  const plan = await t.mutation(internal.pdfCapture.startPdfAttempt, {
    sourceId: id,
    seq,
  });
  return { seq, plan };
}

describe("PDF upload intake", () => {
  test("creates a private ingested pdf Source keyed by the file's SHA-256 and queues capture", async () => {
    const t = convexTest(schema, modules);
    const { id, created, storageId } = await upload(t);
    expect(created).toBe(true);
    const file = await t.run((ctx) => ctx.db.system.get(storageId));
    const hex = Array.from(atob(file!.sha256), (c) =>
      c.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("");
    expect(await source(t, id)).toMatchObject({
      type: "pdf",
      title: "tuning-and-temperament",
      tags: ["tuning"],
      dedupeKey: `pdf:${hex}`,
      pdfStorageId: storageId,
      status: "ingested",
      visibility: "private",
      createdBy: "system",
      metadata: {
        pdfCapture: { state: "queued", seq: 1, tries: 1, endpoint: "parse" },
      },
    });
    const jobs = await scheduled(t);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.name).toMatch(/^pdfCaptureNode(\.js)?:capturePdf$/);
    expect(jobs[0]!.args[0]).toEqual({ sourceId: id, seq: 1 });
  });

  test("a second upload of the same bytes returns the first Source and deletes its own blob", async () => {
    const t = convexTest(schema, modules);
    const first = await upload(t);
    const second = await upload(t, "text", "copy.pdf");
    expect(second).toMatchObject({ id: first.id, created: false });
    expect(
      await t.run((ctx) => ctx.db.system.get(second.storageId)),
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.system.get(first.storageId)),
    ).not.toBeNull();
  });

  test("submitting the same storage id twice keeps the stored file", async () => {
    const t = convexTest(schema, modules);
    const first = await upload(t);
    const again = await reader(t).mutation(api.pdfCapture.createFromPdfUpload, {
      storageId: first.storageId,
    });
    expect(again).toEqual({ id: first.id, created: false });
    expect(
      await t.run((ctx) => ctx.db.system.get(first.storageId)),
    ).not.toBeNull();
  });

  test("refuses a file over PDF_MAX_BYTES and leaves it for mediaSweeper", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(PDF_MAX_BYTES + 1)])),
    );
    await expect(
      reader(t).mutation(api.pdfCapture.createFromPdfUpload, { storageId }),
    ).rejects.toThrow(/25 MB/);
    expect(await t.run((ctx) => ctx.db.query("sources").collect())).toEqual([]);
    await t.mutation(internal.mediaSweeper.sweep, {
      now: Date.now() + 1,
      blobAgeMs: 0,
    });
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
  });

  test("requires a signed-in caller", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run((ctx) => ctx.storage.store(pdfBytes()));
    await expect(
      t.mutation(api.pdfCapture.createFromPdfUpload, { storageId }),
    ).rejects.toThrow();
  });
});

describe("PDF URL intake", () => {
  test("keeps the URL dedupe key, so an arXiv PDF and its abstract page are one Source", async () => {
    const t = convexTest(schema, modules);
    const { id, created } = await reader(t).mutation(
      api.pdfCapture.createFromPdfUrl,
      { url: "https://arxiv.org/pdf/1706.03762" },
    );
    expect(created).toBe(true);
    expect(await source(t, id)).toMatchObject({
      type: "pdf",
      canonicalUrl: "https://arxiv.org/pdf/1706.03762",
      dedupeKey: "arxiv:1706.03762",
      status: "ingested",
      metadata: { pdfCapture: { state: "queued", seq: 1, endpoint: "scrape" } },
    });
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
        url: "https://arxiv.org/abs/1706.03762",
      }),
    ).toEqual({ id, created: false });
    expect(await scheduled(t)).toHaveLength(1);
  });

  test("refuses private and malformed URLs", async () => {
    const t = convexTest(schema, modules);
    for (const url of [
      "http://192.168.1.10/a.pdf",
      "ftp://example.org/a.pdf",
      "nope",
    ])
      await expect(
        reader(t).mutation(api.pdfCapture.createFromPdfUrl, { url }),
      ).rejects.toThrow(/URL/);
  });
});

describe("PDF capture attempts", () => {
  test("an attempt returns the upload to parse and is marked parsing", async () => {
    const t = convexTest(schema, modules);
    const { id, storageId } = await upload(t);
    const { plan } = await startAttempt(t, id);
    expect(plan).toEqual({ endpoint: "parse", storageId });
    expect((await source(t, id))!.metadata.pdfCapture.state).toBe("parsing");
  });

  test("a stale sequence number gets no work", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    expect(
      await t.mutation(internal.pdfCapture.startPdfAttempt, {
        sourceId: id,
        seq: 7,
      }),
    ).toBeNull();
  });

  test("captured text makes the Source text_ready with its provenance", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const { seq } = await startAttempt(t, id);
    expect(
      await t.mutation(internal.pdfCapture.recordPdfCapture, {
        sourceId: id,
        seq,
        outcome: "captured",
        text: prose,
        chars: 438_075,
        truncated: true,
        numPages: 250,
      }),
    ).toEqual({ updated: true });
    const row = (await source(t, id))!;
    expect(row).toMatchObject({
      status: "text_ready",
      rawText: prose.trim(),
      metadata: {
        pdfCapture: {
          state: "captured",
          provider: "firecrawl",
          endpoint: "parse",
          chars: 438_075,
          truncated: true,
          numPages: 250,
        },
      },
    });
    expect(row.rawTextSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.blockedReason).toBeUndefined();
  });

  test("near-empty text parks the Source with pdf_parse_error", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const { seq } = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "captured",
      text: "\n\n",
      chars: 2,
      truncated: false,
    });
    expect(await source(t, id)).toMatchObject({
      status: "review_needed",
      blockedReason: "pdf_parse_error",
      blockedDetails: "This PDF gave almost no text. Its pages can be images.",
      metadata: { pdfCapture: { state: "blocked", code: "pdf_no_text" } },
    });
    expect((await source(t, id))!.rawText).toBeUndefined();
  });

  test("an unreadable PDF blocks on the first attempt", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const { seq } = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "failed",
      code: "pdf_unreadable",
    });
    expect(await source(t, id)).toMatchObject({
      status: "review_needed",
      blockedReason: "pdf_parse_error",
      metadata: {
        pdfCapture: { state: "blocked", code: "pdf_unreadable", tries: 1 },
      },
    });
  });

  test("a retryable failure waits, then the third failure parks no_text", async () => {
    const t = convexTest(schema, modules);
    const { id } = await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
      url: "https://example.org/paper.pdf",
    });
    for (let attempt = 1; attempt <= PDF_MAX_ATTEMPTS; attempt++) {
      const { seq, plan } = await startAttempt(t, id);
      expect(plan).toEqual({
        endpoint: "scrape",
        url: "https://example.org/paper.pdf",
      });
      await t.mutation(internal.pdfCapture.recordPdfCapture, {
        sourceId: id,
        seq,
        outcome: "failed",
        code: "pdf_fetch_http",
        httpStatus: 503,
      });
      const row = (await source(t, id))!;
      if (attempt < PDF_MAX_ATTEMPTS) {
        expect(row).toMatchObject({
          status: "ingested",
          metadata: {
            pdfCapture: {
              state: "waiting",
              seq: seq + 1,
              tries: attempt + 1,
              code: "pdf_fetch_http",
              httpStatus: 503,
            },
          },
        });
        expect(row.blockedReason).toBeUndefined();
        const jobs = await scheduled(t);
        expect(jobs.at(-1)!.args[0]).toEqual({ sourceId: id, seq: seq + 1 });
      } else {
        expect(row).toMatchObject({
          status: "review_needed",
          blockedReason: "no_text",
          blockedDetails: "The server returned HTTP 503. Failed 3 times.",
          metadata: { pdfCapture: { state: "blocked", tries: 3 } },
        });
      }
    }
  });

  test("a late result from an older attempt changes nothing", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const { seq } = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "failed",
      code: "pdf_fetch_network",
    });
    const before = await source(t, id);
    expect(
      await t.mutation(internal.pdfCapture.recordPdfCapture, {
        sourceId: id,
        seq,
        outcome: "captured",
        text: prose,
        chars: prose.length,
        truncated: false,
      }),
    ).toEqual({ updated: false });
    expect(await source(t, id)).toEqual(before);
  });

  test("the watchdog fails an attempt that never reported, and ignores a settled one", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const { seq } = await startAttempt(t, id);
    const watchdog = (await scheduled(t)).find((job) =>
      job.name.endsWith("expirePdfAttempt"),
    );
    expect(watchdog?.args[0]).toEqual({ sourceId: id, seq });
    await t.mutation(internal.pdfCapture.expirePdfAttempt, {
      sourceId: id,
      seq,
    });
    expect((await source(t, id))!.metadata.pdfCapture).toMatchObject({
      state: "waiting",
      code: "pdf_action_stale",
      seq: seq + 1,
    });
    const settled = await source(t, id);
    await t.mutation(internal.pdfCapture.expirePdfAttempt, {
      sourceId: id,
      seq,
    });
    expect(await source(t, id)).toEqual(settled);
  });

  test("an archived Source ignores capture results", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const { seq } = await startAttempt(t, id);
    await t.run((ctx) => ctx.db.patch("sources", id, { status: "archived" }));
    expect(
      await t.mutation(internal.pdfCapture.recordPdfCapture, {
        sourceId: id,
        seq,
        outcome: "captured",
        text: prose,
        chars: prose.length,
        truncated: false,
      }),
    ).toEqual({ updated: false });
    expect((await source(t, id))!.status).toBe("archived");
  });
});

describe("PDF recovery", () => {
  test("Access changed starts a fresh capture run for a blocked PDF", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const { seq } = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "failed",
      code: "pdf_unreadable",
    });
    const blocked = (await source(t, id))!;
    expect(
      await reader(t).mutation(api.sources.requestSourceRecovery, {
        id,
        expectedUpdatedAt: blocked.updatedAt,
        note: "Uploaded a copy with a text layer elsewhere; retry.",
      }),
    ).toEqual({ transcriptQueued: false, pdfQueued: true });
    const row = (await source(t, id))!;
    expect(row).toMatchObject({
      status: "ingested",
      metadata: {
        pdfCapture: { state: "queued", seq: seq + 1, tries: 1 },
      },
    });
    expect(row.blockedReason).toBeUndefined();
    expect((await scheduled(t)).at(-1)!.args[0]).toEqual({
      sourceId: id,
      seq: seq + 1,
    });
  });

  test("provided text resolves a pdf_parse_error block", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const { seq } = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "failed",
      code: "pdf_unreadable",
    });
    const blocked = (await source(t, id))!;
    await reader(t).mutation(api.sources.provideRecoveryText, {
      id,
      expectedUpdatedAt: blocked.updatedAt,
      text: prose,
      kind: "article",
    });
    expect(await source(t, id)).toMatchObject({ status: "text_ready" });
    expect((await source(t, id))!.blockedReason).toBeUndefined();
  });

  test("the inbox offers text recovery for a pdf_parse_error block", async () => {
    const t = convexTest(schema, modules);
    const { id } = await upload(t);
    const queued = await t.query(api.inbox.list, {});
    expect(queued.find((row) => row._id === id)?.nextAction).toBe(
      "Extracting PDF text",
    );
    const { seq } = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "failed",
      code: "pdf_unreadable",
    });
    const rows = await t.query(api.inbox.list, {});
    expect(rows.find((row) => row._id === id)?.nextAction).toBe(
      "Paste excerpt or mark as blocked",
    );
  });
});

describe("PDF storage ownership", () => {
  test("mediaSweeper keeps a blob that a Source references", async () => {
    const t = convexTest(schema, modules);
    const { storageId } = await upload(t);
    const orphan = await t.run((ctx) => ctx.storage.store(pdfBytes("orphan")));
    await t.mutation(internal.mediaSweeper.sweep, {
      now: Date.now() + 1,
      blobAgeMs: 0,
    });
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(orphan))).toBeNull();
  });
});
