// The passage index: full source text chunked into @convex-dev/rag with
// text-embedding-3-large (ADR 0001). This is the only module that constructs
// the RAG client. Indexing is scheduled from source text writes and never
// runs inline, so an indexing failure can never fail the parent write.
import { openai } from "@ai-sdk/openai";
import { RAG } from "@convex-dev/rag";
import { literals } from "convex-helpers/validators";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { readSetting, writeSetting } from "./settings";
import {
  boundPassages,
  clampPassageLimit,
  PASSAGE_CHUNK_CONTEXT,
  PASSAGE_EMBEDDING_DIMENSIONS,
  PASSAGE_EMBEDDING_MODEL,
  PASSAGE_INDEXING_ENABLED,
  PASSAGE_INDEXING_SETTING,
  PASSAGE_NAMESPACE,
  PASSAGE_QUERY_MAX_CHARS,
  PASSAGE_SOURCE_TYPES,
  type PassageHit,
  type PassageSearchResult as SharedPassageSearchResult,
  type PassageSourceType,
  passageSourceText,
} from "./shared/passages";
import { redactError } from "./shared/redactError";

export { PASSAGE_EMBEDDING_MODEL, PASSAGE_NAMESPACE };

export const rag = new RAG<{ type: PassageSourceType }, { sourceId: string }>(
  components.rag,
  {
    textEmbeddingModel: openai.embedding(PASSAGE_EMBEDDING_MODEL),
    embeddingDimension: PASSAGE_EMBEDDING_DIMENSIONS,
    // Immutable facts only: the component cannot update filter values in
    // place, so status is filtered after search against the live source row.
    filterNames: ["type"],
  },
);

// Pages and hydrations read whole source documents (up to 1 MiB each), so ten
// or twelve rows keep one transaction under Convex's 16 MiB read limit.
const PAGE_SIZE = 10;
// Archived hits are dropped after search, so fetch extra candidates; each
// distinct hit source is one document read during hydration.
const SEARCH_OVERFETCH = 2;
const SEARCH_MAX_CANDIDATES = 12;

const sourceTypeValidator = literals(...PASSAGE_SOURCE_TYPES);

const passageSearchResultValidator = v.object({
  passages: v.array(
    v.object({
      sourceId: v.id("sources"),
      title: v.optional(v.string()),
      canonicalUrl: v.optional(v.string()),
      status: v.string(),
      text: v.string(),
      score: v.number(),
      order: v.number(),
      truncated: v.optional(v.literal(true)),
    }),
  ),
  truncated: v.boolean(),
  omitted: v.number(),
});

type PassageSearchResult = SharedPassageSearchResult<Id<"sources">>;

const indexOutcomeValidator = literals(
  "indexed",
  "unchanged",
  "removed",
  "disabled",
  "failed",
);
type IndexOutcome = "indexed" | "unchanged" | "removed" | "disabled" | "failed";

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Schedule (never run inline) passage indexing for a source whose text was
 * written, changed or cleared. Call from every source text write site.
 */
export async function schedulePassageIndex(
  ctx: Pick<MutationCtx, "scheduler">,
  sourceId: Id<"sources">,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.passages.indexSource, { sourceId });
}

/** Schedule removal of a hard-deleted source's passages. */
export async function schedulePassageRemoval(
  ctx: Pick<MutationCtx, "scheduler">,
  sourceId: Id<"sources">,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.passages.removeSource, {
    sourceId,
  });
}

// ============================================================================
// INTERNAL READS
// ============================================================================

export const indexingEnabled = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) =>
    (await readSetting(ctx, PASSAGE_INDEXING_SETTING)) ===
    PASSAGE_INDEXING_ENABLED,
});

