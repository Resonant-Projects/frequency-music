import { writeMidi, type MidiData, type MidiEvent } from "midi-file";
import {
  midiNoteNumber,
  parameterKind,
  parsePitchToken,
  ROOT_NOTE_KINDS,
  tuningIntervalsInCents,
  type CompositionParameter,
  type TuningSpec,
} from "./tuning";

export interface SeedMidiGeneration {
  bytes: Uint8Array;
  bars: number;
  tempoBpm: number;
  rootMidi: number;
  pitchClassPalette: number[];
  honoredParameterIndexes: number[];
}

const TICKS_PER_BEAT = 480;
const MIN_BARS = 8;
const MAX_BARS = 16;
const DEFAULT_BARS = MIN_BARS;
const DEFAULT_TEMPO = 120;
const MIN_TEMPO_BPM = 20;
const MAX_TEMPO_BPM = 400;
const NOTE_VELOCITY = 72;
const SEED_KINDS = new Set([
  "chordprogression",
  "form",
  "rhythm",
  "tempo",
  ...ROOT_NOTE_KINDS,
]);
const DEGREE_BY_ROMAN: Readonly<Record<string, number>> = {
  I: 0,
  II: 1,
  III: 2,
  IV: 3,
  V: 4,
  VI: 5,
  VII: 6,
};

function kindOf(parameter: CompositionParameter): string {
  return parameterKind(parameter).toLowerCase();
}

export function isSeedParameter(parameter: CompositionParameter): boolean {
  return SEED_KINDS.has(kindOf(parameter));
}

