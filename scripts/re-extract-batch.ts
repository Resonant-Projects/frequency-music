/**
 * Re-extract sources by calling the Convex extractSource action.
 * Takes a batch of source IDs and re-runs extraction with a specified model.
 *
 * Usage: CONVEX_URL=... bun run scripts/re-extract-batch.ts [offset] [limit]
 */

import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

async function main() {
  const offset = parseInt(process.argv[2] || "0", 10);
  const limit = parseInt(process.argv[3] || "5", 10);

  // Read the summary file
  const summary = JSON.parse(readFileSync("/tmp/ext-summary.json", "utf-8"));

  // If SOURCE_IDS env var is set, use those directly
  const sourceIds = process.env.SOURCE_IDS?.split(",") || [];
  const needsWork =
    sourceIds.length > 0
      ? sourceIds
          .map((sid) => summary.find((e: any) => e.sourceId === sid))
          .filter(Boolean)
      : summary
          .filter((e: any) => e.claims === 0 || e.params === 0)
          .slice(offset, offset + limit);

  console.log(
    `Re-extracting ${needsWork.length} sources (offset=${offset}, limit=${limit})`,
  );
  console.log(
    `Total needing work: ${summary.filter((e: any) => e.claims === 0 || e.params === 0).length}`,
  );

  for (const ext of needsWork) {
    try {
      console.log(`\nExtracting sourceId=${ext.sourceId}...`);
      const result = await client.action(api.extract.extractSource, {
        sourceId: ext.sourceId,
        model: "anthropic/claude-sonnet-4-6",
        force: true,
      });
      console.log(`  ✓ Done: ${JSON.stringify(result)}`);
    } catch (e: any) {
      console.error(`  ✗ Failed: ${e.message?.slice(0, 100)}`);
    }
  }
}

main().catch(console.error);
