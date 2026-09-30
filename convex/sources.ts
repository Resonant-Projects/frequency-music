import { literals } from "convex-helpers/validators";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";
import {
  looksLikeBotChallenge,
  SCOUTED_CONTENT_PROVIDERS,
  SCOUTED_TEXT_MAX_CHARS,
  SCOUTED_TEXT_MIN_CHARS,
} from "./shared/agentContract";
import { sourceBlockedReasonValidator, sourceStatusValidator } from "./schema";
import {
  computeCanonicalDedupeKey,
  extractYouTubeVideoId,
  generateArchivedDedupeKey,
  generateDedupeKey,
} from "./sourceUtils";
import { sourceReturnValidator } from "./validators";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get sources by status (for inbox/pipeline views)
 */
export const listByStatus = query({
  args: {
    status: sourceStatusValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(sourceReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("sources")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status))
      .order("desc")
      .take(limit);
  },
});

/**
 * List recent sources regardless of status
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(sourceReturnValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * List sources by type
 */
export const listByType = query({
  args: {
    type: v.union(
      v.literal("notion"),
      v.literal("rss"),
      v.literal("url"),
      v.literal("youtube"),
      v.literal("pdf"),
      v.literal("podcast"),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(sourceReturnValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withIndex("by_type_updatedAt", (q) => q.eq("type", args.type))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * Get a single source by ID
 */
export const get = query({
  args: { id: v.id("sources") },
  returns: v.union(sourceReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("sources", args.id);
  },
});

/**
 * Check if a source exists by dedupeKey
 */
export const getByDedupeKey = query({
  args: { dedupeKey: v.string() },
  returns: v.union(sourceReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", args.dedupeKey))
      .first();
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new source (used by ingest pipelines)
 */
export const create = mutation({
  args: {
    type: v.union(
      v.literal("notion"),
      v.literal("rss"),
      v.literal("url"),
      v.literal("youtube"),
      v.literal("pdf"),
      v.literal("podcast"),
    ),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    canonicalUrl: v.optional(v.string()),
    notionPageId: v.optional(v.string()),
    rssGuid: v.optional(v.string()),
    feedUrl: v.optional(v.string()),
    youtubeVideoId: v.optional(v.string()),
    rawText: v.optional(v.string()),
    transcript: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    topics: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    dedupeKey: v.string(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { devBypassSecret: _devBypassSecret, ...createArgs } = args;
    const identity = await requireAuth(ctx, args);
    const now = Date.now();

    // Check for duplicate
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", createArgs.dedupeKey))
      .first();

    if (existing) {
      return { id: existing._id, created: false, reason: "duplicate" };
    }

    // Compute hash if we have text
    let rawTextSha256: string | undefined;
    if (createArgs.rawText || createArgs.transcript) {
      const text = createArgs.rawText || createArgs.transcript || "";
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      rawTextSha256 = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    const id = await ctx.db.insert("sources", {
      ...createArgs,
      rawTextSha256,
      status:
        createArgs.rawText || createArgs.transcript ? "text_ready" : "ingested",
      visibility: "private",
      createdBy: identity.subject as Id<"users">,
      createdAt: now,
      updatedAt: now,
    });

    return { id, created: true };
  },
});

/**
 * Update source status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("sources"),
    status: sourceStatusValidator,
    blockedReason: v.optional(sourceBlockedReasonValidator),
    blockedDetails: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const source = await ctx.db.get("sources", args.id);
    if (!source) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Source not found",
      });
    }

    await ctx.db.patch("sources", args.id, {
      status: args.status,
      blockedReason: args.blockedReason,
      blockedDetails: args.blockedDetails,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Update source with extracted text
 */
export const updateText = mutation({
  args: {
    id: v.id("sources"),
    rawText: v.optional(v.string()),
    transcript: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const source = await ctx.db.get("sources", args.id);
    if (!source) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Source not found",
      });
    }

    const text = args.rawText || args.transcript || "";

    // Compute hash
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const rawTextSha256 = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await ctx.db.patch("sources", args.id, {
      rawText: args.rawText,
      transcript: args.transcript,
      rawTextSha256,
      status: "text_ready",
      updatedAt: Date.now(),
    });
    return null;
  },
});

type ExternalUpsertArgs = {
  dedupeKey: string;
  type: "notion" | "rss" | "url" | "youtube" | "pdf" | "podcast";
  title?: string;
  canonicalUrl?: string;
  publishedAt?: number;
  notionPageId?: string;
  rssGuid?: string;
  feedUrl?: string;
  youtubeVideoId?: string;
  rawText?: string;
  transcript?: string;
  tags?: string[];
  topics?: string[];
  metadata?: unknown;
  createdBy?: Id<"users"> | "system";
};

type ExternalUpsertResult = {
  id: Id<"sources">;
  created: boolean;
  contentChanged: boolean;
};

type QueuedSourceResult = ExternalUpsertResult & {
  queued: boolean;
  workflowId?: string;
};

async function sha256Hex(text: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function upsertExternalSource(
  ctx: MutationCtx,
  args: ExternalUpsertArgs,
): Promise<ExternalUpsertResult> {
  const now = Date.now();

  const existing = await ctx.db
    .query("sources")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", args.dedupeKey))
    .first();

  const text = args.rawText || args.transcript;
  const rawTextSha256 = text ? await sha256Hex(text) : undefined;

  if (!existing) {
    const id = await ctx.db.insert("sources", {
      ...args,
      rawTextSha256,
      status: text ? "text_ready" : "ingested",
      visibility: "private",
      createdBy: args.createdBy ?? "system",
      createdAt: now,
      updatedAt: now,
    });
    return { id, created: true, contentChanged: Boolean(text) };
  }

  const contentChanged = Boolean(
    text &&
      rawTextSha256 &&
      (rawTextSha256 !== existing.rawTextSha256 ||
        existing.status === "ingested"),
  );

  await ctx.db.patch("sources", existing._id, {
    ...args,
    rawTextSha256: rawTextSha256 ?? existing.rawTextSha256,
    status: contentChanged
      ? "text_ready"
      : existing.status === "archived"
        ? "archived"
        : existing.status,
    blockedReason: contentChanged ? undefined : existing.blockedReason,
    updatedAt: now,
  });

  return { id: existing._id, created: false, contentChanged };
}

/**
 * Upsert a source for external ingest pipelines (n8n / HTTP endpoints).
 * Internal-only — called via secret-guarded HTTP actions in http.ts.
 */
export const upsertExternal = internalMutation({
  args: {
    dedupeKey: v.string(),
    type: v.union(
      v.literal("notion"),
      v.literal("rss"),
      v.literal("url"),
      v.literal("youtube"),
      v.literal("pdf"),
      v.literal("podcast"),
    ),
    title: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    notionPageId: v.optional(v.string()),
    rssGuid: v.optional(v.string()),
    feedUrl: v.optional(v.string()),
    rawText: v.optional(v.string()),
    transcript: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    topics: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    contentChanged: v.boolean(),
  }),
  handler: async (ctx, args) => {
    return await upsertExternalSource(ctx, args as ExternalUpsertArgs);
  },
});

/**
 * Operator repair for a Source Scout capture that stored non-content text,
 * such as a bot wall. Clears the text and its provider provenance so the row
 * awaits capture again, and refuses rows that were not captured by a Scout or
 * that already have an Extraction.
 */
export const resetScoutCapture = mutation({
  args: {
    id: v.id("sources"),
    reason: v.string(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const source = await ctx.db.get("sources", args.id);
    if (!source) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Source not found" });
    }
    const metadata = source.metadata as
      | { scoutedBy?: Record<string, unknown> }
      | undefined;
    const scoutedBy = metadata?.scoutedBy;
    if (
      source.type !== "url" ||
      !scoutedBy?.contentProvider ||
      !["text_ready", "ingested"].includes(source.status)
    ) {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Only an unextracted Source Scout capture can be reset",
      });
    }
    const extraction = await ctx.db
      .query("extractions")
      .withIndex("by_sourceId_createdAt", (q) => q.eq("sourceId", args.id))
      .first();
    if (extraction) {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Source already has an Extraction; reset is not safe",
      });
    }
    const {
      contentProvider: _provider,
      capturedByAgentRunId: _capturedBy,
      ...scoutProvenance
    } = scoutedBy;
    await ctx.db.patch("sources", args.id, {
      rawText: undefined,
      rawTextSha256: undefined,
      status: "ingested",
      blockedReason: "no_text",
      blockedDetails: args.reason,
      metadata: { ...metadata, scoutedBy: scoutProvenance },
      updatedAt: Date.now(),
    });
    return null;
  },
});

// A scout-created Source whose page capture failed. Only these rows may gain
// text on a later Scout run; every other duplicate stays a true no-op.
function awaitsScoutCapture(source: Doc<"sources">): boolean {
  const metadata = source.metadata as { scoutedBy?: unknown } | undefined;
  return (
    source.type === "url" &&
    source.status === "ingested" &&
    !source.rawText &&
    Boolean(metadata?.scoutedBy)
  );
}

/**
 * Source-scout preflight: which candidate URLs already own a canonical dedupe
 * key, and whether that Source still awaits page capture. Shares
 * createScoutedSource's key so the scout never captures text intake discards.
 */
export const existingScoutedUrls = internalQuery({
  args: { urls: v.array(v.string()) },
  returns: v.array(v.object({ url: v.string(), needsText: v.boolean() })),
  handler: async (ctx, args) => {
    const matches = await Promise.all(
      args.urls.map((url) => {
        const dedupeKey = generateDedupeKey("url", { canonicalUrl: url });
        return ctx.db
          .query("sources")
          .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
          .first();
      }),
    );
    return args.urls.flatMap((url, index) => {
      const source = matches[index];
      return source ? [{ url, needsText: awaitsScoutCapture(source) }] : [];
    });
  },
});

/**
 * Canonical URL intake for source-scout discoveries. Existing dedupe keys are
 * a no-op so scout provenance never overwrites an earlier intake path. The one
 * exception: a scout-created URL-only Source may gain captured text later.
 */
export const createScoutedSource = internalMutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    rawText: v.optional(v.string()),
    contentProvider: v.optional(literals(...SCOUTED_CONTENT_PROVIDERS)),
    query: v.string(),
    rationale: v.string(),
    agentRunId: v.id("agentRuns"),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    enriched: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    if (Boolean(args.rawText) !== Boolean(args.contentProvider)) {
      throw new Error(
        "Scouted source text and content provider provenance must be supplied together",
      );
    }
    // A bot wall is not source text. The worker filters these too; here one,
    // however short, is treated as a failed capture, so the URL-only Source
    // is still kept and a later run can capture it.
    const walled =
      args.rawText !== undefined && looksLikeBotChallenge(args.rawText);
    const rawText = walled ? undefined : args.rawText;
    const contentProvider = walled ? undefined : args.contentProvider;
    if (
      rawText &&
      (rawText.trim().length < SCOUTED_TEXT_MIN_CHARS ||
        rawText.length > SCOUTED_TEXT_MAX_CHARS)
    ) {
      throw new Error(
        `Scouted source text must be ${SCOUTED_TEXT_MIN_CHARS}-${SCOUTED_TEXT_MAX_CHARS} characters for Extraction`,
      );
    }
    const agentRun = await ctx.db.get("agentRuns", args.agentRunId);
    if (!agentRun) {
      throw new Error("Agent run not found");
    }
    // Crawler text is captured only by the source-scout ingest node; no other
    // run (such as a LangChain agent) may assert Crawl4AI provenance.
    if (rawText && agentRun.graphName !== "source-scout") {
      throw new Error("Scouted source text requires a source-scout run");
    }
    const dedupeKey = generateDedupeKey("url", {
      canonicalUrl: args.url,
    });
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .first();
    if (existing) {
      if (!rawText || !awaitsScoutCapture(existing)) {
        return { id: existing._id, created: false };
      }
      const metadata = existing.metadata as { scoutedBy: object };
      await ctx.db.patch("sources", existing._id, {
        rawText,
        rawTextSha256: await sha256Hex(rawText),
        status: "text_ready",
        // A reset capture was marked no_text; real text clears that block.
        blockedReason: undefined,
        blockedDetails: undefined,
        metadata: {
          ...metadata,
          scoutedBy: {
            ...metadata.scoutedBy,
            contentProvider,
            capturedByAgentRunId: args.agentRunId,
          },
        },
        updatedAt: Date.now(),
      });
      return { id: existing._id, created: false, enriched: true };
    }

    const result = await upsertExternalSource(ctx, {
      dedupeKey,
      type: "url",
      canonicalUrl: args.url,
      title: args.title,
      publishedAt: args.publishedAt,
      rawText,
      createdBy: "system",
      metadata: {
        scoutedBy: {
          agentRunId: args.agentRunId,
          query: args.query,
          rationale: args.rationale,
          ...(contentProvider ? { contentProvider } : {}),
        },
      },
    });
    return { id: result.id, created: result.created };
  },
});

