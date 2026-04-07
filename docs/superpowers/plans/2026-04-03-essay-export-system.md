# Essay Export System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export 80 research essays from `docs/essays/` as blog posts to the Resonant Projects Astro website, with AI-generated excerpts and tags.

**Architecture:** Two-phase pipeline. Phase 1 (`generate-essay-metadata.ts`) runs Haiku via OpenRouter to produce excerpts/tags/categories, caching results in `metadata.json`. Phase 2 (`export-essays.ts`) merges parsed essay content with cached metadata into frontmattered markdown + manifest. An Astro loader in `rproj-website` consumes the export.

**Tech Stack:** Bun, AI SDK + OpenRouter (`@openrouter/ai-sdk-provider`), Astro 6 content loaders, `js-yaml`

**Spec:** `docs/superpowers/specs/2026-04-03-essay-export-system-design.md`

---

## File Structure

### frequency-music repo

| Action    | Path                                 | Responsibility                                               |
| --------- | ------------------------------------ | ------------------------------------------------------------ |
| Create    | `scripts/lib/parse-essay.ts`         | Parse essay markdown: title, date, draft, essay number, body |
| Create    | `scripts/generate-essay-metadata.ts` | Phase 1: AI summarization, writes `metadata.json`            |
| Create    | `scripts/export-essays.ts`           | Phase 2: Pure transform, writes `exports/blog/`              |
| Create    | `scripts/lib/parse-essay.test.ts`    | Tests for essay parser                                       |
| Generated | `docs/essays/metadata.json`          | AI-generated excerpts, tags, categories (hand-editable)      |
| Generated | `exports/blog/manifest.json`         | Index of all exported essays                                 |
| Generated | `exports/blog/essays/*.md`           | Frontmattered markdown for Astro                             |

### rproj-website repo

| Action | Path                                  | Responsibility                                          |
| ------ | ------------------------------------- | ------------------------------------------------------- |
| Create | `src/loaders/frequencyEssayLoader.ts` | Read manifest + markdown, feed into post collection     |
| Modify | `src/content/config.ts`               | Add essay loader to post collection, add `byline` field |

---

## Task 1: Essay Parser

**Files:**

- Create: `scripts/lib/parse-essay.ts`
- Create: `scripts/lib/parse-essay.test.ts`

### Step 1: Write failing tests for essay parser

- [ ] Create `scripts/lib/parse-essay.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { parseEssay } from "./parse-essay";

describe("parseEssay", () => {
  test("parses standard Freq byline with date", () => {
    const input = `# The Ground Note: Why Everything in Music Is Relative

*Freq — March 20, 2026*

---

## The Same Notes, Different Worlds

First paragraph here.`;

    const result = parseEssay(input, "the-ground-note.md");
    expect(result.title).toBe("The Ground Note: Why Everything in Music Is Relative");
    expect(result.slug).toBe("the-ground-note");
    expect(result.publishDate).toBe("2026-03-20");
    expect(result.draft).toBe(false);
    expect(result.essayNumber).toBeNull();
    expect(result.body).toStartWith("## The Same Notes, Different Worlds");
    expect(result.body).not.toContain("Freq —");
    expect(result.body).not.toContain("# The Ground Note");
  });

  test("parses reversed date format", () => {
    const input = `# Beyond the Integers

*February 25, 2026 — Freq*

