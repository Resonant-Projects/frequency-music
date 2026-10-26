import { Effect } from "effect";

/** Keep foreign Promise failures intact at the package's Promise interfaces. */
export function attempt<A>(run: (signal: AbortSignal) => PromiseLike<A>) {
  return Effect.tryPromise({ try: run, catch: (error) => error });
}

/** Bridge an existing job signal without making interruption a retry verdict. */
export function aborted(signal: AbortSignal): Effect.Effect<never, unknown> {
  return Effect.callback((resume) => {
    const onAbort = () => resume(Effect.fail(signal.reason));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    return Effect.sync(() => signal.removeEventListener("abort", onAbort));
  });
}

export function wait(ms: number, signal?: AbortSignal) {
  const delay = Effect.sleep(ms);
  return signal ? Effect.raceFirst(delay, aborted(signal)) : delay;
}
