export interface CompositionParameter {
  kind?: string;
  type?: string;
  value: string;
  details?: unknown;
  canonicalKind?: string;
}

export type TuningSpec =
  | { kind: "edo"; divisions: number }
  | { kind: "ji"; ratios: string[] }
  | { kind: "cents"; values: number[] }
  | { kind: "named"; name: string };

export type TuningParseFailureCode =
  | "missing_tuning"
  | "invalid_tuning_details"
  | "unsupported_tuning";

export type TuningParseResult =
  | { spec: TuningSpec; parameterIndex: number; reason: null }
  | {
      spec: null;
      parameterIndex: null;
      reason: { code: TuningParseFailureCode; message: string };
    };

export interface NamedTuning {
  aliases: string[];
  intervals: Array<number | string>;
  referenceHz?: number;
}

export const NAMED_TUNINGS: Record<string, NamedTuning> = {
  "geometric-temperament": {
    aliases: ["geometric temperament"],
    intervals: [
      100.89,
      200,
      300,
      386.31371,
      498.045,
      600,
      701.955,
      800,
      884.35871,
      1000,
      1088.26871,
      "2/1",
    ],
    referenceHz: 432,
  },
  "grant-precise-temperament": {
    aliases: [
      "grant precise temperament",
      "precise temperament tuning",
      "robert edward grant precise temperament tuning",
    ],
    intervals: [
      99.64,
      199.29,
      301.19,
      400.83,
      498.04,
      600,
      701.96,
      799.17,
      898.81,
      1003.15,
      1102.79,
      "2/1",
    ],
    referenceHz: 432,
  },
  "polygon-angles-pure": {
    aliases: [
      "polygon angles pure",
      "pure polygon internal angles scale",
      "polygon angle scale",
    ],
    intervals: [
      200,
      300,
      360,
      400,
      428.57143,
      450,
      466.66667,
      480,
      490.90909,
      500,
      "2/1",
    ],
  },
};

const TUNING_KINDS = new Set([
  "edo",
  "scale",
  "temperament",
  "tuning",
  "tuningsystem",
]);

const RATIO_PATTERN = /^\d+\s*[/:]\s*\d+$/;
const MAX_EDO = 4096;

export const ROOT_NOTE_KINDS: ReadonlySet<string> = new Set([
  "key",
  "note",
  "rootnote",
]);

export function parameterKind(parameter: CompositionParameter): string {
  return (
    parameter.canonicalKind?.trim() ||
    parameter.kind?.trim() ||
    parameter.type?.trim() ||
    "unknown"
  );
}

export function isTuningParameter(parameter: CompositionParameter): boolean {
  return TUNING_KINDS.has(parameterKind(parameter).toLowerCase());
}

function normalizeRatio(value: string): string {
  return value.trim().replace(":", "/").replaceAll(/\s/g, "");
}

function ratioValue(value: string): number | null {
  if (!RATIO_PATTERN.test(value.trim())) return null;
  const [numeratorText, denominatorText] = normalizeRatio(value).split("/");
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  return numerator > 0 && denominator > 0 ? numerator / denominator : null;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "")
      .slice(0, 72) || "recipe"
  );
}

