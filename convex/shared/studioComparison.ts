// Dependency-free contract for plan 11's human-versus-machine comparison: a
// signed-in person uploads a studio render of one machine litmus baseline,
// and the pair is rated blind. The web app imports this module at runtime, so
// it may not import zod, convex-helpers or any other root-only package.
import { MAX_UPLOAD_BYTES } from "./uploadLimits";

export const STUDIO_ENGINE_NAME = "human-studio";
// Version of the studio provenance record stored in `engine.params`.
export const STUDIO_ENGINE_VERSION = "1";
export const STUDIO_COMPARISON_PURPOSE = "studioComparison";
export const STUDIO_COMPARISON_LABELS = ["A", "B"] as const;

// Same ffmpeg arguments as the machine delivery (media/src/engines/sc), so
// both members carry identical frame layouts and encoder headers.
export const STUDIO_ENCODE_COMMAND =
  "ffmpeg -i studio-master.wav -map_metadata -1 -fflags +bitexact -ar 48000 -ac 2 -c:a libmp3lame -b:a 256k -id3v2_version 0 -write_xing 1 studio-delivery.mp3";

// A frame-counted duration includes the encoder's delay and padding (about
// 50 ms at 48 kHz); anything further off was not cut to the plan's length.
export const STUDIO_DURATION_TOLERANCE_SECS = 0.15;

/** Largest acceptable delivery for a plan: one second of slack at the
 * delivery bitrate plus a frame, and never above the shared upload cap. */
export function studioUploadMaxBytes(
  durationSecs: number,
  bitrateKbps: number,
): number {
  return Math.min(
    MAX_UPLOAD_BYTES,
    Math.ceil(((durationSecs + 1) * bitrateKbps * 1000) / 8) + 2048,
  );
}

// Declared by the person who rendered; loudness is not measured server-side
// (Convex cannot decode audio), so the declaration must sit inside the
// music loudness policy the machine render meets.
export const STUDIO_TEXT_MAX = 200;
export const STUDIO_NOTES_MAX = 2000;
export const STUDIO_TARGET_LUFS = -18;
export const STUDIO_LUFS_TOLERANCE = 0.5;
export const STUDIO_MAX_TRUE_PEAK_DBTP = -1;

export const STUDIO_TUNING_METHODS = ["scala", "mts-esp", "other"] as const;
export type StudioTuningMethod = (typeof STUDIO_TUNING_METHODS)[number];

export type StudioProvenance = {
  daw: string;
  instrument: string;
  tuningMethod: StudioTuningMethod;
  effects: string;
  tunerCheck: string;
  integratedLufs: number;
  truePeakDbtp: number;
  notes?: string;
};

/** Problems with a declaration, empty when it is admissible. */
export function studioProvenanceProblems(value: StudioProvenance): string[] {
  const problems: string[] = [];
  for (const key of ["daw", "instrument", "effects", "tunerCheck"] as const) {
    const text = value[key].trim();
    if (!text) problems.push(`${key} is required`);
    else if (text.length > STUDIO_TEXT_MAX)
      problems.push(`${key} is longer than ${STUDIO_TEXT_MAX} characters`);
  }
  if (!STUDIO_TUNING_METHODS.includes(value.tuningMethod))
    problems.push("tuningMethod is not recognised");
  if (
    !Number.isFinite(value.integratedLufs) ||
    Math.abs(value.integratedLufs - STUDIO_TARGET_LUFS) > STUDIO_LUFS_TOLERANCE
  )
    problems.push(
      `integratedLufs must be ${STUDIO_TARGET_LUFS} LUFS within ${STUDIO_LUFS_TOLERANCE} LU`,
    );
  if (
    !Number.isFinite(value.truePeakDbtp) ||
    value.truePeakDbtp > STUDIO_MAX_TRUE_PEAK_DBTP ||
    value.truePeakDbtp < -60
  )
    problems.push(
      `truePeakDbtp must be at most ${STUDIO_MAX_TRUE_PEAK_DBTP} dBTP`,
    );
  if (value.notes !== undefined && value.notes.length > STUDIO_NOTES_MAX)
    problems.push(`notes is longer than ${STUDIO_NOTES_MAX} characters`);
  return problems;
}

/** The six subjective render scales every comparison member must receive,
 * so the two members are rated on the same dimensions. `overall` stays
 * optional, as in the general rating form. */
export const STUDIO_REQUIRED_SCORE_KEYS = [
  "bodilyPleasantness",
  "goosebumps",
  "perceivedConsonance",
  "musicality",
  "easeOfComposability",
  "expandability",
] as const;

export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

export function studioContentHash(sha256Hex: string): string {
  return `sha256:${sha256Hex}`;
}
