/**
 * Backfill first-class claim rows from embedded extraction claims.
 *
 * Dry-run by default:
 *   vpx tsx scripts/backfill-claims.ts
 * Apply:
 *   vpx tsx scripts/backfill-claims.ts --apply
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_SELF_HOSTED_URL ?? process.env.CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error("Set CONVEX_SELF_HOSTED_URL or CONVEX_URL in .env.local");
}
const BYPASS = process.env.AUTH_BYPASS_SECRET;
if (!BYPASS) {
  throw new Error("Set AUTH_BYPASS_SECRET before running the claims backfill");
}

type BackfillBatchResult = {
  processed: number;
  claimsInserted: number;
  skippedExisting: number;
  isDone: boolean;
  continueCursor: string;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const client = new ConvexHttpClient(CONVEX_URL);
  let cursor: string | null = null;
  let isDone = false;
  const totals = { processed: 0, claimsInserted: 0, skippedExisting: 0 };

  while (!isDone) {
    const result: BackfillBatchResult = await client.mutation(
      api.extractions.backfillClaims,
      {
        cursor,
        batchSize: 10,
        apply,
        devBypassSecret: BYPASS,
      },
    );
    totals.processed += result.processed;
    totals.claimsInserted += result.claimsInserted;
    totals.skippedExisting += result.skippedExisting;
    cursor = result.continueCursor;
    isDone = result.isDone;
    process.stdout.write(`\rprocessed ${totals.processed} extractions...`);
  }

  console.log("\n");
  console.log(apply ? "APPLIED" : "DRY RUN (use --apply to execute)");
  console.log(
    `processed=${totals.processed} claims=${totals.claimsInserted} skippedExisting=${totals.skippedExisting}`,
  );
  if (!apply) {
    console.log(`converged=${totals.claimsInserted === 0 ? "yes" : "no"}`);
  } else {
    console.log(
      "convergence=pending (rerun without --apply; claims must report 0)",
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
