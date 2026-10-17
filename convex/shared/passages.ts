// Passage retrieval contract shared by the Convex passage index, the agent
// tool surface and the operator scripts. Passages live in their own embedding
// space (ADR 0001): never compare a stored claim/concept vector against it.

export const PASSAGE_NAMESPACE = "sources";
export const PASSAGE_EMBEDDING_MODEL = "text-embedding-3-large";
export const PASSAGE_EMBEDDING_DIMENSIONS = 3072;
// OpenAI list price for text-embedding-3-large, used only for estimates.
export const PASSAGE_USD_PER_MILLION_TOKENS = 0.13;

// The index-level filter is the immutable source type only. Status changes
// are applied after search against the live source row, never stored here.
export const PASSAGE_SOURCE_TYPES = [
  "notion",
  "rss",
  "url",
  "youtube",
  "pdf",
  "podcast",
] as const;
export type PassageSourceType = (typeof PASSAGE_SOURCE_TYPES)[number];

// Paid indexing stays off until an operator enables it after a dry run.
export const PASSAGE_INDEXING_SETTING = "passageIndexing";
export const PASSAGE_INDEXING_ENABLED = "enabled";

export const PASSAGE_SEARCH_DEFAULT_LIMIT = 5;
export const PASSAGE_SEARCH_MAX_LIMIT = 8;
export const PASSAGE_QUERY_MAX_CHARS = 2000;
export const PASSAGE_CHUNK_CONTEXT = { before: 1, after: 1 } as const;
export const PASSAGE_RESPONSE_MAX_CHARS = 12_000;
export const PASSAGE_TRUNCATION_MARKER = "\n[… passage truncated]";

/** Rough embedding estimate for operator dry runs (about 4 chars per token). */
export function estimatePassageEmbedding(chars: number): {
  tokens: number;
  usd: number;
} {
  const tokens = Math.ceil(chars / 4);
  return { tokens, usd: (tokens / 1_000_000) * PASSAGE_USD_PER_MILLION_TOKENS };
}

export function clampPassageLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return PASSAGE_SEARCH_DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), PASSAGE_SEARCH_MAX_LIMIT);
}

/** The text a source contributes to the passage index, matching rawTextSha256. */
export function passageSourceText(source: {
  rawText?: string;
  transcript?: string;
}): string {
  return source.rawText || source.transcript || "";
}

export type PassageHit<SourceId extends string = string> = {
  sourceId: SourceId;
  title?: string;
  canonicalUrl?: string;
  status: string;
  text: string;
  score: number;
  order: number;
  truncated?: true;
};

export type PassageSearchResult<SourceId extends string = string> = {
  passages: PassageHit<SourceId>[];
  // Set when lower-scored passages were dropped or one was cut to fit.
  truncated: boolean;
  omitted: number;
};

/**
 * Keep the highest-scored passages within the response character budget.
 * Lower-scored passages are dropped whole; only a first passage that alone
 * exceeds the budget is cut, and then visibly marked.
 */
export function boundPassages<SourceId extends string>(
  hits: readonly PassageHit<SourceId>[],
  maxChars = PASSAGE_RESPONSE_MAX_CHARS,
): PassageSearchResult<SourceId> {
  // eslint-disable-next-line unicorn/no-array-sort -- The agent's ES target does not include Array#toSorted.
  const ranked = [...hits].sort((a, b) => b.score - a.score);
  const passages: PassageHit<SourceId>[] = [];
  let used = 0;
  for (const hit of ranked) {
    if (used + hit.text.length <= maxChars) {
      passages.push(hit);
      used += hit.text.length;
      continue;
    }
    if (passages.length === 0) {
      const room = Math.max(maxChars - PASSAGE_TRUNCATION_MARKER.length, 0);
      passages.push({
        ...hit,
        text: `${hit.text.slice(0, room)}${PASSAGE_TRUNCATION_MARKER}`,
        truncated: true,
      });
    }
    break;
  }
  const omitted = ranked.length - passages.length;
  return {
    passages,
    truncated: omitted > 0 || passages.some((passage) => passage.truncated),
    omitted,
  };
}
