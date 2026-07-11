#!/usr/bin/env -S vpx tsx
/**
 * Ingest a JSON manifest of sources. New source batches are data, not code.
 *
 * Dry-run by default; pass --apply to ingest the manifest.
 * Usage: bun run scripts/ingest-manifest.ts data/<batch>.json [--apply]
 */
import { readFileSync } from "node:fs";
import { type SourceManifestItem, createSourceIngestor } from "./lib/ingest";

const args = process.argv.slice(2);
const path = args.find((arg) => !arg.startsWith("--"));
if (!path) {
  console.error(
    "Usage: bun run scripts/ingest-manifest.ts <manifest.json> [--apply]",
  );
  process.exit(1);
}

const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
if (!Array.isArray(parsed)) {
  throw new Error("Manifest must be a JSON array");
}
const items = parsed as SourceManifestItem[];

const apply = args.includes("--apply");

if (!apply) {
  const typeCounts = new Map<string, number>();
  for (const item of items) {
    typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
  }
  const types = [...typeCounts.entries()]
    .map(([type, count]) => `${type}:${count}`)
    .join(",");
  console.log(
    `DRY RUN: manifest=${path} sources=${items.length} types=${types} (use --apply to ingest)`,
  );
} else {
  console.log(`Ingesting ${items.length} sources from ${path}\n`);
  const summary = await createSourceIngestor().ingest(items);
  console.log(
    `\nDone: ${summary.created} created, ${summary.skipped} skipped, ${summary.failed} failed`,
  );
}
