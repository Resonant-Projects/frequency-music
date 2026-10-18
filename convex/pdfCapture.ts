import { literals } from "convex-helpers/validators";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { type AppIdentity, requireAuth } from "./auth";
import { assertPublicHttpUrl } from "./ingest";
import { settleCaptureFailures } from "./operationFailures";
import { schedulePassageIndex } from "./passages";
import {
  isRetryablePdfFailure,
  PDF_ATTEMPT_DEADLINE_MS,
  PDF_DETAIL_MAX_CHARS,
  PDF_FAILURE_CODES,
  PDF_FAILURES,
  PDF_MAX_ATTEMPTS,
  PDF_RETRY_DELAYS_MS,
  type PdfFailureCode,
  pdfFailureDetail,
  pdfUploadProblem,
  sha256ToHex,
} from "./shared/pdfCapture";
import { advanceSourceVersion } from "./shared/sourceRecovery";
import { isMissingTextBlock } from "./shared/statuses";
import {
  SOURCE_TEXT_MAX_CHARS,
  unextractableTextReason,
} from "./shared/sourceText";
import { generateDedupeKey } from "./sourceUtils";

// PDF Sources reach "ingested" without text. Lab Firecrawl reads them:
// POST /v2/parse for an uploaded file, POST /v2/scrape for a public URL.
// metadata.pdfCapture tracks one capture run. `seq` numbers every scheduled
// attempt and fences late results; `tries` counts attempts in this run.

type PdfEndpoint = "parse" | "scrape";
export type PdfCaptureState = {
  state: "queued" | "parsing" | "waiting" | "captured" | "blocked";
  seq: number;
  tries: number;
  provider: "firecrawl";
  endpoint: PdfEndpoint;
  // The PDF URL to read when it is not the Source's canonicalUrl: a later
  // submission for the same dedupe key (an arXiv abstract's PDF, say).
  url?: string;
  code?: PdfFailureCode;
  httpStatus?: number;
  detail?: string;
  startedAt?: number;
  lastAttemptAt?: number;
  nextAttemptAt?: number;
  capturedAt?: number;
  chars?: number;
  truncated?: boolean;
  numPages?: number;
};

function captureOf(source: Doc<"sources">): PdfCaptureState | undefined {
  return source.metadata?.pdfCapture as PdfCaptureState | undefined;
}

function endpointOf(source: Pick<Doc<"sources">, "pdfStorageId">): PdfEndpoint {
  return source.pdfStorageId ? "parse" : "scrape";
}

/** A PDF Source, or a Source given a PDF URL, that still has no text and something to read it from. */
export function awaitsPdfText(source: Doc<"sources">): boolean {
  const url = captureOf(source)?.url;
  return (
    (source.type === "pdf" || Boolean(url)) &&
    source.status === "ingested" &&
    !source.rawText &&
    !source.transcript &&
    Boolean(source.pdfStorageId || url || source.canonicalUrl)
  );
}

/** A capture run is scheduled, in flight, or waiting to retry. */
function pdfCaptureRunning(source: Doc<"sources">): boolean {
  const state = captureOf(source)?.state;
  return state === "queued" || state === "parsing" || state === "waiting";
}

/**
 * Start a fresh capture run (attempt 1) and schedule it. Returns the
 * metadata.pdfCapture value the caller must store in the same mutation.
 */
export async function queuePdfCapture(
  ctx: MutationCtx,
  sourceId: Id<"sources">,
  source: Pick<Doc<"sources">, "pdfStorageId" | "metadata">,
  url?: string,
): Promise<PdfCaptureState> {
  const previous = source.metadata?.pdfCapture as PdfCaptureState | undefined;
  const pdfUrl = url ?? previous?.url;
  const capture: PdfCaptureState = {
    state: "queued",
    seq: (previous?.seq ?? 0) + 1,
    tries: 1,
    provider: "firecrawl",
    endpoint: endpointOf(source),
    ...(pdfUrl ? { url: pdfUrl } : {}),
  };
  await ctx.scheduler.runAfter(0, internal.pdfCaptureNode.capturePdf, {
    sourceId,
    seq: capture.seq,
  });
  return capture;
}

/** The submitter's users row, or "system" for the bypass identity or an unmapped subject. */
async function creatorOf(
  ctx: MutationCtx,
  identity: AppIdentity,
): Promise<Id<"users"> | "system"> {
  if (identity.isBypass || identity.subject === "system") return "system";
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  return user?._id ?? "system";
}