/**
 * Promote source visibility
 */
export const setVisibility = mutation({
  args: {
    id: v.id("sources"),
    visibility: v.union(
      v.literal("private"),
      v.literal("followers"),
      v.literal("public"),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const source = await ctx.db.get("sources", args.id);
    if (!source) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Source not found",
      });
    }

    await ctx.db.patch("sources", args.id, {
      visibility: args.visibility,
      status:
        args.visibility === "followers"
          ? "promoted_followers"
          : args.visibility === "public"
            ? "promoted_public"
            : source.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Create a URL source from manual app input.
 */
export const createFromUrlInput = mutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    rawText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    contentChanged: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    return await upsertExternalSource(ctx, {
      dedupeKey: generateDedupeKey("url", { canonicalUrl: args.url }),
      type: "url",
      title: args.title,
      canonicalUrl: args.url,
      rawText: args.rawText,
      tags: args.tags,
      createdBy: identity.subject as Id<"users">,
    });
  },
});

/**
 * Create a YouTube source from manual app input.
 */
export const createFromYouTubeInput = mutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    transcript: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    contentChanged: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const videoId = extractYouTubeVideoId(args.url);
    if (!videoId) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Invalid YouTube URL",
      });
    }

    return await upsertExternalSource(ctx, {
      dedupeKey: generateDedupeKey("youtube", { youtubeVideoId: videoId }),
      type: "youtube",
      title: args.title,
      canonicalUrl: args.url,
      youtubeVideoId: videoId,
      transcript: args.transcript,
      tags: args.tags,
      createdBy: identity.subject as Id<"users">,
    });
  },
});

