import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Reusable validator for source status
const sourceStatusValidator = v.union(
  v.literal("ingested"),
  v.literal("text_ready"),
  v.literal("extracting"),
  v.literal("extracted"),
  v.literal("triaged"),
  v.literal("review_needed"),
);

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get sources by status (for inbox/pipeline views)
 */
export const listByStatus = query({
  args: {
    status: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("sources")
      .withIndex("by_status_updatedAt", (q) =>
        q.eq("status", args.status as any),
      )
      .order("desc")
      .take(limit);
  },
});

/**
 * Get a single source by ID
 */
export const get = query({
  args: { id: v.id("sources") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("sources", args.id);
  },
});

/**
 * Check if a source exists by dedupeKey
 */
export const getByDedupeKey = query({
  args: { dedupeKey: v.string() },
  returns: v.union(v.any(), v.null()),
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
  },
  returns: v.object({
    id: v.id("sources"),
    created: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for duplicate
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", args.dedupeKey))
      .first();

    if (existing) {
      return { id: existing._id, created: false, reason: "duplicate" };
    }

    // Compute hash if we have text
    let rawTextSha256: string | undefined;
    if (args.rawText || args.transcript) {
      const text = args.rawText || args.transcript || "";
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      rawTextSha256 = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    const id = await ctx.db.insert("sources", {
      ...args,
      rawTextSha256,
      status: args.rawText || args.transcript ? "text_ready" : "ingested",
      visibility: "private",
      createdBy: "system",
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
    status: v.string(),
    blockedReason: v.optional(v.string()),
    blockedDetails: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = await ctx.db.get("sources", args.id);
    if (!source) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Source not found",
      });
    }

    await ctx.db.patch("sources", args.id, {
      status: args.status as any,
      blockedReason: args.blockedReason as any,
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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

// ============================================================================
// INGEST HELPERS - Deduplication key generators
// ============================================================================

/**
 * Generate dedupeKey for different source types
 */
export function generateDedupeKey(
  type: string,
  identifiers: {
    notionPageId?: string;
    feedUrl?: string;
    rssGuid?: string;
    canonicalUrl?: string;
    youtubeVideoId?: string;
    fileSha256?: string;
  },
): string {
  switch (type) {
    case "notion":
      return `notion:${identifiers.notionPageId}`;
    case "rss":
      return `rss:${identifiers.feedUrl}:${identifiers.rssGuid || identifiers.canonicalUrl}`;
    case "url":
      return `url:${normalizeUrl(identifiers.canonicalUrl || "")}`;
    case "youtube":
      return `yt:${identifiers.youtubeVideoId}`;
    case "pdf":
      return `pdf:${identifiers.fileSha256}`;
    case "podcast":
      return `podcast:${identifiers.feedUrl}:${identifiers.rssGuid || identifiers.canonicalUrl}`;
    default:
      return `unknown:${Date.now()}`;
  }
}

/**
 * Normalize URL for deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
  } catch {
    return url.toLowerCase();
  }
}
