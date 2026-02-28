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

interface ExtractionSummaryRow {
  sourceId: string;
  claims: number;
  params: number;
}

function isExtractionSummaryRow(value: unknown): value is ExtractionSummaryRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.sourceId === "string" &&
    typeof row.claims === "number" &&
    typeof row.params === "number"
  );
}

async function main() {
  const offset = parseInt(process.argv[2] || "0", 10);
  const limit = parseInt(process.argv[3] || "5", 10);

  // Read the summary file
  const rawSummary = JSON.parse(readFileSync("/tmp/ext-summary.json", "utf-8"));
  const summary = Array.isArray(rawSummary)
    ? rawSummary.filter((entry): entry is ExtractionSummaryRow =>
        isExtractionSummaryRow(entry),
      )
    : [];

  // If SOURCE_IDS env var is set, use those directly
  const sourceIds = process.env.SOURCE_IDS?.split(",") || [];
  const needsWork =
    sourceIds.length > 0
      ? sourceIds
          .map((sid) =>
            summary.find(
              (entry: ExtractionSummaryRow) => entry.sourceId === sid,
            ),
          )
          .filter(Boolean)
      : summary
          .filter(
            (entry: ExtractionSummaryRow) =>
              entry.claims === 0 || entry.params === 0,
          )
          .slice(offset, offset + limit);

  console.log(
    `Re-extracting ${needsWork.length} sources (offset=${offset}, limit=${limit})`,
  );
  console.log(
    `Total needing work: ${summary.filter((entry) => entry.claims === 0 || entry.params === 0).length}`,
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ Failed: ${message.slice(0, 100)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
