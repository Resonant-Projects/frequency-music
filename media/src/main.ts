// Worker entrypoint. varlock/auto-load must be the first import so .env.local
// is resolved before config.ts and convex.ts read process.env.
import "varlock/auto-load";
import { Cause, Effect } from "effect";
import { attempt } from "./effects";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config";
import { callTool } from "./convex";
import { handlers } from "./jobs";
import { log, redactError } from "./log";
import { runOnceEffect } from "./runner";

const main = Effect.gen(function* () {
  const config = loadConfig();
  // A kind with no handler would burn every job's attempts and park it;
  // refuse to start rather than poison the queue.
  const unknown = config.kinds.filter((kind) => !Object.hasOwn(handlers, kind));
  if (unknown.length > 0) {
    log(`no handler for job kinds: ${unknown.join(", ")}`);
    process.exit(1);
  }
  yield* attempt(() => mkdir(config.workDir, { recursive: true }));
  log(
    `media worker ${config.workerId} polling every ${config.pollIntervalMs} ms for ${config.kinds.join(", ")}`,
  );
  let stopping = false;
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      const stop = () => {
        stopping = true;
      };
      process.on("SIGTERM", stop);
      process.on("SIGINT", stop);
      return stop;
    }),
    (stop) =>
      Effect.sync(() => {
        process.off("SIGTERM", stop);
        process.off("SIGINT", stop);
      }),
  );
  while (!stopping) {
    const outcome = yield* runOnceEffect(config, callTool, handlers).pipe(
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          log(`poll iteration failed: ${redactError(Cause.squash(cause))}`);
          return "idle" as const;
        }),
      ),
    );
    // Back off after a failure too: requeue has no server-side delay, so an
    // immediate re-claim would burn MAX_ATTEMPTS on a transient outage.
    if (outcome !== "done") {
      yield* Effect.sleep(config.pollIntervalMs);
    }
  }
  log("stopped");
}).pipe(Effect.scoped);

void Effect.runPromise(main);
