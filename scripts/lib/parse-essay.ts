export type ParsedEssay = {
  title: string;
  slug: string;
  publishDate: string | null;
  draft: boolean;
  essayNumber: number | null;
  body: string;
};

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function parseDate(line: string): {
  date: string | null;
  essayNumber: number | null;
} {
  // Strip markdown emphasis (asterisks or underscores)
  const clean = line.replaceAll(/^[*_]{1,2}|[*_]{1,2}$/g, "").trim();

  // Extract essay number if present: "Essay #87" or "Essay #80"
  let essayNumber: number | null = null;
  const essayMatch = clean.match(/Essay\s*#(\d+)/i);
  if (essayMatch) {
    const essayNumberRaw = essayMatch[1];
    if (essayNumberRaw) {
      essayNumber = Number.parseInt(essayNumberRaw, 10);
    }
  }

  // Try full date: "Month DD, YYYY"
  const fullDateRe =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/i;
  const fullMatch = clean.match(fullDateRe);
  if (fullMatch) {
    const monthName = fullMatch[1];
    const dayRaw = fullMatch[2];
    const year = fullMatch[3];
    if (monthName && dayRaw && year) {
      const month = MONTHS[monthName.toLowerCase()];
      const day = dayRaw.padStart(2, "0");
      return { date: `${year}-${month}-${day}`, essayNumber };
    }
  }

  // Try month-only: "Month YYYY"
  const monthOnlyRe =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i;
  const monthMatch = clean.match(monthOnlyRe);
  if (monthMatch) {
    const monthName = monthMatch[1];
    const year = monthMatch[2];
    if (monthName && year) {
      const month = MONTHS[monthName.toLowerCase()];
      return { date: `${year}-${month}-01`, essayNumber };
    }
  }

  return { date: null, essayNumber };
}

function isEmphasisLine(line: string): boolean {
  const t = line.trim();
  return (
    (t.startsWith("*") && t.endsWith("*") && !t.startsWith("* ")) ||
    (t.startsWith("**") && t.endsWith("**")) ||
    (t.startsWith("_") && t.endsWith("_") && !t.startsWith("_ ")) ||
    (t.startsWith("__") && t.endsWith("__"))
  );
}

function extractFrontmatter(content: string): {
  draft: boolean;
  contentAfterFrontmatter: string;
} {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { draft: false, contentAfterFrontmatter: content };
  }
  const fmBlock = fmMatch[1] ?? "";
  const draft = /^\s*draft\s*:\s*true\s*$/m.test(fmBlock);
  return { draft, contentAfterFrontmatter: fmMatch[2] ?? "" };
}

export function parseEssay(content: string, filename: string): ParsedEssay {
  const slug = filename.replace(/\.mdx?$/, "");
  const { draft, contentAfterFrontmatter } = extractFrontmatter(content);

  const lines = contentAfterFrontmatter.split("\n");

  // Parse title from first H1
  let title = slug;
  let titleLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    if (currentLine?.startsWith("# ")) {
      title = currentLine.replace(/^#\s+/, "").trim();
      titleLineIndex = i;
      break;
    }
  }

  // Look for date in lines after the title (check up to 5 lines)
  let publishDate: string | null = null;
  let essayNumber: number | null = null;
  let bylineEndIndex = titleLineIndex;

  const searchStart = titleLineIndex + 1;
  const searchEnd = Math.min(searchStart + 6, lines.length);

  for (let i = searchStart; i < searchEnd; i++) {
    const line = lines[i]?.trim();
    if (line === undefined) break;
    if (line === "" || line === "---") continue;

    const parsed = parseDate(line);
    if (parsed.date !== null || parsed.essayNumber !== null) {
      publishDate = parsed.date;
      essayNumber = parsed.essayNumber;
      bylineEndIndex = i;
      break;
    }

    // Check if this is a non-date italic line (subtitle/dek) — keep searching
    if (isEmphasisLine(line)) {
      // Could be a dek line; check if it contains a date
      const dekParsed = parseDate(line);
      if (dekParsed.date !== null || dekParsed.essayNumber !== null) {
        publishDate = dekParsed.date;
        essayNumber = dekParsed.essayNumber;
        bylineEndIndex = i;
        break;
      }
      // Non-date italic line — it's a subtitle, skip past it
      bylineEndIndex = i;
      continue;
    }

    // Non-empty, non-italic, non-separator line — stop searching
    break;
  }

  // Build body: skip title, byline area, subtitle/dek lines, and the first separator.
  let bodyStartIndex = bylineEndIndex + 1;

  while (bodyStartIndex < lines.length) {
    const line = lines[bodyStartIndex]?.trim();
    if (line === undefined) break;
    if (line === "" || line === "---") {
      bodyStartIndex++;
      continue;
    }

    // If we already found a byline/date, any immediately following emphasis line
    // is treated as a subtitle/dek rather than body content.
    if (publishDate !== null && isEmphasisLine(line)) {
      bodyStartIndex++;
      continue;
    }

    break;
  }

  const body = lines.slice(bodyStartIndex).join("\n").trim();

  return { title, slug, publishDate, draft, essayNumber, body };
}
