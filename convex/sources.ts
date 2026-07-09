import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import {
  sourceBlockedReasonValidator,
  sourceStatusValidator,
} from "./schema";
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
  let rawTextSha256: string | undefined;

  if (text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    rawTextSha256 = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

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
