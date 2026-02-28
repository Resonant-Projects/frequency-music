#!/usr/bin/env bun

/**
 * Ingest Robert Edward Grant's papers and articles
 *
 * Downloads PDFs, extracts text, and ingests into Convex
 *
 * Usage:
 *   bun run scripts/ingest-robert-grant.ts [--pdfs] [--articles] [--youtube]
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Load environment
const envPath = join(import.meta.dir, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const [key, ...vals] = line.split("=");
  if (key && vals.length) {
    // Strip quotes from value
    let value = vals.join("=").trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    env[key.trim()] = value;
  }
}

const CONVEX_URL = env.CONVEX_SELF_HOSTED_URL || env.CONVEX_URL;
if (!CONVEX_URL) throw new Error("Missing CONVEX_URL");

const client = new ConvexHttpClient(CONVEX_URL);

// Load source data
const sourcesPath = join(
  import.meta.dir,
  "../data/robert-edward-grant-sources.json",
);
const sourceData = JSON.parse(readFileSync(sourcesPath, "utf-8"));

// PDF storage directory
const pdfDir = join(import.meta.dir, "../data/pdfs/robert-grant");
if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true });

// Jina Reader API for web articles
async function fetchArticleText(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  console.log(`  Fetching via Jina: ${url}`);

  const resp = await fetch(jinaUrl, {
    headers: { Accept: "text/plain" },
  });

  if (!resp.ok) {
    throw new Error(`Jina fetch failed: ${resp.status}`);
  }

  return resp.text();
}

// Download and extract PDF text using Jina Reader (works with PDF URLs)
async function fetchPdfText(pdfUrl: string, filename: string): Promise<string> {
  // Jina Reader can parse PDFs directly
  const jinaUrl = `https://r.jina.ai/${pdfUrl}`;
  console.log(`  Fetching PDF via Jina: ${filename}`);

  const resp = await fetch(jinaUrl, {
    headers: { Accept: "text/plain" },
  });

  if (!resp.ok) {
    throw new Error(`Jina PDF fetch failed: ${resp.status}`);
  }

  return (await resp.text()).trim();
}

// Generate dedupe key
function dedupeKey(type: "pdf" | "url", id: string): string {
  return `${type}:${id}`;
}

// Ingest a single source
async function ingestSource(
  source: {
    title: string;
    url: string;
    pdf?: string;
    topics?: string[];
    category?: string;
  },
  type: "pdf" | "article",
): Promise<boolean> {
  const key = dedupeKey(type === "pdf" ? "pdf" : "url", source.url);

  // Check if already exists
  const existing = await client.query(api.sources.getByDedupeKey, {
    dedupeKey: key,
  });
  if (existing) {
    console.log(`  Already exists: ${source.title}`);
    return false;
  }

  let fullText = "";

  try {
    if (type === "pdf" && source.pdf) {
      // PDF source - download and extract text
      const filename = `${source.title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`;
      fullText = await fetchPdfText(source.pdf, filename);
    } else {
      // Web article - fetch via Jina
      fullText = await fetchArticleText(source.url);
    }
  } catch (err) {
    console.error(`  Failed to fetch text: ${err}`);
    // Still ingest with minimal text
    fullText = `${source.title}\n\nTopics: ${(source.topics || []).join(", ")}`;
  }

  // Create source (use mutation args matching convex/sources.ts)
  const result = await client.mutation(api.sources.create, {
    type: type === "pdf" ? "pdf" : "url",
    title: source.title,
    canonicalUrl: source.url,
    rawText: fullText.length > 100 ? fullText.slice(0, 200000) : undefined,
    dedupeKey: key,
    topics: source.topics || [],
    metadata: {
      author: "Robert Edward Grant",
      category: source.category || "research",
      pdfUrl: source.pdf,
    },
  });

  if (!result.created) {
    console.log(`  Already exists (dedupe): ${source.title}`);
    return false;
  }

  console.log(`  ✓ Ingested with ${fullText.length} chars: ${source.title}`);

  return true;
}

// Add YouTube feed
async function addYouTubeFeed(): Promise<void> {
  const feed = sourceData.youtube;

  const existing = await client.query(api.feeds.list);
  const hasGrant = existing.some((f: any) =>
    f.url.includes("UC2MN4AlpbY9NYxuYH-ecoCQ"),
  );

  if (hasGrant) {
    console.log("YouTube feed already exists");
    return;
  }

  await client.mutation(api.feeds.create, {
    name: "Robert Edward Grant",
    url: feed.rss,
    type: "youtube",
    metadata: {
      channelUrl: feed.channel,
      author: "Robert Edward Grant",
    },
  });

  console.log("✓ Added Robert Edward Grant YouTube feed");
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const doPdfs = args.length === 0 || args.includes("--pdfs");
  const doArticles = args.length === 0 || args.includes("--articles");
  const doYoutube = args.length === 0 || args.includes("--youtube");

  console.log("=== Robert Edward Grant Source Ingestion ===\n");
  console.log(
    `Options: pdfs=${doPdfs}, articles=${doArticles}, youtube=${doYoutube}\n`,
  );

  let ingested = 0;
  let skipped = 0;

  // Process papers (PDFs)
  if (doPdfs) {
    console.log("--- Processing Papers (PDFs) ---");
    for (const paper of sourceData.papers) {
      console.log(`\nProcessing: ${paper.title}`);
      const success = await ingestSource(paper, "pdf");
      if (success) ingested++;
      else skipped++;

      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Process web articles
  if (doArticles) {
    console.log("\n--- Processing Web Articles ---");
    for (const article of sourceData.articles) {
      console.log(`\nProcessing: ${article.title}`);
      const success = await ingestSource(article, "article");
      if (success) ingested++;
      else skipped++;

      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Add YouTube feed
  if (doYoutube) {
    console.log("\n--- Adding YouTube Feed ---");
    await addYouTubeFeed();
  }

  console.log(`\n=== Complete ===`);
  console.log(`Ingested: ${ingested}, Skipped: ${skipped}`);
}

main().catch(console.error);
