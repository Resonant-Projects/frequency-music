const TITLE_LINE = /^#\s+(.+)/m;

export function extractTitle(bodyMd: string): string {
  const match = bodyMd.match(TITLE_LINE);
  return match ? match[1] : "Weekly Brief";
}

/** The body without the `# title` line `extractTitle` reads, so a page h1 is not repeated. */
export function bodyWithoutTitle(bodyMd: string): string {
  return bodyMd.replace(TITLE_LINE, "").replace(/^\s+/, "");
}

/** Non-empty trimmed lines of a block of text. */
export function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
