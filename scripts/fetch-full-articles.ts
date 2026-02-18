#!/usr/bin/env bun
/**
 * Fetch full article text using Jina Reader API and update sources
 * Then re-run extraction with complete content
 * 
 * Usage: bun run scripts/fetch-full-articles.ts [--limit N] [--min-length N] [--re-extract]
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || process.env.CONVEX_SELF_HOSTED_URL;
const JINA_READER_URL = "https://r.jina.ai";

if (!CONVEX_URL) {
  console.error("CONVEX_URL or CONVEX_SELF_HOSTED_URL must be set");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

/**
 * Fetch full article text using Jina Reader
 */
async function fetchFullArticle(url: string): Promise<string> {
  const jinaUrl = `${JINA_READER_URL}/${url}`;
  
  const response = await fetch(jinaUrl, {
    headers: {
      "Accept": "text/plain",
      "User-Agent": "ResonantProjects/1.0 (research aggregator)",
    },
  });

  if (!response.ok) {
    throw new Error(`Jina Reader error: ${response.status}`);
  }

  return await response.text();
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let limit = 20;
  let minLength = 1000; // Consider anything under 1000 chars as an excerpt
  let reExtract = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
    }
    if (args[i] === "--min-length" && args[i + 1]) {
      minLength = parseInt(args[i + 1], 10);
    }
    if (args[i] === "--re-extract") {
      reExtract = true;
    }
  }

  console.log(`Fetching full articles (min length: ${minLength} chars)...`);
  console.log(`Re-extract after fetch: ${reExtract}\n`);

  // Get sources that might need full text
  // Check both extracted and text_ready sources
  const statuses = ["extracted", "text_ready"];
  const allSources: any[] = [];

  for (const status of statuses) {
    const sources = await client.query(api.sources.listByStatus, {
      status,
      limit: limit * 2,
    });
    allSources.push(...sources);
  }

  // Filter to RSS/URL sources with short text and valid URLs
  const sourcesToProcess = allSources
    .filter((s: any) => {
      const textLen = (s.rawText || "").length;
      const hasUrl = s.canonicalUrl && s.canonicalUrl.startsWith("http");
      const isArticle = s.type === "rss" || s.type === "url";
      const needsFullText = textLen < minLength;
      return isArticle && hasUrl && needsFullText;
    })
    .slice(0, limit);

  console.log(`Found ${sourcesToProcess.length} articles needing full text\n`);

  let success = 0;
  let failed = 0;
  const toReExtract: string[] = [];

  for (const source of sourcesToProcess) {
    const currentLen = (source.rawText || "").length;
    console.log(`📄 ${source.title?.slice(0, 60)}...`);
    console.log(`   URL: ${source.canonicalUrl}`);
    console.log(`   Current: ${currentLen} chars`);

    try {
      const fullText = await fetchFullArticle(source.canonicalUrl);
      
      if (fullText.length <= currentLen) {
        console.log(`   ⚠️ Fetched text not longer (${fullText.length} chars), skipping`);
        continue;
      }

      // Update source with full text
      await client.mutation(api.sources.updateText, {
        id: source._id,
        rawText: fullText,
      });

      console.log(`   ✅ Updated: ${fullText.length} chars`);
      success++;

      // If was already extracted, mark for re-extraction
      if (source.status === "extracted" && reExtract) {
        toReExtract.push(source._id);
      }

      // Rate limit: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log(`   ❌ ${error}`);
      failed++;
    }
    console.log();
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done: ${success} updated, ${failed} failed`);

  if (toReExtract.length > 0 && reExtract) {
    console.log(`\nMarking ${toReExtract.length} sources for re-extraction...`);
    for (const id of toReExtract) {
      await client.mutation(api.sources.updateStatus, {
        id,
        status: "text_ready",
      });
    }
    console.log("Sources reset to text_ready for re-extraction");
  }
}

main().catch(console.error);
