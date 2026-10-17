import { parseMidi } from "midi-file";
import { describe, expect, test } from "vite-plus/test";
import { buildScores } from "../../media/src/engines/sc/score";
import {
  buildStudioKit,
  buildStudioPacket,
  DEFAULT_STUDIO_KITS,
  expandStudioNotes,
  sha256,
  STUDIO_TICKS_PER_BEAT,
  studioMidi,
  studioRenderPlan,
  type StudioKitDefinition,
} from "./studio-validation-kit";

function file(kit: ReturnType<typeof buildStudioKit>, name: string) {
  return kit.files.find((candidate) => candidate.path.endsWith(name))!.contents;
}

function text(kit: ReturnType<typeof buildStudioKit>, name: string): string {
  const contents = file(kit, name);
  if (typeof contents !== "string") throw new Error(`${name} is binary`);
  return contents;
}

/** Independent Scala reading: linear map, degree d of n at key m + k*n + d. */
function scalaHz(scl: string, kbm: string, key: number): number {
  const sclLines = scl
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("!"));
  const count = Number(sclLines[1]);
  const cents = sclLines.slice(2, 2 + count).map((line) => {
    if (line.includes("/")) {
      const [num, den] = line.split("/").map(Number);
      return 1200 * Math.log2(num! / den!);
    }
    return Number(line);
  });
  const kbmLines = kbm
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("!"));
  const [size, , , middle, reference, referenceHz, octaveDegree] =
    kbmLines.map(Number);
  const mapping = kbmLines.slice(7, 7 + size!).map(Number);
  const degreeCents = (target: number) => {
    const offset = target - middle!;
    const octave = Math.floor(offset / size!);
    const degree = mapping[offset - octave * size!]!;
    const period = cents[octaveDegree! - 1]!;
    return octave * period + (degree === 0 ? 0 : cents[degree - 1]!);
  };
  return (
    referenceHz! * 2 ** ((degreeCents(key) - degreeCents(reference!)) / 1200)
  );
}

