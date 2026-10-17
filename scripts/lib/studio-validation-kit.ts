import { createHash } from "node:crypto";
import { writeMidi, type MidiData, type MidiEvent } from "midi-file";
import {
  admitRenderPlan,
  type RenderPlanSnapshot,
} from "../../convex/shared/renderPlan";
import {
  generateSeedEvents,
  octaveDegreeCents,
  prepareDegreeToHz,
  toScl,
  type TuningSpec,
} from "../../convex/shared/tuning";

/**
 * Plan 11 studio validation packet (render ladder §2, steps 2 to 4). Pure
 * builders: no network, environment, Convex, or credential access. A kit gives
 * the machine renderer and Keith's studio pass the same admitted render plan,
 * the same expanded note list, and exact per-note pitch.
 *
 * The starter kit's `seed.mid` is a lossy 12-TET export by design. The studio
 * kit instead writes a degree-native MIDI file: key = middle + octave * n +
 * degree, with a Scala keyboard mapping whose reference key sounds the plan's
 * `referenceHz`. Any `.scl`/`.kbm` or MTS-ESP host then plays each note at
 * exactly the frequency the litmus renderer uses.
 */

export interface StudioKitDefinition {
  slug: string;
  name: string;
  tuning: TuningSpec;
  referenceHz: number;
  tempoBpm: number;
  durationSecs: number;
}

/** The three bounded kits rendered by the 2026-10-13 SuperCollider smoke run
 * (media/src/engines/sc/README.md), lengthened to the plan 11 30-second floor. */
export const DEFAULT_STUDIO_KITS: readonly StudioKitDefinition[] =
  Object.freeze([
    {
      slug: "edo19-432hz",
      name: "19-EDO at 432 Hz",
      tuning: { kind: "edo", divisions: 19 },
      referenceHz: 432,
      tempoBpm: 120,
      durationSecs: 30,
    },
    {
      slug: "ji5-261.63hz",
      name: "5-limit JI at 261.63 Hz",
      tuning: {
        kind: "ji",
        ratios: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
      },
      referenceHz: 261.63,
      tempoBpm: 120,
      durationSecs: 30,
    },
    {
      slug: "edo12-440hz",
      name: "12-EDO at 440 Hz",
      tuning: { kind: "edo", divisions: 12 },
      referenceHz: 440,
      tempoBpm: 120,
      durationSecs: 30,
    },
  ]);

/** MIDI key that sounds degree 0, octave 0 (the plan's referenceHz). */
export const STUDIO_MIDDLE_KEY = 60;
/** 960 PPQ holds the render contract's 1/64-beat grid exactly. Only a study
 * boundary that is off that grid is rounded; notes.csv keeps exact times. */
export const STUDIO_TICKS_PER_BEAT = 960;
const SLUG = /^[a-z0-9][a-z0-9.-]{0,63}$/;

export interface StudioNote {
  index: number;
  startBeat: number;
  endBeat: number;
  startSecs: number;
  endSecs: number;
  degree: number;
  octave: number;
  key: number;
  hz: number;
  velocity: number;
}

export interface StudioKitFile {
  path: string;
  contents: string | Uint8Array;
}

export interface BuiltStudioKit {
  slug: string;
  name: string;
  plan: RenderPlanSnapshot;
  notes: StudioNote[];
  files: StudioKitFile[];
}

/** The admitted baseline plan both renders share. Seed events come from the
 * shared generator with no recipe parameters (8 bars of quarter notes). */
export function studioRenderPlan(kit: StudioKitDefinition): RenderPlanSnapshot {
  return admitRenderPlan({
    version: 1,
    engine: "sc-litmus",
    tuning: kit.tuning,
    referenceHz: kit.referenceHz,
    normalize: true,
    seed: generateSeedEvents([], kit.tuning).events,
    tempoBpm: kit.tempoBpm,
    durationSecs: kit.durationSecs,
  });
}

/** Expand the plan exactly as media/src/engines/sc/score.ts `buildScores`
 * does: loop at the latest seed end, drop notes starting at or after the
 * duration, and cut sustained notes at the study boundary. */
