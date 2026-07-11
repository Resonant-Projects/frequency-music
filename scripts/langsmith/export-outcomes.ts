#!/usr/bin/env -S vpx tsx
/**
 * Export studio outcomes as eval labels (plan 05, task 2).
 *
 * Walks every composition's lineage (composition -> recipe -> hypothesis ->
 * extraction) via Convex, derives an outcome label
 * (expand | repeat | no_expand | failure_archived) from the latest listening
 * verdict + failure archive status, pushes the labeled rows into the LangSmith
 * dataset "studio-outcomes", and prints an outcome-rate table grouped by the
 * extraction promptVersion.
 *
 * Live Convex + LangSmith calls are gated behind env: CONVEX_URL must be set.
 * If no LangSmith API key is present (or --dry-run is passed) the dataset push
 * is skipped and the table is still printed.
 *
 * Usage:
 *   CONVEX_URL=... LANGSMITH_API_KEY=... bun scripts/langsmith/export-outcomes.ts [--limit N] [--dry-run]
 */
import "varlock/auto-load";
import { Client } from "langsmith";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  type LineageLike,
  type OutcomeRow,
  formatOutcomeTable,
  groupByPromptVersion,
  outcomeRowFromLineage,
  outcomeToExample,
} from "./export-outcomes-lib";

const DATASET_NAME = "studio-outcomes";
const DATASET_DESCRIPTION =
  "Studio composition outcomes (expand | repeat | no_expand | failure_archived) as eval labels, keyed by extraction promptVersion/model.";
const LINEAGE_BATCH_SIZE = 20;

const CONVEX_URL = process.env.CONVEX_URL ?? process.env.CONVEX_SELF_HOSTED_URL;
if (!CONVEX_URL) {
  console.error(
    "CONVEX_URL (or CONVEX_SELF_HOSTED_URL) is not set. This script makes live Convex calls; refusing to run.",
  );
  process.exit(1);
}

function parseLimit(argv: string[], fallback: number): number {
  const idx = argv.indexOf("--limit");
  if (idx < 0) return fallback;
  const parsed = Number(argv[idx + 1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function isLangSmithDatasetNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    name?: unknown;
    status?: unknown;
    response?: { status?: unknown };
    message?: unknown;
  };
  if (err.name === "LangSmithNotFoundError") return true;
  if (err.status === 404 || err.response?.status === 404) return true;
  return (
    typeof err.message === "string" &&
    /dataset\[.*\] not found/i.test(err.message)
  );
}

async function collectOutcomeRows(
  client: ConvexHttpClient,
  limit: number,
): Promise<OutcomeRow[]> {
  const compositions = await client.query(api.compositions.list, { limit });
  if (compositions.length === limit) {
    console.warn(
      `Fetched ${limit} compositions (== --limit); the archive may be truncated. Re-run with a larger --limit.`,
    );
  }

  const rows: OutcomeRow[] = [];
  for (let i = 0; i < compositions.length; i += LINEAGE_BATCH_SIZE) {
    const batch = compositions.slice(i, i + LINEAGE_BATCH_SIZE);
    const lineages = await Promise.all(
      batch.map((composition) =>
        client.query(api.compositions.getLineage, {
          id: composition._id as Id<"compositions">,
        }),
      ),
    );
    for (const lineage of lineages) {
      if (!lineage) continue;
      const row = outcomeRowFromLineage(lineage as unknown as LineageLike);
      if (row) rows.push(row);
    }
  }
  return rows;
}

async function pushToLangSmith(rows: OutcomeRow[]): Promise<void> {
  const client = new Client();

  let dataset: Awaited<ReturnType<typeof client.readDataset>>;
  try {
    dataset = await client.readDataset({ datasetName: DATASET_NAME });
    console.log(`Found existing dataset: ${DATASET_NAME}`);
  } catch (error) {
    if (!isLangSmithDatasetNotFound(error)) throw error;
    dataset = await client.createDataset(DATASET_NAME, {
      description: DATASET_DESCRIPTION,
    });
    console.log(`Created dataset: ${DATASET_NAME}`);
  }

  // Dedup on compositionId (one label per composition).
  const existing = new Set<string>();
  for await (const ex of client.listExamples({ datasetId: dataset.id })) {
    const compositionId = (ex.metadata as Record<string, unknown> | undefined)
      ?.compositionId;
    if (typeof compositionId === "string") existing.add(compositionId);
  }

  let created = 0;
  for (const row of rows) {
    if (existing.has(row.compositionId)) continue;
    const example = outcomeToExample(row);
    await client.createExample({ ...example, dataset_id: dataset.id });
    existing.add(row.compositionId);
    created += 1;
  }
  console.log(
    `studio-outcomes: uploaded ${created} new example(s) (${rows.length - created} already present).`,
  );
}

async function main() {
  const argv = process.argv;
  const limit = parseLimit(argv, 1000);
  const dryRun = argv.includes("--dry-run");
  const hasLangSmithKey = Boolean(
    process.env.LANGSMITH_API_KEY ?? process.env.LANGCHAIN_API_KEY,
  );

  const convex = new ConvexHttpClient(CONVEX_URL as string);
  const rows = await collectOutcomeRows(convex, limit);

  if (!rows.length) {
    console.log(
      "No labeled compositions found (no listening verdict or failure status yet).",
    );
    return;
  }

  const groups = groupByPromptVersion(rows);
  console.log(
    `\nStudio outcomes by promptVersion (${rows.length} labeled composition(s)):\n`,
  );
  console.log(formatOutcomeTable(groups));
  console.log("");

  if (dryRun) {
    console.log("--dry-run: skipping LangSmith upload.");
    return;
  }
  if (!hasLangSmithKey) {
    console.warn(
      "No LANGSMITH_API_KEY / LANGCHAIN_API_KEY set; skipping LangSmith upload. (Table printed above.)",
    );
    return;
  }

  await pushToLangSmith(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
