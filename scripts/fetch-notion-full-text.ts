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

interface NotionSourceRow {
  _id: string;
  type: string;
  canonicalUrl?: string;
  rawText?: string;
  title?: string;
}

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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`   ❌ Fetch error: ${message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 20;
  if (args.includes("--limit")) {
    const raw = args[args.indexOf("--limit") + 1];
    const parsed = raw ? Number(raw) : Number.NaN;
    if (Number.isInteger(parsed) && parsed > 0) {
      limit = parsed;
    } else {
      console.warn(`Invalid --limit value "${raw ?? ""}", using default 20`);
    }
  }

  console.log(`📚 Fetching full text for Notion sources (limit: ${limit})\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  // Get notion sources that need text
  const sources = await client.query(api.sources.listByStatus, {
    status: "ingested",
    limit: 100,
  });

  // Filter to notion sources with URLs but minimal text
  const notionSources = sources.filter(
    (s: NotionSourceRow) =>
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`   ❌ Error: ${message}`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
