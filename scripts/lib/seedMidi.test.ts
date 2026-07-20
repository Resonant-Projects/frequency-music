import { parseMidi } from "midi-file";
import { describe, expect, test } from "vite-plus/test";
import { generateSeedMidi } from "./seedMidi";
import type { CompositionParameter, TuningSpec } from "./tuning";

const tuning: TuningSpec = {
  kind: "ji",
  ratios: ["1/1", "9/8", "5/4", "3/2", "5/3", "2/1"],
};

const parameters: CompositionParameter[] = [
  { type: "tempo", value: "96 BPM", details: { bpm: 96 } },
  { type: "rootNote", value: "D4" },
  { type: "rhythm", value: "quarter notes" },
  { type: "chordProgression", value: "I-IV-V-I" },
];

describe("deterministic seed MIDI", () => {
  test("writes the requested tempo and only notes from the tuning palette", () => {
    const result = generateSeedMidi(parameters, tuning);
    const parsed = parseMidi(result.bytes);
    const events = parsed.tracks.flat();
    const tempo = events.find((event) => event.type === "setTempo");
    const notes = events.flatMap((event) =>
      event.type === "noteOn" && event.velocity > 0 ? [event.noteNumber] : [],
    );

    expect(tempo).toMatchObject({
      type: "setTempo",
      microsecondsPerBeat: 625_000,
    });
    expect(notes.length).toBeGreaterThan(0);
    expect(
      notes.every((note) => result.pitchClassPalette.includes(note % 12)),
    ).toBe(true);
    expect(result.bars).toBeGreaterThanOrEqual(8);
    expect(result.bars).toBeLessThanOrEqual(16);
  });

  test("is byte-for-byte deterministic for fixed input", () => {
    const first = generateSeedMidi(parameters, tuning);
    const second = generateSeedMidi(parameters, tuning);

    expect(first.bytes).toEqual(second.bytes);
  });

  test("reports the tempo, root, rhythm, and progression parameters as honored", () => {
    const result = generateSeedMidi(parameters, tuning);
    expect(result.honoredParameterIndexes).toEqual([0, 1, 2, 3]);
  });

  test("gives every repeated rhythm and progression parameter a figure", () => {
    const repeated: CompositionParameter[] = [
      { type: "rhythm", value: "quarter notes" },
      { type: "rhythm", value: "half notes" },
      { type: "chordProgression", value: "I" },
      { type: "chordProgression", value: "V" },
    ];
    const result = generateSeedMidi(repeated, tuning);
    const parsed = parseMidi(result.bytes);
    const noteLengths = new Set(
      parsed.tracks
        .flat()
        .flatMap((event) =>
          event.type === "noteOff" ? [event.deltaTime] : [],
        ),
    );
    const onlyLastProgression = generateSeedMidi([repeated[3]!], tuning);

    expect(noteLengths).toEqual(new Set([480, 960]));
    expect(result.bytes).not.toEqual(onlyLastProgression.bytes);
    expect(result.honoredParameterIndexes).toEqual([0, 1, 2, 3]);
  });
});
