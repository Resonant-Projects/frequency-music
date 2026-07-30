import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id, TableNames } from "../../convex/_generated/dataModel";

/**
 * A materialized eval row: a Convex document plus the enrichment fields this
 * module adds. Kept open-ended because the generated datasets are deliberately
 * heterogeneous (a hypothesis row carries aggregated `claims`, an extraction row
 * carries `rawText`), but each read below is typed at its call site by the
 * generated `api` reference rather than a string name.
 */
export type Row = Record<string, any>;

/**
 * Reads the eval datasets need. Typed against the generated `api` so a renamed
 * or re-signatured Convex function breaks the build here instead of producing an
 * empty golden file at runtime.
 */
export interface EvalQuery {
  source(id: string): Promise<Row | null>;
  extraction(id: string): Promise<Row | null>;
  extractionsBySource(sourceId: string): Promise<Row[]>;
  hypothesis(id: string): Promise<Row | null>;
  recipe(id: string): Promise<Row | null>;
  weeklyBrief(id: string): Promise<Row | null>;
  thesesByIds(ids: string[]): Promise<Row[]>;
  failuresByKeys(keys: string[]): Promise<Row[]>;
}

/**
 * How a linked row that no longer exists in Convex is handled.
 *
 * The golden datasets are a curated, reproducible snapshot — a dangling
 * `extractionId` there means the curation sheet and the database disagree, so
 * it must fail loudly (`"throw"`). The candidate datasets are an opportunistic
 * export of whatever currently exists, so they drop the missing row (`"skip"`).
 */
export type MissingRowPolicy = "throw" | "skip";

/**
 * Convex ids are branded strings; the curation sheet and the exported JSONL
 * carry them as plain strings. This is the one place that conversion happens.
 */
function asId<T extends TableNames>(id: string) {
  return id as Id<T>;
}

export function createEvalQuery(client: ConvexHttpClient): EvalQuery {
  return {
    source: (id) => client.query(api.sources.get, { id: asId<"sources">(id) }),
    extraction: (id) =>
      client.query(api.extractions.get, { id: asId<"extractions">(id) }),
    extractionsBySource: (sourceId) =>
      client.query(api.extractions.getBySourceId, {
        sourceId: asId<"sources">(sourceId),
      }),
    hypothesis: (id) =>
      client.query(api.hypotheses.get, { id: asId<"hypotheses">(id) }),
    recipe: (id) => client.query(api.recipes.get, { id: asId<"recipes">(id) }),
    weeklyBrief: (id) =>
      client.query(api.weeklyBriefs.get, { id: asId<"weeklyBriefs">(id) }),
    thesesByIds: (ids) =>
      client.query(api.theses.getByIds, {
        ids: ids.map((id) => asId<"theses">(id)),
      }),
    failuresByKeys: (keys) => client.query(api.failures.getByKeys, { keys }),
  };
}

/** Reads a single row, naming the lookup in the error when it is missing. */
export async function requireRow(
  query: EvalQuery,
  reader: "source" | "extraction" | "hypothesis" | "recipe" | "weeklyBrief",
  id: string,
) {
  const row = await query[reader](id);
  if (!row) throw new Error(`${reader} did not return ${id}`);
  return row;
}

export async function getSource(
  query: EvalQuery,
  sourceId: string | undefined,
) {
  if (!sourceId) return null;
  return await query.source(sourceId);
}

/**
 * Extractions backing a hypothesis: its explicit `extractionIds` when present,
 * otherwise the most recent extraction per linked source.
 */
export async function resolveHypothesisExtractions(
  query: EvalQuery,
  hypothesis: Row,
  onMissing: MissingRowPolicy,
) {
  const linked = await Promise.all(
    (hypothesis.extractionIds ?? []).map((id: string) =>
      onMissing === "throw"
        ? requireRow(query, "extraction", id)
        : query.extraction(id),
    ),
  );
  const present = linked.filter((row): row is Row => row !== null);
  if (present.length > 0) return present;

  const bySource = await Promise.all(
    (hypothesis.sourceIds ?? []).map((sourceId: string) =>
      query.extractionsBySource(sourceId),
    ),
  );
  return bySource.flatMap((rows) => rows.slice(0, 1));
}

/**
 * Adds the aggregated claim/parameter/topic context an eval row needs on top of
 * the raw hypothesis document. Used for both the standalone hypothesis datasets
 * and the hypotheses embedded in weekly briefs so the same hypothesis id always
 * materializes to the same shape.
 */
export async function enrichHypothesis(
  query: EvalQuery,
  hypothesis: Row,
  onMissing: MissingRowPolicy,
) {
  const [source, extractions] = await Promise.all([
    getSource(query, hypothesis.sourceIds?.[0]),
    resolveHypothesisExtractions(query, hypothesis, onMissing),
  ]);
  return {
    sourceTitle: source?.title ?? "(untitled source)",
    claims: extractions.flatMap((row) => row.claims ?? []),
    compositionParameters: extractions.flatMap(
      (row) => row.compositionParameters ?? [],
    ),
    topics: [...new Set(extractions.flatMap((row) => row.topics ?? []))],
    ...hypothesis,
  };
}

/**
 * Weekly briefs from the e2e era reference thesis rows that have since been
 * deleted. Rather than dropping them, emit one row per `activeThesisId` — the
 * stored row when it still exists, otherwise a placeholder titled from the
 * `e2e-*` names the brief body still quotes.
 *
 * Resolved per id rather than "all or nothing": a partially-deleted thesis set
 * would otherwise silently shrink `theses` below the ids the brief cites.
 */
export function withPlaceholderTheses(brief: Row, storedTheses: Row[]) {
  const activeThesisIds: string[] = brief.activeThesisIds ?? [];
  if (activeThesisIds.length === 0) return storedTheses;

  const storedById = new Map(
    storedTheses.map((thesis) => [String(thesis._id), thesis]),
  );
  const placeholderTitles = [
    ...String(brief.bodyMd ?? "").matchAll(/`(e2e-\d+)`/g),
  ].map((match) => match[1]);

  return activeThesisIds.map(
    (thesisId, index) =>
      storedById.get(thesisId) ?? {
        _id: thesisId,
        title: placeholderTitles[index] ?? `Unavailable thesis ${index + 1}`,
        statement:
          "Historical placeholder referenced by the ratified weekly brief; the original thesis row is no longer present.",
      },
  );
}
