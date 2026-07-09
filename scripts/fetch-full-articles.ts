#!/usr/bin/env bun
/**
 * Fetch full article text for short rss/url sources via Jina Reader.
 *
 * Usage: bun run scripts/fetch-full-articles.ts [--limit N] [--min-length N] [--re-extract] [--dry-run]
 */
import { createSourceIngestor } from "./lib/ingest";

const args = process.argv.slice(2);

function numFlag(flag: string, fallback: number): number {
  const index = args.indexOf(flag);
  const parsed =
    index !== -1 ? Number.parseInt(args[index + 1] ?? "", 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const options = {
  limit: numFlag("--limit", 20),
  minLength: numFlag("--min-length", 1000),
  types: ["rss", "url"] as const,
  reExtract: args.includes("--re-extract"),
};

if (args.includes("--dry-run")) {
  console.log(
    `DRY RUN: refetch statuses=extracted,text_ready types=${options.types.join(",")} limit=${options.limit} minLength=${options.minLength} reExtract=${options.reExtract}`,
  );
} else {
  const summary = await createSourceIngestor().refetchByStatus(
    ["extracted", "text_ready"],
    { ...options, types: [...options.types] },
  );
  console.log(
    `Done: ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`,
  );
}
