// One loudness policy for every wave (spec §3.4). Measurements use ffmpeg's
// ebur128 filter; normalization is measured linear gain, after true-peak
// limiting when the peaks leave no room for it.
import { runFfmpeg, runFfprobe } from "./ffmpeg";

export const LOUDNESS_TARGETS = { spoken: -16, music: -18 } as const;
export const TRUE_PEAK_CEILING = -1;
export const TOLERANCE_LU = 0.5;

export type Measurement = {
  integratedLufs: number;
  truePeakDbtp: number;
  durationSecs: number;
};

function lastMatch(text: string, pattern: RegExp): RegExpMatchArray {
  const last = [...text.matchAll(pattern)].at(-1);
  if (!last) throw new Error(`loudness measurement missing ${pattern.source}`);
  return last;
}

// Duration comes from ffprobe's container/format entry. ffmpeg's `time=`
// progress line is coarse and version-dependent (a 3 s tone reads 2.9 on some
// builds), so it is not a measurement.
async function probeDuration(
  path: string,
  signal?: AbortSignal,
): Promise<number> {
  const text = await runFfprobe(
    ["-show_entries", "format=duration", "-of", "json", path],
    { signal },
  );
  const parsed = JSON.parse(text) as { format?: { duration?: string } };
  const durationSecs = Number(parsed.format?.duration);
  if (parsed.format?.duration === undefined || !Number.isFinite(durationSecs)) {
    throw new Error(`ffprobe reported no duration for ${path}`);
  }
  return durationSecs;
}

// ebur128 prints a summary block at the end of stderr:
//   Integrated loudness:
//     I:         -16.0 LUFS
//   True peak:
//     Peak:       -1.3 dBFS
export async function measure(
  path: string,
  signal?: AbortSignal,
): Promise<Measurement> {
  const { stderr } = await runFfmpeg(
    ["-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { signal },
  );
  const integratedLufs = Number(lastMatch(stderr, /I:\s+(-?[\d.]+) LUFS/g)[1]);
  const truePeakDbtp = Number(lastMatch(stderr, /Peak:\s+(-?[\d.]+) dBFS/g)[1]);
  const durationSecs = await probeDuration(path, signal);
  return { integratedLufs, truePeakDbtp, durationSecs };
}

// Linear gain must leave this much true-peak headroom under the ceiling: the
// 16-bit master and the MP3 encode each move the peak by a few hundredths.
const LINEAR_PEAK_MARGIN_DB = 0.1;
// The limiter aims this far under the ceiling, so the small loudness it takes
// away can be given back with linear gain without crossing the ceiling.
const LIMITER_HEADROOM_DB = 1;
// Each limiting round only makes up the loudness the previous one removed;
// real speech converges in one.
const MAX_LIMIT_ROUNDS = 3;

function linearFeasible(m: Measurement, gainDb: number, ceiling: number) {
  return m.truePeakDbtp + gainDb <= ceiling - LINEAR_PEAK_MARGIN_DB;
}

// Brings `input` to the target with plain gain. When its peaks are too hot
// for that (real speech often sits 18 dB above its loudness, the ceiling
// leaves 15), it is first true-peak limited at the target level. loudnorm's
// own fallback for that case is dynamic mode, which lands anywhere within
// about a decibel of the target, and a take then fails policy.
export async function normalize(
  input: string,
  output: string,
  options: { targetLufs: number; truePeakCeilingDbtp?: number },
  signal?: AbortSignal,
): Promise<Measurement> {
  const ceiling = options.truePeakCeilingDbtp ?? TRUE_PEAK_CEILING;
  let source = input;
  let current = await measure(input, signal);
  let gainDb = options.targetLufs - current.integratedLufs;
  for (let round = 1; !linearFeasible(current, gainDb, ceiling); round++) {
    if (round > MAX_LIMIT_ROUNDS) {
      throw new Error(
        `normalize: cannot reach ${options.targetLufs} LUFS under ${ceiling} dBTP; after ${MAX_LIMIT_ROUNDS} limiting rounds the take is at ${current.integratedLufs.toFixed(2)} LUFS with a ${current.truePeakDbtp.toFixed(2)} dBTP peak`,
      );
    }
    const limited = `${output}.limit${round}.wav`;
    await limitAtGain(source, limited, gainDb, ceiling, signal);
    source = limited;
    current = await measure(source, signal);
    gainDb = options.targetLufs - current.integratedLufs;
  }
  await runFfmpeg(
    [
      "-i",
      source,
      "-af",
      `volume=${gainDb.toFixed(3)}dB`,
      "-ar",
      "48000",
      "-c:a",
      "pcm_s24le",
      output,
    ],
    { signal },
  );
  return await measure(output, signal);
}

// Applies `gainDb`, then limits sample peaks at 4x oversampling (where they
// approximate true peaks) to LIMITER_HEADROOM_DB under the ceiling. The
// limiter's auto-level is off so it only ever turns peaks down, and its
// lookahead delay is compensated so the take keeps its timing.
async function limitAtGain(
  input: string,
  output: string,
  gainDb: number,
  ceiling: number,
  signal?: AbortSignal,
): Promise<void> {
  const limit = 10 ** ((ceiling - LIMITER_HEADROOM_DB) / 20);
  await runFfmpeg(
    [
      "-i",
      input,
      "-af",
      [
        "aresample=192000",
        `volume=${gainDb.toFixed(3)}dB`,
        `alimiter=limit=${limit.toFixed(6)}:attack=1:release=50:level=false:latency=true`,
        "aresample=48000",
      ].join(","),
      "-c:a",
      "pcm_s24le",
      output,
    ],
    { signal },
  );
}

export function assertWithinPolicy(
  measurement: Measurement,
  targetLufs: number,
  toleranceLu: number = TOLERANCE_LU,
): void {
  if (Math.abs(measurement.integratedLufs - targetLufs) > toleranceLu) {
    throw new Error(
      `loudness ${measurement.integratedLufs.toFixed(2)} LUFS is outside ${targetLufs} ±${toleranceLu} LU`,
    );
  }
  if (measurement.truePeakDbtp > TRUE_PEAK_CEILING) {
    throw new Error(
      `true peak ${measurement.truePeakDbtp.toFixed(2)} dBTP exceeds ${TRUE_PEAK_CEILING} dBTP`,
    );
  }
}
