import { TOURNAMENT_MAX_DUPLICATE_JUDGMENTS } from "../../../../convex/shared/hypothesisTournament.js";
import type { CallContext, Metered } from "./types.js";

export const TOURNAMENT_LIMITS = {
  generation: 8,
  grounding: 8,
  scoring: 24,
  duplicate: TOURNAMENT_MAX_DUPLICATE_JUDGMENTS, // per candidate, including the revised-statement check
  finalist: 3,
  selfCheck: 2,
  revision: 1,
  duplicateRecheck: 1,
  tokens: 300_000,
  wallMs: 20 * 60_000,
  cleanupMs: 10_000, // aggregate terminal archival + completion allowance
} as const;
export type BudgetKind = Exclude<
  keyof typeof TOURNAMENT_LIMITS,
  "tokens" | "wallMs" | "cleanupMs"
>;
export class BudgetExhausted extends Error {
  constructor(readonly dimension: string) {
    super(`Tournament budget exhausted: ${dimension}`);
  }
}
export class TournamentBudget {
  readonly calls: Record<BudgetKind, number> = {
    generation: 0,
    grounding: 0,
    scoring: 0,
    duplicate: 0,
    finalist: 0,
    selfCheck: 0,
    revision: 0,
    duplicateRecheck: 0,
  };
  readonly duplicateCalls: Record<number, number> = {};
  tokens = 0;
  readonly startedAt: number;
  private cleanupDeadline: number | undefined;
  constructor(private readonly now: () => number) {
    this.startedAt = now();
  }
  check() {
    if (this.now() - this.startedAt >= TOURNAMENT_LIMITS.wallMs) {
      throw new BudgetExhausted("wallMs");
    }
    if (this.tokens >= TOURNAMENT_LIMITS.tokens)
      throw new BudgetExhausted("tokens");
  }
  count(kind: BudgetKind, batchIndex = -1) {
    this.check();
    const used =
      kind === "duplicate"
        ? (this.duplicateCalls[batchIndex] ?? 0)
        : this.calls[kind];
    if (used >= TOURNAMENT_LIMITS[kind]) throw new BudgetExhausted(kind);
    this.calls[kind]++;
    if (kind === "duplicate") this.duplicateCalls[batchIndex] = used + 1;
  }
  /** Terminal persistence shares one cleanup deadline, starting at its first
   * call and bounded by run deadline + cleanupMs. Ordinary archive transitions
   * use the work deadline. Neither retries nor subsequent cleanup calls reset
   * the allowance. Adapters must honor cancellation before committing writes. */
  async call<T>(
    fn: (context: CallContext) => Promise<T>,
    cleanup = false,
  ): Promise<T> {
    if (!cleanup) this.check();
    const workDeadline = this.startedAt + TOURNAMENT_LIMITS.wallMs;
    if (cleanup) {
      this.cleanupDeadline ??= Math.min(
        this.now() + TOURNAMENT_LIMITS.cleanupMs,
        workDeadline + TOURNAMENT_LIMITS.cleanupMs,
      );
    }
    const remaining =
      (cleanup ? this.cleanupDeadline! : workDeadline) - this.now();
    const dimension = cleanup ? "cleanupMs" : "wallMs";
    if (remaining <= 0) throw new BudgetExhausted(dimension);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() =>
          fn({
            signal: controller.signal,
            maxTotalTokens: Math.max(0, TOURNAMENT_LIMITS.tokens - this.tokens),
          }),
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new BudgetExhausted(dimension));
          }, remaining);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async metered<T>(
    fn: (context: CallContext) => Promise<Metered<T>>,
  ): Promise<T | undefined> {
    const result = await this.call(fn);
    if (!Number.isSafeInteger(result.totalTokens) || result.totalTokens < 0) {
      throw new Error("Provider usage missing or invalid");
    }
    this.tokens += result.totalTokens;
    this.check();
    return result.ok ? result.value : undefined;
  }
}
