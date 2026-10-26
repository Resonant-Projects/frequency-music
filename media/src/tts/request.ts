import { Context, Effect, Layer } from "effect";
import { attempt, wait } from "../effects";

/** Proof that synthesis was rejected before it could start. */
export class SynthesisRejectedError extends Error {}

export const TTS_REQUEST_TIMEOUT_MS = 180_000;

export type RetryOptions = {
  attempts?: number;
  retryableRejections?: readonly number[];
  backoffMs?: (status: number | undefined, attempt: number) => number;
  timeoutMs?: number;
};

type RequestFailure =
  | { _tag: "Rejected"; status: number }
  | { _tag: "OutcomeUnknown"; error: unknown };

class TtsFetch extends Context.Service<TtsFetch, typeof fetch>()(
  "frequency/media/TtsFetch",
) {}

export function defaultBackoffMs(attemptNumber: number): number {
  return 500 * 2 ** (attemptNumber - 1);
}

// Breeze health polling also uses this Promise interface.
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return Effect.runPromise(wait(ms, signal));
}

export function attemptSignal(
  signal: AbortSignal | undefined | null,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function request(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retryable: readonly number[],
) {
  const outcomeUnknown = (error: unknown): RequestFailure => ({
    _tag: "OutcomeUnknown",
    error: init.signal?.aborted
      ? error
      : new Error(
          "TTS request failed (ambiguous transport failure; refusing synthesis retry)",
        ),
  });
  return Effect.gen(function* () {
    const fetchImpl = yield* TtsFetch;
    const response = yield* Effect.acquireRelease(
      attempt((signal) =>
        fetchImpl(url, {
          ...init,
          redirect: "error",
          signal: AbortSignal.any([
            attemptSignal(init.signal, timeoutMs),
            signal,
          ]),
        }),
      ).pipe(Effect.mapError(outcomeUnknown), Effect.interruptible),
      (response) =>
        Effect.promise(async () => {
          // Rejected bodies can echo keys. Release them without reading them.
          await response.body?.cancel().catch(() => undefined);
        }),
    );
    if (response.ok)
      return yield* attempt(() => response.arrayBuffer()).pipe(
        Effect.mapError(outcomeUnknown),
      );
    const status = response.status;
    if (
      retryable.includes(status) ||
      (status >= 400 && status < 500 && status !== 408 && status !== 499)
    ) {
      return yield* Effect.fail<RequestFailure>({ _tag: "Rejected", status });
    }
    return yield* Effect.fail<RequestFailure>({
      _tag: "OutcomeUnknown",
      error: new Error(
        `TTS request failed with status ${status} (synthesis outcome unknown)`,
      ),
    });
  }).pipe(
    Effect.scoped,
    Effect.timeoutOrElse({
      duration: timeoutMs,
      orElse: () =>
        Effect.fail(outcomeUnknown(new Error("TTS attempt timed out"))),
    }),
  );
}

export function fetchAudioWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<ArrayBuffer> {
  const attempts = options.attempts ?? 3;
  const retryable = options.retryableRejections ?? [429];
  const timeoutMs = options.timeoutMs ?? TTS_REQUEST_TIMEOUT_MS;
  const backoff =
    options.backoffMs ??
    ((_status, attemptNumber) => defaultBackoffMs(attemptNumber));
  const runAttempt = (
    attemptNumber: number,
  ): Effect.Effect<ArrayBuffer, unknown, TtsFetch> =>
    Effect.gen(function* () {
      if (init.signal?.aborted) {
        return yield* Effect.fail(
          new SynthesisRejectedError("TTS request cancelled before synthesis"),
        );
      }
      return yield* request(url, init, timeoutMs, retryable).pipe(
        Effect.catchTags({
          OutcomeUnknown: (failure) => Effect.fail(failure.error),
          Rejected: (failure) =>
            Effect.gen(function* () {
              if (
                !retryable.includes(failure.status) ||
                attemptNumber === attempts
              ) {
                return yield* Effect.fail(
                  new SynthesisRejectedError(
                    `TTS request failed with status ${failure.status}`,
                  ),
                );
              }
              const delay = Effect.try({
                try: () => backoff(failure.status, attemptNumber),
                catch: (error) => error,
              }).pipe(
                Effect.flatMap((ms) => wait(ms, init.signal ?? undefined)),
              );
              yield* delay.pipe(
                Effect.mapError(
                  () =>
                    new SynthesisRejectedError(
                      "TTS retry cancelled after provider rejection",
                    ),
                ),
              );
              return yield* runAttempt(attemptNumber + 1);
            }),
        }),
      );
    });
  const program = Effect.gen(function* () {
    if (!Number.isInteger(attempts) || attempts < 1) {
      return yield* Effect.fail(
        new SynthesisRejectedError("TTS attempts must be a positive integer"),
      );
    }
    return yield* runAttempt(1);
  });
  return Effect.runPromise(
    program.pipe(Effect.provide(Layer.succeed(TtsFetch, globalThis.fetch))),
  );
}