function namedTuning(value: string): TuningSpec | null {
  const normalized = normalizeName(value);
  for (const [name, entry] of Object.entries(NAMED_TUNINGS)) {
    if (
      normalizeName(name) === normalized ||
      entry.aliases.some((alias) => normalizeName(alias) === normalized)
    ) {
      return { kind: "named", name };
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function ratiosFrom(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ratios = value.map((item) =>
    typeof item === "string" && ratioValue(item) !== null
      ? normalizeRatio(item)
      : null,
  );
  return ratios.some((ratio) => ratio === null) ? null : (ratios as string[]);
}

function centsFrom(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const cents = value.map((item) =>
    typeof item === "number" && Number.isFinite(item) ? item : null,
  );
  return cents.some((cent) => cent === null) ? null : (cents as number[]);
}

function detailsSpec(details: unknown): TuningSpec | null {
  const record = asRecord(details);
  if (!record) return null;
  const ratios = ratiosFrom(record.ratios ?? record.intervals);
  if (ratios) return { kind: "ji", ratios };
  const values = centsFrom(record.cents ?? record.values ?? record.intervals);
  if (values) return { kind: "cents", values };
  return null;
}

function valueSpec(value: string): TuningSpec | null {
  const named = namedTuning(value);
  if (named) return named;

  const edo = value.match(
    /(?:^|\b)(\d{1,4})\s*(?:-\s*)?(?:edo|tet|tone\s+equal\s+temperament)\b/i,
  );
  if (edo) {
    const divisions = Number(edo[1]);
    if (Number.isInteger(divisions) && divisions >= 1 && divisions <= MAX_EDO) {
      return { kind: "edo", divisions };
    }
  }

  const ratios = value.match(/\d+\s*[/:]\s*\d+/g);
  if (ratios && ratios.length > 0) {
    const normalized = ratiosFrom(ratios);
    if (!normalized) return null;
    return {
      kind: "ji",
      ratios: normalized,
    };
  }

  const cents = [...value.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:cents?|¢)/gi)].map(
    (match) => Number(match[1]),
  );
  if (cents.length > 0 && cents.every(Number.isFinite)) {
    return { kind: "cents", values: cents };
  }

  return null;
}

export function parseTuningFromParametersWithReason(
  params: CompositionParameter[],
): TuningParseResult {
  const tuningParameters = params.flatMap((parameter, parameterIndex) =>
    isTuningParameter(parameter) ? [{ parameter, parameterIndex }] : [],
  );
  if (tuningParameters.length === 0) {
    return {
      spec: null,
      parameterIndex: null,
      reason: {
        code: "missing_tuning",
        message: "No tuning parameter was provided.",
      },
    };
  }

  for (const { parameter, parameterIndex } of tuningParameters) {
    const parsed = detailsSpec(parameter.details) ?? valueSpec(parameter.value);
    if (parsed) return { spec: parsed, parameterIndex, reason: null };
  }

  const parameter = tuningParameters[0]?.parameter;
  const details = asRecord(parameter?.details);
  const hasExplicitDetails = Boolean(
    details &&
      ["ratios", "cents", "values", "intervals"].some(
        (key) => details[key] !== undefined,
      ),
  );
  return {
    spec: null,
    parameterIndex: null,
    reason: {
      code: hasExplicitDetails
        ? "invalid_tuning_details"
        : "unsupported_tuning",
      message: hasExplicitDetails
        ? `Tuning details for "${parameter?.value ?? "unknown"}" are not a numeric cents list or ratio list.`
        : `Unsupported tuning system: "${parameter?.value ?? "unknown"}".`,
    },
  };
}

export function parseTuningFromParameters(
  params: CompositionParameter[],
): TuningSpec | null {
  return parseTuningFromParametersWithReason(params).spec;
}

function normalizedIntervals(spec: TuningSpec): Array<number | string> {
  if (spec.kind === "edo") {
    if (
      !Number.isInteger(spec.divisions) ||
      spec.divisions < 1 ||
      spec.divisions > MAX_EDO
    ) {
      throw new Error("EDO divisions must be an integer between 1 and 4096.");
    }
    return [
      ...Array.from(
        { length: spec.divisions - 1 },
        (_, index) => ((index + 1) * 1200) / spec.divisions,
      ),
      "2/1",
    ];
  }
  if (spec.kind === "ji") {
    const ratios = spec.ratios
      .map(normalizeRatio)
      .filter((ratio) => ratio !== "1/1");
    if (ratios.some((ratio) => ratioValue(ratio) === null)) {
      throw new Error(
        "JI ratios must have positive numerators and denominators.",
      );
    }
    const sortedRatios = ratios
      .filter((ratio) => ratio !== "2/1")
      .toSorted((left, right) => ratioValue(left)! - ratioValue(right)!);
    return [...sortedRatios, "2/1"];
  }
  if (spec.kind === "cents") {
    const values = spec.values
      .filter((value) => value > 0 && value < 1200)
      .toSorted((left, right) => left - right);
    values.push(1200);
    return values.map((value) => (value === 1200 ? "2/1" : value));
  }
  const named = NAMED_TUNINGS[spec.name];
  if (!named) throw new Error(`Unknown named tuning: ${spec.name}`);
  return named.intervals;
}

function formatInterval(interval: number | string): string {
  return typeof interval === "number" ? interval.toFixed(5) : interval;
}

export function toScl(spec: TuningSpec, description: string): string {
  const intervals = normalizedIntervals(spec);
  return [
    "! tuning.scl",
    "!",
    description,
    String(intervals.length),
    "!",
    ...intervals.map(formatInterval),
    "",
  ].join("\n");
}

const NATURAL_NOTE_TO_SEMITONE: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function parsePitchToken(value: string): string | null {
  return (
    value.match(/(?<![A-Za-z])[A-Ga-g](?:#|b)?(?:-?\d+)?(?![A-Za-z])/)?.[0] ??
    null
  );
}

export function midiNoteNumber(note = "C4"): number | null {
  const match = note.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)?$/);
  if (!match) return null;
  const naturalSemitone = NATURAL_NOTE_TO_SEMITONE[match[1]!.toUpperCase()];
  if (naturalSemitone === undefined) return null;
  const accidentalOffset = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  const semitone = naturalSemitone + accidentalOffset;
  const octave = match[3] === undefined ? 4 : Number(match[3]);
  const midi = (octave + 1) * 12 + semitone;
  return midi >= 0 && midi <= 127 ? midi : null;
}

export function toKbm(spec: TuningSpec, rootNote = "C4"): string {
  const mapSize = normalizedIntervals(spec).length;
  const middleNote = midiNoteNumber(rootNote) ?? 60;
  const referenceNote = 69;
  const referenceHz =
    spec.kind === "named"
      ? (NAMED_TUNINGS[spec.name]?.referenceHz ?? 440)
      : 440;

  return [
    "! tuning.kbm",
    `! Keyboard mapping rooted at MIDI note ${middleNote}`,
    "! Size of map",
    String(mapSize),
    "! First MIDI note number to retune",
    "0",
    "! Last MIDI note number to retune",
    "127",
    "! Middle note (scale degree 0)",
    String(middleNote),
    "! Reference note",
    String(referenceNote),
    "! Reference frequency",
    referenceHz.toFixed(5),
    "! Formal octave degree",
    String(mapSize),
    "! Mapping",
    ...Array.from({ length: mapSize }, (_, index) => String(index)),
    "",
  ].join("\n");
}

export function tuningIntervalsInCents(spec: TuningSpec): number[] {
  return normalizedIntervals(spec).map((interval) => {
    if (typeof interval === "number") return interval;
    const [numeratorText, denominatorText] = interval.split("/");
    const numerator = Number(numeratorText);
    const denominator = Number(denominatorText);
    return 1200 * Math.log2(numerator / denominator);
  });
}
