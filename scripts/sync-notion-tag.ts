#!/usr/bin/env bun

/**
 * Sync notes from a Notion Tag to the Convex sources database
 *
 * Usage:
 *   bun scripts/sync-notion-tag.ts                    # Sync Frequency Research tag
 *   bun scripts/sync-notion-tag.ts --tag-id <id>      # Sync specific tag
 *   bun scripts/sync-notion-tag.ts --fetch-full-text  # Also fetch article text via Jina
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL =
  process.env.CONVEX_URL || "https://righteous-marmot-892.convex.cloud";
const NOTION_VERSION = "2025-09-03";
const FREQUENCY_RESEARCH_TAG_ID = "2ff1c0d4-15f5-806e-8d86-d62c5f4cf701";

// Read Notion API key
function getNotionKey(): string {
  try {
    return readFileSync(`${homedir()}/.config/notion/api_key`, "utf-8").trim();
  } catch {
    throw new Error(
      "Notion API key not found. Set up ~/.config/notion/api_key",
    );
  }
}

async function notionRequest(endpoint: string, options: RequestInit = {}) {
  const key = getNotionKey();
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  return response.json();
}

interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: {
    Name?: { title: Array<{ text: { content: string } }> };
    URL?: { url: string | null };
    Type?: { select: { name: string } | null };
    Content?: { rich_text: Array<{ text: { content: string } }> };
    "Note Date"?: { date: { start: string } | null };
    Tag?: { relation: Array<{ id: string }> };
  };
}

async function getTagNotes(tagId: string): Promise<string[]> {
  const page = await notionRequest(`/pages/${tagId}`);
  const notes = page.properties?.Notes?.relation || [];
  return notes.map((n: { id: string }) => n.id);
}

async function getPageDetails(pageId: string): Promise<NotionPage> {
  return await notionRequest(`/pages/${pageId}`);
}

async function getPageContent(pageId: string): Promise<string> {
  const blocks = await notionRequest(`/blocks/${pageId}/children`);

  const textParts: string[] = [];

  for (const block of blocks.results || []) {
    const type = block.type;
    const content = block[type];

    if (content?.rich_text) {
      const text = content.rich_text.map((t: any) => t.plain_text).join("");
      if (text) textParts.push(text);
    }

    // Handle child blocks recursively (one level)
    if (block.has_children) {
      try {
        const childContent = await getPageContent(block.id);
        if (childContent) textParts.push(childContent);
      } catch {
        // Ignore errors for child blocks
      }
    }
  }

  return textParts.join("\n\n");
}

async function fetchFullText(url: string): Promise<string | null> {
  if (!url) return null;

  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const response = await fetch(jinaUrl, {
      headers: { Accept: "text/plain" },
    });

    if (!response.ok) return null;

    const text = await response.text();
    return text.slice(0, 100000); // Limit to 100k chars
  } catch (e) {
    console.error(`Failed to fetch ${url}: ${e}`);
    return null;
  }
}

function extractTitle(page: NotionPage): string {
  return page.properties?.Name?.title?.[0]?.text?.content || "Untitled";
}

function extractUrl(page: NotionPage): string | undefined {
  return page.properties?.URL?.url || undefined;
}

function extractType(page: NotionPage): string | undefined {
  return page.properties?.Type?.select?.name;
}

async function main() {
  const args = process.argv.slice(2);
  const tagId = args.includes("--tag-id")
    ? args[args.indexOf("--tag-id") + 1]
    : FREQUENCY_RESEARCH_TAG_ID;
  const fetchFullTextFlag = args.includes("--fetch-full-text");

  console.log(`🔄 Syncing Notion tag: ${tagId}`);
  console.log(`   Fetch full text: ${fetchFullTextFlag ? "yes" : "no"}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  // Get all notes linked to the tag
  console.log("📋 Fetching note IDs from tag...");
  const noteIds = await getTagNotes(tagId);
  console.log(`   Found ${noteIds.length} notes\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const noteId of noteIds) {
    try {
      // Get page details
      const page = await getPageDetails(noteId);
      const title = extractTitle(page);
      const url = extractUrl(page);
      const type = extractType(page);

      console.log(`📄 Processing: ${title.slice(0, 50)}...`);

      // Generate dedupeKey
      const dedupeKey = `notion:${noteId}`;

      // Check if already exists
      const existing = await client.query(api.sources.getByDedupeKey, {
        dedupeKey,
      });
      if (existing) {
        console.log(`   ⏭️ Already exists, skipping`);
        skipped++;
        continue;
      }

      // Get page content (blocks)
      let rawText = await getPageContent(noteId);

      // Optionally fetch full article text
      if (fetchFullTextFlag && url) {
        console.log(`   🌐 Fetching full article from ${url.slice(0, 50)}...`);
        const fullText = await fetchFullText(url);
        if (fullText) {
          rawText = `${rawText}\n\n---\n\n${fullText}`;
        }
      }

      // Create source
      const result = await client.mutation(api.sources.create, {
        type: "notion",
        title,
        canonicalUrl: url,
        notionPageId: noteId,
        rawText: rawText || undefined,
        tags: type ? [type] : undefined,
        topics: ["frequency-research"],
        dedupeKey,
        metadata: {
          notionUrl: page.url,
          notionType: type,
          createdTime: page.created_time,
          lastEditedTime: page.last_edited_time,
        },
      });

      if (result.created) {
        console.log(`   ✅ Created: ${result.id}`);
        created++;
      } else {
        console.log(`   ⏭️ Duplicate`);
        skipped++;
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 350));
    } catch (e: any) {
      console.error(`   ❌ Error: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("SYNC COMPLETE");
  console.log("=".repeat(50));
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

main().catch(console.error);
