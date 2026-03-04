/**
 * Update sources in Convex from /tmp/kernel-text-*.txt files
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { readFileSync, readdirSync } from "fs";
import { Id } from "../convex/_generated/dataModel";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);
const BYPASS = "freq-opus-extract-2026";

async function main() {
  const files = readdirSync("/tmp").filter(f => f.startsWith("kernel-text-jx7"));
  
  for (const file of files) {
    const sourceId = file.replace("kernel-text-", "").replace(".txt", "");
    const text = readFileSync(`/tmp/${file}`, "utf-8");
    console.log(`${sourceId}: ${text.length} chars`);
    
    if (text.length < 500) {
      console.log("  ⏭ Too short, skipping");
      continue;
    }

    try {
      await client.mutation(api.sources.updateText, {
        id: sourceId as Id<"sources">,
        rawText: text.slice(0, 100000),
        devBypassSecret: BYPASS,
      });
      console.log("  ✓ Updated");
    } catch (e: any) {
      console.error(`  ✗ ${e.message?.slice(0, 120)}`);
    }
  }
}

main().catch(console.error);