describe("plan 11 studio validation kits", () => {
  test("the default packet is three admitted 30-second kits", () => {
    const packet = buildStudioPacket();
    expect(packet.kits.map((kit) => kit.slug)).toEqual([
      "edo19-432hz",
      "ji5-261.63hz",
      "edo12-440hz",
    ]);
    for (const kit of packet.kits) {
      expect(kit.plan.durationSecs).toBe(30);
      expect(kit.plan.normalize).toBe(true);
      expect(kit.plan.variable).toBeUndefined();
      expect(kit.notes.length).toBeGreaterThan(0);
      expect(Math.max(...kit.notes.map((note) => note.endSecs))).toBe(30);
    }
    expect(packet.manifest.map((entry) => entry.path)).toContain(
      "session-sheet.md",
    );
    expect(packet.manifest.map((entry) => entry.path)).toContain(
      "machine-render.mjs",
    );
    for (const entry of packet.manifest) {
      const written = packet.files.find(
        (candidate) => candidate.path === entry.path,
      );
      expect(entry.sha256).toBe(sha256(written!.contents));
    }
  });

  test("is deterministic", () => {
    expect(buildStudioPacket().manifest).toEqual(buildStudioPacket().manifest);
  });

  test.each(DEFAULT_STUDIO_KITS)(
    "$name matches the litmus renderer's expanded score",
    (definition) => {
      const plan = studioRenderPlan(definition);
      const [score] = buildScores(plan);
      const notes = expandStudioNotes(plan);
      expect(notes).toHaveLength(score!.notes.length);
      notes.forEach((note, index) => {
        const machine = score!.notes[index]!;
        expect(note.startSecs).toBeCloseTo(machine.start, 9);
        expect(note.endSecs).toBeCloseTo(machine.end, 9);
        expect(note.hz).toBe(machine.hz);
        expect(note.velocity / 127).toBe(machine.amplitude);
      });
    },
  );

  test.each(DEFAULT_STUDIO_KITS)(
    "$name scl and kbm sound every key at the renderer's Hz",
    (definition) => {
      const kit = buildStudioKit(definition);
      const scl = text(kit, "tuning.scl");
      const kbm = text(kit, "tuning.kbm");
      for (const note of kit.notes) {
        const hz = scalaHz(scl, kbm, note.key);
        // .scl stores EDO cents to five decimals: under 1e-5 cent of error.
        expect(Math.abs(1200 * Math.log2(hz / note.hz))).toBeLessThan(1e-4);
      }
    },
  );

  test.each(DEFAULT_STUDIO_KITS)(
    "$name MIDI carries every note at its exact key and beat",
    (definition) => {
      const kit = buildStudioKit(definition);
      const bytes = file(kit, "seed-degree.mid");
      if (typeof bytes === "string") throw new Error("MIDI must be binary");
      const midi = parseMidi(bytes);
      expect(midi.header.ticksPerBeat).toBe(STUDIO_TICKS_PER_BEAT);
      let tick = 0;
      const open = new Map<number, number>();
      const decoded: {
        key: number;
        start: number;
        end: number;
        velocity: number;
      }[] = [];
      const velocities = new Map<number, number>();
      let tempo = 0;
      for (const event of midi.tracks[0]!) {
        tick += event.deltaTime;
        if (event.type === "setTempo") tempo = event.microsecondsPerBeat;
        if (event.type === "noteOn" && event.velocity > 0) {
          open.set(event.noteNumber, tick);
          velocities.set(event.noteNumber, event.velocity);
        } else if (event.type === "noteOff") {
          decoded.push({
            key: event.noteNumber,
            start: open.get(event.noteNumber)!,
            end: tick,
            velocity: velocities.get(event.noteNumber)!,
          });
          open.delete(event.noteNumber);
        }
      }
      expect(open.size).toBe(0);
      expect(tempo).toBe(60_000_000 / definition.tempoBpm);
      expect(tick).toBe(
        ((definition.durationSecs * definition.tempoBpm) / 60) *
          STUDIO_TICKS_PER_BEAT,
      );
      decoded.sort((a, b) => a.start - b.start);
      expect(decoded).toEqual(
        kit.notes.map((note) => ({
          key: note.key,
          start: note.startBeat * STUDIO_TICKS_PER_BEAT,
          end: note.endBeat * STUDIO_TICKS_PER_BEAT,
          velocity: note.velocity,
        })),
      );
    },
  );

  test("the card states the reference pitch and fixed constraints", () => {
    const kit = buildStudioKit(DEFAULT_STUDIO_KITS[0]!);
    const card = text(kit, "card.md");
    expect(card).toContain("Key 60 must sound 432 Hz");
    expect(card).toContain("Duration: exactly 30 s");
    expect(card).toContain("No pitch modulation");
  });

  test("rejects unsafe slugs, duplicate slugs and unmappable keys", () => {
    const base = DEFAULT_STUDIO_KITS[0]!;
    expect(() => buildStudioKit({ ...base, slug: "../escape" })).toThrow(
      /Invalid kit slug/,
    );
    expect(() => buildStudioPacket([base, base])).toThrow(/unique/);
    const plan = studioRenderPlan(base);
    expect(() =>
      expandStudioNotes({
        ...plan,
        seed: [{ degree: 0, octave: 4, startBeat: 0, beats: 1, velocity: 72 }],
      }),
    ).toThrow(/outside MIDI keys/);
  });

  test("refuses overlapping notes on one key", () => {
    const definition: StudioKitDefinition = DEFAULT_STUDIO_KITS[2]!;
    const plan = {
      ...studioRenderPlan(definition),
      durationSecs: 2,
      seed: [
        { degree: 0, octave: 0, startBeat: 0, beats: 2, velocity: 72 },
        { degree: 0, octave: 0, startBeat: 1, beats: 2, velocity: 72 },
      ],
    };
    expect(() => studioMidi(plan, expandStudioNotes(plan), "overlap")).toThrow(
      /overlap on MIDI key 60/,
    );
  });
});
