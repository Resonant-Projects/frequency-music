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

// Hosted TTS failure policy: two retries with backoff, then fail with the
// provider's status code only. The response body is never read into the
// error (it may echo the request, including the key), and a network-level
// failure surfaces without the URL (whose query string may carry a key) or
// headers. `init.signal` is the caller's deadline; redirects are refused so
// the key header never follows a redirect to another host.
export async function fetchAudioWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
): Promise<ArrayBuffer> {
  let lastStatus: number | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { ...init, redirect: "error" });
      if (response.ok) return await response.arrayBuffer();
      lastStatus = response.status;
    } catch (error) {
      // The caller's deadline is not a provider failure; stop immediately.
      if (init.signal?.aborted) throw error;
      lastStatus = undefined;
    }
    if (attempt < attempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, 500 * 2 ** (attempt - 1)),
      );
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
