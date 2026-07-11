#!/usr/bin/env -S vpx tsx
/**
 * Fetch full text for Notion sources that have URLs.
 *
 * Usage: bun scripts/fetch-notion-full-text.ts [--limit N] [--dry-run]
 */
import { createSourceIngestor } from "./lib/ingest";

const args = process.argv.slice(2);
const index = args.indexOf("--limit");
const parsed =
  index !== -1 ? Number.parseInt(args[index + 1] ?? "", 10) : Number.NaN;
const limit = Number.isInteger(parsed) && parsed > 0 ? parsed : 20;

if (args.includes("--dry-run")) {
  console.log(
    `DRY RUN: refetch statuses=ingested types=notion limit=${limit} minLength=500`,
  );
} else {
  console.log(`📚 Fetching full text for Notion sources (limit: ${limit})\n`);
  const summary = await createSourceIngestor().refetchByStatus(["ingested"], {
    limit,
    minLength: 500,
    types: ["notion"],
  });
  console.log(
    `\n✅ Updated: ${summary.updated}  ⏭ Skipped: ${summary.skipped}  ❌ Errors: ${summary.failed}`,
  );
}
