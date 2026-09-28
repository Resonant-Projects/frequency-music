// One loudness policy for every wave (spec §3.4). Measurements use ffmpeg's
// ebur128 filter; normalization is two-pass loudnorm with a true-peak ceiling.
import { runFfmpeg } from "./ffmpeg";

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

// ebur128 prints a summary block at the end of stderr:
//   Integrated loudness:
//     I:         -16.0 LUFS
//   True peak:
//     Peak:       -1.3 dBFS
// and ffmpeg's progress line carries time=HH:MM:SS.ss.
export async function measure(path: string): Promise<Measurement> {
  const { stderr } = await runFfmpeg([
    "-i",
    path,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ]);
  const integratedLufs = Number(lastMatch(stderr, /I:\s+(-?[\d.]+) LUFS/g)[1]);
  const truePeakDbtp = Number(lastMatch(stderr, /Peak:\s+(-?[\d.]+) dBFS/g)[1]);
  const time = lastMatch(stderr, /time=(\d+):(\d+):([\d.]+)/g);
  const durationSecs =
    Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]);
  return { integratedLufs, truePeakDbtp, durationSecs };
}

export async function normalize(
  input: string,
  output: string,
  options: { targetLufs: number; truePeakCeilingDbtp?: number },
): Promise<Measurement> {
  const ceiling = options.truePeakCeilingDbtp ?? TRUE_PEAK_CEILING;
  const first = await runFfmpeg([
    "-i",
    input,
    "-af",
    `loudnorm=I=${options.targetLufs}:TP=${ceiling}:LRA=11:print_format=json`,
    "-f",
    "null",
    "-",
  ]);
  // The JSON block is not the tail of stderr: ffmpeg 8 prints an output summary
  // and a final progress line after the closing brace, so slice both ends.
  const jsonText = first.stderr.slice(
    first.stderr.lastIndexOf("{"),
    first.stderr.lastIndexOf("}") + 1,
  );
  const stats = JSON.parse(jsonText) as Record<string, string>;
  await runFfmpeg([
    "-i",
    input,
    "-af",
    `loudnorm=I=${options.targetLufs}:TP=${ceiling}:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true:print_format=summary`,
    "-ar",
    "48000",
    "-c:a",
    "pcm_s24le",
    output,
  ]);
  return await measure(output);
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
