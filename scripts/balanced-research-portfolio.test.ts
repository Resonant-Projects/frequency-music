import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { computeCanonicalDedupeKey } from "../convex/sourceUtils";

describe("approved balanced research portfolio", () => {
  test("contains 24 distinct substantive units with the approved area allocation and provenance", () => {
    const rows = JSON.parse(
      readFileSync(
        new URL("../data/balanced-research-portfolio.json", import.meta.url),
        "utf8",
      ),
    ) as Array<{
      type: "url";
      url: string;
      title: string;
      topics: string[];
      fetchText: boolean;
      metadata: {
        researchPortfolio: {
          area: string;
          primaryDomain: string;
          workId: string;
          contentScope: string;
        };
      };
    }>;
    const counts: Record<string, number> = {};
    const keys = new Set<string>();
    for (const row of rows) {
      const provenance = row.metadata.researchPortfolio;
      expect(provenance.workId).toBeTruthy();
      expect(provenance.primaryDomain).toBeTruthy();
      expect(row.title).toBeTruthy();
      expect(row.topics.length).toBeGreaterThan(0);
      // Capture is a deliberate separate step, never an implicit paid fetch.
      expect(row.fetchText).toBe(false);
      expect(["full_text", "abstract", "reference_only"]).toContain(
        provenance.contentScope,
      );
      counts[provenance.area] = (counts[provenance.area] ?? 0) + 1;
      keys.add(
        computeCanonicalDedupeKey({ type: "url", canonicalUrl: row.url })!,
      );
    }
    expect(keys.size).toBe(24);
    expect(counts).toEqual({
      math: 5,
      wave: 5,
      music: 5,
      psycho: 5,
      geometry: 2,
      synthesis: 2,
    });
  });
});
