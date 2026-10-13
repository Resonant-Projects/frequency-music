import {
  expandRenderPlan,
  RENDER_LIMITS,
} from "../../../../convex/shared/renderPlan";
import { prepareDegreeToHz } from "../../../../convex/shared/tuning";

export const SCORE_LEAD_SECS = 0.01;
// Leave a finite guard band below 48 kHz Nyquist for the fourth partial.
// This is specific to the four-partial synth, not the shared pitch contract.
export const MAX_LITMUS_FUNDAMENTAL_HZ = 5999;
export const MAX_CONCURRENT_VOICES = 4096;
export const SC_BLOCK_SIZE = 64;
const RELEASE_SECS = 0.3;
// Count two extra blocks conservatively for gate/free scheduling granularity.
const VOICE_TAIL_SECS = RELEASE_SECS + (2 * SC_BLOCK_SIZE) / 48000;

/** Only trusted local paths use this quoting function. Plan strings never
 * become language source. Escape SC interpolation as well as string syntax. */
export function scString(value: string): string {
  if (/[\x00-\x1f\x7f]/.test(value))
    throw new Error("Control character in SC path");
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("#", "\\#")}"`;
}

export function buildScores(input: unknown) {
  const members = expandRenderPlan(input);
  return members.map((member) => {
    const hz = prepareDegreeToHz(member.tuning, member.referenceHz);
    // Check every seed mapping, even a note beyond the truncated study end.
    for (const event of member.seed) {
      if (hz(event.degree, event.octave) > MAX_LITMUS_FUNDAMENTAL_HZ)
        throw new Error(
          `Litmus fundamental exceeds ${MAX_LITMUS_FUNDAMENTAL_HZ} Hz four-partial limit`,
        );
    }
    const cycle = Math.max(
      ...member.seed.map(
        (event) => ((event.startBeat + event.beats) * 60) / member.tempoBpm,
      ),
    );
    const notes = [];
    for (let loop = 0; loop < Math.ceil(member.durationSecs / cycle); loop++) {
      for (const event of member.seed) {
        const start = loop * cycle + (event.startBeat * 60) / member.tempoBpm;
        if (start >= member.durationSecs) continue;
        if (notes.length >= RENDER_LIMITS.maxExpandedEvents)
          throw new Error("Expanded score exceeds 8192 notes");
        notes.push(
          Object.freeze({
            start,
            end: Math.min(
              start + (event.beats * 60) / member.tempoBpm,
              member.durationSecs,
            ),
            hz: hz(event.degree, event.octave),
            amplitude: event.velocity / 127,
          }),
        );
      }
    }
    const voiceEdges = notes
      .flatMap((note) => [
        { time: note.start, delta: 1 },
        { time: note.end + VOICE_TAIL_SECS, delta: -1 },
      ])
      .sort((a, b) => a.time - b.time || b.delta - a.delta);
    let voices = 0;
    let maxConcurrentVoices = 0;
    for (const edge of voiceEdges) {
      voices += edge.delta;
      maxConcurrentVoices = Math.max(maxConcurrentVoices, voices);
    }
    if (maxConcurrentVoices > MAX_CONCURRENT_VOICES)
      throw new Error(
        `Litmus exceeds ${MAX_CONCURRENT_VOICES} concurrent voices including release tails`,
      );
    // A power-of-two node table, including the root group in addition to synths.
    const maxNodes = 2 ** Math.ceil(Math.log2(maxConcurrentVoices + 1));
    const messages = notes
      .flatMap((note, index) => [
        {
          time: note.start + SCORE_LEAD_SECS,
          order: 1,
          text: `[\\s_new, \\frequencyLitmus, ${1000 + index}, 0, 0, \\freq, ${note.hz}, \\amp, ${note.amplitude}]`,
        },
        {
          time: note.end + SCORE_LEAD_SECS,
          order: 0,
          text: `[\\n_set, ${1000 + index}, \\gate, 0]`,
        },
      ])
      .sort((a, b) => a.time - b.time || a.order - b.order);
    return Object.freeze({
      member,
      maxConcurrentVoices,
      maxNodes,
      notes: Object.freeze(notes),
      /** synthSource must be the bundled litmus.scd, never caller code. */
      source(synthSource: string, scorePath: string) {
        return `${synthSource}\nScore([\n[0, [\\d_recv, ~litmus.asBytes]],\n${messages.map((message) => `[${message.time}, ${message.text}],`).join("\n")}\n[${member.durationSecs + SCORE_LEAD_SECS}, [\\c_set, 0, 0]]\n]).write(${scString(scorePath)});\n0.exit;\n`;
      },
    });
  });
}
