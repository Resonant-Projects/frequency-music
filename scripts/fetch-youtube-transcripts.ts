#!/usr/bin/env bun
/**
 * Fetch YouTube transcripts using Fabric CLI and push to Convex
 * 
 * Usage: bun run scripts/fetch-youtube-transcripts.ts [--limit N]
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const FABRIC_PATH = `${process.env.HOME}/.local/bin/fabric`;
const CONVEX_URL = process.env.CONVEX_URL || process.env.CONVEX_SELF_HOSTED_URL;

if (!CONVEX_URL) {
  console.error("CONVEX_URL or CONVEX_SELF_HOSTED_URL must be set");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

/**
 * Extract video ID from URL (handles regular videos, shorts, and embeds)
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,  // YouTube Shorts
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch transcript using Fabric CLI
 */
async function fetchTranscript(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  
  const proc = Bun.spawn([FABRIC_PATH, "--youtube", url, "--transcript"], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Fabric error: ${stderr}`);
  }

  return stdout.trim();
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let limit = 10;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
    }
  }

  console.log(`Fetching up to ${limit} YouTube transcripts...`);

  // Get YouTube sources without transcripts
  const sources = await client.query(api.sources.listByStatus, {
    status: "ingested",
    limit: limit * 2,
  });

  const youtubeSources = sources
    .filter((s: any) => s.type === "youtube")
    .slice(0, limit);

  console.log(`Found ${youtubeSources.length} YouTube videos to process`);

  let success = 0;
  let failed = 0;

  for (const source of youtubeSources) {
    const videoId = source.youtubeVideoId || extractVideoId(source.canonicalUrl || "");
    if (!videoId) {
      console.log(`❌ ${source.title}: No video ID`);
      failed++;
      continue;
    }

    try {
      console.log(`📹 ${source.title}...`);
      const transcript = await fetchTranscript(videoId);
      
      if (!transcript) {
        throw new Error("Empty transcript");
      }

      // Update source in Convex
      await client.mutation(api.sources.updateText, {
        id: source._id,
        transcript,
      });

      console.log(`   ✅ ${transcript.length} chars`);
      success++;
    } catch (error) {
      console.log(`   ❌ ${error}`);
      
      // Mark as failed
      await client.mutation(api.sources.updateStatus, {
        id: source._id,
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: `Transcript fetch failed: ${error}`,
      });
      failed++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
