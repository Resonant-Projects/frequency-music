import { describe, expect, test, vi } from "vite-plus/test";
import {
  type BackfillBatchResult,
  type BackfillOptions,
  backfillExitCode,
  backfillReport,
  embeddingCeiling,
  formatCeilingUsd,
  parseBackfillArgs,
  runBackfill,
} from "./passage-backfill";

const DRY: BackfillOptions = { apply: false, batchSize: 10, canary: false };
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

  test("reads apply, batch size and canary", () => {
    expect(
      parseBackfillArgs(["--apply", "--batch-size", "3", "--canary"]),
    ).toEqual({ apply: true, batchSize: 3, canary: true });
    expect(parseBackfillArgs(["--apply", "--help"])).toBe("help");
  });

  test.each([
    [["--aply"], /Unknown argument: --aply/],
    [["apply"], /Unknown argument: apply/],
    [["--batch-size"], /positive integer/],
    [["--batch-size", "0"], /positive integer/],
    [["--batch-size", "2.5"], /positive integer/],
    [["--batch-size", "11"], /at most 10/],
    [["--max-batches", "1"], /Unknown argument: --max-batches/],
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
      canaryStopped: false,
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

  test("a canary skips pages with no pending work and stops after the first with some", async () => {
    const { callBatch, calls } = pages(
      page({ pending: 0, pendingChars: 0, continueCursor: "a" }),
      page({ pending: 2, indexed: 2, continueCursor: "b" }),
      page({ isDone: true }),
    );
    const run = await runBackfill(
      callBatch,
      { ...APPLY, batchSize: 4, canary: true },
      noSleep,
    );
    expect(calls).toEqual([
      { cursor: null, batchSize: 4, apply: true },
      { cursor: "a", batchSize: 4, apply: true },
    ]);
    expect(run).toMatchObject({
      batches: 2,
      complete: false,
      canaryStopped: true,
    });
    expect(run.totals).toMatchObject({ pending: 2, indexed: 2, failed: 0 });
    expect(backfillReport(run, { ...APPLY, canary: true })).toContain(
      "scope=partial batches=2 (canary stopped at the first page with pending work)",
    );
  });

  test("a canary over a corpus with nothing pending scans everything", async () => {
    const { callBatch } = pages(
      page({ pending: 0 }),
      page({ pending: 0, isDone: true }),
    );
    const run = await runBackfill(
      callBatch,
      { ...APPLY, canary: true },
      noSleep,
    );
    expect(run).toMatchObject({ complete: true, canaryStopped: false });
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

  test("a failure before any page returns reports the gate as unknown", async () => {
    const failure = new Error("fetch failed");
    const { callBatch } = pages(failure);
    const run = await runBackfill(callBatch, DRY, noSleep);
    expect(run).toMatchObject({ enabled: null, batches: 0, error: failure });
    const report = backfillReport(run, DRY);
    expect(report).toContain("indexing=unknown");
    expect(report).toContain("scope=partial batches=0 (stopped by an error)");
    expect(backfillExitCode(run, DRY)).toBe(1);
  });

  test.each([
    [true, "indexing=enabled"],
    [false, "indexing=disabled"],
  ])(
    "a returned page reports the server's gate (%s)",
    async (enabled, line) => {
      const { callBatch } = pages(page({ enabled, isDone: true }));
      const run = await runBackfill(callBatch, DRY, noSleep);
      expect(run.enabled).toBe(enabled);
      expect(backfillReport(run, DRY)).toContain(line);
    },
  );

  test.each([
    [true, "indexing=enabled"],
    [false, "indexing=disabled"],
  ])(
    "a later failure keeps the last gate a page returned (%s)",
    async (enabled, line) => {
      const failure = new Error("fetch failed");
      const { callBatch } = pages(page({ enabled }), failure);
      const run = await runBackfill(callBatch, DRY, noSleep);
      expect(run).toMatchObject({ enabled, batches: 1, error: failure });
      expect(run.totals.scanned).toBe(10);
      expect(backfillReport(run, DRY)).toContain(line);
      expect(backfillExitCode(run, DRY)).toBe(1);
    },
  );

  test("apply pauses between batches and a dry run does not", async () => {
    const sleep = vi.fn(async () => {});
    await runBackfill(twoPages(), APPLY, { sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
    await runBackfill(twoPages(), DRY, { sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

describe("formatCeilingUsd", () => {
  test("rounds up, so a tiny paid ceiling never prints as zero", () => {
    // 100 chars → 300 tokens → $0.000039.
    expect(formatCeilingUsd(embeddingCeiling(100).usd)).toBe("0.0001");
    expect(formatCeilingUsd(0.39)).toBe("0.3900");
    expect(formatCeilingUsd(0.156)).toBe("0.1560");
    expect(formatCeilingUsd(0)).toBe("0.0000");
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
  canaryStopped: false,
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
    const partial = { ...complete({}), complete: false, canaryStopped: true };
    expect(backfillReport(partial, { ...DRY, canary: true })).toContain(
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