export function expandStudioNotes(plan: RenderPlanSnapshot): StudioNote[] {
  const hz = prepareDegreeToHz(plan.tuning, plan.referenceHz);
  const degreeCount = octaveDegreeCents(plan.tuning).length;
  const secsPerBeat = 60 / plan.tempoBpm;
  // Second values use buildScores' exact expressions: `x * (60 / bpm)` rounds
  // differently and can admit or drop a note at the duration boundary.
  const cycleSecs = Math.max(
    ...plan.seed.map(
      (event) => ((event.startBeat + event.beats) * 60) / plan.tempoBpm,
    ),
  );
  const cycleBeats = cycleSecs / secsPerBeat;
  const notes: StudioNote[] = [];
  for (let loop = 0; loop < Math.ceil(plan.durationSecs / cycleSecs); loop++) {
    for (const event of plan.seed) {
      const startSecs =
        loop * cycleSecs + (event.startBeat * 60) / plan.tempoBpm;
      if (startSecs >= plan.durationSecs) continue;
      const endSecs = Math.min(
        startSecs + (event.beats * 60) / plan.tempoBpm,
        plan.durationSecs,
      );
      const key = STUDIO_MIDDLE_KEY + event.octave * degreeCount + event.degree;
      if (key < 0 || key > 127) {
        throw new Error(
          `Degree ${event.degree}, octave ${event.octave} maps outside MIDI keys 0 to 127.`,
        );
      }
      notes.push({
        index: notes.length,
        startBeat: loop * cycleBeats + event.startBeat,
        endBeat: endSecs / secsPerBeat,
        startSecs,
        endSecs,
        degree: event.degree,
        octave: event.octave,
        key,
        hz: hz(event.degree, event.octave),
        velocity: event.velocity,
      });
    }
  }
  return notes;
}

/** Linear Scala keyboard mapping: the middle key is degree 0 and sounds
 * referenceHz; every key above or below steps one scale degree. */
export function studioKbm(plan: RenderPlanSnapshot): string {
  const degreeCount = octaveDegreeCents(plan.tuning).length;
  return [
    "! tuning.kbm",
    `! Studio validation mapping: key ${STUDIO_MIDDLE_KEY} is degree 0 at ${plan.referenceHz} Hz`,
    "! Size of map",
    String(degreeCount),
    "! First MIDI note number to retune",
    "0",
    "! Last MIDI note number to retune",
    "127",
    "! Middle note (scale degree 0)",
    String(STUDIO_MIDDLE_KEY),
    "! Reference note",
    String(STUDIO_MIDDLE_KEY),
    "! Reference frequency",
    plan.referenceHz.toFixed(6),
    "! Formal octave degree",
    String(degreeCount),
    "! Mapping",
    ...Array.from({ length: degreeCount }, (_, index) => String(index)),
    "",
  ].join("\n");
}

function ticks(beats: number): number {
  return Math.round(beats * STUDIO_TICKS_PER_BEAT);
}

