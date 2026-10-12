import type { VoiceEntry, VoiceProvider } from "../../../convex/shared/voices";

/** The provider rejected synthesis, or local validation refused before calling it. */
export class SynthesisRejectedError extends Error {}

export type TtsProvider = {
  id: VoiceProvider;
  maxChars: number;
  // `signal` is the job deadline; providers pass it to the request so an
  // aborted job stops waiting; the provider may still finish or charge.
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
// signal. A timeout leaves the provider outcome unknown and cannot authorize
// another synthesis request.
export const TTS_REQUEST_TIMEOUT_MS = 180_000;

// TTS failure policy: explicit rate-limit rejections get two retries, then fail with the
// provider's status code only. The response body is never read into the
// error (it may echo the request, including the key), and a network-level
// failure surfaces without the URL (whose query string may carry a key) or
// headers. `init.signal` is the caller's deadline; redirects are refused so
// the key header never follows a redirect to another host. `backoffMs` lets a
// provider wait differently for a particular status (Breeze answers 409 while
// it renders another request) without changing the attempt count.
export type RetryOptions = {
  attempts?: number;
  // Provider-specific statuses that definitively reject before synthesis.
  // Breeze also uses 409/503 for busy/loading; hosted providers default to 429.
  retryableRejections?: readonly number[];
  // Delay before another rejected attempt.
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
  if (!Number.isInteger(attempts) || attempts < 1)
    throw new SynthesisRejectedError("TTS attempts must be a positive integer");
  const retryable = options.retryableRejections ?? [429];
  const backoffMs =
    options.backoffMs ?? ((_status, attempt) => defaultBackoffMs(attempt));
  const timeoutMs = options.timeoutMs ?? TTS_REQUEST_TIMEOUT_MS;
  const deadline = init.signal ?? undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (deadline?.aborted)
      throw new SynthesisRejectedError(
        "TTS request cancelled before synthesis",
      );
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        redirect: "error",
        signal: attemptSignal(deadline, timeoutMs),
      });
      if (response.ok) return await response.arrayBuffer();
    } catch (error) {
      if (deadline?.aborted) throw error;
      // A transport failure or lost response cannot prove synthesis stopped.
      throw new Error(
        "TTS request failed (ambiguous transport failure; refusing synthesis retry)",
      );
    }
    const status = response.status;
    const rejected =
      retryable.includes(status) ||
      (status >= 400 && status < 500 && status !== 408 && status !== 499);
    if (!rejected)
      throw new Error(
        `TTS request failed with status ${status} (synthesis outcome unknown)`,
      );
    if (!retryable.includes(status) || attempt === attempts)
      throw new SynthesisRejectedError(
        `TTS request failed with status ${status}`,
      );
    try {
      await sleep(backoffMs(status, attempt), deadline);
    } catch {
      // Every prior request was explicitly rejected. No next request began.
      throw new SynthesisRejectedError(
        "TTS retry cancelled after provider rejection",
      );
    }
  }
  throw new Error("TTS retry loop did not settle");
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new SynthesisRejectedError(`${name} is not set`);
  return value;
}
