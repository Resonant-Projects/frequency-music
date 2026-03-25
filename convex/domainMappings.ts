export type DisplaySectorId =
  | "math"
  | "wave"
  | "music"
  | "psycho"
  | "geometry"
  | "synthesis";

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

const defaultSectorDomainMap: Record<DisplaySectorId, string[]> = {
  math: ["mathematics"],
  wave: ["acoustics"],
  music: ["tuning", "theory", "general"],
  psycho: ["psychoacoustics"],
  geometry: ["geometry"],
  synthesis: ["production", "instrument"],
};

const directDomainSectorMap = new Map<string, DisplaySectorId>(
  Object.entries(defaultSectorDomainMap).flatMap(([sector, domains]) =>
    domains.map((domain) => [domain, sector as DisplaySectorId]),
  ),
);

export function normalizeSectorId(raw: string): DisplaySectorId {
  const normalized = raw.toLowerCase().trim();
  return sectorAliases[normalized] ?? "music";
}

export function getDefaultDomainsForSector(sectorId: string): string[] {
  return defaultSectorDomainMap[normalizeSectorId(sectorId)];
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
