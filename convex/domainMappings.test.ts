import { describe, expect, test } from "vite-plus/test";
import {
  getSeedConceptDomainEntries,
  isConceptDomainRegistrySeeded,
  resolveDomainsForSector,
} from "./domainMappings";

describe("domain mappings", () => {
  test("falls back to built-in sector domains when the registry is empty", () => {
    expect(resolveDomainsForSector([], "math")).toEqual({
      sector: "math",
      domains: ["mathematics", "general"],
      specificDomains: ["mathematics"],
      usedFallback: true,
    });

    expect(resolveDomainsForSector([], "phys")).toEqual({
      sector: "wave",
      domains: ["acoustics", "general"],
      specificDomains: ["acoustics"],
      usedFallback: true,
    });
  });

  test("keeps legacy fallback behavior while the registry is only partially seeded", () => {
    expect(
      resolveDomainsForSector(
        [
          { name: "ratio-lattices", sectorMapping: "math" },
          { name: "spectral-fusion", sectorMapping: "synthesis" },
        ],
        "math",
      ),
    ).toEqual({
      sector: "math",
      domains: ["mathematics", "general"],
      specificDomains: ["mathematics"],
      usedFallback: true,
    });
  });

  test("uses the registry as the source of truth once the built-ins are seeded", () => {
    const seededEntries = [
      ...getSeedConceptDomainEntries(),
      { name: "ratio-lattices", sectorMapping: "math" },
      { name: "spectral-fusion", sectorMapping: "synthesis" },
    ];

    expect(isConceptDomainRegistrySeeded(seededEntries)).toBe(true);
    expect(resolveDomainsForSector(seededEntries, "math")).toEqual({
      sector: "math",
      domains: ["mathematics", "general", "ratio-lattices"],
      specificDomains: ["mathematics", "ratio-lattices"],
      usedFallback: false,
    });
  });

  test("includes general for every sector after the registry is seeded", () => {
    const seededEntries = getSeedConceptDomainEntries();

    expect(resolveDomainsForSector(seededEntries, "wave")).toEqual({
      sector: "wave",
      domains: ["acoustics", "general"],
      specificDomains: ["acoustics"],
      usedFallback: false,
    });
  });

  test("can infer sector membership from registry domain names after seeding", () => {
    expect(
      resolveDomainsForSector(
        [...getSeedConceptDomainEntries(), { name: "topology" }],
        "math",
      ),
    ).toEqual({
      sector: "math",
      domains: ["mathematics", "general", "topology"],
      specificDomains: ["mathematics", "topology"],
      usedFallback: false,
    });
  });
});
