/**
 * Estimate or backfill embeddings for active claims and on-mission concepts.
 *
 * Dry run:
 *   vpx tsx scripts/embed-backfill.ts
 * Apply:
 *   vpx tsx scripts/embed-backfill.ts --apply
 *
 * Operator-gated: both modes contact the deployed Convex backend. Apply also
 * requires OPENAI_API_KEY in the Convex deployment environment.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

const BATCH_SIZE = 100;
const USD_PER_MILLION_TOKENS = 0.02;

type BackfillKind = "claims" | "concepts";
type BackfillBatchResult = {
  kind: BackfillKind;
  scanned: number;
  pending: number;
  pendingChars: number;
  embedded: number;
  remaining: number;
  isDone: boolean;
  continueCursor: string;
};

function printUsage() {
  console.log("Usage: vpx tsx scripts/embed-backfill.ts [--apply]");
  console.log("Default is a read-only cost and coverage estimate.");
}

async function processKind(kind: BackfillKind, apply: boolean) {
  const client = getConvexClient();
  const devBypassSecret = getDevBypassSecret();
  let cursor: string | null = null;
  let isDone = false;
  const totals = {
    scanned: 0,
    pending: 0,
    pendingChars: 0,
    embedded: 0,
    remaining: 0,
  };
  while (!isDone) {
    const result: BackfillBatchResult = await client.action(
      api.embeddings.backfillBatch,
      {
        kind,
        cursor,
        batchSize: BATCH_SIZE,
        apply,
        devBypassSecret,
      },
    );
    totals.scanned += result.scanned;
    totals.pending += result.pending;
    totals.pendingChars += result.pendingChars;
    totals.embedded += result.embedded;
    totals.remaining += result.remaining;
    cursor = result.continueCursor;
    isDone = result.isDone;
    process.stderr.write(`\r${kind}: scanned ${totals.scanned} rows...`);
  }
  process.stderr.write("\n");
  return totals;
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }
  const apply = process.argv.includes("--apply");
  const claimTotals = await processKind("claims", apply);
  const conceptTotals = await processKind("concepts", apply);
  const pendingChars = claimTotals.pendingChars + conceptTotals.pendingChars;
  const estimatedTokens = Math.ceil(pendingChars / 4);
  const estimatedCost = (estimatedTokens / 1_000_000) * USD_PER_MILLION_TOKENS;

  console.log(apply ? "APPLIED" : "DRY RUN (use --apply to execute)");
  console.log(
    `claims: scanned=${claimTotals.scanned} pending=${claimTotals.pending} embedded=${claimTotals.embedded} remaining=${claimTotals.remaining}`,
  );
  console.log(
    `concepts: scanned=${conceptTotals.scanned} pending=${conceptTotals.pending} embedded=${conceptTotals.embedded} remaining=${conceptTotals.remaining}`,
  );
  console.log(
    `estimate: chars=${pendingChars} tokens≈${estimatedTokens} cost≈$${estimatedCost.toFixed(4)} at $0.02/1M tokens`,
  );
  console.log(
    apply
      ? "convergence=pending (rerun dry-run after all batches complete)"
      : `converged=${claimTotals.pending + conceptTotals.pending === 0 ? "yes" : "no"}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
