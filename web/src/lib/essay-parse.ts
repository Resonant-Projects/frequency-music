type Essay = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  dateLabel: string | null;
  dateValue: number | null;
  readTimeMinutes: number;
  wordCount: number;
};

/**
 * Everything the archive and related-essay lists need, minus the markdown body.
 * The body is loaded on demand so the 6.7 MB corpus never enters the entry
 * chunk; summaries are precomputed at build time (see the essay-index plugin in
 * `web/vite.config.ts`).
 */
type EssaySummary = Omit<Essay, "body">;

const monthPattern =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/;

// Images are stripped before links: the link pattern matches the `[alt](url)`
// tail of an image, so the other order leaves a stray `!` in the text.
export function stripMarkdown(input: string) {
  return input
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replaceAll(/^>\s?/gm, "")
    .replaceAll(/^#{1,6}\s+/gm, "")
    .replaceAll(/^\s*[-*+]\s+/gm, "")
    .replaceAll(/\*\*([^*]+)\*\*/g, "$1")
    .replaceAll(/\*([^*]+)\*/g, "$1")
    .replaceAll(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function parseDateLabel(value: string | null) {
  if (!value) return null;
  const match = value.match(monthPattern);
  if (!match) return null;
  const parsed = Date.parse(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

// A dateline is the first line under the title, wrapped in balanced italic or
// bold markers (`*…*`, `**…**`, `_…_`, `__…__`) around a calendar date, e.g.
// `**Essay #77 — March 29, 2026**` or `_Freq — May 9, 2026_`. A wrapped line
// without a month and year (`_A note from the 2026-05-25 pass._`) is prose.
const wrappedLinePattern = /^(\*{1,2}|_{1,2})(.+)\1$/;

function datelineLabel(line: string): string | null {
  const match = line.trim().match(wrappedLinePattern);
  if (!match) return null;
  const inner = match[2].trim();
  return monthPattern.test(inner) ? inner : null;
}

function extractExcerpt(markdown: string) {
  const blocks = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const candidate = blocks.find((block) => {
    if (block.startsWith("#")) return false;
    if (block.startsWith("---")) return false;
    if (block.startsWith("```")) return false;
    return true;
  });

  const excerpt = stripMarkdown(candidate ?? "");
  if (!excerpt) return "A new Frequency Music essay from the research archive.";
  if (excerpt.length <= 190) return excerpt;
  return `${excerpt.slice(0, 187).trimEnd()}...`;
}

/**
 * Splits a raw essay file into its title, dateline label, and markdown body
 * (everything after the title, the dateline, and an optional `---` rule).
 */
function splitEssay(raw: string) {
  const normalized = raw.replaceAll("\r", "");
  const lines = normalized.split("\n");
  const titleLine = lines.find((line) => line.trim().startsWith("# "));
  const title = titleLine?.replace(/^#\s+/, "").trim() ?? null;

  const titleIndex = lines.findIndex((line) => line === titleLine);
  const contentLines =
    titleIndex >= 0 ? lines.slice(titleIndex + 1) : [...lines];

  while (contentLines[0]?.trim() === "") contentLines.shift();

  const dateLabel = datelineLabel(contentLines[0] ?? "");
  if (dateLabel !== null) contentLines.shift();

  while (contentLines[0]?.trim() === "") contentLines.shift();
  if (contentLines[0]?.trim() === "---") {
    contentLines.shift();
  }
  while (contentLines[0]?.trim() === "") contentLines.shift();

  return { title, dateLabel, body: contentLines.join("\n").trim() };
}

/** The renderable markdown body of a raw essay file, as `parseEssay` returns it. */
export function essayBody(raw: string): string {
  return splitEssay(raw).body;
}

export function parseEssay(slug: string, raw: string): Essay {
  const { title, dateLabel, body } = splitEssay(raw);
  const plainText = stripMarkdown(body);
  const words = plainText ? plainText.split(/\s+/).length : 0;

  return {
    slug,
    title: title ?? slug,
    excerpt: extractExcerpt(body),
    body,
    dateLabel,
    dateValue: parseDateLabel(dateLabel),
    readTimeMinutes: Math.max(1, Math.ceil(words / 220)),
    wordCount: words,
  };
}

/** Newest first, undated entries last, ties broken by title. */
export function compareEssays(left: EssaySummary, right: EssaySummary) {
  if (left.dateValue !== null && right.dateValue !== null) {
    return right.dateValue - left.dateValue;
  }
  if (left.dateValue !== null) return -1;
  if (right.dateValue !== null) return 1;
  return left.title.localeCompare(right.title);
}

export function toEssaySummary(essay: Essay): EssaySummary {
  const { body: _body, ...summary } = essay;
  return summary;
}

export type { Essay, EssaySummary };