## The Problem`;

    const result = parseEssay(input, "beyond-the-integers.md");
    expect(result.publishDate).toBe("2026-02-25");
  });

  test("parses By Freq dot format", () => {
    const input = `# The Comma Problem

*By Freq · February 21, 2026*

## Content`;

    const result = parseEssay(input, "the-comma-problem.md");
    expect(result.publishDate).toBe("2026-02-21");
  });

  test("parses Essay # format with italic", () => {
    const input = `# The Grain of Listening

*Essay #87 — April 2, 2026*

*On why perception keeps choosing the discrete.*

## Content`;

    const result = parseEssay(input, "the-grain-of-listening.md");
    expect(result.publishDate).toBe("2026-04-02");
    expect(result.essayNumber).toBe(87);
  });

  test("parses Essay # format with bold", () => {
    const input = `# Everything Is a Resonant Body

**Essay #80** — March 31, 2026

*How rooms and neural networks act as transfer functions.*

## Content`;

    const result = parseEssay(input, "everything-is-a-resonant-body.md");
    expect(result.publishDate).toBe("2026-03-31");
    expect(result.essayNumber).toBe(80);
  });

  test("parses bare date", () => {
    const input = `# The Spheres Revisited

*March 5, 2026*

## Content`;

    const result = parseEssay(input, "the-spheres-revisited.md");
    expect(result.publishDate).toBe("2026-03-05");
  });

  test("parses month-only date as first of month", () => {
    const input = `# The Grain of Identity

*Freq · March 2026*

## Content`;

    const result = parseEssay(input, "the-grain-of-identity.md");
    expect(result.publishDate).toBe("2026-03-01");
  });

  test("returns null date when no date found", () => {
    const input = `# The Color of Chaos: Why Music Lives at the Edge of Order

*Why do some sequences of notes feel alive while others feel dead?*

## The Spectrum of Randomness`;

    const result = parseEssay(input, "the-color-of-chaos.md");
    expect(result.publishDate).toBeNull();
  });

  test("respects draft: true frontmatter", () => {
    const input = `---
draft: true
---
# Some Draft Essay

*Freq — March 20, 2026*

## Content`;

    const result = parseEssay(input, "some-draft.md");
    expect(result.draft).toBe(true);
  });

  test("draft: false means published", () => {
    const input = `---
draft: false
---
# Published Essay

*Freq — March 20, 2026*

## Content`;

    const result = parseEssay(input, "published.md");
    expect(result.draft).toBe(false);
  });

  test("strips title, byline, and first separator from body", () => {
    const input = `# Title

*Freq — March 20, 2026*

---

## First Section

Paragraph.`;

    const result = parseEssay(input, "test.md");
    expect(result.body).toBe("## First Section\n\nParagraph.");
  });

  test("derives slug from filename", () => {
    const result = parseEssay("# Test\n\n## Body", "the-ground-note.md");
    expect(result.slug).toBe("the-ground-note");
  });
});
```

- [ ] Run tests to verify they fail:

```bash
bun test scripts/lib/parse-essay.test.ts
```

Expected: All tests fail — `parse-essay` module not found.

### Step 2: Implement essay parser

- [ ] Create `scripts/lib/parse-essay.ts`:

```typescript
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