/** Type 0 MIDI of the expanded study, one channel, degree-native keys. */
export function studioMidi(
  plan: RenderPlanSnapshot,
  notes: readonly StudioNote[],
  name: string,
): Uint8Array {
  const byKey = new Map<number, StudioNote>();
  for (const note of notes.toSorted((a, b) => a.startBeat - b.startBeat)) {
    const previous = byKey.get(note.key);
    if (previous && previous.endBeat > note.startBeat) {
      throw new Error(
        `Notes ${previous.index} and ${note.index} overlap on MIDI key ${note.key}; one MIDI channel cannot represent that.`,
      );
    }
    byKey.set(note.key, note);
  }
  // At one tick: earlier notes release, then attacks, then the release of a
  // note shorter than one tick (the renderer keeps a boundary note that
  // starts a rounding error before the duration), so every attack pairs.
  const timeline = notes
    .flatMap((note) => {
      const start = ticks(note.startBeat);
      const end = ticks(note.endBeat);
      return [
        { tick: start, order: 1, on: true, note },
        { tick: end, order: end === start ? 2 : 0, on: false, note },
      ];
    })
    .toSorted((a, b) => a.tick - b.tick || a.order - b.order);
  const events: MidiEvent[] = [
    { deltaTime: 0, meta: true, type: "trackName", text: name },
    {
      deltaTime: 0,
      meta: true,
      type: "setTempo",
      microsecondsPerBeat: Math.round(60_000_000 / plan.tempoBpm),
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
  let cursor = 0;
  for (const { tick, on, note } of timeline) {
    events.push(
      on
        ? {
            deltaTime: tick - cursor,
            type: "noteOn",
            channel: 0,
            noteNumber: note.key,
            velocity: note.velocity,
          }
        : {
            deltaTime: tick - cursor,
            type: "noteOff",
            channel: 0,
            noteNumber: note.key,
            velocity: 0,
          },
    );
    cursor = tick;
  }
  const endTick = ticks((plan.durationSecs * plan.tempoBpm) / 60);
  events.push({
    deltaTime: Math.max(0, endTick - cursor),
    meta: true,
    type: "endOfTrack",
  });
  const midi: MidiData = {
    header: { format: 0, numTracks: 1, ticksPerBeat: STUDIO_TICKS_PER_BEAT },
    tracks: [events],
  };
  return Uint8Array.from(writeMidi(midi));
}

export function notesCsv(notes: readonly StudioNote[]): string {
  return [
    "index,start_secs,end_secs,start_beat,end_beat,degree,octave,midi_key,hz,velocity",
    ...notes.map((note) =>
      [
        note.index,
        note.startSecs.toFixed(6),
        note.endSecs.toFixed(6),
        note.startBeat,
        note.endBeat,
        note.degree,
        note.octave,
        note.key,
        note.hz.toFixed(6),
        note.velocity,
      ].join(","),
    ),
    "",
  ].join("\n");
}

function kitCard(
  kit: StudioKitDefinition,
  plan: RenderPlanSnapshot,
  notes: readonly StudioNote[],
): string {
  const keys = [...new Set(notes.map((note) => note.key))].toSorted(
    (a, b) => a - b,
  );
  const pitchRows = keys.map((key) => {
    const note = notes.find((candidate) => candidate.key === key)!;
    return `| ${key} | ${note.degree} | ${note.octave} | ${note.hz.toFixed(4)} |`;
  });
  return [
    `# Studio validation kit: ${kit.name}`,
    "",
    "Plan 11 human-versus-machine comparison. The machine render and your",
    "studio render must play the same notes at the same pitches and times;",
    "only the sound design may differ.",
    "",
    "## Fixed constraints",
    "",
    `- Duration: exactly ${plan.durationSecs} s. Tempo ${plan.tempoBpm} BPM, 4/4.`,
    `- Notes: ${notes.length}, from \`seed-degree.mid\` (also listed in \`notes.csv\`). Do not edit, quantize, humanize, transpose or add notes.`,
    `- Pitch: load \`tuning.scl\` and \`tuning.kbm\` (directly or through MTS-ESP). Key ${STUDIO_MIDDLE_KEY} must sound ${plan.referenceHz} Hz. Check one held note with a tuner against the table below before recording.`,
    "- No pitch modulation: no vibrato, detune, unison spread, chorus, pitch envelope, glide or pitch-shifting effects.",
    "- Delivery: 48 kHz, 24-bit stereo WAV, integrated loudness -18 LUFS within 0.5 LU, true peak at most -1 dBTP. Reach the target with gain rather than limiting, as the machine render does.",
    "- Use one instrument and patch for all three kits. Record the instrument, patch and any effects in `provenance.md`.",
    "",
    "## Free choice",
    "",
    "Instrument, timbre, envelopes, and time-based effects that do not change pitch (for example a short room reverb).",
    "",
    "## Pitch table (keys used)",
    "",
    "| MIDI key | Degree | Octave | Hz |",
    "| --- | --- | --- | --- |",
    ...pitchRows,
    "",
  ].join("\n");
}

const PROVENANCE_TEMPLATE = [
  "# Studio render provenance",
  "",
  "- Kit slug:",
  "- Rendered by:",
  "- Date (UTC):",
  "- Host / DAW and version:",
  "- Instrument and patch:",
  "- Tuning method (Scala .scl/.kbm in instrument, MTS-ESP Master, other):",
  "- Effects (none, or list):",
  "- Tuner check (key, measured Hz):",
  "- Measured integrated LUFS / true peak:",
  "- File name and SHA-256:",
  "",
].join("\n");

export function buildStudioKit(kit: StudioKitDefinition): BuiltStudioKit {
  if (!SLUG.test(kit.slug)) throw new Error(`Invalid kit slug: ${kit.slug}`);
  const plan = studioRenderPlan(kit);
  const notes = expandStudioNotes(plan);
  const files: StudioKitFile[] = [
    {
      path: "render-plan.json",
      contents: `${JSON.stringify(plan, null, 2)}\n`,
    },
    {
      path: "tuning.scl",
      contents: toScl(plan.tuning, `${kit.name} (studio validation kit)`),
    },
    { path: "tuning.kbm", contents: studioKbm(plan) },
    { path: "seed-degree.mid", contents: studioMidi(plan, notes, kit.name) },
    { path: "notes.csv", contents: notesCsv(notes) },
    { path: "card.md", contents: kitCard(kit, plan, notes) },
    { path: "provenance.md", contents: PROVENANCE_TEMPLATE },
  ];
  return {
    slug: kit.slug,
    name: kit.name,
    plan,
    notes,
    files: files.map((file) => ({ ...file, path: `${kit.slug}/${file.path}` })),
  };
}

export function sha256(contents: string | Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

/** Session sheet for the blind A/B. Ratings use the listeningSessions 0 to 5
 * subjective scales; the machine score `consonanceComputed` is excluded. */
export const SESSION_SHEET = [
  "# Blind listening sheet (plan 11 step 3)",
  "",
  "Fill one block per kit. Someone other than the listener, or a script,",
  "assigns A and B; record the mapping only after all ratings are written.",
  "",
  "- Listener:",
  "- Date and time of day:",
  "- Listening method (headphones, monitors, car, phone speaker):",
  "",
  "| Kit | Label | bodilyPleasantness | goosebumps | perceivedConsonance | musicality | easeOfComposability | expandability | Notes |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  "| | A | | | | | | | |",
  "| | B | | | | | | | |",
  "",
  "For each kit, also answer: were your ratings about the tuning (the",
  "hypothesis variable) or about the sound (render quality)? Name the",
  "features you were reacting to.",
  "",
  "Mapping revealed after rating (A = machine | studio):",
  "",
].join("\n");

// Runs inside the published media image (see docs/plan11-studio-validation-packet.md):
// renders each kit's render-plan.json with the production litmus renderer.
export const MACHINE_RENDER_DRIVER = `// Usage inside the media image, from /app/media:
//   node_modules/.bin/tsx /packet/machine-render.mjs /packet /out
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const { renderLocal } = await import("/app/media/src/engines/sc/index.ts");
const [packet, out] = process.argv.slice(2);
const summary = [];
for (const entry of (await readdir(packet, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  const plan = JSON.parse(await readFile(join(packet, entry.name, "render-plan.json"), "utf8"));
  await mkdir(join(out, entry.name), { recursive: true });
  const tempRoot = join(out, ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const rendered = await renderLocal(plan, { tempRoot });
  try {
    const [member] = rendered.artifacts;
    await copyFile(member.master, join(out, entry.name, "machine-master.wav"));
    await copyFile(member.delivery, join(out, entry.name, "machine-delivery.mp3"));
    summary.push({ kit: entry.name, durationSecs: member.durationSecs });
  } finally {
    await rendered.dispose();
  }
}
console.log(JSON.stringify(summary, null, 2));
`;

export interface StudioPacket {
  kits: BuiltStudioKit[];
  files: StudioKitFile[];
  manifest: { path: string; bytes: number; sha256: string }[];
}

export function buildStudioPacket(
  kits: readonly StudioKitDefinition[] = DEFAULT_STUDIO_KITS,
): StudioPacket {
  const slugs = new Set(kits.map((kit) => kit.slug));
  if (slugs.size !== kits.length) throw new Error("Kit slugs must be unique.");
  const built = kits.map(buildStudioKit);
  const files: StudioKitFile[] = [
    ...built.flatMap((kit) => kit.files),
    { path: "session-sheet.md", contents: SESSION_SHEET },
    { path: "machine-render.mjs", contents: MACHINE_RENDER_DRIVER },
  ];
  const manifest = files.map((file) => ({
    path: file.path,
    bytes:
      typeof file.contents === "string"
        ? Buffer.byteLength(file.contents)
        : file.contents.byteLength,
    sha256: sha256(file.contents),
  }));
  return { kits: built, files, manifest };
}
