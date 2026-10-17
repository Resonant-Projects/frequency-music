/**
 * Estimate or backfill the passage index over every text-bearing source,
 * regardless of status (consumers filter by live status after search).
 *
 * Dry run:
 *   vpx tsx scripts/backfill-passages.ts
 * Canary, then full apply (after `passages:setIndexingEnabled {"enabled": true}`):
 *   vpx tsx scripts/backfill-passages.ts --apply --canary
 *   vpx tsx scripts/backfill-passages.ts --apply
 *
 * Operator-gated: both modes contact the deployed Convex backend. Apply makes
 * paid text-embedding-3-large calls and requires OPENAI_API_KEY in the Convex
 * deployment environment. A dry run after apply should report pending=0.
 * Reruns resume: a source whose current text has a ready entry is skipped.
 * The acceptance sequence is docs/evidence/passage-index-20261017/acceptance.md.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";
import {
  BACKFILL_USAGE,
  backfillExitCode,
  backfillReport,
  parseBackfillArgs,
  runBackfill,
} from "./lib/passage-backfill";

async function main() {
  let options: ReturnType<typeof parseBackfillArgs>;
  try {
    options = parseBackfillArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(BACKFILL_USAGE.join("\n"));
    process.exitCode = 2;
    return;
  }
  if (options === "help") {
    console.log(BACKFILL_USAGE.join("\n"));
    return;
  }
  const client = getConvexClient();
  const devBypassSecret = getDevBypassSecret();
  const run = await runBackfill(
    (args) =>
      client.action(api.passages.backfillBatch, { ...args, devBypassSecret }),
    options,
    {
      onProgress: (totals) =>
        process.stderr.write(`\rsources: scanned ${totals.scanned}...`),
    },
  );
  process.stderr.write("\n");
  for (const line of backfillReport(run, options)) console.log(line);
  if (run.error !== undefined) console.error(run.error);
  process.exitCode = backfillExitCode(run, options);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
