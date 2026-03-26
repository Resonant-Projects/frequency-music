import { describe, expect, test } from "bun:test";
import { resolveDomainsForSector } from "./domainMappings";

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

  test("prefers registry matches over the fallback map", () => {
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
      domains: ["ratio-lattices"],
      specificDomains: ["ratio-lattices"],
      usedFallback: false,
    });
  });

  test("can infer sector membership from registry domain names", () => {
    expect(
      resolveDomainsForSector([{ name: "topology" }], "math"),
    ).toEqual({
      sector: "math",
      domains: ["topology"],
      specificDomains: ["topology"],
      usedFallback: false,
    });
  });
});
