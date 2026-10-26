import { Cause, Effect, Exit, Scope } from "effect";

/** Keep the native interval's unref and cadence, with scoped, drained tasks. */
export function startMaintenance(options: {
  intervalMs: number;
  task: Effect.Effect<void>;
  onDefect: (error: unknown) => void;
}): () => Promise<void> {
  const scope = Scope.makeUnsafe("parallel");
  const task = options.task.pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        options.onDefect(Cause.squash(cause));
      }),
    ),
  );
  const timer = Effect.runSync(
    Effect.acquireRelease(
      Effect.sync(() => {
        const timer = setInterval(() => {
          // Closing this scope drains in-flight maintenance rather than
          // interrupting it. Each request has its existing native deadline.
          Effect.runFork(
            task.pipe(
              Effect.forkIn(scope, {
                startImmediately: true,
                uninterruptible: true,
              }),
            ),
          );
        }, options.intervalMs);
        timer.unref?.();
        return timer;
      }),
      (timer) => Effect.sync(() => clearInterval(timer)),
    ).pipe(Scope.provide(scope)),
  );
  let stopped: Promise<void> | undefined;
  return () => {
    clearInterval(timer);
    stopped ??= Effect.runPromise(Scope.close(scope, Exit.void));
    return stopped;
  };
}

/** Signal deadlines remain on the native clock used by foreign HTTP clients. */
export function requestDeadline(ms: number) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      return { controller, timer };
    }),
    ({ timer }) => Effect.sync(() => clearTimeout(timer)),
  ).pipe(Effect.map(({ controller }) => controller.signal));
}