function parseDate(line: string): { date: string | null; essayNumber: number | null } {
  // Strip markdown emphasis
  const clean = line.replace(/^\*{1,2}|\*{1,2}$/g, "").trim();

  // Extract essay number if present: "Essay #87" or "Essay #80"
  let essayNumber: number | null = null;
  const essayMatch = clean.match(/Essay\s*#(\d+)/i);
  if (essayMatch) {
    essayNumber = Number.parseInt(essayMatch[1], 10);
  }

  // Try full date: "Month DD, YYYY"
  const fullDateRe =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/i;
  const fullMatch = clean.match(fullDateRe);
  if (fullMatch) {
    const month = MONTHS[fullMatch[1].toLowerCase()];
    const day = fullMatch[2].padStart(2, "0");
    return { date: `${fullMatch[3]}-${month}-${day}`, essayNumber };
  }

  // Try month-only: "Month YYYY"
  const monthOnlyRe =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i;
  const monthMatch = clean.match(monthOnlyRe);
  if (monthMatch) {
    const month = MONTHS[monthMatch[1].toLowerCase()];
    return { date: `${monthMatch[2]}-${month}-01`, essayNumber };
  }

  return { date: null, essayNumber };
}

function extractFrontmatter(content: string): {
  draft: boolean;
  contentAfterFrontmatter: string;
} {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { draft: false, contentAfterFrontmatter: content };
  }
  const fmBlock = fmMatch[1];
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
    if (lines[i].startsWith("# ")) {
      title = lines[i].replace(/^#\s+/, "").trim();
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
    const line = lines[i].trim();
    if (line === "" || line === "---") continue;

    const parsed = parseDate(line);
    if (parsed.date !== null || parsed.essayNumber !== null) {
      publishDate = parsed.date;
      essayNumber = parsed.essayNumber;
      bylineEndIndex = i;
      break;
    }

    // Check if this is a non-date italic line (subtitle/dek) — keep searching
    if (line.startsWith("*") || line.startsWith("**")) {
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

  // Build body: skip title, byline area, and first --- separator
  let bodyStartIndex = bylineEndIndex + 1;

  // Skip blank lines and the first --- separator after the byline
  while (bodyStartIndex < lines.length) {
    const line = lines[bodyStartIndex].trim();
    if (line === "" || line === "---") {
      bodyStartIndex++;
      continue;
    }
    break;
  }

  // Also skip any dek/subtitle italic lines that come after the separator
  // but only if we already found a date (they're not the byline)
  if (publishDate !== null) {
    while (bodyStartIndex < lines.length) {
      const line = lines[bodyStartIndex].trim();
      if (line === "") {
        bodyStartIndex++;
        continue;
      }
      if (
        (line.startsWith("*") && line.endsWith("*") && !line.startsWith("* ")) ||
        (line.startsWith("**") && line.endsWith("**"))
      ) {
        // This is a dek/subtitle italic line after the separator — skip it
        bodyStartIndex++;
        continue;
      }
      break;
    }
  }

  const body = lines.slice(bodyStartIndex).join("\n").trim();

  return { title, slug, publishDate, draft, essayNumber, body };
}
```

- [ ] Run tests:

```bash
bun test scripts/lib/parse-essay.test.ts
```

Expected: All tests pass.

### Step 3: Commit

- [ ] Commit the parser and tests:

```bash
git add scripts/lib/parse-essay.ts scripts/lib/parse-essay.test.ts
git commit -m "feat: add essay markdown parser with date extraction and draft support"
```

---

## Task 2: AI Metadata Generation Script

**Files:**

- Create: `scripts/generate-essay-metadata.ts`

### Step 1: Write the metadata generation script

- [ ] Create `scripts/generate-essay-metadata.ts`:

```typescript
#!/usr/bin/env bun
/**
 * Phase 1: Generate AI excerpts, tags, and categories for essays.
 *
 * Runs incrementally — only processes essays not already in metadata.json
 * or whose content hash has changed.
 *
 * Usage:
 *   bun scripts/generate-essay-metadata.ts
 *   bun scripts/generate-essay-metadata.ts --force   # regenerate all
 */

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { parseEssay } from "./lib/parse-essay";

const ESSAYS_DIR = join(import.meta.dir, "../docs/essays");
const METADATA_PATH = join(ESSAYS_DIR, "metadata.json");
const MODEL_ID = "anthropic/claude-haiku-4.5";

const TAG_VOCABULARY = [
  "microtuning",
  "xenharmonic",
  "psychoacoustics",
  "wave-physics",
  "mathematical-music-theory",
  "sacred-geometry",
  "cymatics",
  "consciousness",
  "biofield",
  "sound-healing",
  "group-theory",
  "tuning-systems",
  "rhythm",
  "perception",
  "AI-music",
  "information-theory",
  "acoustics",
  "composition",
  "signal-processing",
  "temperament",
  "resonance",
  "geometry",
  "number-theory",
] as const;

const CATEGORIES = [
  "music-theory",
  "physics-of-sound",
  "mathematics",
  "perception",
  "composition",
  "interdisciplinary",
] as const;

const metadataSchema = z.object({
  excerpt: z
    .string()
    .describe("1-2 sentence summary suitable for a blog card, under 200 characters"),
  tags: z
    .array(z.enum(TAG_VOCABULARY))
    .min(3)
    .max(6)
    .describe("3-6 tags from the controlled vocabulary"),
  category: z.enum(CATEGORIES).describe("Single best-fit category"),
});

type EssayMetadataEntry = z.infer<typeof metadataSchema> & {
  contentHash: string;
  generatedAt: string;
};

type MetadataFile = Record<string, EssayMetadataEntry>;

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function loadMetadata(): Promise<MetadataFile> {
  try {
    const raw = await readFile(METADATA_PATH, "utf8");
    return JSON.parse(raw) as MetadataFile;
  } catch {
    return {};
  }
}

async function main() {
  const force = process.argv.includes("--force");

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY env var is required");
    process.exit(1);
  }

  const openrouter = createOpenRouter({ apiKey });
  const model = openrouter(MODEL_ID);

  const files = (await readdir(ESSAYS_DIR)).filter((f) => f.endsWith(".md"));
  const metadata = await loadMetadata();

  let processed = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const filename of files) {
    const content = await readFile(join(ESSAYS_DIR, filename), "utf8");
    const hash = contentHash(content);
    const slug = filename.replace(/\.md$/, "");

    // Skip if unchanged and not forced
    if (!force && metadata[slug]?.contentHash === hash) {
      skipped++;
      continue;
    }

    const parsed = parseEssay(content, filename);
    if (parsed.draft) {
      skipped++;
      continue;
    }

    console.log(`Generating metadata for: ${parsed.title}`);

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: metadataSchema }),
        prompt: `Analyze this research essay and generate metadata.\n\nTitle: ${parsed.title}\n\n${parsed.body}`,
        system: `You are a metadata generator for a music research blog called Frequency. The blog explores connections between music, physics, mathematics, and geometry. Generate a concise excerpt, relevant tags, and a category for the given essay. The excerpt should be compelling and informative, suitable for a blog card preview.`,
      });

      if (!output) {
        throw new Error("No structured output returned");
      }

      metadata[slug] = {
        ...output,
        contentHash: hash,
        generatedAt: new Date().toISOString(),
      };
      processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED: ${slug} — ${message}`);
      failures.push(slug);
    }
  }

  // Sort keys alphabetically for stable output
  const sorted: MetadataFile = {};
  for (const key of Object.keys(metadata).sort()) {
    sorted[key] = metadata[key];
  }

  await writeFile(METADATA_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");

  console.log(`\nDone. Processed: ${processed}, Skipped: ${skipped}, Failed: ${failures.length}`);
  if (failures.length > 0) {
    console.error("Failures:", failures.join(", "));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
```

