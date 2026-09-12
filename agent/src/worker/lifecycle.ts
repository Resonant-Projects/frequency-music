import { setTimeout as sleep } from "node:timers/promises";

type SignalSource = {
  on(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown;
  off(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown;
};

/** Drain the entire outstanding poll (claim, graph, and terminal writes).
 * Signals only stop future claims; they never cancel or requeue active work.
 */
export async function runWorkerLoop(options: {
  poll: () => Promise<boolean>;
  pollIntervalMs: number;
  signals: SignalSource;
  log: (message: string) => void;
  onPollError: (error: unknown) => void;
}): Promise<void> {
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
  options.signals.on("SIGTERM", onTerm);
  options.signals.on("SIGINT", onInt);
  try {
    while (!draining) {
      let claimed = false;
      try {
        claimed = await options.poll();
      } catch (error) {
        options.onPollError(error);
      }
      if (draining) break;
      if (!claimed) {
        try {
          await sleep(options.pollIntervalMs, undefined, {
            signal: idleAbort.signal,
          });
        } catch (error) {
          if (!idleAbort.signal.aborted) throw error;
        }
      }
    }
    options.log("worker drain finished; local poll settled");
  } finally {
    options.signals.off("SIGTERM", onTerm);
    options.signals.off("SIGINT", onInt);
  }
}
