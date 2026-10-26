import { Effect, Fiber } from "effect";
import type { ClaimedMediaJob } from "../../convex/shared/mediaJobs";
import { LEASE_MS } from "../../convex/shared/mediaJobs";
import type { callTool } from "./convex";
import { attempt } from "./effects";
import type { JobContext, JobHandler } from "./jobs/types";
import { log, redactError } from "./log";

const RENEW_EVERY_MS = Math.floor(LEASE_MS / 3);

/** The ticker keeps checking expiry even while a renewal request is pending. */
export function renewLease(
  job: ClaimedMediaJob,
  tool: typeof callTool,
  abort: AbortController,
) {
  return Effect.gen(function* () {
    let expiresAt = job.leaseExpiresAt;
    let failures = 0;
    let inFlight = false;
    let pending: Fiber.Fiber<void, never> | undefined;
    const renew = attempt((signal) =>
      tool<{ leaseExpiresAt: number }>(
        "renewMediaJobLease",
        { jobId: job.jobId, leaseToken: job.leaseToken },
        signal,
      ),
    ).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          expiresAt = result.leaseExpiresAt;
          failures = 0;
        }),
      ),
      Effect.asVoid,
      Effect.catch((error) =>
        Effect.sync(() => {
          failures++;
          if (failures >= 2 || Date.now() + RENEW_EVERY_MS >= expiresAt) {
            abort.abort(new Error("Media lease renewal failed"));
          }
          log(`lease renewal failed for ${job.jobId}: ${redactError(error)}`);
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          inFlight = false;
        }),
      ),
    );
    const ticker = yield* Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep(RENEW_EVERY_MS);
        if (Date.now() >= expiresAt) {
          abort.abort(new Error("Media lease expired"));
        } else if (!inFlight) {
          inFlight = true;
          pending = yield* renew.pipe(
            Effect.forkScoped({ startImmediately: true }),
          );
        }
      }
    }).pipe(Effect.forkScoped({ startImmediately: true }));
    return Effect.gen(function* () {
      yield* Fiber.interrupt(ticker);
      if (pending) yield* Fiber.interrupt(pending);
    });
  });
}

/** A foreign handler may ignore abort. Give it only the existing grace window. */
export function runHandler(options: {
  handler: JobHandler;
  context: JobContext;
  abort: AbortController;
  stopRenewal: Effect.Effect<void>;
  deadlineMs: number;
  graceMs: number;
}) {
  return Effect.gen(function* () {
    const running = yield* Effect.try({
      try: () => options.handler(options.context),
      catch: (error) => error,
    });
    return yield* attempt(() => running).pipe(
      Effect.timeoutOrElse({
        duration: options.deadlineMs,
        orElse: () =>
          Effect.gen(function* () {
            yield* options.stopRenewal;
            const error = new Error(
              `job deadline exceeded after ${options.deadlineMs} ms`,
            );
            options.abort.abort(error);
            return yield* Effect.fail(error);
          }),
      }),
      Effect.catch((error) =>
        Effect.gen(function* () {
          if (options.abort.signal.aborted) {
            yield* attempt(() => running.catch(() => undefined)).pipe(
              Effect.timeoutOption(options.graceMs),
            );
          }
          return yield* Effect.fail(error);
        }),
      ),
    );
  });
}
