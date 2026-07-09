#!/usr/bin/env bun
/**
 * Sync notes from a Notion Tag to the Convex sources database.
 *
 * Usage:
 *   bun scripts/sync-notion-tag.ts
 *   bun scripts/sync-notion-tag.ts --tag-id <id>
 *   bun scripts/sync-notion-tag.ts --fetch-full-text
 *   Add --dry-run to validate options without network/backend access.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fetchViaJina } from "./lib/fetchText";
import { createSourceIngestor } from "./lib/ingest";

const NOTION_VERSION = "2025-09-03";
const FREQUENCY_RESEARCH_TAG_ID = "2ff1c0d4-15f5-806e-8d86-d62c5f4cf701";

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

interface RichTextElement {
  plain_text?: string;
}

async function getTagNotes(tagId: string): Promise<string[]> {
  const page = await notionRequest(`/pages/${tagId}`);
  const notes = page.properties?.Notes?.relation || [];
  return notes.map((note: { id: string }) => note.id);
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
      const text = (content.rich_text as RichTextElement[])
        .map((element) =>
          typeof element.plain_text === "string" ? element.plain_text : "",
        )
        .filter((value) => value.trim().length > 0)
        .join("");
      if (text) textParts.push(text);
    }
    if (block.has_children) {
      try {
        const childContent = await getPageContent(block.id);
        if (childContent) textParts.push(childContent);
      } catch {
        // Ignore errors for child blocks.
      }
    }
  }
  return textParts.join("\n\n");
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
  const tagIndex = args.indexOf("--tag-id");
  let tagId = FREQUENCY_RESEARCH_TAG_ID;
  if (tagIndex !== -1) {
    const candidate = args[tagIndex + 1];
    if (
      !candidate ||
      candidate.trim().length === 0 ||
      candidate.startsWith("--")
    ) {
      throw new Error(
        "Missing value for --tag-id. Usage: --tag-id <notion-tag-id>",
      );
    }
    tagId = candidate;
  }
  const fetchFullText = args.includes("--fetch-full-text");

  if (args.includes("--dry-run")) {
    console.log(
      `DRY RUN: sync Notion tag=${tagId} fetchFullText=${fetchFullText}`,
    );
    return;
  }

  console.log(`🔄 Syncing Notion tag: ${tagId}`);
  console.log(`   Fetch full text: ${fetchFullText ? "yes" : "no"}\n`);
  const ingestor = createSourceIngestor({ rateMs: 350 });

  console.log("📋 Fetching note IDs from tag...");
  const noteIds = await getTagNotes(tagId);
  console.log(`   Found ${noteIds.length} notes\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;
  for (const noteId of noteIds) {
    try {
      if (
        await ingestor.alreadyIngested({
          type: "notion",
          title: noteId,
          notionPageId: noteId,
        })
      ) {
        console.log("   ⏭️ Already exists, skipping");
        skipped++;
        continue;
      }

      const page = await getPageDetails(noteId);
      const title = extractTitle(page);
      const url = extractUrl(page);
      const type = extractType(page);
      console.log(`📄 Processing: ${title.slice(0, 50)}...`);

      let rawText = await getPageContent(noteId);
      if (fetchFullText && url) {
        console.log(`   🌐 Fetching full article from ${url.slice(0, 50)}...`);
        const fullText = await fetchViaJina(url);
        if (fullText.ok) {
          rawText = `${rawText}\n\n---\n\n${fullText.text.slice(0, 100_000)}`;
        }
      }

      const summary = await ingestor.ingest([
        {
          type: "notion",
          title,
          canonicalUrl: url,
          notionPageId: noteId,
          rawText: rawText || undefined,
          fetchText: false,
          tags: type ? [type] : undefined,
          topics: ["frequency-research"],
          metadata: {
            notionUrl: page.url,
            notionType: type,
            createdTime: page.created_time,
            lastEditedTime: page.last_edited_time,
          },
        },
      ]);
      created += summary.created;
      skipped += summary.skipped;
      errors += summary.failed;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Error: ${message}`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