export const createFromUrlAndQueue = action({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    rawText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    contentChanged: v.boolean(),
    queued: v.boolean(),
    workflowId: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<QueuedSourceResult> => {
    await requireAuth(ctx, args);
    const result: ExternalUpsertResult = await ctx.runMutation(
      api.sources.createFromUrlInput,
      {
        url: args.url,
        title: args.title,
        rawText: args.rawText,
        tags: args.tags,
        devBypassSecret: args.devBypassSecret,
      },
    );
    const hasReadyContent = Boolean(args.rawText?.trim());
    if (!hasReadyContent || (!result.created && !result.contentChanged)) {
      return { ...result, queued: false };
    }

    const workflow: { workflowId: string } = await ctx.runMutation(
      api.workflows.startSingleSourceExtraction,
      {
        sourceId: result.id,
        model: args.model,
        devBypassSecret: args.devBypassSecret,
      },
    );

    return {
      ...result,
      queued: true,
      workflowId: workflow.workflowId,
    };
  },
});

export const createFromYouTubeAndQueue = action({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    transcript: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    contentChanged: v.boolean(),
    queued: v.boolean(),
    workflowId: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<QueuedSourceResult> => {
    await requireAuth(ctx, args);
    const result: ExternalUpsertResult = await ctx.runMutation(
      api.sources.createFromYouTubeInput,
      {
        url: args.url,
        title: args.title,
        transcript: args.transcript,
        tags: args.tags,
        devBypassSecret: args.devBypassSecret,
      },
    );
    const hasReadyContent = Boolean(args.transcript?.trim());
    if (!hasReadyContent || (!result.created && !result.contentChanged)) {
      return { ...result, queued: false };
    }

    const workflow: { workflowId: string } = await ctx.runMutation(
      api.workflows.startSingleSourceExtraction,
      {
        sourceId: result.id,
        model: args.model,
        devBypassSecret: args.devBypassSecret,
      },
    );

    return {
      ...result,
      queued: true,
      workflowId: workflow.workflowId,
    };
  },
});

