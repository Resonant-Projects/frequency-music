#!/usr/bin/env bun

/**
 * Ingest books (free PDFs) and arXiv papers
 *
 * Usage:
 *   bun run scripts/ingest-books-papers.ts [--books] [--arxiv] [--feeds]
 */

import { readFileSync } from "node:fs";
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
const dataPath = join(import.meta.dir, "../data/books-and-papers.json");
const sourceData = JSON.parse(readFileSync(dataPath, "utf-8"));

// Jina Reader for fetching content
async function fetchText(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  console.log(`  Fetching via Jina: ${url.slice(0, 60)}...`);

  const resp = await fetch(jinaUrl, {
    headers: { Accept: "text/plain" },
  });

  if (!resp.ok) {
    throw new Error(`Jina fetch failed: ${resp.status}`);
  }

  return (await resp.text()).trim();
}

// Ingest a book or paper
async function ingestSource(
  item: {
    title: string;
    author?: string;
    url: string;
    pdf?: string;
    topics?: string[];
    category?: string;
  },
  type: "book" | "arxiv",
): Promise<boolean> {
  const dedupeKey =
    type === "arxiv"
      ? `arxiv:${item.url.split("/").pop()}`
      : `book:${item.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  // Check if exists
  const existing = await client.query(api.sources.getByDedupeKey, {
    dedupeKey,
  });
  if (existing) {
    console.log(`  Already exists: ${item.title}`);
    return false;
  }

  let fullText = "";
  const fetchUrl = item.pdf || item.url;

  try {
    fullText = await fetchText(fetchUrl);
  } catch (err) {
    console.error(`  Failed to fetch: ${err}`);
    fullText = `${item.title}\n\nAuthor: ${item.author || "Unknown"}\nTopics: ${(item.topics || []).join(", ")}`;
  }

  const result = await client.mutation(api.sources.create, {
    type: "pdf",
    title: item.title,
    author: item.author,
    canonicalUrl: item.url,
    rawText: fullText.length > 100 ? fullText.slice(0, 200000) : undefined,
    dedupeKey,
    topics: item.topics || [],
    metadata: {
      category: item.category,
      sourceType: type,
      pdfUrl: item.pdf,
    },
  });

  if (!result.created) {
    console.log(`  Already exists (dedupe): ${item.title}`);
    return false;
  }

  console.log(`  ✓ Ingested (${fullText.length} chars): ${item.title}`);
  return true;
}

// Add RSS feeds for journals/arxiv
async function addFeeds(): Promise<void> {
  console.log("\n--- Adding Journal/ArXiv RSS Feeds ---");

  const feeds = [
    // Open journals
    {
      name: "Music Theory Online",
      url: "https://mtosmt.org/mto.xml",
      type: "rss" as const,
    },
    // ArXiv categories
    {
      name: "arXiv: Sound (cs.SD)",
      url: "https://arxiv.org/rss/cs.SD",
      type: "rss" as const,
    },
    {
      name: "arXiv: Audio & Speech (eess.AS)",
      url: "https://arxiv.org/rss/eess.AS",
      type: "rss" as const,
    },
    // Journal of Mathematics and Music
    {
      name: "Journal of Mathematics and Music",
      url: "https://www.tandfonline.com/feed/rss/tmam20",
      type: "rss" as const,
    },
  ];

  const existingFeeds = await client.query(api.feeds.list);

  for (const feed of feeds) {
    const exists = existingFeeds.some((f: any) => f.url === feed.url);
    if (exists) {
      console.log(`  Already exists: ${feed.name}`);
      continue;
    }

    try {
      await client.mutation(api.feeds.create, {
        name: feed.name,
        url: feed.url,
        type: feed.type,
        category: "academic",
        metadata: { source: "books-and-papers.json" },
      });
      console.log(`  ✓ Added: ${feed.name}`);
    } catch (err) {
      console.error(`  Failed to add ${feed.name}: ${err}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doBooks = args.length === 0 || args.includes("--books");
  const doArxiv = args.length === 0 || args.includes("--arxiv");
  const doFeeds = args.length === 0 || args.includes("--feeds");

  console.log("=== Books & Papers Ingestion ===\n");
  console.log(
    `Options: books=${doBooks}, arxiv=${doArxiv}, feeds=${doFeeds}\n`,
  );

  let ingested = 0;
  let skipped = 0;

  // Free PDF books
  if (doBooks) {
    console.log("--- Processing Free PDF Books ---");
    for (const book of sourceData.books.free_pdfs) {
      console.log(`\nProcessing: ${book.title}`);
      const success = await ingestSource(book, "book");
      if (success) ingested++;
      else skipped++;
      await new Promise((r) => setTimeout(r, 1000)); // Rate limit
    }
  }

  // ArXiv papers
  if (doArxiv) {
    console.log("\n--- Processing ArXiv Papers ---");
    for (const paper of sourceData.arxiv_papers) {
      console.log(`\nProcessing: ${paper.title}`);
      const success = await ingestSource(paper, "arxiv");
      if (success) ingested++;
      else skipped++;
      await new Promise((r) => setTimeout(r, 1000)); // Rate limit
    }
  }

  // RSS feeds
  if (doFeeds) {
    await addFeeds();
  }

  console.log(`\n=== Complete ===`);
  console.log(`Ingested: ${ingested}, Skipped: ${skipped}`);
}

main().catch(console.error);
