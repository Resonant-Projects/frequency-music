import type { VoiceEntry, VoiceProvider } from "../../../convex/shared/voices";

export type TtsProvider = {
  id: VoiceProvider;
  maxChars: number;
  // `signal` is the job deadline; providers pass it to the request so an
  // aborted job does not leave a TTS call in flight.
  synthesize: (
    text: string,
    voice: VoiceEntry,
    outputPath: string,
    signal?: AbortSignal,
  ) => Promise<void>;
};

// One attempt may not hang past this: a provider that accepts the request
// and never answers would otherwise hold the job until the runner's lease
// deadline. Like media/src/convex.ts, the timeout rides alongside the job
// signal, so neither can outlive the other. A timed-out attempt is retried
// like any other failed attempt.
export const TTS_REQUEST_TIMEOUT_MS = 180_000;

// TTS failure policy: two retries with backoff, then fail with the
// provider's status code only. The response body is never read into the
// error (it may echo the request, including the key), and a network-level
// failure surfaces without the URL (whose query string may carry a key) or
// headers. `init.signal` is the caller's deadline; redirects are refused so
// the key header never follows a redirect to another host. `backoffMs` lets a
// provider wait differently for a particular status (Breeze answers 409 while
// it renders another request) without changing the attempt count.
export type RetryOptions = {
  attempts?: number;
  // Delay before the next attempt, given the failed status (undefined for a
  // network error) and the 1-based number of the attempt that just failed.
  backoffMs?: (status: number | undefined, attempt: number) => number;
  // Per-attempt cap; tests shorten it. Production uses TTS_REQUEST_TIMEOUT_MS.
  timeoutMs?: number;
};

export function defaultBackoffMs(attempt: number): number {
  return 500 * 2 ** (attempt - 1);
}

// A backoff that ends early when the caller's deadline passes, so an aborted
// job does not sit out the rest of a wait before noticing.
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// The signal one attempt runs under: the caller's deadline plus this
// attempt's own timeout.
export function attemptSignal(
  signal: AbortSignal | undefined | null,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function fetchAudioWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<ArrayBuffer> {
  const attempts = options.attempts ?? 3;
  const backoffMs =
    options.backoffMs ?? ((_status, attempt) => defaultBackoffMs(attempt));
  const timeoutMs = options.timeoutMs ?? TTS_REQUEST_TIMEOUT_MS;
  const deadline = init.signal ?? undefined;
  let lastStatus: number | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: "error",
        signal: attemptSignal(deadline, timeoutMs),
      });
      if (response.ok) return await response.arrayBuffer();
      lastStatus = response.status;
    } catch (error) {
      // The caller's deadline is not a provider failure; stop immediately.
      // An attempt timeout is one, and is retried like a network error.
      if (deadline?.aborted) throw error;
      lastStatus = undefined;
    }
    if (attempt < attempts) {
      await sleep(backoffMs(lastStatus, attempt), deadline);
    }
  }
  throw new Error(
    lastStatus === undefined
      ? `TTS request failed after ${attempts} attempts (network error)`
      : `TTS request failed with status ${lastStatus}`,
  );
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
