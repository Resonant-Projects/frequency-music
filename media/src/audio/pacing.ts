// Long-form pacing: the pieces of a narration (sentence chunks, paragraphs,
// section headings) laid end to end with gaps chosen by what comes next,
// rather than one uniform gap. Each piece is trimmed to its speech first, so
// a provider's own leading and trailing silence does not decide the spacing.
import { runFfmpeg } from "./ffmpeg";
import { measure } from "./loudness";

export type PieceRole =
  | "intro"
  | "heading"
  | "subheading"
  | "paragraph"
  | "outro";

// Gaps in milliseconds. A section heading gets the longest pause before it
// and a clear pause after, so a listener hears the section change; a
// horizontal rule in the essay gets a long pause without a heading.
export const PACING_GAPS_MS = {
  withinParagraph: 250,
  betweenParagraphs: 700,
  sceneBreak: 1600,
  beforeHeading: 2000,
  afterHeading: 1000,
  beforeSubheading: 1300,
  afterSubheading: 700,
  afterIntro: 1200,
  beforeOutro: 1800,
} as const;

// Pink noise from anoisesrc at amplitude 1, band-limited as below, measures
// about -17.5 dBFS RMS (ffmpeg 8); the volume filter moves it to the target.
const ROOM_TONE_SOURCE_RMS_DB = -17.5;

export type PacedSegment = {
  role: PieceRole;
  breakBefore?: boolean;
  // Rendered chunk files for this segment, in order.
  files: string[];
};

// The gap before segment `index` (0 for the first).
export function gapBeforeSegment(
  segments: Pick<PacedSegment, "role" | "breakBefore">[],
  index: number,
): number {
  if (index === 0) return 0;
  const current = segments[index]!;
  const previous = segments[index - 1]!;
  const gaps = PACING_GAPS_MS;
  if (current.role === "heading") return gaps.beforeHeading;
  if (current.role === "subheading") return gaps.beforeSubheading;
  if (current.role === "outro") return gaps.beforeOutro;
  if (previous.role === "heading") return gaps.afterHeading;
  if (previous.role === "subheading") return gaps.afterSubheading;
  if (previous.role === "intro") return gaps.afterIntro;
  if (current.breakBefore) return gaps.sceneBreak;
  return gaps.betweenParagraphs;
}

// Trims leading and trailing silence below `thresholdDb`, keeping a little
// air on each side, and fades the edges so a cut never clicks.
export async function trimToSpeech(
  input: string,
  output: string,
  options: {
    thresholdDb?: number;
    keepStartMs?: number;
    keepEndMs?: number;
  } = {},
  signal?: AbortSignal,
): Promise<void> {
  const threshold = options.thresholdDb ?? -45;
  const keepStart = ((options.keepStartMs ?? 40) / 1000).toFixed(3);
  const keepEnd = ((options.keepEndMs ?? 120) / 1000).toFixed(3);
  const strip = (keep: string) =>
    `silenceremove=start_periods=1:start_threshold=${threshold}dB:start_silence=${keep}`;
  await runFfmpeg(
    [
      "-i",
      input,
      "-af",
      [
        "aresample=48000",
        "aformat=channel_layouts=mono",
        strip(keepStart),
        "areverse",
        strip(keepEnd),
        // Fade-out first while reversed (it is the tail), then fade-in.
        "afade=t=in:d=0.025",
        "areverse",
        "afade=t=in:d=0.010",
      ].join(","),
      "-c:a",
      "pcm_s24le",
      output,
    ],
    { signal },
  );
}

// The quiet floor of a take in dBFS: the 10th-percentile RMS of 50 ms
// windows, ignoring digital silence. Hosted voices with an audible hiss
// sit around -60 to -50; a clean take is far lower.
export async function noiseFloorDb(
  input: string,
  signal?: AbortSignal,
): Promise<number> {
  const { stdout } = await runFfmpeg(
    [
      "-i",
      input,
      "-af",
      "aresample=48000,asetnsamples=n=2400:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
      "-f",
      "null",
      "-",
    ],
    { signal },
  );
  const levels = [...stdout.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)]
    .map((match) => Number(match[1]))
    .filter((level) => Number.isFinite(level) && level > -110)
    .sort((a, b) => a - b);
  if (levels.length === 0) return -120;
  return levels[Math.floor(levels.length * 0.1)]!;
}

