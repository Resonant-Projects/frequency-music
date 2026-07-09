/**
 * Migrate source dedupeKeys to the canonical sourceUtils format.
 *
 * Dry-run by default: prints planned changes and collisions, writes nothing.
 * Usage:
 *   bun run scripts/migrate-dedupe-keys.ts           # dry run
 *   bun run scripts/migrate-dedupe-keys.ts --apply   # execute
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
  throw new Error(
    "Set AUTH_BYPASS_SECRET before applying dedupe-key mutations",
  );
}

type MigrationBatchResult = {
  processed: number;
  changed: number;
  collisionsArchived: number;
  skipped: number;
  isDone: boolean;
  continueCursor: string;
  planned: Array<{
    id: string;
    from: string;
    to: string;
    collidesWith: string | null;
  }>;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const client = new ConvexHttpClient(CONVEX_URL as string);

  let cursor: string | null = null;
  let isDone = false;
  const totals = {
    processed: 0,
    changed: 0,
    collisionsArchived: 0,
    skipped: 0,
  };
  const planned: Array<{
    id: string;
    from: string;
    to: string;
    collidesWith: string | null;
  }> = [];
  const plannedByCanonicalKey = new Map<string, string>();

  while (!isDone) {
    const result: MigrationBatchResult = await client.mutation(
      api.sources.recomputeDedupeKeys,
      {
        cursor,
        batchSize: 25,
        apply,
        devBypassSecret: BYPASS,
      },
    );
    totals.processed += result.processed;
    totals.changed += result.changed;
    totals.collisionsArchived += result.collisionsArchived;
    totals.skipped += result.skipped;
    for (const change of result.planned) {
      const earlierPlannedId = plannedByCanonicalKey.get(change.to);
      if (!change.collidesWith && earlierPlannedId) {
        planned.push({ ...change, collidesWith: earlierPlannedId });
      } else {
        planned.push(change);
      }
      if (!earlierPlannedId) {
        plannedByCanonicalKey.set(change.to, change.collidesWith ?? change.id);
      }
    }
    cursor = result.continueCursor;
    isDone = result.isDone;
    process.stdout.write(`\rprocessed ${totals.processed}...`);
  }
  console.log("\n");

  for (const p of planned) {
    const marker = p.collidesWith
      ? `COLLISION → archive vs ${p.collidesWith}`
      : "rekey";
    console.log(`${p.id}\n  from: ${p.from}\n  to:   ${p.to}\n  ${marker}\n`);
  }

  console.log(`${apply ? "APPLIED" : "DRY RUN (use --apply to execute)"}`);
  console.log(
    `processed=${totals.processed} rekeyed=${totals.changed} archived=${totals.collisionsArchived} skipped=${totals.skipped} plannedShown=${planned.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
