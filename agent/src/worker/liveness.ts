// External liveness for the Kubernetes deploy gate.
//
// The gate's previous evidence was a CronJob reading the Deployment through the
// Kubernetes API. With no readiness probe on the worker, `ready` is true from
// container start until process exit, so that check only ever proved a process
// with the accepted image digest was resident -- never that this loop was still
// able to claim work. A wedged poller reported healthy indefinitely.
//
// Silence is the wedge signal. When the worker cannot prove recent progress we
// stop pushing and let Kuma's freshness deadline fire. An explicit `down` push
// would add nothing -- a fully hung event loop cannot push at all -- and it
// would lose the dead-man's-switch property that also covers the process being
// killed outright.

import { HEARTBEAT_INTERVAL_MS } from "../../../convex/shared/agentContract";

/** How often a healthy worker pushes. Well inside Kuma's 420s deadline, so a
 * handful of consecutive push failures still clear the alert threshold. */
export const LIVENESS_PUSH_INTERVAL_MS = 60_000;

/** Bound the push so an abandoned request cannot outlive a drained worker. */
export const LIVENESS_PUSH_TIMEOUT_MS = 8_000;

/** Progress older than this withholds the push. Run heartbeats only fire every
 * HEARTBEAT_INTERVAL_MS, so this must clear that plus one push interval or a
 * legitimately busy run would be reported as wedged. */
export const LIVENESS_STALE_AFTER_MS =
  HEARTBEAT_INTERVAL_MS + LIVENESS_PUSH_INTERVAL_MS;

export type LivenessReporter = {
  /** Record that the loop demonstrably executed: a poll settled, a node event
   * was appended, or a run heartbeat landed. */
  markAlive: () => void;
  /** Stop the timer and await any in-flight push. */
  stop: () => Promise<void>;
};

/** The push URL carries the monitor's token in its path, so an `http:` endpoint
 * would put that token on the wire in cleartext. Parsing is the only way into
 * the reporter, which keeps that rule structural rather than a check a later
 * caller can forget. A rejected URL leaves the worker running and silent, and
 * silence is already the wedge signal the freshness deadline reports. */
export function parseLivenessPushUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return url.protocol === "https:" ? url : null;
}

export function createLivenessReporter(options: {
  pushUrl: URL;
  log: (message: string, ...rest: unknown[]) => void;
  redact: (error: unknown) => string;
  now?: () => number;
  fetchImpl?: typeof fetch;
  intervalMs?: number;
  staleAfterMs?: number;
}): LivenessReporter {
  const now = options.now ?? Date.now;
  const intervalMs = options.intervalMs ?? LIVENESS_PUSH_INTERVAL_MS;
  const staleAfterMs = options.staleAfterMs ?? LIVENESS_STALE_AFTER_MS;
  const pending = new Set<Promise<void>>();
  let lastProgressAt = now();
  let stopped = false;
  let withheld = false;

  // The push URL embeds the monitor's secret token, so it is never logged and
  // errors are redacted like every other outbound call in this worker.
  const push = async (): Promise<void> => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      LIVENESS_PUSH_TIMEOUT_MS,
    );
    try {
      const fetchImpl = options.fetchImpl ?? globalThis.fetch;
      const response = await fetchImpl(options.pushUrl, {
        signal: controller.signal,
      });
      if (!response.ok) {
        options.log(`liveness push rejected with status ${response.status}`);
      }
    } catch (error) {
      options.log("liveness push failed:", options.redact(error));
    } finally {
      clearTimeout(timeout);
    }
  };

  const tick = () => {
    if (stopped) return;
    const age = now() - lastProgressAt;
    if (age > staleAfterMs) {
      if (!withheld) {
        withheld = true;
        options.log(
          `liveness: no worker progress for ${Math.round(age / 1000)}s; ` +
            "withholding pushes until progress resumes",
        );
      }
      return;
    }
    if (withheld) {
      withheld = false;
      options.log("liveness: worker progress resumed; pushing again");
    }
    const inFlight = push();
    pending.add(inFlight);
    void inFlight.finally(() => pending.delete(inFlight));
  };

  const timer = setInterval(tick, intervalMs);
  (timer as { unref?: () => void }).unref?.();

  return {
    markAlive: () => {
      lastProgressAt = now();
    },
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await Promise.all(pending);
    },
  };
}
