#!/usr/bin/env -S vpx tsx
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

// oxlint-disable-next-line import/no-unassigned-import -- varlock populates process.env as a side effect.
import "varlock/auto-load";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { normalizeExcerpt } from "./lib/essay-metadata";
import { parseEssay } from "./lib/parse-essay";

const ESSAYS_DIR = join(import.meta.dirname, "../docs/essays");
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
    .describe(
      "1-2 sentence summary suitable for a blog card, under 200 characters",
    ),
  tags: z
    .array(z.enum(TAG_VOCABULARY))
    .describe("3-6 tags from the controlled vocabulary"),
  category: z.enum(CATEGORIES).describe("Single best-fit category"),
});

type EssayMetadataEntry = z.infer<typeof metadataSchema> & {
  contentHash: string;
  generatedAt: string;
};

type MetadataFile = Record<string, EssayMetadataEntry>;

function normalizeTags(tags: string[]): EssayMetadataEntry["tags"] {
  const uniqueTags = Array.from(
    new Set(
      tags.filter((tag): tag is EssayMetadataEntry["tags"][number] =>
        (TAG_VOCABULARY as readonly string[]).includes(tag),
      ),
    ),
  );

  if (uniqueTags.length < 3) {
    throw new Error(`Expected at least 3 valid tags, got ${uniqueTags.length}`);
  }

  return uniqueTags.slice(0, 6);
}

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
  // An unresolved varlock/1Password reference is still a non-empty string, so a
  // bare presence check would send `op://...` to OpenRouter and fail as a 401
  // far from the real cause. Reject the reference form explicitly.
  if (!apiKey || apiKey.startsWith("op(") || apiKey.startsWith("op://")) {
    console.error(
      "OPENROUTER_API_KEY must be resolved to a real key before running metadata generation",
    );
    process.exit(1);
  }

  const openrouter = createOpenRouter({ apiKey });
  const model = openrouter(MODEL_ID);

  const files = (await readdir(ESSAYS_DIR))
    .filter((f) => f.endsWith(".md"))
    .toSorted();
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

      const excerpt = normalizeExcerpt(output.excerpt);
      const tags = normalizeTags(output.tags);

      metadata[slug] = {
        excerpt,
        tags,
        category: output.category,
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
  for (const key of Object.keys(metadata).toSorted()) {
    const entry = metadata[key];
    if (entry) {
      sorted[key] = entry;
    }
  }

  await writeFile(
    METADATA_PATH,
    JSON.stringify(sorted, null, 2) + "\n",
    "utf8",
  );

  console.log(
    `\nDone. Processed: ${processed}, Skipped: ${skipped}, Failed: ${failures.length}`,
  );
  if (failures.length > 0) {
    console.error("Failures:", failures.join(", "));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
