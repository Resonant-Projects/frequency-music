#!/usr/bin/env bun
/**
 * Ingest open access articles from Journal of Mathematics and Music
 * 
 * Fetches full text of all articles from the RSS feed that are open access
 * (indicated by "Full article:" prefix in the URL, meaning free access)
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || "https://righteous-marmot-892.convex.cloud";
const RSS_URL = "https://www.tandfonline.com/feed/rss/tmam20";

interface Article {
  title: string;
  url: string;
  doi: string;
  author: string;
  date: string;
  volume?: string;
  issue?: string;
}

async function parseRSSFeed(): Promise<Article[]> {
  const response = await fetch(RSS_URL);
  const xml = await response.text();
  
  const articles: Article[] = [];
  
  // Simple XML parsing for RSS items
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    const title = item.match(/<dc:title>(.*?)<\/dc:title>/)?.[1] || "";
    const url = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const doi = item.match(/<dc:identifier>doi:(.*?)<\/dc:identifier>/)?.[1] || "";
    const author = item.match(/<dc:creator>(.*?)<\/dc:creator>/)?.[1] || "";
    const date = item.match(/<dc:date>(.*?)<\/dc:date>/)?.[1] || "";
    const volume = item.match(/<prism:volume>(.*?)<\/prism:volume>/)?.[1];
    const issue = item.match(/<prism:number>(.*?)<\/prism:number>/)?.[1];
    
    if (title && url) {
      articles.push({ title, url: url.replace("?af=R", ""), doi, author, date, volume, issue });
    }
  }
  
  return articles;
}

async function fetchFullText(url: string): Promise<string | null> {
  try {
    // Use Jina Reader API
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const response = await fetch(jinaUrl, {
      headers: { "Accept": "text/plain" },
    });
    
    if (!response.ok) {
      console.log(`   ⚠️ Jina returned ${response.status}`);
      return null;
    }
    
    const text = await response.text();
    
    // Check if we got meaningful content (not just a paywall page)
    if (text.length < 1000) {
      console.log(`   ⚠️ Too short (${text.length} chars), likely paywalled`);
      return null;
    }
    
    // Check for paywall indicators
    if (text.includes("Get access") && text.length < 3000) {
      console.log(`   ⚠️ Likely paywalled`);
      return null;
    }
    
    return text.slice(0, 100000);
  } catch (e: any) {
    console.error(`   ❌ Fetch error: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log("📚 Ingesting J. Math. Music Open Access Articles\n");
  
  const client = new ConvexHttpClient(CONVEX_URL);
  
  // Parse RSS feed
  console.log("📡 Fetching RSS feed...");
  const articles = await parseRSSFeed();
  console.log(`   Found ${articles.length} articles\n`);
  
  let created = 0;
  let skipped = 0;
  let paywalled = 0;
  let errors = 0;
  
  for (const article of articles) {
    const dedupeKey = `url:${article.doi || article.url}`;
    
    console.log(`📄 ${article.title.slice(0, 60)}...`);
    console.log(`   DOI: ${article.doi}`);
    
    // Check if already exists
    const existing = await client.query(api.sources.getByDedupeKey, { dedupeKey });
    if (existing) {
      console.log(`   ⏭️ Already exists`);
      skipped++;
      continue;
    }
    
    // Fetch full text
    console.log(`   🌐 Fetching full text...`);
    const fullText = await fetchFullText(article.url);
    
    if (!fullText) {
      paywalled++;
      continue;
    }
    
    console.log(`   📝 Got ${fullText.length} chars`);
    
    // Create source
    try {
      const result = await client.mutation(api.sources.create, {
        type: "url" as const,
        title: article.title,
        author: article.author.split(/\s+(?:a |b )/)[0], // Clean up author field
        canonicalUrl: article.url,
        rawText: fullText,
        tags: ["journal-of-mathematics-and-music", "open-access", "peer-reviewed"],
        topics: ["mathematical music theory"],
        dedupeKey,
        metadata: {
          doi: article.doi,
          volume: article.volume,
          issue: article.issue,
          publishedDate: article.date,
          journal: "Journal of Mathematics and Music",
        },
      });
      
      if (result.created) {
        console.log(`   ✅ Created: ${result.id}`);
        created++;
      }
    } catch (e: any) {
      console.error(`   ❌ Error: ${e.message}`);
      errors++;
    }
    
    // Rate limit for Jina
    await new Promise((r) => setTimeout(r, 1500));
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("INGESTION COMPLETE");
  console.log("=".repeat(50));
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️ Skipped (existing): ${skipped}`);
  console.log(`🔒 Paywalled: ${paywalled}`);
  console.log(`❌ Errors: ${errors}`);
}

main().catch(console.error);
