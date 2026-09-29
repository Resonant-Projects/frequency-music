// Joining rendered pieces: paragraphs into a narration, a narration behind a
// lead-in. Everything is resampled to mono 48 kHz first so inputs from any
// provider (or a downloaded master) mix on the same grid.
import { runFfmpeg } from "./ffmpeg";
import { measure } from "./loudness";

export async function silence(
  output: string,
  seconds: number,
  signal?: AbortSignal,
): Promise<void> {
  await runFfmpeg(
    [
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=48000:cl=mono",
      "-t",
      String(seconds),
      "-c:a",
      "pcm_s24le",
      output,
    ],
    { signal },
  );
}

// Places each input at a start offset (leadMs, then gapMs after the previous
// one ends) and mixes the delayed streams. The inputs never overlap, so
// amix with normalize=0 is a pure sum: each piece keeps its own level. Returns
// the start second of each input so callers can compute chapter marks.
export async function concatWithGaps(
  inputs: string[],
  output: string,
  gapMs: number,
  options: { leadMs?: number; tailMs?: number } = {},
  signal?: AbortSignal,
): Promise<{ starts: number[] }> {
  if (inputs.length === 0) throw new Error("concatWithGaps needs an input");
  const starts: number[] = [];
  let cursor = (options.leadMs ?? 0) / 1000;
  for (const input of inputs) {
    starts.push(cursor);
    cursor += (await measure(input, signal)).durationSecs + gapMs / 1000;
  }
  const total = cursor - gapMs / 1000 + (options.tailMs ?? 0) / 1000;
  const totalText = total.toFixed(3);
  const prepared = inputs.map((_, index) => {
    const delayMs = Math.round((starts[index] ?? 0) * 1000);
    return `[${index}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${delayMs}|${delayMs}[d${index}]`;
  });
  const labels = inputs.map((_, index) => `[d${index}]`).join("");
  // apad pads the mix out to the tail; -t trims the same length so the file
  // is exactly total seconds whichever side rounding lands on.
  const mix = `${labels}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0,apad=whole_dur=${totalText}[out]`;
  await runFfmpeg(
    [
      ...inputs.flatMap((input) => ["-i", input]),
      "-filter_complex",
      [...prepared, mix].join(";"),
      "-map",
      "[out]",
      "-t",
      totalText,
      "-c:a",
      "pcm_s24le",
      output,
    ],
    { signal },
  );
  return { starts };
}

// Strips leading and trailing silence, keeping `keepMs` of it on each side
// so a paragraph never starts or ends on a hard edge.
export async function trimEdges(
  input: string,
  output: string,
  keepMs = 300,
  signal?: AbortSignal,
): Promise<void> {
  const keep = (keepMs / 1000).toFixed(3);
  const strip = `silenceremove=start_periods=1:start_threshold=-50dB:start_silence=${keep}`;
  await runFfmpeg(
    [
      "-i",
      input,
      "-af",
      `${strip},areverse,${strip},areverse`,
      "-c:a",
      "pcm_s24le",
      output,
    ],
    { signal },
  );
}
