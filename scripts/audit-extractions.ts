/**
 * Audit all extractions - show which ones have useful content vs noise.
 * Groups by quality tier so we can prioritize re-extraction.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { writeFileSync } from "fs";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

async function main() {
  const extractions = await client.query(api.extractions.listRecent, { limit: 200 });

  // Get source details for each extraction
  const results = [];
  for (const ext of extractions) {
    try {
      const source = await client.query(api.sources.get, { id: ext.sourceId });
      results.push({
        extractionId: ext._id,
        sourceId: ext.sourceId,
        title: source?.title ?? "UNKNOWN",
        type: source?.type ?? "unknown",
        claims: ext.claims?.length ?? 0,
        params: ext.compositionParameters?.length ?? 0,
        topics: ext.topics?.length ?? 0,
        hasContent: (source?.rawText?.length ?? 0) > 200,
        contentLen: source?.rawText?.length ?? 0,
        summary: ext.summary?.slice(0, 150) ?? "",
      });
    } catch {
      results.push({
        extractionId: ext._id,
        sourceId: ext.sourceId,
        title: "ERROR",
        type: "unknown",
        claims: ext.claims?.length ?? 0,
        params: ext.compositionParameters?.length ?? 0,
        topics: ext.topics?.length ?? 0,
        hasContent: false,
        contentLen: 0,
        summary: "",
      });
    }
  }

  // Tier 1: Has claims AND params (good extraction)
  const tier1 = results.filter(r => r.claims > 0 && r.params > 0);
  // Tier 2: Has claims but no params (partial - may need re-extract)
  const tier2 = results.filter(r => r.claims > 0 && r.params === 0);
  // Tier 3: Has content but zero claims (bad extraction or off-topic)
  const tier3 = results.filter(r => r.claims === 0 && r.hasContent);
  // Tier 4: No content
  const tier4 = results.filter(r => !r.hasContent);

  console.log(`\n=== Extraction Audit ===`);
  console.log(`Total: ${results.length}`);
  console.log(`Tier 1 (claims+params): ${tier1.length}`);
  console.log(`Tier 2 (claims only):   ${tier2.length}`);
  console.log(`Tier 3 (has content, 0 claims): ${tier3.length}`);
  console.log(`Tier 4 (no content):    ${tier4.length}`);

  console.log(`\n--- Tier 2: Have claims but missing params (re-extract priority) ---`);
  for (const r of tier2.slice(0, 20)) {
    console.log(`  ${r.claims}c/${r.params}p  ${r.title.slice(0, 70)}  (${r.contentLen} chars)`);
  }

  console.log(`\n--- Tier 3: Have content but 0 claims (check if relevant) ---`);
  for (const r of tier3.slice(0, 20)) {
    console.log(`  ${r.title.slice(0, 70)}  (${r.contentLen} chars)`);
    if (r.summary) console.log(`    ${r.summary.slice(0, 100)}`);
  }

  writeFileSync("/tmp/extraction-audit.json", JSON.stringify({
    tier1: tier1.map(r => ({ sourceId: r.sourceId, title: r.title })),
    tier2: tier2.map(r => ({ sourceId: r.sourceId, title: r.title, claims: r.claims })),
    tier3: tier3.map(r => ({ sourceId: r.sourceId, title: r.title, contentLen: r.contentLen })),
    tier4: tier4.map(r => ({ sourceId: r.sourceId, title: r.title })),
  }, null, 2));
  console.log(`\nFull audit written to /tmp/extraction-audit.json`);
}

main().catch(console.error);
