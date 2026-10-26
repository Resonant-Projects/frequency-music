import { Effect } from "effect";

type SignalSource = {
  on(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown;
  off(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown;
};

/** Drain the entire outstanding poll (claim, graph, and terminal writes).
 * Signals only stop future claims; they never cancel or requeue active work.
 */
export function runWorkerLoopEffect(options: {
  poll: () => Promise<boolean>;
  pollIntervalMs: number;
  signals: SignalSource;
  log: (message: string) => void;
  onPollError: (error: unknown) => void;
  /** Fires after every poll attempt, successful or not. A poll that returns or
   * throws proves the loop is still executing; a wedged poll never settles. */
  onPollSettled?: () => void;
}) {
  return Effect.gen(function* () {
    const idleAbort = new AbortController();
    let draining = false;
    const shutdown = (signal: string) => {
      if (draining) return;
      draining = true;
      options.log(
        `received ${signal}; draining outstanding claim and active run`,
      );
      idleAbort.abort();
    };
    const onTerm = () => shutdown("SIGTERM");
    const onInt = () => shutdown("SIGINT");
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        options.signals.on("SIGTERM", onTerm);
        options.signals.on("SIGINT", onInt);
      }),
      () =>
        Effect.sync(() => {
          options.signals.off("SIGTERM", onTerm);
          options.signals.off("SIGINT", onInt);
        }),
    );
    while (!draining) {
      const claimed = yield* Effect.tryPromise({
        try: () => options.poll(),
        catch: (error) => error,
      }).pipe(
        Effect.catch((error) =>
          Effect.sync(() => {
            options.onPollError(error);
            return false;
          }),
        ),
      );
      options.onPollSettled?.();
      if (draining) break;
      if (!claimed) {
        const cancelled = Effect.callback<never, unknown>((resume) => {
          const stop = () => resume(Effect.fail(idleAbort.signal.reason));
          idleAbort.signal.addEventListener("abort", stop, { once: true });
          if (idleAbort.signal.aborted) stop();
          return Effect.sync(() =>
            idleAbort.signal.removeEventListener("abort", stop),
          );
        });
        yield* Effect.raceFirst(
          Effect.sleep(options.pollIntervalMs),
          cancelled,
        ).pipe(
          Effect.catch((error) =>
            idleAbort.signal.aborted ? Effect.void : Effect.fail(error),
          ),
        );
      }
    }
    options.log("worker drain finished; local poll settled");
  }).pipe(Effect.scoped);
}

export function runWorkerLoop(
  options: Parameters<typeof runWorkerLoopEffect>[0],
): Promise<void> {
  return Effect.runPromise(runWorkerLoopEffect(options));
}
