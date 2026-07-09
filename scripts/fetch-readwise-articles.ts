#!/usr/bin/env bun
/**
 * Fetch articles from Readwise Reader and ingest into Convex
 *
 * Usage: bun run scripts/fetch-readwise-articles.ts [options]
 *   --search <terms>    Search for specific topics
 *   --location <loc>    Filter by location (new, later, archive)
 *   --limit <n>         Max articles to process
 *   --fetch-full        Fetch full article text via Jina
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const READWISE_TOKEN = process.env.READWISE_TOKEN;
const CONVEX_URL = process.env.CONVEX_URL || process.env.CONVEX_SELF_HOSTED_URL;
const JINA_READER_URL = "https://r.jina.ai";

if (!READWISE_TOKEN) {
  console.error("READWISE_TOKEN must be set");
  process.exit(1);
}

if (!CONVEX_URL) {
  console.error("CONVEX_URL or CONVEX_SELF_HOSTED_URL must be set");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

interface ReadwiseArticle {
  id: string;
  title: string;
  author: string | null;
  source_url: string;
  category: string;
  location: string;
  tags: Record<string, any>;
  site_name: string | null;
  word_count: number | null;
  created_at: string;
  updated_at: string;
  published_date: string | null;
  summary: string | null;
  image_url: string | null;
  content: string | null;
  reading_progress: number;
  notes: string | null;
}

/**
 * Fetch articles from Readwise Reader API
 */
async function fetchReadwiseArticles(params: {
  location?: string;
  category?: string;
  pageSize?: number;
}): Promise<ReadwiseArticle[]> {
  const queryParams = new URLSearchParams();
  if (params.location) queryParams.set("location", params.location);
  if (params.category)
    queryParams.set("category", params.category || "article");
  queryParams.set("page_size", String(params.pageSize || 100));

  const url = `https://readwise.io/api/v3/list/?${queryParams}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${READWISE_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Readwise API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

/**
 * Fetch full article content via Jina Reader
 */
async function fetchFullArticle(url: string): Promise<string | null> {
  try {
    const jinaUrl = `${JINA_READER_URL}/${url}`;
    const response = await fetch(jinaUrl, {
      headers: { Accept: "text/plain" },
    });

    if (!response.ok) {
      console.log(`   ⚠️ Jina failed for ${url}: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.log(`   ⚠️ Jina error: ${error}`);
    return null;
  }
}

/**
 * Filter articles by search terms
 */
function filterBySearchTerms(
  articles: ReadwiseArticle[],
  searchTerms: string[],
): ReadwiseArticle[] {
  if (searchTerms.length === 0) return articles;

  const patterns = searchTerms.map((t) => new RegExp(t, "i"));

  return articles.filter((article) => {
    const searchText = `${article.title} ${article.summary || ""} ${article.site_name || ""}`;
    return patterns.some((p) => p.test(searchText));
  });
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let searchTerms: string[] = [];
  let location: string | undefined;
  let limit = 20;
  let fetchFull = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--search" && args[i + 1]) {
      searchTerms = args[i + 1].split(",").map((s) => s.trim());
      i++;
    }
    if (args[i] === "--location" && args[i + 1]) {
      location = args[i + 1];
      i++;
    }
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === "--fetch-full") {
      fetchFull = true;
    }
  }

  // Default search terms for research content
  if (searchTerms.length === 0) {
    searchTerms = [
      "music",
      "frequency",
      "harmonic",
      "acoustic",
      "cymatics",
      "tuning",
      "psychoacoustic",
      "neuroscience",
      "perception",
      "physics",
      "mathematics",
      "wave",
      "resonance",
      "vibration",
      "432",
      "528",
      "solfeggio",
      "temperament",
      "interval",
      "consonance",
      "dissonance",
      "spectrum",
      "fourier",
    ];
  }

  console.log(`Fetching Readwise articles...`);
  console.log(`Search terms: ${searchTerms.join(", ")}`);
  console.log(`Location filter: ${location || "any"}`);
  console.log(`Fetch full text: ${fetchFull}\n`);

  // Fetch articles
  const allArticles = await fetchReadwiseArticles({
    location,
    category: "article",
    pageSize: 200,
  });

  console.log(`Found ${allArticles.length} total articles in Reader`);

  // Filter by search terms
  const relevantArticles = filterBySearchTerms(allArticles, searchTerms).slice(
    0,
    limit,
  );
  console.log(`${relevantArticles.length} match research criteria\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const article of relevantArticles) {
    console.log(`📄 ${article.title?.slice(0, 60)}...`);
    console.log(`   URL: ${article.source_url}`);
    console.log(
      `   Location: ${article.location}, Progress: ${Math.round(article.reading_progress * 100)}%`,
    );

    try {
      // Generate dedupeKey
      const dedupeKey = `readwise:${article.id}`;

      // Check if already exists
      const existing = await client.query(api.sources.getByDedupeKey, {
        dedupeKey,
      });
      if (existing) {
        console.log(`   ⏭️ Already ingested`);
        skipped++;
        continue;
      }

      // Get full text if requested
      let rawText = article.content || article.summary || "";
      if (fetchFull && article.source_url && rawText.length < 2000) {
        console.log(`   📥 Fetching full text...`);
        const fullText = await fetchFullArticle(article.source_url);
        if (fullText && fullText.length > rawText.length) {
          rawText = fullText;
          console.log(`   ✓ Got ${fullText.length} chars`);
        }
        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Create source in Convex
      const result = await client.mutation(api.sources.create, {
        type: "url",
        title: article.title,
        author: article.author || undefined,
        canonicalUrl: article.source_url,
        publishedAt: article.published_date
          ? Date.parse(article.published_date)
          : undefined,
        rawText: rawText || undefined,
        tags: ["readwise", ...Object.keys(article.tags || {})],
        metadata: {
          readwiseId: article.id,
          readwiseLocation: article.location,
          siteName: article.site_name,
          wordCount: article.word_count,
          readingProgress: article.reading_progress,
        },
        dedupeKey,
      });

      if (result.created) {
        console.log(`   ✅ Ingested (${rawText.length} chars)`);
        success++;
      } else {
        console.log(`   ⏭️ Duplicate`);
        skipped++;
      }
    } catch (error) {
      console.log(`   ❌ ${error}`);
      failed++;
    }
    console.log();
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(
    `Done: ${success} ingested, ${skipped} skipped, ${failed} failed`,
  );
}

main().catch(console.error);
