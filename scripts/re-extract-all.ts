/**
 * Re-extract all Tier 1 + Tier 2 sources with Sonnet 4.6.
 * Reads from /tmp/extraction-audit.json and processes sequentially.
 * Tracks progress in /tmp/re-extract-progress.json.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);
const PROGRESS_FILE = "/tmp/re-extract-progress.json";

async function main() {
  const audit = JSON.parse(readFileSync("/tmp/extraction-audit.json", "utf-8"));

  // Tier 2 first (most improvement potential), then Tier 1
  const toProcess = [
    ...audit.tier2.map((r: any) => ({ ...r, tier: 2 })),
    ...audit.tier1.map((r: any) => ({ ...r, tier: 1 })),
  ];

  // Load progress
  let progress: Record<string, string> = {};
  if (existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }

  const remaining = toProcess.filter((r) => !progress[r.sourceId]);
  console.log(`Total to process: ${toProcess.length}`);
  console.log(`Already done: ${Object.keys(progress).length}`);
  console.log(`Remaining: ${remaining.length}`);
  console.log(`---`);

  let success = 0;
  let failed = 0;

  for (const item of remaining) {
    try {
      console.log(`[Tier ${item.tier}] ${item.title?.slice(0, 60)}...`);
      const result = await client.action(api.extract.extractSource, {
        sourceId: item.sourceId,
        model: "anthropic/claude-sonnet-4-6",
        force: true,
      });

      const claims = (result as any)?.claimCount ?? "?";
      const params = (result as any)?.parameterCount ?? "?";
      console.log(`  ✓ ${claims} claims, ${params} params`);
      progress[item.sourceId] = "done";
      success++;
    } catch (e: any) {
      console.error(`  ✗ ${e.message?.slice(0, 80)}`);
      progress[item.sourceId] = `error: ${e.message?.slice(0, 50)}`;
      failed++;
    }

    // Save progress after each item
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

    // Small delay to be gentle on the API
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n=== Done ===`);
  console.log(`Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
