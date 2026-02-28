#!/usr/bin/env bun
/**
 * Fetch full text for Notion sources that have URLs
 *
 * Usage:
 *   bun scripts/fetch-notion-full-text.ts           # Process all notion sources
 *   bun scripts/fetch-notion-full-text.ts --limit 5 # Process 5 sources
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL =
  process.env.CONVEX_URL || "https://righteous-marmot-892.convex.cloud";

async function fetchFullText(url: string): Promise<string | null> {
  if (!url) return null;

  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const response = await fetch(jinaUrl, {
      headers: { Accept: "text/plain" },
    });

    if (!response.ok) {
      console.log(`   ⚠️ Jina returned ${response.status}`);
      return null;
    }

    const text = await response.text();
    return text.slice(0, 100000);
  } catch (e: any) {
    console.error(`   ❌ Fetch error: ${e.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes("--limit")
    ? parseInt(args[args.indexOf("--limit") + 1], 10)
    : 20;

  console.log(`📚 Fetching full text for Notion sources (limit: ${limit})\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  // Get notion sources that need text
  const sources = await client.query(api.sources.listByStatus, {
    status: "ingested",
    limit: 100,
  });

  // Filter to notion sources with URLs but minimal text
  const notionSources = sources.filter(
    (s: any) =>
      s.type === "notion" &&
      s.canonicalUrl &&
      (!s.rawText || s.rawText.length < 500),
  );

  console.log(
    `Found ${notionSources.length} Notion sources needing full text\n`,
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const source of notionSources.slice(0, limit)) {
    console.log(`📄 ${source.title?.slice(0, 50)}...`);
    console.log(`   URL: ${source.canonicalUrl?.slice(0, 60)}...`);

    try {
      const fullText = await fetchFullText(source.canonicalUrl);

      if (fullText && fullText.length > 500) {
        await client.mutation(api.sources.updateText, {
          id: source._id,
          rawText: fullText,
        });
        console.log(`   ✅ Updated with ${fullText.length} chars`);
        updated++;
      } else {
        console.log(`   ⏭️ No substantial text found`);
        skipped++;
      }

      // Rate limit for Jina
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e: any) {
      console.error(`   ❌ Error: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("FETCH COMPLETE");
  console.log("=".repeat(50));
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

main().catch(console.error);