### Step 2: Smoke-test with a single essay

- [ ] Run on a single real essay to verify it works end-to-end:

```bash
bun scripts/generate-essay-metadata.ts
```

Expected: Processes all essays without cached metadata. Creates `docs/essays/metadata.json` with entries.

- [ ] Verify the output:

```bash
bun -e "const m = await Bun.file('docs/essays/metadata.json').json(); const keys = Object.keys(m); console.log('Entries:', keys.length); console.log('Sample:', JSON.stringify(m[keys[0]], null, 2))"
```

Expected: Entry count close to 80 (minus drafts/failures). Each entry has `excerpt`, `tags`, `category`, `contentHash`, `generatedAt`.

### Step 3: Verify incremental behavior

- [ ] Run again — should skip everything:

```bash
bun scripts/generate-essay-metadata.ts
```

Expected: Output shows `Processed: 0, Skipped: ~80`.

### Step 4: Commit

- [ ] Commit:

```bash
git add scripts/generate-essay-metadata.ts
git commit -m "feat: add AI metadata generation for essays (Haiku via OpenRouter)"
```

Note: Do NOT commit `docs/essays/metadata.json` yet — review it first in Task 3.

---

## Task 3: Review and Commit Metadata

This is a manual review step.

### Step 1: Review generated metadata

- [ ] Spot-check 5-10 entries in `docs/essays/metadata.json`:

```bash
bun -e "
const m = await Bun.file('docs/essays/metadata.json').json();
const keys = Object.keys(m);
// Show 5 random entries
for (let i = 0; i < 5; i++) {
  const k = keys[Math.floor(Math.random() * keys.length)];
  console.log(k + ':', JSON.stringify(m[k], null, 2));
  console.log('---');
}
"
```

Check that:

- Excerpts are coherent and under ~200 chars
- Tags are from the controlled vocabulary
- Categories make sense

### Step 2: Hand-edit if needed

- [ ] Fix any bad entries directly in `docs/essays/metadata.json`. The `contentHash` field means re-running `generate-essay-metadata.ts` won't overwrite your edits (as long as the essay source hasn't changed).

### Step 3: Commit metadata

- [ ] Commit:

```bash
git add docs/essays/metadata.json
git commit -m "data: add AI-generated essay metadata (excerpts, tags, categories)"
```

---

## Task 4: Export Script

**Files:**

- Create: `scripts/export-essays.ts`

### Step 1: Write the export script

- [ ] Create `scripts/export-essays.ts`:

```typescript
#!/usr/bin/env bun
/**
 * Phase 2: Export essays as frontmattered markdown + manifest for the Astro blog.
 *
 * Reads docs/essays/*.md + docs/essays/metadata.json, writes to exports/blog/.
 * Pure transform — no AI calls, no network.
 *
 * Usage:
 *   bun scripts/export-essays.ts
 *   bun scripts/export-essays.ts --output-dir exports/blog
 */

import { execSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEssay, type ParsedEssay } from "./lib/parse-essay";

const ESSAYS_DIR = join(import.meta.dir, "../docs/essays");
const METADATA_PATH = join(ESSAYS_DIR, "metadata.json");
const DEFAULT_OUTPUT_DIR = join(import.meta.dir, "../exports/blog");
const MANIFEST_VERSION = "frequency_essays_v1";

type MetadataEntry = {
  excerpt: string;
  tags: string[];
  category: string;
  contentHash: string;
  generatedAt: string;
};

type ManifestItem = {
  slug: string;
  path: string;
  title: string;
  publishDate: string | null;
  category: string;
};

function getGitDate(filePath: string): string | null {
  try {
    const result = execSync(`git log --diff-filter=A --format=%aI -- "${filePath}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!result) return null;
    // Take first line, extract YYYY-MM-DD
    return result.split("\n")[0].slice(0, 10);
  } catch {
    return null;
  }
}

function buildFrontmatter(
  essay: ParsedEssay,
  meta: MetadataEntry,
  publishDate: string | null,
): string {
  const lines = ["---"];
  lines.push(`title: ${JSON.stringify(essay.title)}`);
  if (publishDate) lines.push(`publishDate: ${publishDate}`);
  lines.push(`excerpt: ${JSON.stringify(meta.excerpt)}`);
  lines.push(`category: ${meta.category}`);
  lines.push("tags:");
  for (const tag of meta.tags) {
    lines.push(`  - ${tag}`);
  }
  lines.push("author: Keith Elliott");
  lines.push("byline: Freq");
  lines.push("---");
  return lines.join("\n");
}

function parseArgs(): { outputDir: string } {
  const args = process.argv.slice(2);
  let outputDir = DEFAULT_OUTPUT_DIR;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    }
  }
  return { outputDir };
}

