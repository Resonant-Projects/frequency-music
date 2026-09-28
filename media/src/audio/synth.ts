import { runFfmpeg } from "./ffmpeg";

// ffmpeg's `sine` source has a fixed amplitude of 1/8 full scale (-18.06 dBFS),
// so the volume filter compensates to make `gainDb` the tone's peak in dBFS.
const SINE_SOURCE_PEAK_DBFS = 20 * Math.log10(1 / 8);

export async function synthTone(
  output: string,
  options: {
    hz: number;
    seconds: number;
    sampleRate?: number;
    gainDb?: number;
  },
  signal?: AbortSignal,
): Promise<void> {
  const sampleRate = options.sampleRate ?? 48000;
  const gainDb = options.gainDb ?? -20;
  await runFfmpeg(
    [
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${options.hz}:sample_rate=${sampleRate}:duration=${options.seconds}`,
      "-af",
      `volume=${gainDb - SINE_SOURCE_PEAK_DBFS}dB`,
      "-ac",
      "1",
      "-c:a",
      "pcm_s24le",
      output,
    ],
    { signal },
  );
}