export const sourceForIndex = internalQuery({
  args: { sourceId: v.id("sources") },
  returns: v.union(
    v.null(),
    v.object({
      type: sourceTypeValidator,
      title: v.optional(v.string()),
      text: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const source = await ctx.db.get("sources", args.sourceId);
    if (!source) return null;
    return {
      type: source.type,
      title: source.title,
      text: passageSourceText(source),
    };
  },
});

/** One page of sources with their indexable text size and content hash. */
export const textBearingPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), numItems: v.number() },
  returns: v.object({
    scanned: v.number(),
    rows: v.array(
      v.object({
        sourceId: v.id("sources"),
        chars: v.number(),
        contentHash: v.string(),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("sources").paginate({
      cursor: args.cursor,
      numItems: Math.min(Math.max(Math.trunc(args.numItems), 1), PAGE_SIZE),
    });
    const rows = [];
    for (const source of page.page) {
      const text = passageSourceText(source);
      if (!text) continue;
      rows.push({
        sourceId: source._id,
        chars: text.length,
        contentHash: await sha256Hex(text),
      });
    }
    return {
      scanned: page.page.length,
      rows,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/** Live source rows for search hydration; unknown keys are omitted. */
export const liveSources = internalQuery({
  args: { keys: v.array(v.string()) },
  returns: v.array(
    v.object({
      sourceId: v.id("sources"),
      title: v.optional(v.string()),
      canonicalUrl: v.optional(v.string()),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = [];
    for (const key of new Set(args.keys)) {
      const id = ctx.db.normalizeId("sources", key);
      const source = id ? await ctx.db.get("sources", id) : null;
      if (!source) continue;
      rows.push({
        sourceId: source._id,
        title: source.title,
        canonicalUrl: source.canonicalUrl,
        status: source.status,
      });
    }
    return rows;
  },
});

// ============================================================================
// INDEXING
// ============================================================================

async function removeEntries(ctx: ActionCtx, sourceId: Id<"sources">) {
  const namespace = await rag.getNamespace(ctx, {
    namespace: PASSAGE_NAMESPACE,
  });
  if (!namespace) return;
  await rag.deleteByKey(ctx, {
    namespaceId: namespace.namespaceId,
    key: sourceId,
  });
}

async function hasCurrentEntry(
  ctx: ActionCtx,
  sourceId: Id<"sources">,
  contentHash: string,
): Promise<boolean> {
  const entry = await rag.findEntryByContentHash(ctx, {
    namespace: PASSAGE_NAMESPACE,
    key: sourceId,
    contentHash,
  });
  return entry?.status === "ready";
}

/**
 * Bring one source's passages in line with its current text. Unchanged text
 * is detected before rag.add, which would otherwise embed before deduplicating.
 */
async function indexOne(
  ctx: ActionCtx,
  sourceId: Id<"sources">,
): Promise<IndexOutcome> {
  try {
    const source = await ctx.runQuery(internal.passages.sourceForIndex, {
      sourceId,
    });
    if (!source || !source.text) {
      // Removal is free, so cleared or deleted text never waits for the gate.
      await removeEntries(ctx, sourceId);
      // Text restored meanwhile may have been judged unchanged by another
      // run, whose entry this removal just deleted: index it again.
      const restored = await ctx.runQuery(internal.passages.sourceForIndex, {
        sourceId,
      });
      if (restored?.text)
        await ctx.scheduler.runAfter(0, internal.passages.indexSource, {
          sourceId,
        });
      return "removed";
    }
    if (!(await ctx.runQuery(internal.passages.indexingEnabled, {}))) {
      return "disabled";
    }
    const contentHash = await sha256Hex(source.text);
    if (await hasCurrentEntry(ctx, sourceId, contentHash)) return "unchanged";
    const result = await rag.add(ctx, {
      namespace: PASSAGE_NAMESPACE,
      key: sourceId,
      contentHash,
      title: source.title,
      filterValues: [{ name: "type", value: source.type }],
      metadata: { sourceId },
      text: source.text,
    });
    if (result.replacedEntry && result.replacedEntry.entryId !== result.entryId)
      await rag.delete(ctx, { entryId: result.replacedEntry.entryId });
    // A concurrent write or delete may have landed while this one embedded.
    const latest = await ctx.runQuery(internal.passages.sourceForIndex, {
      sourceId,
    });
    if (!latest?.text || (await sha256Hex(latest.text)) !== contentHash)
      await ctx.scheduler.runAfter(0, internal.passages.indexSource, {
        sourceId,
      });
    return "indexed";
  } catch (error) {
    console.warn(
      `Passage indexing skipped for ${sourceId}: ${redactError(error)}`,
    );
    return "failed";
  }
}

export const indexSource = internalAction({
  args: { sourceId: v.id("sources") },
  returns: indexOutcomeValidator,
  handler: (ctx, args): Promise<IndexOutcome> => indexOne(ctx, args.sourceId),
});

export const removeSource = internalAction({
  args: { sourceId: v.id("sources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // A hard-deleted id is never reused, so no restore recheck is needed.
      await removeEntries(ctx, args.sourceId);
    } catch (error) {
      console.warn(
        `Passage removal failed for ${args.sourceId}: ${redactError(error)}`,
      );
    }
    return null;
  },
});

/**
 * Weekly belt-and-braces sweep: re-index any text-bearing source whose current
 * text has no ready entry. Unchanged sources cost one lookup and no embedding.
 */
export const sweep = internalAction({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ctx.runQuery(internal.passages.indexingEnabled, {})))
      return null;
    const page = await ctx.runQuery(internal.passages.textBearingPage, {
      cursor: args.cursor ?? null,
      numItems: PAGE_SIZE,
    });
    for (const row of page.rows) {
      if (await hasCurrentEntry(ctx, row.sourceId, row.contentHash)) continue;
      await indexOne(ctx, row.sourceId);
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.passages.sweep, {
        cursor: page.continueCursor,
      });
    return null;
  },
});

// ============================================================================
// SEARCH
// ============================================================================

async function searchPassages(
  ctx: ActionCtx,
  args: { query: string; limit?: number; types?: PassageSourceType[] },
): Promise<PassageSearchResult> {
  const query = args.query.trim();
  if (!query || query.length > PASSAGE_QUERY_MAX_CHARS) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `Query must be 1-${PASSAGE_QUERY_MAX_CHARS} characters`,
    });
  }
  const limit = clampPassageLimit(args.limit);
  // An index that was never populated cannot match; skip the paid query embed.
  const namespace = await rag.getNamespace(ctx, {
    namespace: PASSAGE_NAMESPACE,
  });
  if (!namespace) return { passages: [], truncated: false, omitted: 0 };
  const { results, entries } = await rag.search(ctx, {
    namespace: PASSAGE_NAMESPACE,
    query,
    limit: Math.min(limit * SEARCH_OVERFETCH, SEARCH_MAX_CANDIDATES),
    chunkContext: PASSAGE_CHUNK_CONTEXT,
    filters: [...new Set(args.types ?? [])].map((type) => ({
      name: "type" as const,
      value: type,
    })),
  });
  const keyByEntry = new Map(
    entries.flatMap((entry) => (entry.key ? [[entry.entryId, entry.key]] : [])),
  );
  const live = new Map(
    (
      await ctx.runQuery(internal.passages.liveSources, {
        keys: [...new Set(keyByEntry.values())],
      })
    ).map((source) => [source.sourceId as string, source] as const),
  );
  // The component gives a hit's neighbouring chunk to an adjacent hit's range
  // rather than repeating it, so rebuild each window from every range.
  const chunkText = new Map<string, string>();
  for (const result of results)
    result.content.forEach((chunk, index) =>
      chunkText.set(
        `${result.entryId}:${result.startOrder + index}`,
        chunk.text,
      ),
    );
  const windowText = (entryId: string, order: number) =>
    [
      order - PASSAGE_CHUNK_CONTEXT.before,
      order,
      order + PASSAGE_CHUNK_CONTEXT.after,
    ]
      .flatMap((at) => {
        const text = chunkText.get(`${entryId}:${at}`);
        return text === undefined ? [] : [text];
      })
      .join("\n");
  const hits: PassageHit<Id<"sources">>[] = [];
  for (const result of results.toSorted((a, b) => b.score - a.score)) {
    const key = keyByEntry.get(result.entryId);
    const source = key ? live.get(key) : undefined;
    // Live status, never the at-index-time status; archived sources drop out.
    if (!source || source.status === "archived") continue;
    hits.push({
      sourceId: source.sourceId,
      ...(source.title === undefined ? {} : { title: source.title }),
      ...(source.canonicalUrl === undefined
        ? {}
        : { canonicalUrl: source.canonicalUrl }),
      status: source.status,
      text: windowText(result.entryId, result.order),
      score: result.score,
      order: result.order,
    });
    if (hits.length === limit) break;
  }
  return boundPassages(hits);
}

const searchArgs = {
  query: v.string(),
  limit: v.optional(v.number()),
  types: v.optional(v.array(sourceTypeValidator)),
};

/** Backing action for the searchSourcePassages agent tool. */
export const searchForAgent = internalAction({
  args: searchArgs,
  returns: passageSearchResultValidator,
  handler: (ctx, args): Promise<PassageSearchResult> =>
    searchPassages(ctx, args),
});

// ============================================================================
// OPERATOR TOOLS (scripts/probe-passages.ts, scripts/backfill-passages.ts)
// ============================================================================

export const probe = action({
  args: { ...searchArgs, devBypassSecret: v.optional(v.string()) },
  returns: passageSearchResultValidator,
  handler: async (ctx, args): Promise<PassageSearchResult> => {
    await requireAuth(ctx, args);
    return await searchPassages(ctx, args);
  },
});

/** Operator switch for paid indexing; off until a dry run is reviewed. */
export const setIndexingEnabled = internalMutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await writeSetting(
      ctx,
      PASSAGE_INDEXING_SETTING,
      args.enabled ? PASSAGE_INDEXING_ENABLED : "disabled",
    );
    return null;
  },
});

