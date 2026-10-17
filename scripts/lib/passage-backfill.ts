// Driver for scripts/backfill-passages.ts: argument parsing, the paged loop
// over passages:backfillBatch, and the operator report. Kept free of Convex
// and env access so the loop and the report are testable offline.
import {
  estimatePassageEmbedding,
  PASSAGE_EMBEDDING_MODEL,
  PASSAGE_USD_PER_MILLION_TOKENS,
} from "../../convex/shared/passages";

// convex/passages.ts clamps every page to ten sources to stay under Convex's
// 16 MiB transaction read limit.
export const BACKFILL_MAX_BATCH_SIZE = 10;
const BATCH_PAUSE_MS = 250;

export const BACKFILL_USAGE = [
  "Usage: vpx tsx scripts/backfill-passages.ts [--apply] [--canary] [--batch-size N]",
  "Default is a read-only count, size and cost estimate over every source.",
  `--batch-size N   sources per backfillBatch action, 1-${BACKFILL_MAX_BATCH_SIZE} (default ${BACKFILL_MAX_BATCH_SIZE})`,
  "--canary         stop after the first page with pending work, so an apply",
  "                 embeds at most one page; a rerun resumes because sources",
  "                 with a ready entry are skipped",
];

export type BackfillOptions = {
  apply: boolean;
  batchSize: number;
  canary: boolean;
};

function positiveInteger(flag: string, value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${flag} needs a positive integer`);
  return parsed;
}

/** Parse flags strictly: a typo must not silently change what runs. */
export function parseBackfillArgs(
  argv: readonly string[],
): BackfillOptions | "help" {
  const options: BackfillOptions = {
    apply: false,
    batchSize: BACKFILL_MAX_BATCH_SIZE,
    canary: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help") return "help";
    if (arg === "--apply") options.apply = true;
    else if (arg === "--batch-size") {
      options.batchSize = positiveInteger(arg, argv[++index]);
      if (options.batchSize > BACKFILL_MAX_BATCH_SIZE)
        throw new Error(
          `--batch-size is at most ${BACKFILL_MAX_BATCH_SIZE}, the server's page cap`,
        );
    } else if (arg === "--canary") options.canary = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

/** One page result from passages:backfillBatch. */
export type BackfillBatchResult = {
  enabled: boolean;
  scanned: number;
  textBearing: number;
  pending: number;
  pendingChars: number;
  indexed: number;
  failed: number;
  isDone: boolean;
  continueCursor: string;
};

export type BackfillTotals = Pick<
  BackfillBatchResult,
  "scanned" | "textBearing" | "pending" | "pendingChars" | "indexed" | "failed"
>;

const TOTAL_KEYS = [
  "scanned",
  "textBearing",
  "pending",
  "pendingChars",
  "indexed",
  "failed",
] as const satisfies readonly (keyof BackfillTotals)[];

export type BackfillRun = {
  // The server's indexing gate from the last page returned; null until a page
  // returns, so a run that fails on its first call does not guess.
  enabled: boolean | null;
  batches: number;
  // True only when the last page reported isDone: every source was scanned.
  complete: boolean;
  // Set when --canary stopped the run at its first page with pending work.
  canaryStopped: boolean;
  totals: BackfillTotals;
  // Set when a batch call threw; the totals cover the pages before it.
  error?: unknown;
};

export async function runBackfill(
  callBatch: (args: {
    cursor: string | null;
    batchSize: number;
    apply: boolean;
  }) => Promise<BackfillBatchResult>,
  options: BackfillOptions,
  hooks: {
    sleep?: (milliseconds: number) => Promise<void>;
    onProgress?: (totals: BackfillTotals) => void;
  } = {},
): Promise<BackfillRun> {
  const sleep =
    hooks.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const run: BackfillRun = {
    enabled: null,
    batches: 0,
    complete: false,
    canaryStopped: false,
    totals: {
      scanned: 0,
      textBearing: 0,
      pending: 0,
      pendingChars: 0,
      indexed: 0,
      failed: 0,
    },
  };
  let cursor: string | null = null;
  try {
    for (;;) {
      if (options.apply && run.batches > 0) await sleep(BATCH_PAUSE_MS);
      const result = await callBatch({
        cursor,
        batchSize: options.batchSize,
        apply: options.apply,
      });
      run.batches++;
      run.enabled = result.enabled;
      for (const key of TOTAL_KEYS) run.totals[key] += result[key];
      hooks.onProgress?.(run.totals);
      cursor = result.continueCursor;
      if (result.isDone) {
        run.complete = true;
        break;
      }
      // Earlier pages held no pending work, so they embedded nothing.
      if (options.canary && result.pending > 0) {
        run.canaryStopped = true;
        break;
      }
    }
  } catch (error) {
    run.error = error;
  }
  return run;
}

/**
 * A hard ceiling on embedding tokens for `chars` UTF-16 code units. Every
 * embedding token covers at least one UTF-8 byte, and a code unit encodes to
 * at most three bytes, so the ceiling holds for any script. The chars/4
 * estimate can undershoot several-fold for CJK or emoji text.
 */
export function embeddingCeiling(chars: number): {
  tokens: number;
  usd: number;
} {
  const tokens = chars * 3;
  return { tokens, usd: (tokens / 1_000_000) * PASSAGE_USD_PER_MILLION_TOKENS };
}

/** Dollars at four decimals, rounded up so a printed ceiling stays a bound. */
export function formatCeilingUsd(usd: number): string {
  // Strip float noise before rounding up, so an exact $0.39 prints as 0.3900.
  return (Math.ceil(Number((usd * 10_000).toPrecision(12))) / 10_000).toFixed(
    4,
  );
}

export function backfillReport(
  run: BackfillRun,
  options: BackfillOptions,
): string[] {
  const { totals } = run;
  const estimate = estimatePassageEmbedding(totals.pendingChars);
  const ceiling = embeddingCeiling(totals.pendingChars);
  const scope = run.complete
    ? `scope=full batches=${run.batches}`
    : `scope=partial batches=${run.batches} (${run.error === undefined ? "canary stopped at the first page with pending work" : "stopped by an error"})`;
  const lines = [
    options.apply ? "APPLIED" : "DRY RUN (use --apply to execute)",
    `indexing=${run.enabled === null ? "unknown" : run.enabled ? "enabled" : "disabled"}`,
    scope,
    `sources: scanned=${totals.scanned} textBearing=${totals.textBearing} pending=${totals.pending} indexed=${totals.indexed} failed=${totals.failed}`,
    `estimate: chars=${totals.pendingChars} tokens≈${estimate.tokens} cost≈$${estimate.usd.toFixed(4)} at $${PASSAGE_USD_PER_MILLION_TOKENS}/1M tokens (${PASSAGE_EMBEDDING_MODEL})`,
    `ceiling: tokens≤${ceiling.tokens} cost≤$${formatCeilingUsd(ceiling.usd)} (3 tokens per char, any script)`,
  ];
  if (options.apply)
    lines.push("convergence=pending (rerun the dry run to confirm pending=0)");
  else if (run.complete)
    lines.push(`converged=${totals.pending === 0 ? "yes" : "no"}`);
  else lines.push("converged=unknown (partial scan)");
  if (totals.failed > 0)
    lines.push(
      'failed sources are in the Convex logs as "Passage indexing skipped for <sourceId>"',
    );
  return lines;
}

/** Nonzero when a batch call threw or an apply left any source failed. */
export function backfillExitCode(
  run: BackfillRun,
  options: BackfillOptions,
): number {
  if (run.error !== undefined) return 1;
  return options.apply && run.totals.failed > 0 ? 1 : 0;
}
