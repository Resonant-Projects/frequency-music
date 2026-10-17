// Which domain sector a pipeline item (source, extraction, hypothesis) belongs
// to. Items carry topic or concept names; `api.dashboard.conceptSectors` maps
// the classified ones to sectors through the shared domain→sector contract in
// `convex/shared/domainMappings.ts`.

/** Normalized concept name → display sector, for classified concepts only. */
export type ConceptSectors = ReadonlyMap<string, string>;

const normalizeName = (name: string) => name.toLowerCase().trim();

/**
 * The sector most of an item's classified concepts share; a tie goes to the
 * sector of its first classified concept. An item with no classified concept
 * falls back to topic keywords.
 */
export function itemSector(
  names: readonly string[] | undefined,
  conceptSectors: ConceptSectors,
): string {
  const votes = new Map<string, number>();
  for (const name of names ?? []) {
    const sector = conceptSectors.get(normalizeName(name));
    if (sector) votes.set(sector, (votes.get(sector) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [sector, count] of votes) {
    // Map order is first-vote order, so a strict comparison keeps the tie-break.
    if (best === undefined || count > votes.get(best)!) best = sector;
  }
  return best ?? inferSectorFromTopics(names ?? []);
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