// Source types whose text a submitted PDF can supply; a YouTube or podcast
// Source keeps its transcript path.
const PDF_READABLE_TYPES = new Set<Doc<"sources">["type"]>([
  "url",
  "rss",
  "pdf",
]);

function fileTitle(fileName?: string): string | undefined {
  const name = fileName
    ?.trim()
    .replace(/\.pdf$/i, "")
    .trim();
  return name || undefined;
}

const intakeResultValidator = v.object({
  id: v.id("sources"),
  created: v.boolean(),
  // A capture run was queued for the returned Source.
  pdfQueued: v.boolean(),
});

export const generatePdfUploadUrl = mutation({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a PDF Source from a file the browser uploaded to Convex storage.
 * The dedupe key is the file's SHA-256, read from the _storage row.
 */
export const createFromPdfUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
    title: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  returns: intakeResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const file = await ctx.db.system.get(args.storageId);
    if (!file)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "The uploaded file was not found. Upload it again.",
      });
    const owner = await ctx.db
      .query("sources")
      .withIndex("by_pdfStorageId", (q) => q.eq("pdfStorageId", args.storageId))
      .first();
    if (owner) return { id: owner._id, created: false, pdfQueued: false };

    // A refused upload stays unreferenced; mediaSweeper deletes it after 24 h.
    // (Deleting it here would roll back with the thrown error.)
    const problem = pdfUploadProblem(file);
    if (problem)
      throw new ConvexError({ code: "INVALID_FILE", message: problem });

    const dedupeKey = generateDedupeKey("pdf", {
      fileSha256: sha256ToHex(file.sha256),
    });
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .first();
    if (existing) {
      // A textless Source with this hash (a manifest PDF, say) keeps these
      // bytes and is read from them; otherwise the copy is not needed.
      if (needsTextFromPdf(existing)) {
        await requeueWithPdf(ctx, existing, { pdfStorageId: args.storageId });
        return { id: existing._id, created: false, pdfQueued: true };
      }
      await ctx.storage.delete(args.storageId);
      return { id: existing._id, created: false, pdfQueued: false };
    }
    return {
      id: await insertPdfSource(ctx, {
        dedupeKey,
        pdfStorageId: args.storageId,
        title: args.title?.trim() || fileTitle(args.fileName),
        tags: args.tags,
        createdBy: await creatorOf(ctx, identity),
      }),
      created: true,
      pdfQueued: true,
    };
  },
});

/**
 * Create a PDF Source for a public PDF URL. It keeps the URL dedupe key, so
 * an arXiv or DOI PDF shares identity with its landing page. An existing
 * textless Source with that key is read from this PDF instead.
 */
export const createFromPdfUrl = mutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  returns: intakeResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const url = args.url.trim();
    try {
      assertPublicHttpUrl(url);
    } catch {
      throw new ConvexError({
        code: "INVALID_URL",
        message: "Provide a public http or https PDF URL.",
      });
    }
    const dedupeKey = generateDedupeKey("url", { canonicalUrl: url });
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .first();
    if (existing) {
      // The stored URL, if any, already failed; read the one just submitted.
      const pdfQueued = needsTextFromPdf(existing);
      if (pdfQueued) await requeueWithPdf(ctx, existing, { url });
      return { id: existing._id, created: false, pdfQueued };
    }
    return {
      id: await insertPdfSource(ctx, {
        dedupeKey,
        canonicalUrl: url,
        title: args.title?.trim() || undefined,
        tags: args.tags,
        createdBy: await creatorOf(ctx, identity),
      }),
      created: true,
      pdfQueued: true,
    };
  },
});

/**
 * An existing Source a newly submitted PDF should give text to: a textless
 * page or PDF Source without stored bytes that is blocked for missing text
 * (the states sourceForRecovery accepts), or ingested with no capture running.
 */
function needsTextFromPdf(source: Doc<"sources">): boolean {
  return (
    PDF_READABLE_TYPES.has(source.type) &&
    !source.rawText &&
    !source.transcript &&
    !source.pdfStorageId &&
    (((source.status === "review_needed" || source.status === "extracted") &&
      isMissingTextBlock(source.blockedReason)) ||
      (source.status === "ingested" && !pdfCaptureRunning(source)))
  );
}

