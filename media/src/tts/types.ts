import type { VoiceEntry, VoiceProvider } from "../../../convex/shared/voices";

// Existing provider imports keep one request implementation and error class.
export {
  attemptSignal,
  defaultBackoffMs,
  fetchAudioWithRetry,
  type RetryOptions,
  sleep,
  SynthesisRejectedError,
  TTS_REQUEST_TIMEOUT_MS,
} from "./request";
import { SynthesisRejectedError } from "./request";

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

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new SynthesisRejectedError(`${name} is not set`);
  return value;
}
