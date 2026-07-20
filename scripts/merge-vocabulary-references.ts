/**
 * Rewrite references for vocabulary merges that exceed the inline transaction.
 *
 * Dry run (default):
 *   vpx tsx scripts/merge-vocabulary-references.ts --list parameterKind --source <id> --target <id>
 * Apply:
 *   vpx tsx scripts/merge-vocabulary-references.ts --list relationshipKind --source <id> --target <id> --apply
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

type FallbackList = "parameterKind" | "relationshipKind";
type BatchResult = {
  sourceName: string;
  targetName: string;
  processed: number;
  remapped: number;
  isDone: boolean;
  continueCursor: string;
};

function flagValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredFlag(flag: string) {
  const value = flagValue(flag)?.trim();
  if (!value) throw new Error(`Missing required ${flag} value`);
  return value;
}

function parseList(): FallbackList {
  const value = requiredFlag("--list");
  if (value !== "parameterKind" && value !== "relationshipKind") {
    throw new Error("--list must be parameterKind or relationshipKind");
  }
  return value;
}

async function main() {
  const list = parseList();
  const sourceEntryId = requiredFlag("--source");
  const targetEntryId = requiredFlag("--target");
  const apply = process.argv.includes("--apply");
  const requestedBatchSize = Number(flagValue("--batch-size") ?? 25);
  const batchSize = Number.isFinite(requestedBatchSize)
    ? Math.min(Math.max(Math.trunc(requestedBatchSize), 1), 100)
    : 25;
  const note = flagValue("--note")?.trim();
  const devBypassSecret = getDevBypassSecret();
  const client = getConvexClient();

  // Parameter-kind mergeEntry intentionally records the registry decision
  // before the heavy extraction documents are rewritten in bounded batches.
  if (apply && list === "parameterKind") {
    await client.mutation(api.vocabulary.mergeEntry, {
      list,
      sourceEntryId,
      targetEntryId,
      ...(note ? { note } : {}),
      devBypassSecret,
    });
  }

  let cursor: string | null = null;
  let isDone = false;
  let processed = 0;
  let remapped = 0;
  let sourceName = sourceEntryId;
  let targetName = targetEntryId;

  while (!isDone) {
    const result: BatchResult = await client.mutation(
      api.vocabulary.mergeVocabularyReferenceBatch,
      {
        list,
        sourceEntryId,
        targetEntryId,
        cursor,
        batchSize,
        apply,
        devBypassSecret,
      },
    );
    processed += result.processed;
    remapped += result.remapped;
    sourceName = result.sourceName;
    targetName = result.targetName;
    isDone = result.isDone;
    cursor =
      apply && list === "relationshipKind" ? null : result.continueCursor;
    process.stdout.write(
      `\r${apply ? "applying" : "scanning"} ${sourceName} -> ${targetName}: processed=${processed} remapped=${remapped}`,
    );
  }
  process.stdout.write("\n");

  // Large relationship merges rewrite first; once the remaining indexed set
  // is empty, mergeEntry atomically records the registry decision (and catches
  // any final <=2,000 references inserted during the batched pass).
  if (apply && list === "relationshipKind") {
    await client.mutation(api.vocabulary.mergeEntry, {
      list,
      sourceEntryId,
      targetEntryId,
      ...(note ? { note } : {}),
      devBypassSecret,
    });
  }

  console.log(
    `${apply ? "APPLIED" : "DRY RUN (use --apply to execute)"}: ${list} ${sourceName} -> ${targetName}; processed=${processed} remapped=${remapped}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