// ============================================================================
// ARCHIVE
// ============================================================================

/**
 * Archive a source (mark as off-topic/irrelevant)
 */
export const archive = mutation({
  args: {
    id: v.id("sources"),
    reason: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const source = await ctx.db.get("sources", args.id);
    if (!source) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Source not found",
      });
    }
    await ctx.db.patch("sources", args.id, {
      status: "archived",
      blockedDetails: args.reason || "Archived: off-topic or irrelevant",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Migration: recompute canonical dedupeKeys (see docs/plans/2026-07-03-01-arch-dedupe-contract.md).
 * Batched via pagination cursor. apply:false reports without writing.
 * Collision rule: older row keeps the key; newer row is archived as duplicate.
 */
export const recomputeDedupeKeys = mutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    changed: v.number(),
    collisionsArchived: v.number(),
    skipped: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
    planned: v.array(
      v.object({
        id: v.string(),
        from: v.string(),
        to: v.string(),
        collidesWith: v.union(v.string(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const batchSize = Math.min(Math.max(args.batchSize ?? 25, 1), 100);
    const page = await ctx.db
      .query("sources")
      .paginate({ numItems: batchSize, cursor: args.cursor });

    let changed = 0;
    let collisionsArchived = 0;
    let skipped = 0;
    const planned: Array<{
      id: string;
      from: string;
      to: string;
      collidesWith: string | null;
    }> = [];
    const now = Date.now();

    for (const source of page.page) {
      if (source.status === "archived") {
        skipped++;
        continue;
      }

      const canonical = computeCanonicalDedupeKey(source);
      if (canonical === null || canonical === source.dedupeKey) {
        if (canonical === null) skipped++;
        continue;
      }

      const holder = await ctx.db
        .query("sources")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", canonical))
        .first();
      const collidesWith =
        holder && holder._id !== source._id ? holder._id : null;
      planned.push({
        id: source._id,
        from: source.dedupeKey,
        to: canonical,
        collidesWith,
      });

      if (!args.apply) continue;

      if (collidesWith === null) {
        await ctx.db.patch("sources", source._id, {
          dedupeKey: canonical,
          updatedAt: now,
        });
        changed++;
      } else if (holder && holder.createdAt <= source.createdAt) {
        // Holder is older: archive this row as the duplicate.
        await ctx.db.patch("sources", source._id, {
          status: "archived",
          blockedReason: "duplicate",
          blockedDetails: `dedupe-migration: duplicate of ${holder._id}`,
          updatedAt: now,
        });
        collisionsArchived++;
      } else if (holder) {
        // This row is older: it should own the canonical key. Archive the newer holder first.
        await ctx.db.patch("sources", holder._id, {
          status: "archived",
          blockedReason: "duplicate",
          blockedDetails: `dedupe-migration: duplicate of ${source._id}`,
          dedupeKey: generateArchivedDedupeKey(holder.dedupeKey, holder._id),
          updatedAt: now,
        });
        await ctx.db.patch("sources", source._id, {
          dedupeKey: canonical,
          updatedAt: now,
        });
        changed++;
        collisionsArchived++;
      }
    }

    return {
      processed: page.page.length,
      changed,
      collisionsArchived,
      skipped,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      planned: planned.slice(0, 50),
    };
  },
});

/**
 * Bulk archive sources by ID
 */
export const bulkArchive = mutation({
  args: {
    ids: v.array(v.id("sources")),
    reason: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({ archived: v.number() }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    let archived = 0;
    for (const id of args.ids) {
      const source = await ctx.db.get("sources", id);
      if (source) {
        await ctx.db.patch("sources", id, {
          status: "archived",
          blockedDetails: args.reason || "Archived: off-topic or irrelevant",
          updatedAt: Date.now(),
        });
        archived++;
      }
    }
    return { archived };
  },
});

/**
 * Hard delete a source by ID
 */
export const deleteById = mutation({
  args: { id: v.id("sources"), devBypassSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    await ctx.db.delete(args.id);
  },
});
