// Bounded passage retrieval over the existing source index. Index creation and
// lifecycle stay in passages.ts; this module owns candidate selection and context.
import type { RAG } from "@convex-dev/rag";
import { embed } from "ai";
import { ConvexError } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import {
  packPassages,
  clampPassageLimit,
  passageContextWindow,
  PASSAGE_CHUNK_CONTEXT,
  PASSAGE_EMBEDDING_DIMENSIONS,
  PASSAGE_EMBEDDING_MODEL,
  PASSAGE_NAMESPACE,
  PASSAGE_QUERY_MAX_CHARS,
  type PassageHit,
  type PassageSearchResult,
  type PassageSourceType,
} from "./shared/passages";

const SEARCH_OVERFETCH = 8;
const SEARCH_MAX_CANDIDATES = 64;
const SOURCE_HYDRATION_BATCH = 12;
type SearchResult = PassageSearchResult<Id<"sources">>;

export async function searchPassages(
  ctx: ActionCtx,
  args: { query: string; limit?: number; types?: PassageSourceType[] },
  rag: RAG<{ type: PassageSourceType }, { sourceId: string }>,
): Promise<SearchResult> {
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
  // Retrieve enough globally ranked chunks to survive repeated windows from
  // one Source, then select distinct Sources before their additional windows.
  const { embedding } = await embed({
    model: rag.options.textEmbeddingModel,
    value: query,
  });
  const { results, entries } = await ctx.runAction(
    components.rag.search.search,
    {
      namespace: PASSAGE_NAMESPACE,
      modelId: PASSAGE_EMBEDDING_MODEL,
      dimension: PASSAGE_EMBEDDING_DIMENSIONS,
      embedding,
      textQuery: query,
      limit: Math.min(limit * SEARCH_OVERFETCH, SEARCH_MAX_CANDIDATES),
      chunkContext: PASSAGE_CHUNK_CONTEXT,
      vectorWeight: 1,
      textWeight: 4,
      filters: [...new Set(args.types ?? [])].map((type) => ({
        name: "type",
        value: type,
      })),
    },
  );
  // Only a ready entry is the source's current text; an add interrupted
  // between chunk batches can leave a pending entry's vectors searchable.
  const keyByEntry = new Map(
    entries.flatMap((entry) =>
      entry.key && entry.status === "ready" ? [[entry.entryId, entry.key]] : [],
    ),
  );
  // Each hydration reads whole Source rows. Keep every query at twelve rows
  // even when the candidate pool contains many distinct Sources.
  const keys = [...new Set(keyByEntry.values())];
  const live = new Map<
    string,
    {
      sourceId: Id<"sources">;
      title?: string;
      canonicalUrl?: string;
      status: string;
    }
  >();
  for (let start = 0; start < keys.length; start += SOURCE_HYDRATION_BATCH) {
    const rows = await ctx.runQuery(internal.passages.liveSources, {
      keys: keys.slice(start, start + SOURCE_HYDRATION_BATCH),
    });
    for (const source of rows) live.set(source.sourceId, source);
  }
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
    passageContextWindow(
      chunkText.get(`${entryId}:${order}`) ?? "",
      chunkText.get(`${entryId}:${order - 1}`),
      chunkText.get(`${entryId}:${order + 1}`),
    );
  const hits: PassageHit<Id<"sources">>[] = [];
  const seenSources = new Set<string>();
  const repeated = [];
  const diverse = [];
  for (const result of results.toSorted((a, b) => b.score - a.score)) {
    const key = keyByEntry.get(result.entryId);
    if (!key) continue;
    if (seenSources.has(key)) repeated.push(result);
    else {
      seenSources.add(key);
      diverse.push(result);
    }
  }
  // Consider each source's best passage before additional overlapping hits
  // from the same source can consume the result count and character budget.
  for (const result of [...diverse, ...repeated]) {
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
      ...windowText(result.entryId, result.order),
      score: result.score,
      order: result.order,
    });
    if (hits.length === limit) break;
  }
  return packPassages(hits);
}
