import { writeMidi, type MidiData, type MidiEvent } from "midi-file";
import {
  tuningIntervalsInCents,
  type CompositionParameter,
  type TuningSpec,
} from "./tuning";
import { generateSeedEvents } from "../../convex/shared/tuning/seedEvents";
export {
  generateSeedEvents,
  isSeedParameter,
} from "../../convex/shared/tuning/seedEvents";
export type {
  SeedEvent,
  SeedEventGeneration,
} from "../../convex/shared/tuning/seedEvents";

export interface SeedMidiGeneration {
  bytes: Uint8Array;
  bars: number;
  tempoBpm: number;
  rootMidi: number;
  pitchClassPalette: number[];
  honoredParameterIndexes: number[];
}

const TICKS_PER_BEAT = 480;

/** Lossy compatibility export: round cents to the nearest semitone, fold pitch
 * classes into the root octave, and wrap notes above 127 down one octave.
 * Unlike the old class-palette generator, never merge native events. Thus
 * microtonal seeds can contain repeated MIDI pitches and have new MIDI bytes.
 * Exact pitch rendering must use the native events and degreeToHz instead. */
export function generateSeedMidi(
  parameters: CompositionParameter[],
  tuning: TuningSpec,
): SeedMidiGeneration {
  const seed = generateSeedEvents(parameters, tuning);
  const { bars, tempoBpm, rootMidi } = seed;
  const intervals = tuningIntervalsInCents(tuning);
  const palette = [
    ...new Set([
      rootMidi % 12,
      ...intervals.map(
        (cents) => (((rootMidi + Math.round(cents / 100)) % 12) + 12) % 12,
      ),
    ]),
  ];
  const degreeCents = [0, ...intervals.slice(0, -1)];
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

  for (const event of seed.events) {
    const distance =
      ((Math.round(degreeCents[event.degree]! / 100) % 12) + 12) % 12;
    const pitch = rootMidi + distance;
    const noteNumber = pitch > 127 ? pitch - 12 : pitch;
    events.push({
      deltaTime: 0,
      type: "noteOn",
      channel: 0,
      noteNumber,
      velocity: event.velocity,
    });
    events.push({
      deltaTime: Math.round(event.beats * TICKS_PER_BEAT),
      type: "noteOff",
      channel: 0,
      noteNumber,
      velocity: 0,
    });
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
    honoredParameterIndexes: seed.honoredParameterIndexes,
  };
}