type BackfillBatchResult = {
  enabled: boolean;
  scanned: number;
  textBearing: number;
  pending: number;
  pendingChars: number;
  indexed: number;
  failed: number;
  isDone: boolean;
  continueCursor: string;
};

/**
 * One backfill page. Dry run reports how many text-bearing sources lack a
 * current entry and their size; apply indexes them and needs the gate on.
 */
export const backfillBatch = action({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    enabled: v.boolean(),
    scanned: v.number(),
    textBearing: v.number(),
    pending: v.number(),
    pendingChars: v.number(),
    indexed: v.number(),
    failed: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args): Promise<BackfillBatchResult> => {
    const identity = await requireAuth(ctx, args);
    if (!identity.isBypass)
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Passage backfill requires the operator bypass secret",
      });
    const enabled = await ctx.runQuery(internal.passages.indexingEnabled, {});
    if (args.apply && !enabled)
      throw new ConvexError({
        code: "INDEXING_DISABLED",
        message:
          "Passage indexing is disabled; run passages:setIndexingEnabled first",
      });
    const page = await ctx.runQuery(internal.passages.textBearingPage, {
      cursor: args.cursor,
      numItems: args.batchSize ?? PAGE_SIZE,
    });
    let pending = 0;
    let pendingChars = 0;
    let indexed = 0;
    let failed = 0;
    for (const row of page.rows) {
      if (await hasCurrentEntry(ctx, row.sourceId, row.contentHash)) continue;
      pending++;
      pendingChars += row.chars;
      if (!args.apply) continue;
      const outcome = await indexOne(ctx, row.sourceId);
      if (outcome === "indexed" || outcome === "unchanged") indexed++;
      else failed++;
    }
    return {
      enabled,
      scanned: page.scanned,
      textBearing: page.rows.length,
      pending,
      pendingChars,
      indexed,
      failed,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