/** Attach the submitted bytes or URL to an existing Source and start a capture run. */
async function requeueWithPdf(
  ctx: MutationCtx,
  source: Doc<"sources">,
  pdf: { pdfStorageId: Id<"_storage"> } | { url: string },
): Promise<void> {
  const pdfStorageId = "pdfStorageId" in pdf ? pdf.pdfStorageId : undefined;
  const pdfCapture = await queuePdfCapture(
    ctx,
    source._id,
    { ...source, ...(pdfStorageId ? { pdfStorageId } : {}) },
    "url" in pdf ? pdf.url : undefined,
  );
  await ctx.db.patch("sources", source._id, {
    ...(pdfStorageId ? { pdfStorageId } : {}),
    status: "ingested",
    blockedReason: undefined,
    blockedDetails: undefined,
    updatedAt: advanceSourceVersion(source.updatedAt),
    metadata: { ...source.metadata, pdfCapture },
  });
}

async function insertPdfSource(
  ctx: MutationCtx,
  fields: {
    dedupeKey: string;
    pdfStorageId?: Id<"_storage">;
    canonicalUrl?: string;
    title?: string;
    tags?: string[];
    createdBy: Id<"users"> | "system";
  },
): Promise<Id<"sources">> {
  const now = Date.now();
  const capture: PdfCaptureState = {
    state: "queued",
    seq: 1,
    tries: 1,
    provider: "firecrawl",
    endpoint: endpointOf(fields),
  };
  const id = await ctx.db.insert("sources", {
    type: "pdf",
    ...fields,
    tags: fields.tags ?? [],
    metadata: { pdfCapture: capture },
    status: "ingested",
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.pdfCaptureNode.capturePdf, {
    sourceId: id,
    seq: capture.seq,
  });
  return id;
}

/**
 * Claim one scheduled attempt. Returns what the action must read, or null
 * when the attempt is stale or the Source no longer awaits PDF text.
 */
export const startPdfAttempt = internalMutation({
  args: { sourceId: v.id("sources"), seq: v.number() },
  returns: v.union(
    v.null(),
    v.object({ endpoint: v.literal("parse"), storageId: v.id("_storage") }),
    v.object({ endpoint: v.literal("scrape"), url: v.string() }),
  ),
  handler: async (ctx, args) => {
    const source = await ctx.db.get("sources", args.sourceId);
    const capture = source && captureOf(source);
    if (
      !source ||
      !capture ||
      !awaitsPdfText(source) ||
      capture.seq !== args.seq ||
      (capture.state !== "queued" && capture.state !== "waiting")
    )
      return null;
    const now = Date.now();
    await ctx.db.patch("sources", source._id, {
      metadata: {
        ...source.metadata,
        pdfCapture: {
          ...capture,
          state: "parsing",
          startedAt: now,
          nextAttemptAt: undefined,
        },
      },
    });
    await ctx.scheduler.runAfter(
      PDF_ATTEMPT_DEADLINE_MS,
      internal.pdfCapture.expirePdfAttempt,
      { sourceId: source._id, seq: args.seq },
    );
    return source.pdfStorageId
      ? { endpoint: "parse" as const, storageId: source.pdfStorageId }
      : {
          endpoint: "scrape" as const,
          url: capture.url ?? source.canonicalUrl!,
        };
  },
});

/** The open attempt of a Source, or null when this result is stale. */
async function openAttempt(
  ctx: MutationCtx,
  sourceId: Id<"sources">,
  seq: number,
): Promise<{ source: Doc<"sources">; capture: PdfCaptureState } | null> {
  const source = await ctx.db.get("sources", sourceId);
  const capture = source && captureOf(source);
  if (
    !source ||
    !capture ||
    !awaitsPdfText(source) ||
    capture.seq !== seq ||
    capture.state !== "parsing"
  )
    return null;
  return { source, capture };
}

async function recordFailure(
  ctx: MutationCtx,
  source: Doc<"sources">,
  capture: PdfCaptureState,
  code: PdfFailureCode,
  httpStatus?: number,
) {
  const now = Date.now();
  const detail = pdfFailureDetail(code, httpStatus).slice(
    0,
    PDF_DETAIL_MAX_CHARS,
  );
  const attempt = {
    ...capture,
    code,
    httpStatus,
    detail,
    lastAttemptAt: now,
    startedAt: undefined,
  };
  if (
    isRetryablePdfFailure(code, httpStatus) &&
    capture.tries < PDF_MAX_ATTEMPTS
  ) {
    const delay =
      PDF_RETRY_DELAYS_MS[capture.tries - 1] ?? PDF_RETRY_DELAYS_MS.at(-1)!;
    const next = {
      ...attempt,
      state: "waiting" as const,
      seq: capture.seq + 1,
      tries: capture.tries + 1,
      nextAttemptAt: now + delay,
    };
    await ctx.db.patch("sources", source._id, {
      metadata: { ...source.metadata, pdfCapture: next },
      updatedAt: advanceSourceVersion(source.updatedAt, now),
    });
    await ctx.scheduler.runAfter(delay, internal.pdfCaptureNode.capturePdf, {
      sourceId: source._id,
      seq: next.seq,
    });
    return;
  }
  // A stored file that no longer exists is not the Source's: clearing it lets
  // a replacement upload attach, and stops "Access changed" re-reading it.
  const fileGone =
    code === "pdf_file_missing" &&
    source.pdfStorageId !== undefined &&
    !(await ctx.db.system.get(source.pdfStorageId));
  await ctx.db.patch("sources", source._id, {
    ...(fileGone ? { pdfStorageId: undefined } : {}),
    status: "review_needed",
    blockedReason: PDF_FAILURES[code].reason,
    blockedDetails:
      capture.tries > 1 ? `${detail} Failed ${capture.tries} times.` : detail,
    metadata: {
      ...source.metadata,
      pdfCapture: { ...attempt, state: "blocked" },
    },
    updatedAt: advanceSourceVersion(source.updatedAt, now),
  });
}

/**
 * Record one attempt's outcome. Captured text makes the Source text_ready;
 * a failure retries (retryable codes, PDF_MAX_ATTEMPTS per run) or parks the
 * Source as review_needed with pdf_parse_error or no_text.
 */
export const recordPdfCapture = internalMutation({
  args: {
    sourceId: v.id("sources"),
    seq: v.number(),
    outcome: literals("captured", "failed"),
    text: v.optional(v.string()),
    chars: v.optional(v.number()),
    truncated: v.optional(v.boolean()),
    numPages: v.optional(v.number()),
    code: v.optional(literals(...PDF_FAILURE_CODES)),
    httpStatus: v.optional(v.number()),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const open = await openAttempt(ctx, args.sourceId, args.seq);
    if (!open) return { updated: false };
    const { source, capture } = open;
    if (args.outcome === "failed") {
      await recordFailure(
        ctx,
        source,
        capture,
        args.code ?? "pdf_firecrawl_error",
        args.httpStatus,
      );
      return { updated: true };
    }
    const text = args.text?.trim() ?? "";
    if (text.length > SOURCE_TEXT_MAX_CHARS)
      throw new Error(
        `PDF text must be capped at ${SOURCE_TEXT_MAX_CHARS} characters`,
      );
    // Bot walls and near-empty text are not the document: a scanned PDF
    // gives a few stray characters, not prose.
    if (unextractableTextReason(text, { allowExcerpt: true })) {
      await recordFailure(ctx, source, capture, "pdf_no_text");
      return { updated: true };
    }
    const now = Date.now();
    await ctx.db.patch("sources", source._id, {
      rawText: text,
      rawTextSha256: await sha256Hex(text),
      status: "text_ready",
      blockedReason: undefined,
      blockedDetails: undefined,
      metadata: {
        ...source.metadata,
        pdfCapture: {
          ...capture,
          state: "captured",
          code: undefined,
          httpStatus: undefined,
          detail: undefined,
          startedAt: undefined,
          lastAttemptAt: now,
          capturedAt: now,
          chars: args.chars ?? text.length,
          truncated: args.truncated ?? false,
          ...(args.numPages !== undefined ? { numPages: args.numPages } : {}),
        },
      },
      updatedAt: advanceSourceVersion(source.updatedAt, now),
    });
    await schedulePassageIndex(ctx, source._id);
    // Captured text settles failures of earlier captures of this Source, as
    // canonical Scout intake does.
    await settleCaptureFailures(ctx, {
      dedupeKey: source.dedupeKey,
      capturedAt: now,
    });
    return { updated: true };
  },
});

/** An attempt still open at its deadline crashed or timed out. */
export const expirePdfAttempt = internalMutation({
  args: { sourceId: v.id("sources"), seq: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const open = await openAttempt(ctx, args.sourceId, args.seq);
    if (open)
      await recordFailure(ctx, open.source, open.capture, "pdf_action_stale");
    return null;
  },
});

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
