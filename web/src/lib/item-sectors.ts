// Which domain sector a pipeline item (source, extraction, hypothesis) belongs
// to. Items carry topic or concept names; `api.dashboard.conceptSectors` maps
// the classified ones to sectors through the shared domain→sector contract in
// `convex/shared/domainMappings.ts`.

import type { PipelineItems } from "./zodiac-types";

/** Normalized concept name → display sector, for classified concepts only. */
export type ConceptSectors = ReadonlyMap<string, string>;

const normalizeName = (name: string) => name.toLowerCase().trim();

/**
 * The sector most of an item's classified concepts share; a tie goes to the
 * sector of its first classified concept. An item with no classified concept
 * falls back to topic keywords. An item with no topics at all has no sector:
 * nothing places it, so no domain claims it.
 */
export function itemSector(
  names: readonly string[] | undefined,
  conceptSectors: ConceptSectors,
): string | undefined {
  if (!names?.length) return undefined;
  const votes = new Map<string, number>();
  // One vote per concept: a source's own topics can repeat its extraction's.
  for (const name of new Set(names.map(normalizeName))) {
    const sector = conceptSectors.get(name);
    if (sector) votes.set(sector, (votes.get(sector) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [sector, count] of votes) {
    // Map order is first-vote order, so a strict comparison keeps the tie-break.
    if (best === undefined || count > votes.get(best)!) best = sector;
  }
  return best ?? inferSectorFromTopics(names);
}

/**
 * A source's topic names. An extracted source's topics live on its current
 * extraction, not on the source row. A sampled extraction's topics come first,
 * in their current order, so the tie-break agrees with the extraction itself.
 * The source's linked concept names (`conceptNames`, read per source) cover
 * every sampled source; their order is the order concepts were first linked,
 * which stands in for topic order only when the extraction is not sampled.
 */
export function sourceTopicNames(
  extractions: ReadonlyArray<{ sourceId: string; topics: readonly string[] }>,
): (source: {
  _id: string;
  topics?: readonly string[];
  conceptNames?: readonly string[];
}) => string[] {
  const bySource = new Map<string, string[]>();
  for (const { sourceId, topics } of extractions) {
    bySource.set(sourceId, [...(bySource.get(sourceId) ?? []), ...topics]);
  }
  return (source) => [
    ...(bySource.get(source._id) ?? []),
    ...(source.topics ?? []),
    ...(source.conceptNames ?? []),
  ];
}

/** Each placeable item's topic names: sources, then extractions, then hypotheses. */
export function pipelineItemNames(
  items: PipelineItems,
): Array<string[] | undefined> {
  const sourceTopics = sourceTopicNames(items.extractions);
  return [
    ...items.sources.map(sourceTopics),
    ...items.extractions.map((extraction) => extraction.topics),
    ...items.hypotheses.map((hypothesis) => hypothesis.concepts),
  ];
}

/**
 * The concept names to look up for a set of items, at most `limit`. It takes
 * every item's first topic, then every item's second, and so on, so a bounded
 * lookup reaches as many items as possible.
 */
export function conceptSectorLookupNames(
  itemNames: ReadonlyArray<readonly string[] | undefined>,
  limit: number,
): string[] {
  const names = new Set<string>();
  const depth = Math.max(0, ...itemNames.map((list) => list?.length ?? 0));
  for (let rank = 0; rank < depth; rank++) {
    for (const list of itemNames) {
      const name = list?.[rank] && normalizeName(list[rank]);
      if (!name) continue;
      names.add(name);
      if (names.size >= limit) return [...names];
    }
  }
  return [...names];
}

// Fallback only: items with no classified concept (topics not yet linked or
// classified, or beyond the lookup bound) are placed by these topic keywords.
function inferSectorFromTopics(topics: readonly string[]): string {
  const joined = topics.join(" ").toLowerCase();
  if (
    joined.includes("math") ||
    joined.includes("ratio") ||
    joined.includes("topolog")
  )
    return "math";
  if (
    joined.includes("wave") ||
    joined.includes("frequency") ||
    joined.includes("reson") ||
    joined.includes("acoust")
  )
    return "wave";
  if (
    joined.includes("psycho") ||
    joined.includes("perception") ||
    joined.includes("consonan")
  )
    return "psycho";
  if (
    joined.includes("geometr") ||
    joined.includes("tonnetz") ||
    joined.includes("symmetry")
  )
    return "geometry";
  if (
    joined.includes("synth") ||
    joined.includes("timbre") ||
    joined.includes("production")
  )
    return "synthesis";
  return "music";
}
