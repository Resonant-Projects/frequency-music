import { tuningIntervalsInCents, type TuningSpec } from "./tuning";

/** Render-only admission policy. 256 degrees covers dense microtonal studies;
 * 64 characters accommodates named tunings and precise rational intervals.
 * The legacy Scala/KBM parser deliberately does not use these limits. */
export const MAX_RENDER_DEGREES = 256;
export const MAX_RENDER_TUNING_STRING_LENGTH = 64;

function assertRenderTuningSize(tuning: TuningSpec): void {
  if (
    (tuning.kind === "edo" && tuning.divisions > MAX_RENDER_DEGREES) ||
    (tuning.kind === "cents" && tuning.values.length > MAX_RENDER_DEGREES) ||
    (tuning.kind === "ji" &&
      (tuning.ratios.length > MAX_RENDER_DEGREES ||
        tuning.ratios.some(
          (ratio) => ratio.length > MAX_RENDER_TUNING_STRING_LENGTH,
        ))) ||
    (tuning.kind === "named" &&
      tuning.name.length > MAX_RENDER_TUNING_STRING_LENGTH)
  ) {
    throw new Error("Render tuning exceeds degree or string admission limits.");
  }
}

export const MIN_RENDER_HZ = 20;
export const MAX_RENDER_HZ = 20_000;

/** Version 1 supports octave repetition only. Legacy Scala normalization stays
 * unchanged; render inputs cannot silently discard cents outside the octave or
 * interpret a non-octave ratio as a formal period. */
export function octaveDegreeCents(tuning: TuningSpec): number[] {
  assertRenderTuningSize(tuning);
  if (
    tuning.kind === "cents" &&
    tuning.values.some(
      (value) => !Number.isFinite(value) || value < 0 || value > 1200,
    )
  ) {
    throw new Error(
      "Render tuning supports only cents within the octave (0 to 1200).",
    );
  }
  const intervals = tuningIntervalsInCents(tuning);
  const degrees = intervals.slice(0, -1);
  if (intervals.length > MAX_RENDER_DEGREES) {
    throw new Error("Render tuning admits at most 256 normalized degrees.");
  }
  if (
    intervals.at(-1) !== 1200 ||
    degrees.some(
      (cents) => !Number.isFinite(cents) || cents < 0 || cents >= 1200,
    )
  ) {
    throw new Error(
      "Render tuning supports only octave-repeating intervals below 2/1.",
    );
  }
  // Scala omits unison and includes the terminal octave. Render degrees do the
  // opposite: degree 0 is unison; the terminal octave is degree 0, octave 1.
  return [0, ...degrees];
}

/** referenceHz is degree 0 in octave 0, independently of KBM's MIDI-69 anchor.
 * Degrees never wrap implicitly; callers supply an integer octave explicitly. */
export function degreeToHz(
  tuning: TuningSpec,
  referenceHz: number,
  degree: number,
  octave = 0,
): number {
  return prepareDegreeToHz(tuning, referenceHz)(degree, octave);
}

/** Normalize once per mapping; the returned function does O(1) work per note. */
export function prepareDegreeToHz(tuning: TuningSpec, referenceHz: number) {
  return degreeCentsToHz(octaveDegreeCents(tuning), referenceHz);
}

/** Use an already normalized octave degree table, detached from caller edits. */
export function degreeCentsToHz(
  degrees: readonly number[],
  referenceHz: number,
) {
  const cents = [...degrees];
  return (degree: number, octave = 0): number => {
    if (!Number.isInteger(degree) || degree < 0 || degree >= cents.length) {
      throw new Error(`Degree must be an integer in [0, ${cents.length}).`);
    }
    if (!Number.isSafeInteger(octave)) {
      throw new Error("Octave must be a safe integer.");
    }
    if (!Number.isFinite(referenceHz) || referenceHz <= 0) {
      throw new Error("Reference frequency must be finite and positive.");
    }
    const hz = referenceHz * 2 ** (octave + cents[degree]! / 1200);
    if (!Number.isFinite(hz) || hz < MIN_RENDER_HZ || hz > MAX_RENDER_HZ) {
      throw new Error("Rendered frequency must be between 20 and 20000 Hz.");
    }
    return hz;
  };
}
