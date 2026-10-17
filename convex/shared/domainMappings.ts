export type DisplaySectorId =
  | "math"
  | "wave"
  | "music"
  | "psycho"
  | "geometry"
  | "synthesis";

/**
 * The most concept names one `dashboard.conceptSectors` lookup accepts. Each
 * concept read carries its embedding (~12 KB), so 500 names, plus at most one
 * registry read per concept, stay well inside one query's 16 MiB read budget
 * and 4,096 index ranges.
 */
export const MAX_CONCEPT_SECTOR_NAMES = 500;

export type ConceptDomainRegistryEntry = {
  name: string;
  sectorMapping?: string;
};

const sectorAliases: Record<string, DisplaySectorId> = {
  math: "math",
  phys: "wave",
  wave: "wave",
  music: "music",
  psycho: "psycho",
  geo: "geometry",
  geometry: "geometry",
  synth: "synthesis",
  synthesis: "synthesis",
};

const registryDefaultSectorDomainMap: Record<DisplaySectorId, string[]> = {
  math: ["mathematics"],
  wave: ["acoustics"],
  music: ["tuning", "theory", "general"],
  psycho: ["psychoacoustics"],
  geometry: ["geometry"],
  synthesis: ["production", "instrument"],
};

const fallbackSectorDomainMap: Record<DisplaySectorId, string[]> = {
  math: ["mathematics", "general"],
  wave: ["acoustics", "general"],
  music: ["tuning", "theory", "general"],
  psycho: ["psychoacoustics", "general"],
  geometry: ["geometry", "general"],
  synthesis: ["production", "instrument", "general"],
};

const directDomainSectorMap = new Map<string, DisplaySectorId>(
  Object.entries(registryDefaultSectorDomainMap).flatMap(([sector, domains]) =>
    domains.map((domain) => [domain, sector as DisplaySectorId]),
  ),
);

const seedConceptDomainEntries: Array<ConceptDomainRegistryEntry> = [
  { name: "mathematics", sectorMapping: "math" },
  { name: "acoustics", sectorMapping: "wave" },
  { name: "tuning", sectorMapping: "music" },
  { name: "theory", sectorMapping: "music" },
  { name: "psychoacoustics", sectorMapping: "psycho" },
  { name: "geometry", sectorMapping: "geometry" },
  { name: "production", sectorMapping: "synthesis" },
  { name: "instrument", sectorMapping: "synthesis" },
  { name: "general" },
];

export function normalizeSectorId(raw: string): DisplaySectorId {
  const normalized = raw.toLowerCase().trim();
  return sectorAliases[normalized] ?? "music";
}

export function getDefaultDomainsForSector(sectorId: string): string[] {
  return fallbackSectorDomainMap[normalizeSectorId(sectorId)];
}

export function getSeedConceptDomainEntries(): ConceptDomainRegistryEntry[] {
  return seedConceptDomainEntries.map((entry) => ({ ...entry }));
}

export function isConceptDomainRegistrySeeded(
  entries: ConceptDomainRegistryEntry[],
): boolean {
  const names = new Set(
    entries
      .map((entry) => entry.name.toLowerCase().trim())
      .filter((name) => name.length > 0),
  );
  return seedConceptDomainEntries.every((entry) => names.has(entry.name));
}

export function resolveDomainsForSector(
  entries: ConceptDomainRegistryEntry[],
  sectorId: string,
) {
  const sector = normalizeSectorId(sectorId);
  const registrySeeded = isConceptDomainRegistrySeeded(entries);
  if (!registrySeeded) {
    const fallbackDomains = fallbackSectorDomainMap[sector];
    return {
      sector,
      domains: fallbackDomains,
      specificDomains: fallbackDomains.filter((domain) => domain !== "general"),
      usedFallback: true,
    };
  }

  const registryDomains = Array.from(
    new Set(
      entries.flatMap((entry) => {
        const name = entry.name.toLowerCase().trim();
        if (!name) return [];
        if (name === "general") return ["general"];
        return resolveDomainSector(name, [entry]) === sector ? [name] : [];
      }),
    ),
  );

  return {
    sector,
    domains: registryDomains,
    specificDomains: registryDomains.filter((domain) => domain !== "general"),
    usedFallback: false,
  };
}

/**
 * The display sector for a concept domain. This is the one domain→sector
 * contract: a registry row's curated `sectorMapping` wins, and any other
 * domain takes the default mapping below.
 */
export function resolveDomainSector(
  domain: string,
  entries: ConceptDomainRegistryEntry[],
): DisplaySectorId {
  const name = domain.toLowerCase().trim();
  const sectorMapping = entries.find(
    (entry) => entry.name.toLowerCase().trim() === name,
  )?.sectorMapping;
  return sectorMapping
    ? normalizeSectorId(sectorMapping)
    : inferDisplaySectorFromDomain(name);
}

export function inferDisplaySectorFromDomain(domain?: string): DisplaySectorId {
  const normalized = domain?.toLowerCase().trim();
  if (!normalized) return "music";

  const mapped = directDomainSectorMap.get(normalized);
  if (mapped) return mapped;

  if (
    normalized.includes("math") ||
    normalized.includes("ratio") ||
    normalized.includes("topolog")
  ) {
    return "math";
  }
  if (
    normalized.includes("wave") ||
    normalized.includes("acoust") ||
    normalized.includes("reson")
  ) {
    return "wave";
  }
  if (
    normalized.includes("psycho") ||
    normalized.includes("perception") ||
    normalized.includes("conson")
  ) {
    return "psycho";
  }
  if (
    normalized.includes("geometr") ||
    normalized.includes("polygon") ||
    normalized.includes("platonic")
  ) {
    return "geometry";
  }
  if (
    normalized.includes("synth") ||
    normalized.includes("timbre") ||
    normalized.includes("production") ||
    normalized.includes("instrument")
  ) {
    return "synthesis";
  }
  return "music";
}
