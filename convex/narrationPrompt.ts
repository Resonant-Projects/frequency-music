// Pure prompt builder and script parser for spoken narration. V8-safe: the
// Node action in narration.ts imports this; the calibration passage query
// lives here because a "use node" file cannot export queries.
import { internalQuery } from "./_generated/server";
import type { NarrationScript } from "./shared/mediaJobs";

export const NARRATION_PROMPT_VERSION = "narration.v1";
const WORDS_PER_MINUTE = 150;

export function buildNarrationPrompt(args: {
  kind: "weeklyBrief" | "docket" | "passage";
  bodyMd: string;
  targetMinutes: number;
  studioPrompts?: { tenMin: string; thirtyMin: string; ninetyMin: string };
}): { system: string; prompt: string } {
  const words = args.targetMinutes * WORDS_PER_MINUTE;
  const system = [
    "You write spoken-word scripts for a podcast narrator. Output plain prose only: no headers, no markdown, no lists, no links, no code, no asterisks.",
    'Speak numbers as a reader would ("four hundred and thirty-two hertz"). Speak ratios as "three to two".',
    "Separate paragraphs with a line containing only [pause].",
    "End with a line CHAPTERS followed by one line per chapter in the form <paragraph index>: <title>, starting at 0.",
  ].join(" ");
  const closing = args.studioPrompts
    ? `\n\nClose with a chapter titled Studio prompts that reads these three options aloud, each as one or two sentences:\nTen minutes: ${args.studioPrompts.tenMin}\nThirty minutes: ${args.studioPrompts.thirtyMin}\nNinety minutes: ${args.studioPrompts.ninetyMin}`
    : "";
  const sourceKind = args.kind === "weeklyBrief" ? "weekly brief" : args.kind;
  const prompt = `Turn the following ${sourceKind} into a script of about ${words} words (${args.targetMinutes} minutes at ${WORDS_PER_MINUTE} words per minute). Keep at most three experiment cards; state the stake of each in its first sentence. Mark every paragraph break with a line containing only [pause] and finish with the CHAPTERS block.${closing}\n\nSOURCE:\n${args.bodyMd}`;
  return { system, prompt };
}

const MARKDOWN_RESIDUE = /^(#{1,6}\s|[-*]\s|\d+\.\s|>|```)|\*\*|\[[^\]]+\]\(/m;
const CHAPTERS_MARKER = "\nCHAPTERS";

export function parseNarrationScript(text: string): NarrationScript {
  const marker = text.lastIndexOf(CHAPTERS_MARKER);
  if (marker < 0) throw new Error("script is missing the CHAPTERS block");
  const body = text.slice(0, marker).trim();
  const chapterLines = text
    .slice(marker + CHAPTERS_MARKER.length)
    .trim()
    .split("\n")
    .filter(Boolean);
  if (MARKDOWN_RESIDUE.test(body)) {
    throw new Error("script contains markdown residue");
  }
  const paragraphs = body
    .split(/\n\s*\[pause\]\s*\n/)
    .map((paragraph) => paragraph.replaceAll(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length === 0) throw new Error("script has no paragraphs");
  const chapters = chapterLines.map((line) => {
    const match = line.match(/^(\d+):\s*(.+)$/);
    const title = match?.[2]?.trim();
    if (!match || !title) throw new Error(`bad chapter line: ${line}`);
    const startParagraph = Number(match[1]);
    if (startParagraph >= paragraphs.length) {
      throw new Error(`chapter start ${startParagraph} beyond paragraphs`);
    }
    return { title, startParagraph };
  });
  if (chapters.length === 0) throw new Error("script has no chapters");
  return { paragraphs, chapters };
}

export function scriptWordCount(script: NarrationScript): number {
  return script.paragraphs.reduce(
    (sum, paragraph) => sum + paragraph.split(/\s+/).filter(Boolean).length,
    0,
  );
}

// Verbatim copy of media/fixtures/calibration-passage.md (trimmed); the test
// in narration.test.ts holds the two in sync. Every voice shootout renders
// this same passage so takes stay comparable across time.
export const CALIBRATION_PASSAGE = `Start by listening for beating. Play a low tone, and above it a fifth tuned pure, so the two waves lock together and the sound sits perfectly still. Now nudge the upper note down to the tempered fifth a piano uses, and listen again. Underneath the pitch you will hear a slow wobble, a pulse that swells and fades about once a second. That wobble is the beating, and it is the whole difference between the two tunings.
[pause]
Now notice what your body does with each one. On the pure fifth, many listeners feel the chest loosen and the breath lengthen, as if the room had settled. On the tempered fifth, the same listeners often report a faint tension in the jaw or the shoulders, a small readiness to correct something. Neither response is wrong. Stay with the sound long enough to tell which one you are having.
[pause]
Here are the numbers behind what you heard. A pure fifth is a ratio of three to two: for every three cycles of the upper note, the lower note completes two, and the pair repeats exactly. The tempered fifth is a hair narrower, by about two cents. If the lower note is concert A at four hundred and forty hertz, the pure fifth above it sits at six hundred and sixty hertz, while the tempered fifth lands just under that.

CHAPTERS
0: Beating
1: Body
2: Numbers`;

export const calibrationPassage = internalQuery({
  args: {},
  handler: () => parseNarrationScript(CALIBRATION_PASSAGE),
});
