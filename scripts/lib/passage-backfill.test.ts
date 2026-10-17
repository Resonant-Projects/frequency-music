import { describe, expect, test, vi } from "vite-plus/test";
import {
  type BackfillBatchResult,
  type BackfillOptions,
  backfillExitCode,
  backfillReport,
  embeddingCeiling,
  parseBackfillArgs,
  runBackfill,
} from "./passage-backfill";

const DRY: BackfillOptions = { apply: false, batchSize: 10, maxBatches: null };
const APPLY: BackfillOptions = { ...DRY, apply: true };

const page = (
  overrides: Partial<BackfillBatchResult> = {},
): BackfillBatchResult => ({
  enabled: true,
  scanned: 10,
  textBearing: 8,
  pending: 2,
  pendingChars: 4000,
  indexed: 0,
  failed: 0,
  isDone: false,
  continueCursor: "next",
  ...overrides,
});

/** A batch function serving the given pages in order, recording its calls. */
function pages(...results: (BackfillBatchResult | Error)[]) {
  const calls: { cursor: string | null; batchSize: number; apply: boolean }[] =
    [];
  const callBatch = vi.fn((args: (typeof calls)[number]) => {
    calls.push(args);
    const result = results[calls.length - 1];
    if (!result) return Promise.reject(new Error("called past the last page"));
    return result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve(result);
  });
  return { callBatch, calls };
}

const noSleep = { sleep: async () => {} };
const twoPages = () => pages(page(), page({ isDone: true })).callBatch;

describe("parseBackfillArgs", () => {
  test("defaults to a full dry run at the server's page size", () => {
    expect(parseBackfillArgs([])).toEqual(DRY);
  });

  test("reads apply, batch size and a canary batch limit", () => {
    expect(
      parseBackfillArgs(["--apply", "--batch-size", "3", "--max-batches", "1"]),
    ).toEqual({ apply: true, batchSize: 3, maxBatches: 1 });
    expect(parseBackfillArgs(["--apply", "--help"])).toBe("help");
  });

  test.each([
    [["--aply"], /Unknown argument: --aply/],
    [["apply"], /Unknown argument: apply/],
    [["--batch-size"], /positive integer/],
    [["--batch-size", "0"], /positive integer/],
    [["--batch-size", "2.5"], /positive integer/],
    [["--batch-size", "11"], /at most 10/],
    [["--max-batches", "-1"], /positive integer/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseBackfillArgs(argv)).toThrow(message);
  });
});

describe("runBackfill", () => {
  test("follows the cursor to the last page and sums every page", async () => {
    const { callBatch, calls } = pages(
      page({ continueCursor: "a" }),
      page({ pending: 1, pendingChars: 10, isDone: true, continueCursor: "b" }),
    );
    const run = await runBackfill(callBatch, DRY, noSleep);
    expect(calls).toEqual([
      { cursor: null, batchSize: 10, apply: false },
      { cursor: "a", batchSize: 10, apply: false },
    ]);
    expect(run).toEqual({
      enabled: true,
      batches: 2,
      complete: true,
      totals: {
        scanned: 20,
        textBearing: 16,
        pending: 3,
        pendingChars: 4010,
        indexed: 0,
        failed: 0,
      },
    });
  });

  test("a canary stops after --max-batches without claiming a full scan", async () => {
    const { callBatch, calls } = pages(
      page({ indexed: 2 }),
      page({ isDone: true }),
    );
    const run = await runBackfill(
      callBatch,
      { ...APPLY, batchSize: 4, maxBatches: 1 },
      noSleep,
    );
    expect(calls).toEqual([{ cursor: null, batchSize: 4, apply: true }]);
    expect(run).toMatchObject({ batches: 1, complete: false });
    expect(run.totals.indexed).toBe(2);
  });

  test("a failing batch call keeps the totals of the pages before it", async () => {
    const failure = new Error("Passage indexing is disabled");
    const { callBatch } = pages(page({ indexed: 2 }), failure);
    const run = await runBackfill(callBatch, APPLY, noSleep);
    expect(run).toMatchObject({ batches: 1, complete: false, error: failure });
    expect(run.totals.indexed).toBe(2);
    expect(backfillExitCode(run, APPLY)).toBe(1);
    expect(backfillReport(run, APPLY)).toContain(
      "scope=partial batches=1 (stopped by an error)",
    );
  });

  test("apply pauses between batches and a dry run does not", async () => {
    const sleep = vi.fn(async () => {});
    await runBackfill(twoPages(), APPLY, { sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
    await runBackfill(twoPages(), DRY, { sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

describe("embeddingCeiling", () => {
  test("bounds tokens at three per UTF-16 code unit", () => {
    expect(embeddingCeiling(1_000_000)).toEqual({
      tokens: 3_000_000,
      usd: 0.39,
    });
    // A three-byte CJK character is one code unit; an emoji is two units and
    // four bytes. Either way UTF-8 bytes, and so tokens, stay under 3x.
    for (const text of ["音".repeat(100), "🎵".repeat(100), "a".repeat(100)])
      expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(
        embeddingCeiling(text.length).tokens,
      );
  });
});

const complete = (
  totals: Partial<BackfillBatchResult>,
  enabled = false,
): Parameters<typeof backfillReport>[0] => ({
  enabled,
  batches: 3,
  complete: true,
  totals: {
    scanned: 25,
    textBearing: 20,
    pending: 0,
    pendingChars: 0,
    indexed: 0,
    failed: 0,
    ...totals,
  },
});

describe("backfillReport", () => {
  test("a full dry run reports the estimate, the ceiling and convergence", () => {
    expect(
      backfillReport(complete({ pending: 4, pendingChars: 400_000 }), DRY),
    ).toEqual([
      "DRY RUN (use --apply to execute)",
      "indexing=disabled",
      "scope=full batches=3",
      "sources: scanned=25 textBearing=20 pending=4 indexed=0 failed=0",
      "estimate: chars=400000 tokens≈100000 cost≈$0.0130 at $0.13/1M tokens (text-embedding-3-large)",
      "ceiling: tokens≤1200000 cost≤$0.1560 (3 tokens per char, any script)",
      "converged=no",
    ]);
    expect(backfillReport(complete({}), DRY).at(-1)).toBe("converged=yes");
  });

  test("a partial dry run never claims convergence", () => {
    const partial = { ...complete({}), complete: false };
    expect(backfillReport(partial, { ...DRY, maxBatches: 3 })).toContain(
      "converged=unknown (partial scan)",
    );
  });

  test("an apply with failures points at the logs and exits nonzero", () => {
    const run = complete({ pending: 3, indexed: 2, failed: 1 }, true);
    const report = backfillReport(run, APPLY);
    expect(report).toContain(
      "convergence=pending (rerun the dry run to confirm pending=0)",
    );
    expect(report.at(-1)).toMatch(/Passage indexing skipped for <sourceId>/);
    expect(backfillExitCode(run, APPLY)).toBe(1);
    expect(backfillExitCode(complete({ indexed: 3 }, true), APPLY)).toBe(0);
    // A dry run's pending work is a report, not a failure.
    expect(backfillExitCode(complete({ pending: 3 }), DRY)).toBe(0);
  });
});
