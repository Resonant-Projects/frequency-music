/**
 * List all extraction IDs and their sourceIds with quality metrics.
 * Outputs compact JSON to avoid truncation.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

async function main() {
  // Get all extractions in batches
  const all: any[] = [];
  const batch = await client.query(api.extractions.listRecent, { limit: 200 });
  all.push(...batch);

  const summary = all.map((e: any) => ({
    id: e._id,
    sourceId: e.sourceId,
    claims: e.claims?.length ?? 0,
    topics: e.topics?.length ?? 0,
    params: e.compositionParameters?.length ?? 0,
    model: e.model,
  }));

  const zeroClaims = summary.filter((s) => s.claims === 0).length;
  const zeroParams = summary.filter((s) => s.params === 0).length;

  console.error(`Total: ${summary.length}`);
  console.error(`Zero claims: ${zeroClaims}`);
  console.error(`Zero params: ${zeroParams}`);

  // Write to file
  const fs = await import("node:fs");
  fs.writeFileSync("/tmp/ext-summary.json", JSON.stringify(summary, null, 2));
  console.error("Written to /tmp/ext-summary.json");
}

main().catch(console.error);
