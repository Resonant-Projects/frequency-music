/**
 * Estimate or backfill the passage index over every text-bearing source,
 * regardless of status (consumers filter by live status after search).
 *
 * Dry run:
 *   vpx tsx scripts/backfill-passages.ts
 * Apply (after `passages:setIndexingEnabled {"enabled": true}`):
 *   vpx tsx scripts/backfill-passages.ts --apply
 *
 * Operator-gated: both modes contact the deployed Convex backend. Apply makes
 * paid text-embedding-3-large calls and requires OPENAI_API_KEY in the Convex
 * deployment environment. A dry run after apply should report pending=0.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import type { FunctionReturnType } from "convex/server";
import { api } from "../convex/_generated/api";
import {
  estimatePassageEmbedding,
  PASSAGE_EMBEDDING_MODEL,
  PASSAGE_USD_PER_MILLION_TOKENS,
} from "../convex/shared/passages";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

// Matches PAGE_SIZE in convex/passages.ts, which caps each page at ten
// sources to stay under Convex's 16 MiB transaction read limit.
const BATCH_SIZE = 10;

type BackfillBatchResult = FunctionReturnType<
  typeof api.passages.backfillBatch
>;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function printUsage() {
  console.log("Usage: vpx tsx scripts/backfill-passages.ts [--apply]");
  console.log("Default is a read-only count, size and cost estimate.");
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }
  const apply = process.argv.includes("--apply");
  const client = getConvexClient();
  const devBypassSecret = getDevBypassSecret();
  const totals = {
    scanned: 0,
    textBearing: 0,
    pending: 0,
    pendingChars: 0,
    indexed: 0,
    failed: 0,
  };
  let enabled = false;
  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    const result: BackfillBatchResult = await client.action(
      api.passages.backfillBatch,
      { cursor, batchSize: BATCH_SIZE, apply, devBypassSecret },
    );
    enabled = result.enabled;
    totals.scanned += result.scanned;
    totals.textBearing += result.textBearing;
    totals.pending += result.pending;
    totals.pendingChars += result.pendingChars;
    totals.indexed += result.indexed;
    totals.failed += result.failed;
    cursor = result.continueCursor;
    isDone = result.isDone;
    process.stderr.write(`\rsources: scanned ${totals.scanned}...`);
    if (apply && !isDone) await sleep(250);
  }
  process.stderr.write("\n");

  const estimate = estimatePassageEmbedding(totals.pendingChars);
  console.log(apply ? "APPLIED" : "DRY RUN (use --apply to execute)");
  console.log(`indexing=${enabled ? "enabled" : "disabled"}`);
  console.log(
    `sources: scanned=${totals.scanned} textBearing=${totals.textBearing} pending=${totals.pending} indexed=${totals.indexed} failed=${totals.failed}`,
  );
  console.log(
    `estimate: chars=${totals.pendingChars} tokens≈${estimate.tokens} cost≈$${estimate.usd.toFixed(4)} at $${PASSAGE_USD_PER_MILLION_TOKENS}/1M tokens (${PASSAGE_EMBEDDING_MODEL})`,
  );
  console.log(
    apply
      ? "convergence=pending (rerun the dry run to confirm pending=0)"
      : `converged=${totals.pending === 0 ? "yes" : "no"}`,
  );
  if (apply && totals.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