function detailsNumber(
  parameter: CompositionParameter,
  key: string,
): number | null {
  if (
    !parameter.details ||
    typeof parameter.details !== "object" ||
    Array.isArray(parameter.details)
  ) {
    return null;
  }
  const value = (parameter.details as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseFirstSignedDecimal(value: string): number | null {
  const token = value.match(/[+-]?(?:\d+\.?\d*|\.\d+)/)?.[0];
  if (token === undefined) return null;
  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTempo(parameter: CompositionParameter): number | null {
  const fromDetails = detailsNumber(parameter, "bpm");
  const fromValue = parseFirstSignedDecimal(parameter.value);
  const tempo = fromDetails ?? fromValue;
  return tempo !== null && tempo >= MIN_TEMPO_BPM && tempo <= MAX_TEMPO_BPM
    ? tempo
    : null;
}

function parseRoot(parameter: CompositionParameter): number | null {
  const pitch = parsePitchToken(parameter.value);
  return pitch ? midiNoteNumber(pitch) : null;
}

function rhythmTicks(value: string): number | null {
  // Fractions need explicit digit guards: a bare \b lets "11/8" match "1/8".
  if (/\beighth\b/i.test(value) || /(?<![\d/])1\/8(?!\d)/.test(value)) {
    return TICKS_PER_BEAT / 2;
  }
  if (/\bquarter\b/i.test(value) || /(?<![\d/])1\/4(?!\d)/.test(value)) {
    return TICKS_PER_BEAT;
  }
  if (/\bhalf\b/i.test(value) || /(?<![\d/])1\/2(?!\d)/.test(value)) {
    return TICKS_PER_BEAT * 2;
  }
  if (/\bwhole\b/i.test(value)) return TICKS_PER_BEAT * 4;
  return null;
}

function romanDegree(token: string): number | null {
  const normalized = token.toUpperCase().replaceAll(/[^IV]/g, "");
  return DEGREE_BY_ROMAN[normalized] ?? null;
}

function progressionDegrees(value: string): number[] | null {
  const tokens = value.match(/(?:^|[-–—>\s])([ivIV]{1,4})(?=$|[-–—>\s])/g);
  if (!tokens) return null;
  const degrees = tokens.map(romanDegree);
  return degrees.length > 0 && degrees.every((degree) => degree !== null)
    ? (degrees as number[])
    : null;
}

function requestedBars(parameter: CompositionParameter): number | null {
  const fromDetails =
    detailsNumber(parameter, "barsMin") ?? detailsNumber(parameter, "bars");
  const fromValue = parseFirstSignedDecimal(parameter.value);
  const bars = fromDetails ?? fromValue;
  return bars !== null && Number.isInteger(bars) ? bars : null;
}

function pitchClassPalette(spec: TuningSpec, rootMidi: number): number[] {
  const classes = new Set<number>([rootMidi % 12]);
  for (const cents of tuningIntervalsInCents(spec)) {
    const semitones = Math.round(cents / 100);
    classes.add((((rootMidi + semitones) % 12) + 12) % 12);
  }
  return [...classes];
}

function midiNotesForPalette(palette: number[], rootMidi: number): number[] {
  return palette
    .map((pitchClass) => {
      const distance = (pitchClass - (rootMidi % 12) + 12) % 12;
      const note = rootMidi + distance;
      // Roots above MIDI 116 would push some palette notes past 127; wrap
      // those down an octave so every note stays valid and keeps its class.
      return note > 127 ? note - 12 : note;
    })
    .toSorted((left, right) => left - right);
}

export function generateSeedMidi(
  parameters: CompositionParameter[],
  tuning: TuningSpec,
): SeedMidiGeneration {
  const honored = new Set<number>();
  let tempoBpm = DEFAULT_TEMPO;
  let rootMidi = 60;
  let bars = DEFAULT_BARS;
  let hasTempo = false;
  let hasRoot = false;
  let hasForm = false;
  const rhythmFigures: number[] = [];
  const progressionFigures: number[][] = [];

  for (const [index, parameter] of parameters.entries()) {
    const kind = kindOf(parameter);
    if (kind === "tempo" && !hasTempo) {
      const parsed = parseTempo(parameter);
      if (parsed !== null) {
        tempoBpm = parsed;
        hasTempo = true;
        honored.add(index);
      }
    } else if (ROOT_NOTE_KINDS.has(kind) && !hasRoot) {
      const parsed = parseRoot(parameter);
      if (parsed !== null) {
        rootMidi = parsed;
        hasRoot = true;
        honored.add(index);
      }
    } else if (kind === "rhythm") {
      const parsed = rhythmTicks(parameter.value);
      if (parsed !== null) {
        rhythmFigures.push(parsed);
        honored.add(index);
      }
    } else if (kind === "chordprogression") {
      const parsed = progressionDegrees(parameter.value);
      if (parsed !== null) {
        progressionFigures.push(parsed);
        honored.add(index);
      }
    } else if (kind === "form" && !hasForm) {
      const parsed = requestedBars(parameter);
      if (parsed !== null && parsed >= MIN_BARS && parsed <= MAX_BARS) {
        bars = parsed;
        hasForm = true;
        honored.add(index);
      }
    }
  }

  const palette = pitchClassPalette(tuning, rootMidi);
  const notes = midiNotesForPalette(palette, rootMidi);
  const events: MidiEvent[] = [
    { deltaTime: 0, meta: true, type: "trackName", text: "Starter Kit Seed" },
    {
      deltaTime: 0,
      meta: true,
      type: "setTempo",
      microsecondsPerBeat: Math.round(60_000_000 / tempoBpm),
    },
    {
      deltaTime: 0,
      meta: true,
      type: "timeSignature",
      numerator: 4,
      denominator: 4,
      metronome: 24,
      thirtyseconds: 8,
    },
  ];

  const barTicks = TICKS_PER_BEAT * 4;
  for (let bar = 0; bar < bars; bar += 1) {
    const noteTicks =
      rhythmFigures.length > 0
        ? rhythmFigures[bar % rhythmFigures.length]!
        : TICKS_PER_BEAT;
    const progression =
      progressionFigures.length > 0
        ? progressionFigures[bar % progressionFigures.length]
        : undefined;
    const progressionDegree = progression?.[bar % progression.length];
    const notesPerBar = Math.max(1, Math.floor(barTicks / noteTicks));
    const startingIndex =
      progressionDegree === undefined
        ? bar % notes.length
        : progressionDegree % notes.length;
    for (let step = 0; step < notesPerBar; step += 1) {
      const noteNumber = notes[(startingIndex + step) % notes.length]!;
      events.push({
        deltaTime: 0,
        type: "noteOn",
        channel: 0,
        noteNumber,
        velocity: NOTE_VELOCITY,
      });
      events.push({
        deltaTime: noteTicks,
        type: "noteOff",
        channel: 0,
        noteNumber,
        velocity: 0,
      });
    }
  }
  events.push({ deltaTime: 0, meta: true, type: "endOfTrack" });

  const midi: MidiData = {
    header: { format: 0, numTracks: 1, ticksPerBeat: TICKS_PER_BEAT },
    tracks: [events],
  };

  return {
    bytes: Uint8Array.from(writeMidi(midi)),
    bars,
    tempoBpm,
    rootMidi,
    pitchClassPalette: palette,
    honoredParameterIndexes: [...honored].toSorted(
      (left, right) => left - right,
    ),
  };
}
