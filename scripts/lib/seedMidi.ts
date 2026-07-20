import { writeMidi, type MidiData, type MidiEvent } from "midi-file";
import {
  midiNoteNumber,
  parameterKind,
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
const DEFAULT_BARS = 8;
const DEFAULT_TEMPO = 120;
const SCALE_DEGREE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];

function kindOf(parameter: CompositionParameter): string {
  return parameterKind(parameter).toLowerCase();
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

function parseTempo(parameter: CompositionParameter): number | null {
  const fromDetails = detailsNumber(parameter, "bpm");
  const fromValue = Number(parameter.value.match(/\d+(?:\.\d+)?/)?.[0]);
  const tempo = fromDetails ?? (Number.isFinite(fromValue) ? fromValue : null);
  return tempo !== null && tempo >= 20 && tempo <= 400 ? tempo : null;
}

function parseRoot(parameter: CompositionParameter): number | null {
  const pitch = parameter.value.match(/[A-Ga-g][#b]?-?\d*/)?.[0];
  return pitch ? midiNoteNumber(pitch) : null;
}

function rhythmTicks(value: string): number | null {
  if (/\beighth|1\/8\b/i.test(value)) return TICKS_PER_BEAT / 2;
  if (/\bquarter|1\/4\b/i.test(value)) return TICKS_PER_BEAT;
  if (/\bhalf|1\/2\b/i.test(value)) return TICKS_PER_BEAT * 2;
  if (/\bwhole\b/i.test(value)) return TICKS_PER_BEAT * 4;
  return null;
}

function romanDegree(token: string): number | null {
  const normalized = token.toUpperCase().replaceAll(/[^IV]/g, "");
  const degreeByRoman: Record<string, number> = {
    I: 0,
    II: 1,
    III: 2,
    IV: 3,
    V: 4,
    VI: 5,
    VII: 6,
  };
  return degreeByRoman[normalized] ?? null;
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
  const fromValue = Number(parameter.value.match(/\d+/)?.[0]);
  const bars = fromDetails ?? (Number.isFinite(fromValue) ? fromValue : null);
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
      return rootMidi + distance;
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
  let noteTicks = TICKS_PER_BEAT;
  let bars = DEFAULT_BARS;
  let progression: number[] | null = null;

  for (const [index, parameter] of parameters.entries()) {
    const kind = kindOf(parameter);
    if (kind === "tempo") {
      const parsed = parseTempo(parameter);
      if (parsed !== null) {
        tempoBpm = parsed;
        honored.add(index);
      }
    } else if (["key", "note", "rootnote"].includes(kind)) {
      const parsed = parseRoot(parameter);
      if (parsed !== null) {
        rootMidi = parsed;
        honored.add(index);
      }
    } else if (kind === "rhythm") {
      const parsed = rhythmTicks(parameter.value);
      if (parsed !== null) {
        noteTicks = parsed;
        honored.add(index);
      }
    } else if (kind === "chordprogression") {
      const parsed = progressionDegrees(parameter.value);
      if (parsed !== null) {
        progression = parsed;
        honored.add(index);
      }
    } else if (kind === "form") {
      const parsed = requestedBars(parameter);
      if (parsed !== null && parsed >= 8 && parsed <= 16) {
        bars = parsed;
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
  const notesPerBar = Math.max(1, Math.floor(barTicks / noteTicks));
  for (let bar = 0; bar < bars; bar += 1) {
    const progressionDegree = progression?.[bar % progression.length];
    const startingIndex =
      progressionDegree === undefined
        ? bar % notes.length
        : SCALE_DEGREE_OFFSETS[progressionDegree]! % notes.length;
    for (let step = 0; step < notesPerBar; step += 1) {
      const noteNumber = notes[(startingIndex + step) % notes.length]!;
      events.push({
        deltaTime: 0,
        type: "noteOn",
        channel: 0,
        noteNumber,
        velocity: 72,
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
