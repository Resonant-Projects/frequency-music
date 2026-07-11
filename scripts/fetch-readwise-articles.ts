#!/usr/bin/env -S vpx tsx
/**
 * Fetch articles from Readwise Reader and ingest into Convex.
 *
 * Usage: bun run scripts/fetch-readwise-articles.ts [options]
 *   --search <terms>    Search for specific topics (comma separated)
 *   --location <loc>    Filter by location (new, later, archive)
 *   --limit <n>         Max articles to process
 *   --fetch-full        Fetch full article text via Jina
 *   --dry-run           Validate options without network/backend access
 */
import "varlock/auto-load";
import { fetchViaJina } from "./lib/fetchText";
import { createSourceIngestor } from "./lib/ingest";

interface ReadwiseArticle {
  id: string;
  title: string;
  author: string | null;
  source_url: string;
  category: string;
  location: string;
  tags: Record<string, unknown>;
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

function getReadwiseToken(): string {
  const token = process.env.READWISE_TOKEN;
  if (!token) throw new Error("READWISE_TOKEN must be set");
  return token;
}

async function fetchReadwiseArticles(params: {
  location?: string;
  category?: string;
  pageSize?: number;
}): Promise<ReadwiseArticle[]> {
  const queryParams = new URLSearchParams();
  if (params.location) queryParams.set("location", params.location);
  if (params.category) queryParams.set("category", params.category);
  queryParams.set("page_size", String(params.pageSize || 100));
  const response = await fetch(
    `https://readwise.io/api/v3/list/?${queryParams}`,
    {
      headers: {
        Authorization: `Token ${getReadwiseToken()}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok) throw new Error(`Readwise API error: ${response.status}`);
  const data = (await response.json()) as { results: ReadwiseArticle[] };
  return data.results;
}

function filterBySearchTerms(
  articles: ReadwiseArticle[],
  searchTerms: string[],
): ReadwiseArticle[] {
  if (searchTerms.length === 0) return articles;
  const patterns = searchTerms.map((term) => new RegExp(term, "i"));
  return articles.filter((article) => {
    const searchText = `${article.title} ${article.summary || ""} ${article.site_name || ""}`;
    return patterns.some((pattern) => pattern.test(searchText));
  });
}

const DEFAULT_SEARCH_TERMS = [
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

async function main() {
  const args = process.argv.slice(2);
  let searchTerms: string[] = [];
  let location: string | undefined;
  let limit = 20;
  let fetchFull = false;
  for (let index = 0; index < args.length; index++) {
    const value = args[index + 1];
    if (args[index] === "--search" && value) {
      searchTerms = value.split(",").map((term) => term.trim());
      index++;
    }
    if (args[index] === "--location" && value) {
      location = value;
      index++;
    }
    if (args[index] === "--limit" && value) {
      limit = Number.parseInt(value, 10);
      index++;
    }
    if (args[index] === "--fetch-full") fetchFull = true;
  }
  if (searchTerms.length === 0) searchTerms = DEFAULT_SEARCH_TERMS;

  if (args.includes("--dry-run")) {
    console.log(
      `DRY RUN: fetch Readwise location=${location || "any"} limit=${limit} fetchFull=${fetchFull} searchTerms=${searchTerms.length}`,
    );
    return;
  }

  console.log("Fetching Readwise articles...");
  console.log(`Search terms: ${searchTerms.join(", ")}`);
  console.log(`Location filter: ${location || "any"}`);
  console.log(`Fetch full text: ${fetchFull}\n`);

  const allArticles = await fetchReadwiseArticles({
    location,
    category: "article",
    pageSize: 200,
  });
  console.log(`Found ${allArticles.length} total articles in Reader`);
  const relevantArticles = filterBySearchTerms(allArticles, searchTerms).slice(
    0,
    limit,
  );
  console.log(`${relevantArticles.length} match research criteria\n`);

  const ingestor = createSourceIngestor();
  let success = 0;
  let skipped = 0;
  let failed = 0;
  for (const article of relevantArticles) {
    console.log(`📄 ${article.title?.slice(0, 60)}...`);
    if (
      await ingestor.alreadyIngested({
        type: "url",
        title: article.title,
        canonicalUrl: article.source_url,
      })
    ) {
      console.log("   ⏭️ Already ingested");
      skipped++;
      continue;
    }

    let rawText = article.content || article.summary || "";
    if (fetchFull && article.source_url && rawText.length < 2000) {
      console.log("   📥 Fetching full text...");
      const fullText = await fetchViaJina(article.source_url);
      if (fullText.ok && fullText.text.length > rawText.length) {
        rawText = fullText.text;
        console.log(`   ✓ Got ${fullText.text.length} chars`);
      }
    }

    const summary = await ingestor.ingest([
      {
        type: "url",
        title: article.title,
        author: article.author || undefined,
        canonicalUrl: article.source_url,
        publishedAt: article.published_date
          ? Date.parse(article.published_date)
          : undefined,
        rawText: rawText || undefined,
        fetchText: false,
        tags: ["readwise", ...Object.keys(article.tags || {})],
        metadata: {
          readwiseId: article.id,
          readwiseLocation: article.location,
          siteName: article.site_name,
          wordCount: article.word_count,
          readingProgress: article.reading_progress,
        },
      },
    ]);
    success += summary.created;
    skipped += summary.skipped;
    failed += summary.failed;
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(
    `Done: ${success} ingested, ${skipped} skipped, ${failed} failed`,
  );
}

main().catch(console.error);