// Lays the segments out with role-based gaps and mixes them. With
// `roomToneDb`, a steady low noise bed at that RMS level runs under the
// whole narration so the gaps carry the same floor as the speech instead of
// dropping to digital silence (which sounds like a gate opening and closing).
// Returns the start second of each segment.
export async function assemblePaced(
  segments: PacedSegment[],
  output: string,
  options: { tailMs?: number; roomToneDb?: number } = {},
  signal?: AbortSignal,
): Promise<{ segmentStarts: number[]; durationSecs: number }> {
  const files: string[] = [];
  const starts: number[] = [];
  const segmentStarts: number[] = [];
  let cursor = 0;
  for (const [index, segment] of segments.entries()) {
    if (segment.files.length === 0) {
      throw new Error(`segment ${index} has no rendered audio`);
    }
    cursor += gapBeforeSegment(segments, index) / 1000;
    segmentStarts.push(cursor);
    for (const [chunkIndex, file] of segment.files.entries()) {
      if (chunkIndex > 0) cursor += PACING_GAPS_MS.withinParagraph / 1000;
      files.push(file);
      starts.push(cursor);
      cursor += (await measure(file, signal)).durationSecs;
    }
  }
  const total = cursor + (options.tailMs ?? 500) / 1000;
  const totalText = total.toFixed(3);
  const inputs = files.flatMap((file) => ["-i", file]);
  const prepared = files.map((_, index) => {
    const delayMs = Math.round(starts[index]! * 1000);
    return `[${index}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${delayMs}|${delayMs}[d${index}]`;
  });
  let labels = files.map((_, index) => `[d${index}]`).join("");
  let count = files.length;
  if (options.roomToneDb !== undefined) {
    const gainDb = options.roomToneDb - ROOM_TONE_SOURCE_RMS_DB;
    prepared.push(
      `anoisesrc=color=pink:amplitude=1:sample_rate=48000:seed=7:duration=${totalText},lowpass=f=7000,highpass=f=80,volume=${gainDb.toFixed(2)}dB[tone]`,
    );
    labels += "[tone]";
    count += 1;
  }
  const mix = `${labels}amix=inputs=${count}:normalize=0:dropout_transition=0,apad=whole_dur=${totalText}[out]`;
  await runFfmpeg(
    [
      ...inputs,
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
  return { segmentStarts, durationSecs: total };
}

export type ChunkVerdict = { ok: true } | { ok: false; reason: string };

// A sanity gate for one rendered chunk, before it can reach an episode.
// Spoken English runs at roughly 12-18 characters a second; a chunk far
// slower than that has run away (a model that never stopped generating
// mumbles for minutes), and one far faster has been cut short. `medianRate`
// tightens the check to this voice once enough chunks have rendered.
export function checkChunk(
  chars: number,
  durationSecs: number,
  medianRate?: number,
): ChunkVerdict {
  if (durationSecs <= 0.2) return { ok: false, reason: "empty audio" };
  // Short pieces (headings, one-line paragraphs) carry their own pauses;
  // judge them on an absolute ceiling only.
  if (chars < 60) {
    if (durationSecs > 2 + chars / 5) {
      return {
        ok: false,
        reason: `${durationSecs.toFixed(1)} s for ${chars} characters`,
      };
    }
    // Faster than 30 characters a second, the piece was cut short.
    if (chars >= 8 && durationSecs < chars / 30) {
      return {
        ok: false,
        reason: `too short: ${durationSecs.toFixed(2)} s for ${chars} characters`,
      };
    }
    return { ok: true };
  }
  const rate = chars / durationSecs;
  const low = Math.max(7, (medianRate ?? 0) * 0.6);
  const high = Math.min(30, medianRate ? medianRate * 1.7 : 30);
  if (rate < low) {
    return {
      ok: false,
      reason: `too slow: ${rate.toFixed(1)} characters a second (${durationSecs.toFixed(1)} s for ${chars})`,
    };
  }
  if (rate > high) {
    return {
      ok: false,
      reason: `too fast: ${rate.toFixed(1)} characters a second (${durationSecs.toFixed(1)} s for ${chars})`,
    };
  }
  return { ok: true };
}
