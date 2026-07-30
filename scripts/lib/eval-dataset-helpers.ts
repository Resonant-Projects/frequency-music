import type { ConvexHttpClient } from "convex/browser";

export type Row = Record<string, any>;

export type EvalQuery = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

/**
 * How a linked row that no longer exists in Convex is handled.
 *
 * The golden datasets are a curated, reproducible snapshot — a dangling
 * `extractionId` there means the curation sheet and the database disagree, so
 * it must fail loudly (`"throw"`). The candidate datasets are an opportunistic
 * export of whatever currently exists, so they drop the missing row (`"skip"`).
 */
export type MissingRowPolicy = "throw" | "skip";

export function createEvalQuery(client: ConvexHttpClient): EvalQuery {
  return (name, args) => client.query(name as any, args);
}

export async function getRow(query: EvalQuery, name: string, id: string) {
  return (await query(name, { id })) as Row | null;
}

export async function requireRow(query: EvalQuery, name: string, id: string) {
  const row = await getRow(query, name, id);
  if (!row) throw new Error(`${name} did not return ${id}`);
  return row;
}

export async function resolveRow(
  query: EvalQuery,
  name: string,
  id: string,
  onMissing: MissingRowPolicy,
) {
  return onMissing === "throw"
    ? await requireRow(query, name, id)
    : await getRow(query, name, id);
}

export async function getSource(
  query: EvalQuery,
  sourceId: string | undefined,
) {
  if (!sourceId) return null;
  return await getRow(query, "sources:get", sourceId);
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
      resolveRow(query, "extractions:get", id, onMissing),
    ),
  );
  const present = linked.filter((row): row is Row => row !== null);
  if (present.length > 0) return present;

  const bySource = await Promise.all(
    (hypothesis.sourceIds ?? []).map(
      async (sourceId: string) =>
        (await query("extractions:getBySourceId", { sourceId })) as Row[],
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
