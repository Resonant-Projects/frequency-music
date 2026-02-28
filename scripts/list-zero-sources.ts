import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

interface SummaryItem {
  sourceId: string;
  claims: number;
  params: number;
}

function isSummaryItem(item: unknown): item is SummaryItem {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const row = item as Record<string, unknown>;
  return (
    typeof row.sourceId === "string" &&
    typeof row.claims === "number" &&
    typeof row.params === "number"
  );
}

const summary = JSON.parse(
  readFileSync("/tmp/ext-summary.json", "utf-8"),
) as unknown;
const rows = Array.isArray(summary)
  ? summary.filter((item): item is SummaryItem => isSummaryItem(item))
  : [];
const invalidCount = Array.isArray(summary) ? summary.length - rows.length : 0;
if (invalidCount > 0) {
  console.warn(`Skipped ${invalidCount} invalid summary rows`);
}
const zeros = rows.filter((e: SummaryItem) => e.claims === 0 && e.params === 0);

async function main() {
  for (const z of zeros) {
    const source = await client.query(api.sources.get, { id: z.sourceId });
    const title = source?.title?.slice(0, 70) || "UNKNOWN";
    const type = source?.type || "?";
    const textLen = source?.rawText?.length || 0;
    console.log(
      `${z.sourceId} | ${type.padEnd(10)} | ${textLen.toString().padStart(6)} | ${title}`,
    );
  }
}
main();
