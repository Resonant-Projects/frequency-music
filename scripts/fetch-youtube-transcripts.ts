#!/usr/bin/env -S vp node
/**
 * Fetch YouTube transcripts using Fabric CLI and push to Convex.
 *
 * Usage: bun run scripts/fetch-youtube-transcripts.ts [--limit N] [--dry-run]
 */
import "varlock/auto-load";
import { spawn } from "node:child_process";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

const FABRIC_PATH = `${process.env.HOME}/.local/bin/fabric`;

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const videoId = url.match(pattern)?.[1];
    if (videoId) return videoId;
  }
  return null;
}

async function fetchTranscript(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const { stdout, stderr, exitCode } = await new Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }>((resolve, reject) => {
    const proc = spawn(
      FABRIC_PATH,
      ["--youtube", url, "--transcript"],
      {
        env: {
          ...process.env,
          PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
        },
      },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    proc.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });
  });
  if (exitCode !== 0) throw new Error(`Fabric error: ${stderr}`);
  return stdout.trim();
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 10;
  for (let index = 0; index < args.length; index++) {
    const value = args[index + 1];
    if (args[index] === "--limit" && value) {
      limit = Number.parseInt(value, 10);
    }
  }

  if (args.includes("--dry-run")) {
    console.log(
      `DRY RUN: fetch YouTube transcripts status=ingested limit=${limit}`,
    );
    return;
  }

  const client = getConvexClient();
  const devBypassSecret = getDevBypassSecret();
  console.log(`Fetching up to ${limit} YouTube transcripts...`);
  const sources = await client.query(api.sources.listByStatus, {
    status: "ingested",
    limit: limit * 2,
  });
  const youtubeSources = sources
    .filter((source) => source.type === "youtube")
    .slice(0, limit);
  console.log(`Found ${youtubeSources.length} YouTube videos to process`);

  let success = 0;
  let failed = 0;
  for (const source of youtubeSources) {
    const videoId =
      source.youtubeVideoId || extractVideoId(source.canonicalUrl || "");
    if (!videoId) {
      console.log(`❌ ${source.title}: No video ID`);
      failed++;
      continue;
    }
    try {
      console.log(`📹 ${source.title}...`);
      const transcript = await fetchTranscript(videoId);
      if (!transcript) throw new Error("Empty transcript");
      await client.mutation(api.sources.updateText, {
        id: source._id,
        transcript,
        devBypassSecret,
      });
      console.log(`   ✅ ${transcript.length} chars`);
      success++;
    } catch (error) {
      console.log(`   ❌ ${String(error)}`);
      await client.mutation(api.sources.updateStatus, {
        id: source._id,
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: `Transcript fetch failed: ${String(error)}`,
        devBypassSecret,
      });
      failed++;
    }
  }
  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
