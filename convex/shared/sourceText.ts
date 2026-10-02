// Pure cross-runtime check of whether captured source text is worth an
// Extraction. Feed excerpts and bot walls cost a model call and yield no
// claims: 92% of Nautilus teaser Extractions returned none (2026-10-02 audit).
import { looksLikeBotChallenge } from "./agentContract";

// Below this many words there is nothing to extract.
export const MIN_EXTRACTABLE_WORDS = 25;
// A truncated feed excerpt is short; full articles that end in an ellipsis are not.
const EXCERPT_MAX_WORDS = 150;
const EXCERPT_MARKERS = [
  // WordPress feed footer: "The post <title> appeared first on <site>."
  /\bThe post\b[\s\S]{1,300}\bappeared first on\b/i,
  /\b(?:continue|keep) reading\b/i,
  /\bread (?:the full|more)\b[^.]{0,40}$/i,
  /(?:\[\s*(?:…|\.\.\.|&hellip;)\s*\]|…|&hellip;|\.\.\.)\s*$/,
];

/** Why captured text should not be extracted, or null when it should. */
export function unextractableTextReason(text: string): string | null {
  const trimmed = text.trim();
  if (looksLikeBotChallenge(trimmed)) {
    return "Captured text is a bot wall or browser check, not the source.";
  }
  const prose = trimmed
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ");
  const words = prose.split(/\s+/).filter(Boolean).length;
  if (words < MIN_EXTRACTABLE_WORDS) {
    return `Captured text has only ${words} words.`;
  }
  if (
    words <= EXCERPT_MAX_WORDS &&
    EXCERPT_MARKERS.some((marker) => marker.test(trimmed))
  ) {
    return `Captured text is a ${words}-word feed excerpt; the full text was not captured.`;
  }
  return null;
}
