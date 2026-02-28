#!/usr/bin/env bun

/**
 * Ingest YouTube videos from a playlist into the Convex sources database
 *
 * Usage:
 *   bun scripts/ingest-youtube-playlist.ts <playlist-url>
 *   bun scripts/ingest-youtube-playlist.ts <playlist-url> --with-transcripts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL;

interface Video {
  title: string;
  url: string;
  videoId: string;
  duration: number;
  channel: string;
}

async function getPlaylistVideos(playlistUrl: string): Promise<Video[]> {
  const proc = Bun.spawn(
    [
      "yt-dlp",
      "--flat-playlist",
      "--print",
      "%(title)s|||%(url)s|||%(duration)s|||%(channel)s|||%(id)s",
      playlistUrl,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const output = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(
      `yt-dlp failed with exit code ${exitCode}\n${stderr}\n${output}`,
    );
  }

  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [title, url, duration, channel, videoId] = line.split("|||");
      return {
        title: title || "Untitled",
        url: url || "",
        videoId: videoId || "",
        duration: parseInt(duration, 10) || 0,
        channel: channel || "Unknown",
      };
    })
    .filter((v) => v.videoId && v.url && v.title !== "[Private video]");
}

async function main() {
  const args = process.argv.slice(2);
  const playlistUrl = args.find((a) => !a.startsWith("--"));
  const withTranscripts = args.includes("--with-transcripts");

  if (!playlistUrl) {
    console.log("Usage: bun scripts/ingest-youtube-playlist.ts <playlist-url>");
    process.exit(1);
  }
  if (!CONVEX_URL) {
    console.error("CONVEX_URL must be set");
    process.exit(1);
  }

  console.log(`📺 Ingesting YouTube playlist: ${playlistUrl}`);
  console.log(`   Transcripts: ${withTranscripts ? "yes" : "no"}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  // Get playlist videos
  console.log("🔍 Fetching playlist...");
  const videos = await getPlaylistVideos(playlistUrl);
  console.log(`   Found ${videos.length} videos\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const video of videos) {
    const dedupeKey = `yt:${video.videoId}`;

    // Check if already exists
    const existing = await client.query(api.sources.getByDedupeKey, {
      dedupeKey,
    });
    if (existing) {
      skipped++;
      continue;
    }

    console.log(`📄 ${video.title.slice(0, 55)}... (${video.channel})`);

    try {
      const result = await client.mutation(api.sources.create, {
        type: "youtube" as const,
        title: video.title,
        author: video.channel,
        canonicalUrl: video.url,
        youtubeVideoId: video.videoId,
        tags: ["youtube-playlist", "saved"],
        topics: [],
        dedupeKey,
        metadata: {
          duration: video.duration,
          channel: video.channel,
          playlistSource: playlistUrl,
        },
      });

      if (result.created) {
        created++;
      } else {
        skipped++;
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`   ❌ ${message}`);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("INGESTION COMPLETE");
  console.log("=".repeat(50));
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
