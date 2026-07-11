#!/usr/bin/env -S vpx tsx
/**
 * Phase 2: Export essays as frontmattered markdown + manifest for the Astro blog.
 *
 * Reads docs/essays/*.md + docs/essays/metadata.json, writes to exports/blog/.
 * Pure transform - no AI calls, no network.
 *
 * Usage:
 *   bun scripts/export-essays.ts
 *   bun scripts/export-essays.ts --output-dir exports/blog
 */

import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseEssay, type ParsedEssay } from "./lib/parse-essay";

const ESSAYS_DIR = join(import.meta.dirname, "../docs/essays");
const METADATA_PATH = join(ESSAYS_DIR, "metadata.json");
const DEFAULT_OUTPUT_DIR = join(import.meta.dirname, "../exports/blog");
const MANIFEST_VERSION = "frequency_essays_v1";
const AUTHOR = "Keith Elliott";
const BYLINE = "Freq";

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
  const repoRelativePath = relative(resolve(import.meta.dirname, ".."), filePath);
  try {
    const result = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--format=%aI", "--", repoRelativePath],
      {
        encoding: "utf8",
        cwd: resolve(import.meta.dirname, ".."),
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
    if (!result) return null;
    const firstLine = result.split("\n")[0];
    return firstLine ? firstLine.slice(0, 10) : null;
  } catch {
    return null;
  }
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function buildFrontmatter(
  essay: ParsedEssay,
  meta: MetadataEntry,
  publishDate: string | null,
): string {
  const lines = ["---"];
  lines.push(`title: ${yamlString(essay.title)}`);
  if (publishDate) {
    lines.push(`publishDate: ${publishDate}`);
  }
  lines.push(`excerpt: ${yamlString(meta.excerpt)}`);
  lines.push(`category: ${yamlString(meta.category)}`);
  lines.push("tags:");
  for (const tag of meta.tags) {
    lines.push(`  - ${yamlString(tag)}`);
  }
  lines.push(`author: ${yamlString(AUTHOR)}`);
  lines.push(`byline: ${yamlString(BYLINE)}`);
  lines.push("---");
  return lines.join("\n");
}

function parseArgs(): { outputDir: string } {
  const args = process.argv.slice(2);
  let outputDir = DEFAULT_OUTPUT_DIR;
  for (let i = 0; i < args.length; i++) {
    const currentArg = args[i];
    const nextArg = args[i + 1];
    if (currentArg === "--output-dir" && nextArg) {
      outputDir = nextArg;
      i++;
    }
  }
  return { outputDir };
}

async function listEssayFiles(): Promise<string[]> {
  return (await readdir(ESSAYS_DIR))
    .filter((file) => file.endsWith(".md"))
    .toSorted();
}

async function main() {
  const { outputDir } = parseArgs();
  const resolvedOutputDir = resolve(outputDir);
  const essaysOutputDir = join(resolvedOutputDir, "essays");

  let metadata: Record<string, MetadataEntry>;
  try {
    metadata = JSON.parse(await readFile(METADATA_PATH, "utf8")) as Record<
      string,
      MetadataEntry
    >;
  } catch {
    console.error(
      "metadata.json not found. Run generate-essay-metadata.ts first.",
    );
    process.exit(1);
  }

  await rm(resolvedOutputDir, { recursive: true, force: true });
  await mkdir(essaysOutputDir, { recursive: true });

  const files = await listEssayFiles();
  const manifestItems: ManifestItem[] = [];
  const missingMetadata: string[] = [];

  for (const filename of files) {
    const filePath = join(ESSAYS_DIR, filename);
    const content = await readFile(filePath, "utf8");
    const essay = parseEssay(content, filename);
    if (essay.draft) {
      continue;
    }

    const meta = metadata[essay.slug];
    if (!meta) {
      missingMetadata.push(essay.slug);
      continue;
    }

    const publishDate = essay.publishDate ?? getGitDate(filePath);
    if (!publishDate) {
      console.warn(`Warning: no publish date found for ${essay.slug}`);
    }

    const frontmatter = buildFrontmatter(essay, meta, publishDate);
    const relativePath = `essays/${essay.slug}.md`;
    const outputMarkdown = `${frontmatter}\n\n${essay.body}\n`;
    await writeFile(
      join(resolvedOutputDir, relativePath),
      outputMarkdown,
      "utf8",
    );

    manifestItems.push({
      slug: essay.slug,
      path: relativePath,
      title: essay.title,
      publishDate,
      category: meta.category,
    });
  }

  manifestItems.sort((a, b) => {
    if (!a.publishDate && !b.publishDate) return 0;
    if (!a.publishDate) return 1;
    if (!b.publishDate) return -1;
    return b.publishDate.localeCompare(a.publishDate);
  });

  await writeFile(
    join(resolvedOutputDir, "manifest.json"),
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

  console.log(
    `Exported ${manifestItems.length} essays to ${resolvedOutputDir}/`,
  );

  if (missingMetadata.length > 0) {
    console.error(
      `\n${missingMetadata.length} essays skipped (no metadata): ${missingMetadata.join(", ")}`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
