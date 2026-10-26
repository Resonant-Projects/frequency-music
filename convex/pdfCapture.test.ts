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
import schema from "./schema";
import { modules } from "../harness/modules";
import { PDF_MAX_BYTES } from "./shared/pdfCapture";
import {
  prose,
  pdfBytes,
  reader,
  upload,
  source,
  scheduled,
  startAttempt,
} from "../harness/pdfCaptureFixtures";

beforeEach(() => {
  // Scheduled captures must not run on their own: each test drives them.
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

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
    expect(second).toMatchObject({
      id: first.id,
      created: false,
      pdfQueued: false,
    });
    expect(
      await t.run((ctx) => ctx.db.system.get(second.storageId)),
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.system.get(first.storageId)),
    ).not.toBeNull();
  });

  test("an upload gives its bytes to a textless manifest PDF Source with the same hash", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run((ctx) => ctx.storage.store(pdfBytes()));
    const file = await t.run((ctx) => ctx.db.system.get(storageId));
    const hex = Array.from(atob(file!.sha256), (c) =>
      c.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("");
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "pdf",
        dedupeKey: `pdf:${hex}`,
        title: "Manifest PDF",
        tags: [],
        metadata: {},
        status: "review_needed",
        blockedReason: "no_text",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUpload, {
        storageId,
      }),
    ).toEqual({ id, created: false, pdfQueued: true });
    const row = (await source(t, id))!;
    expect(row).toMatchObject({
      pdfStorageId: storageId,
      status: "ingested",
      metadata: { pdfCapture: { state: "queued", endpoint: "parse" } },
    });
    expect(row.blockedReason).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).not.toBeNull();
    const { plan } = await startAttempt(t, id);
    expect(plan).toEqual({ endpoint: "parse", storageId });
  });

  test("a missing stored file is cleared, so a replacement upload recovers the Source", async () => {
    const t = convexTest(schema, modules);
    const { id, storageId } = await upload(t);
    await t.run((ctx) => ctx.storage.delete(storageId));
    const { seq } = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "failed",
      code: "pdf_file_missing",
    });
    const blocked = (await source(t, id))!;
    expect(blocked).toMatchObject({
      status: "review_needed",
      blockedReason: "no_text",
    });
    expect(blocked.pdfStorageId).toBeUndefined();
    const replacement = await upload(t);
    expect(replacement).toMatchObject({
      id,
      created: false,
      pdfQueued: true,
    });
    expect(await source(t, id)).toMatchObject({
      pdfStorageId: replacement.storageId,
      status: "ingested",
    });
  });

  test("submitting the same storage id twice keeps the stored file", async () => {
    const t = convexTest(schema, modules);
    const first = await upload(t);
    const again = await reader(t).mutation(api.pdfCapture.createFromPdfUpload, {
      storageId: first.storageId,
    });
    expect(again).toEqual({ id: first.id, created: false, pdfQueued: false });
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
    ).toEqual({ id, created: false, pdfQueued: false });
    expect(await scheduled(t)).toHaveLength(1);
  });

  test("a PDF URL captures text for an existing Source blocked without text", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        dedupeKey: "arxiv:1706.03762",
        canonicalUrl: "https://arxiv.org/abs/1706.03762",
        tags: [],
        metadata: { scoutedBy: { query: "attention" } },
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: "Captured text is a bot wall or browser check.",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const pdfUrl = "https://arxiv.org/pdf/1706.03762";
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
        url: pdfUrl,
      }),
    ).toEqual({ id, created: false, pdfQueued: true });
    const queued = (await source(t, id))!;
    expect(queued).toMatchObject({
      type: "url",
      canonicalUrl: "https://arxiv.org/abs/1706.03762",
      status: "ingested",
      metadata: {
        scoutedBy: { query: "attention" },
        pdfCapture: {
          state: "queued",
          seq: 1,
          endpoint: "scrape",
          url: pdfUrl,
        },
      },
    });
    expect(queued.blockedReason).toBeUndefined();
    expect(queued.updatedAt).toBeGreaterThan(1);
    const { seq, plan } = await startAttempt(t, id);
    expect(plan).toEqual({ endpoint: "scrape", url: pdfUrl });
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "captured",
      text: prose,
      chars: prose.length,
      truncated: false,
    });
    expect(await source(t, id)).toMatchObject({
      status: "text_ready",
      rawText: prose.trim(),
    });
  });

  test("a corrected PDF URL is read for a blocked PDF Source", async () => {
    const t = convexTest(schema, modules);
    const { id } = await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
      url: "https://arxiv.org/abs/1706.03762",
    });
    const first = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq: first.seq,
      outcome: "failed",
      code: "pdf_not_pdf",
    });
    const pdfUrl = "https://arxiv.org/pdf/1706.03762";
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
        url: pdfUrl,
      }),
    ).toEqual({ id, created: false, pdfQueued: true });
    const { plan } = await startAttempt(t, id);
    expect(plan).toEqual({ endpoint: "scrape", url: pdfUrl });
  });

  test("a PDF URL captures text for an existing ingested Source that has none", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        dedupeKey: "arxiv:1706.03762",
        canonicalUrl: "https://arxiv.org/abs/1706.03762",
        tags: [],
        metadata: {},
        status: "ingested",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const pdfUrl = "https://arxiv.org/pdf/1706.03762";
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
        url: pdfUrl,
      }),
    ).toEqual({ id, created: false, pdfQueued: true });
    const rows = await t.query(api.inbox.list, {});
    expect(rows.find((row) => row._id === id)?.nextAction).toBe(
      "Extracting PDF text",
    );
    const { plan } = await startAttempt(t, id);
    expect(plan).toEqual({ endpoint: "scrape", url: pdfUrl });
  });

  test("PDF text settles the Source's open Scout capture failures", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        dedupeKey: "arxiv:1706.03762",
        canonicalUrl: "https://arxiv.org/abs/1706.03762",
        tags: [],
        metadata: { scoutedBy: { query: "attention" } },
        status: "review_needed",
        blockedReason: "no_text",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const failureId = await t.run((ctx) =>
      ctx.db.insert("operationFailures", {
        operationId: "capture:arxiv:1706.03762",
        causeKey: "capture:bot_wall",
        target: {
          kind: "capture",
          input: {
            url: "https://arxiv.org/abs/1706.03762",
            query: "attention",
            rationale: "Scout",
          },
        },
        captureDedupeKey: "arxiv:1706.03762",
        message: "Bot wall",
        status: "needsReview",
        attempts: 3,
        nextAttemptAt: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
      url: "https://arxiv.org/pdf/1706.03762",
    });
    const { seq } = await startAttempt(t, id);
    await t.mutation(internal.pdfCapture.recordPdfCapture, {
      sourceId: id,
      seq,
      outcome: "captured",
      text: prose,
      chars: prose.length,
      truncated: false,
    });
    expect(await t.run((ctx) => ctx.db.get(failureId))).toMatchObject({
      status: "resolved",
    });
  });

  test("a PDF URL captures text for an extracted Source blocked without text", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        dedupeKey: "arxiv:1706.03762",
        canonicalUrl: "https://arxiv.org/abs/1706.03762",
        tags: [],
        metadata: {},
        status: "extracted",
        blockedReason: "no_text",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
        url: "https://arxiv.org/pdf/1706.03762",
      }),
    ).toEqual({ id, created: false, pdfQueued: true });
    expect(await source(t, id)).toMatchObject({ status: "ingested" });
  });

  test("a PDF URL captures text for a textless PDF Source that never had a capture", async () => {
    const t = convexTest(schema, modules);
    const pdfUrl = "https://example.org/score.pdf";
    const { generateDedupeKey } = await import("./sourceUtils");
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "pdf",
        dedupeKey: generateDedupeKey("url", { canonicalUrl: pdfUrl }),
        canonicalUrl: pdfUrl,
        tags: [],
        metadata: {},
        status: "ingested",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
        url: pdfUrl,
      }),
    ).toEqual({ id, created: false, pdfQueued: true });
    const { plan } = await startAttempt(t, id);
    expect(plan).toEqual({ endpoint: "scrape", url: pdfUrl });
  });

  test("a PDF URL does not queue capture for a YouTube Source", async () => {
    const t = convexTest(schema, modules);
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const { generateDedupeKey } = await import("./sourceUtils");
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "youtube",
        dedupeKey: generateDedupeKey("url", { canonicalUrl: url }),
        canonicalUrl: url,
        tags: [],
        metadata: {},
        status: "ingested",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUrl, { url }),
    ).toEqual({ id, created: false, pdfQueued: false });
    expect(await scheduled(t)).toHaveLength(0);
  });

  test("a PDF URL leaves an existing Source that has text alone", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        dedupeKey: "arxiv:1706.03762",
        canonicalUrl: "https://arxiv.org/abs/1706.03762",
        rawText: prose,
        tags: [],
        metadata: {},
        status: "text_ready",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect(
      await reader(t).mutation(api.pdfCapture.createFromPdfUrl, {
        url: "https://arxiv.org/pdf/1706.03762",
      }),
    ).toEqual({ id, created: false, pdfQueued: false });
    expect(await source(t, id)).toMatchObject({
      status: "text_ready",
      updatedAt: 1,
    });
    expect(await scheduled(t)).toHaveLength(0);
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
