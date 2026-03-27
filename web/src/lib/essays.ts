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

const monthPattern =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/;

const essayModules = import.meta.glob("../../../docs/essays/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function stripMarkdown(input: string) {
  return input
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replaceAll(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
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

function isMetadataLine(line: string) {
  const trimmed = line.trim();
  if (!/^\*.*\*$/.test(trimmed)) return false;
  const inner = trimmed.slice(1, -1).trim();
  return /\b20\d{2}\b/.test(inner);
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

function parseEssay(slug: string, raw: string): Essay {
  const normalized = raw.replaceAll("\r", "");
  const lines = normalized.split("\n");
  const titleLine = lines.find((line) => line.trim().startsWith("# "));
  const title = titleLine?.replace(/^#\s+/, "").trim() ?? slug;

  const titleIndex = lines.findIndex((line) => line === titleLine);
  let contentLines = titleIndex >= 0 ? lines.slice(titleIndex + 1) : [...lines];

  while (contentLines[0]?.trim() === "") contentLines.shift();

  let dateLabel: string | null = null;
  if (isMetadataLine(contentLines[0] ?? "")) {
    dateLabel = contentLines[0].trim().slice(1, -1).trim();
    contentLines.shift();
  }

  while (contentLines[0]?.trim() === "") contentLines.shift();
  if (contentLines[0]?.trim() === "---") {
    contentLines.shift();
  }
  while (contentLines[0]?.trim() === "") contentLines.shift();

  const body = contentLines.join("\n").trim();
  const plainText = stripMarkdown(body);
  const words = plainText ? plainText.split(/\s+/).length : 0;

  return {
    slug,
    title,
    excerpt: extractExcerpt(body),
    body,
    dateLabel,
    dateValue: parseDateLabel(dateLabel),
    readTimeMinutes: Math.max(1, Math.ceil(words / 220)),
    wordCount: words,
  };
}

export const essayLibrary = Object.entries(essayModules)
  .map(([path, raw]) => {
    const match = path.match(/\/([^/]+)\.md$/);
    const slug = match?.[1] ?? path;
    return parseEssay(slug, raw);
  })
  .toSorted((left, right) => {
    if (left.dateValue !== null && right.dateValue !== null) {
      return right.dateValue - left.dateValue;
    }
    if (left.dateValue !== null) return -1;
    if (right.dateValue !== null) return 1;
    return left.title.localeCompare(right.title);
  });

export function getEssayBySlug(slug: string) {
  return essayLibrary.find((essay) => essay.slug === slug) ?? null;
}

export type { Essay };