async function main() {
  const { outputDir } = parseArgs();
  const essaysOutputDir = join(outputDir, "essays");

  // Load metadata
  let metadata: Record<string, MetadataEntry>;
  try {
    metadata = JSON.parse(await readFile(METADATA_PATH, "utf8"));
  } catch {
    console.error("metadata.json not found. Run generate-essay-metadata.ts first.");
    process.exit(1);
  }

  // Clean and recreate output
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(essaysOutputDir, { recursive: true });

  const files = (await readdir(ESSAYS_DIR)).filter((f) => f.endsWith(".md"));
  const manifestItems: ManifestItem[] = [];
  const warnings: string[] = [];

  for (const filename of files) {
    const content = await readFile(join(ESSAYS_DIR, filename), "utf8");
    const essay = parseEssay(content, filename);

    if (essay.draft) continue;

    const meta = metadata[essay.slug];
    if (!meta) {
      warnings.push(essay.slug);
      continue;
    }

    // Resolve date: parsed from essay > git fallback > null
    const publishDate = essay.publishDate ?? getGitDate(join(ESSAYS_DIR, filename));

    if (!publishDate) {
      console.warn(`  Warning: no date for ${essay.slug}`);
    }

    const frontmatter = buildFrontmatter(essay, meta, publishDate);
    const outputMarkdown = `${frontmatter}\n\n${essay.body}\n`;

    const relativePath = `essays/${essay.slug}.md`;
    await writeFile(join(outputDir, relativePath), outputMarkdown, "utf8");

    manifestItems.push({
      slug: essay.slug,
      path: relativePath,
      title: essay.title,
      publishDate,
      category: meta.category,
    });
  }

  // Sort manifest by date descending (nulls last)
  manifestItems.sort((a, b) => {
    if (!a.publishDate && !b.publishDate) return 0;
    if (!a.publishDate) return 1;
    if (!b.publishDate) return -1;
    return b.publishDate.localeCompare(a.publishDate);
  });

  await writeFile(
    join(outputDir, "manifest.json"),
    JSON.stringify(
      {
        version: MANIFEST_VERSION,
        generatedAt: new Date().toISOString(),
        items: manifestItems,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`Exported ${manifestItems.length} essays to ${outputDir}/`);

  if (warnings.length > 0) {
    console.error(`\n${warnings.length} essays skipped (no metadata): ${warnings.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
```

### Step 2: Run the export

- [ ] Run:

```bash
bun scripts/export-essays.ts
```

Expected: Creates `exports/blog/manifest.json` and `exports/blog/essays/*.md`. Logs count.

### Step 3: Verify output

- [ ] Check manifest:

```bash
bun -e "const m = await Bun.file('exports/blog/manifest.json').json(); console.log('Version:', m.version); console.log('Count:', m.items.length); console.log('First:', m.items[0])"
```

- [ ] Check a sample exported essay:

```bash
head -20 exports/blog/essays/the-ground-note.md
```

Expected: YAML frontmatter with title, publishDate, excerpt, category, tags, author, byline. Body starts with first content section (no H1, no byline, no separator).

### Step 4: Commit

- [ ] Commit:

```bash
git add scripts/export-essays.ts
git commit -m "feat: add essay export script (markdown + manifest for Astro)"
```

Note: Do NOT commit the `exports/blog/` output — it's a generated artifact. Add `exports/blog/` to `.gitignore` if not already ignored.

### Step 5: Update .gitignore

- [ ] Check and update `.gitignore`:

```bash
grep -q "exports/blog" .gitignore || echo "exports/blog/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore generated blog exports"
```

---

## Task 5: Frequency Essay Loader (rproj-website)

**Files:**

- Create: `src/loaders/frequencyEssayLoader.ts` (in rproj-website)

### Step 1: Write the essay loader

- [ ] Create `/Users/kelliott/code/rproj-website/src/loaders/frequencyEssayLoader.ts`:

```typescript
import type { Loader } from "astro/loaders";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { load as loadYaml } from "js-yaml";

type EssayManifestItem = {
  slug: string;
  path: string;
  title: string;
  publishDate: string | null;
  category: string;
};

type EssayManifest = {
  version: "frequency_essays_v1";
  generatedAt: string;
  items: EssayManifestItem[];
};

type ManifestSource =
  | { mode: "remote"; manifestUrl: URL; contentBaseUrl: URL; manifest: EssayManifest }
  | { mode: "local"; baseDir: string; manifest: EssayManifest };

const DEFAULT_LOCAL_EXPORT_DIR = resolve(process.cwd(), "../frequency-music/exports/blog");

function parseManifest(raw: string): EssayManifest {
  const parsed = JSON.parse(raw) as Partial<EssayManifest>;
  if (parsed.version !== "frequency_essays_v1" || !Array.isArray(parsed.items)) {
    throw new Error("Essay manifest is missing the frequency_essays_v1 contract.");
  }
  return parsed as EssayManifest;
}

function parseMarkdownDocument(source: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Essay markdown file is missing frontmatter.");
  }
  return {
    frontmatter: loadYaml(match[1] ?? "") as Record<string, unknown>,
    body: match[2] ?? "",
  };
}

async function fetchText(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadManifestSource(): Promise<ManifestSource | null> {
  const manifestUrl = process.env.ESSAY_MANIFEST_URL;
  if (manifestUrl) {
    const manifestLocation = new URL(manifestUrl);
    const contentBaseUrl = process.env.ESSAY_CONTENT_BASE_URL
      ? new URL(process.env.ESSAY_CONTENT_BASE_URL)
      : new URL("./", manifestLocation);
    const manifest = parseManifest(await fetchText(manifestLocation));
    return { mode: "remote", manifestUrl: manifestLocation, contentBaseUrl, manifest };
  }

  const localBaseDir = process.env.ESSAY_LOCAL_EXPORT_DIR ?? DEFAULT_LOCAL_EXPORT_DIR;
  const manifestPath = join(localBaseDir, "manifest.json");

  let manifestRaw: string;
  try {
    manifestRaw = await readFile(manifestPath, "utf8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }

  return { mode: "local", baseDir: localBaseDir, manifest: parseManifest(manifestRaw) };
}

async function loadMarkdownEntry(
  source: ManifestSource,
  relativePath: string,
): Promise<{ raw: string; fileUrl?: URL }> {
  if (source.mode === "remote") {
    const url = new URL(relativePath, source.contentBaseUrl);
    return { raw: await fetchText(url), fileUrl: url };
  }
  const filePath = join(source.baseDir, relativePath);
  return { raw: await readFile(filePath, "utf8"), fileUrl: pathToFileURL(filePath) };
}

export function frequencyEssayLoader(): Loader {
  return {
    name: "frequency-essay-loader",
    load: async (context) => {
      const source = await loadManifestSource();

      if (!source) {
        context.logger.warn(
          "No essay manifest found. Set ESSAY_MANIFEST_URL or run export-essays.ts in frequency-music.",
        );
        return;
      }

      for (const item of source.manifest.items) {
        try {
          const { raw, fileUrl } = await loadMarkdownEntry(source, item.path);
          const { frontmatter, body } = parseMarkdownDocument(raw);
          const parsedData = await context.parseData({
            id: `essay/${item.slug}`,
            data: frontmatter,
          });
          const rendered = await context.renderMarkdown(body, { fileURL: fileUrl });
          context.store.set({
            id: `essay/${item.slug}`,
            data: parsedData,
            body,
            digest: context.generateDigest(raw),
            rendered,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          context.logger.error(`Failed to load essay ${item.slug}: ${message}`);
        }
      }
    },
  };
}
```

### Step 2: Commit

- [ ] Commit in rproj-website:

```bash
cd /Users/kelliott/code/rproj-website
git add src/loaders/frequencyEssayLoader.ts
git commit -m "feat: add frequency essay loader for blog posts"
```

---

## Task 6: Integrate Essay Loader into Post Collection (rproj-website)

**Files:**

- Modify: `/Users/kelliott/code/rproj-website/src/content/config.ts`
- Create: `/Users/kelliott/code/rproj-website/src/loaders/mergeLoaders.ts`

### Step 1: Create the mergeLoaders helper

- [ ] Create `/Users/kelliott/code/rproj-website/src/loaders/mergeLoaders.ts`:

```typescript
import type { Loader } from "astro/loaders";

/**
 * Runs multiple loaders sequentially into the same content store.
 */
export function mergeLoaders(...loaders: Loader[]): Loader {
  return {
    name: loaders.map((l) => l.name).join("+"),
    load: async (context) => {
      for (const loader of loaders) {
        await loader.load(context);
      }
    },
  };
}
```

### Step 2: Update content config

- [ ] Modify `/Users/kelliott/code/rproj-website/src/content/config.ts`:

Add imports at the top (after existing imports):

```typescript
import { frequencyEssayLoader } from "../loaders/frequencyEssayLoader";
import { mergeLoaders } from "../loaders/mergeLoaders";
```

Replace the `postCollection` definition:

```typescript
const postCollection = defineCollection({
  loader: mergeLoaders(
    glob({ pattern: ["**/*.md", "**/*.mdx"], base: "src/content/post" }),
    frequencyEssayLoader(),
  ),
  schema: ({ image }) =>
    z.object({
      publishDate: z.date().optional(),
      updateDate: z.date().optional(),
      draft: z.boolean().optional(),

      title: z.string(),
      excerpt: z.string().optional(),
      image: image().optional(),

      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      author: z.string().optional(),
      byline: z.string().optional(),

      metadata: metadataDefinition(),
    }),
});
```

The only change to the schema is adding `byline: z.string().optional()`.

### Step 3: Verify the Astro build

- [ ] Run the Astro dev server to check for errors:

```bash
cd /Users/kelliott/code/rproj-website
bun run dev
```

Expected: Dev server starts. If essay manifest exists locally, essays load without errors. If not, a warning is logged but the site still works.

### Step 4: Commit

- [ ] Commit in rproj-website:

```bash
cd /Users/kelliott/code/rproj-website
git add src/loaders/mergeLoaders.ts src/content/config.ts
git commit -m "feat: integrate frequency essays into post collection via mergeLoaders"
```

---

## Task 7: End-to-End Verification

### Step 1: Run the full pipeline

- [ ] From frequency-music, run both phases:

```bash
cd /Users/kelliott/code/frequency-music
bun scripts/generate-essay-metadata.ts
bun scripts/export-essays.ts
```

### Step 2: Verify Astro picks up the essays

- [ ] Start the rproj-website dev server:

```bash
cd /Users/kelliott/code/rproj-website
bun run dev
```

- [ ] Check that essays appear in the blog listing page. The exact URL depends on the site's routing but is likely `/blog` or `/`.

### Step 3: Spot-check rendering

- [ ] Navigate to an individual essay post (e.g., `/blog/essay/the-ground-note` or similar). Verify:
  - Title renders correctly
  - Byline shows "Freq"
  - Date is correct
  - Body markdown renders properly
  - Tags/category display if the template supports them
