#!/usr/bin/env bun

/**
 * Ingest microtuning/xenharmonic sources
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Load environment
const envPath = join(import.meta.dir, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const [key, ...vals] = line.split("=");
  if (key && vals.length) {
    let value = vals.join("=").trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    env[key.trim()] = value;
  }
}

const CONVEX_URL = env.CONVEX_SELF_HOSTED_URL || env.CONVEX_URL;
if (!CONVEX_URL) throw new Error("Missing CONVEX_URL");

const client = new ConvexHttpClient(CONVEX_URL);

// Jina Reader for fetching content
async function fetchText(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  console.log(`  Fetching: ${url.slice(0, 60)}...`);

  const resp = await fetch(jinaUrl, {
    headers: { Accept: "text/plain" },
  });

  if (!resp.ok) throw new Error(`Jina fetch failed: ${resp.status}`);
  return (await resp.text()).trim();
}

// Sources to ingest
const sources = [
  // Core articles
  {
    title: "Just Intonation Explained",
    author: "Kyle Gann",
    url: "https://www.kylegann.com/tuning.html",
    topics: ["just intonation", "fractions", "ratios", "cents", "pure tuning"],
  },
  {
    title: "Anatomy of an Octave - Interval Reference Chart",
    author: "Kyle Gann",
    url: "https://www.kylegann.com/Octave.html",
    topics: ["intervals", "ratios", "cents", "reference"],
  },
  {
    title: "Introduction to Historical Tunings",
    author: "Kyle Gann",
    url: "https://www.kylegann.com/histune.html",
    topics: [
      "meantone",
      "well temperaments",
      "Pythagorean",
      "historical tuning",
    ],
  },
  {
    title: "Ben Johnston's Notation",
    author: "Kyle Gann",
    url: "https://www.kylegann.com/BJnotation.html",
    topics: [
      "notation",
      "just intonation",
      "Ben Johnston",
      "microtonal notation",
    ],
  },
  {
    title: "Microtonality (Music Composition Textbook)",
    url: "https://open.lib.umn.edu/musiccomposition/chapter/microtonality/",
    topics: [
      "composition",
      "notation",
      "harmonic beating",
      "microtonal composition",
    ],
  },
  // Sevish tutorials
  {
    title: "What's the difference between ET and EDO?",
    author: "Sevish",
    url: "https://sevish.com/2016/whats-the-difference-between-et-and-edo/",
    topics: ["EDO", "equal temperament", "terminology"],
  },
  {
    title: "Mapping microtonal scales to a MIDI keyboard in Scala",
    author: "Sevish",
    url: "https://sevish.com/2017/mapping-microtonal-scales-keyboard-scala/",
    topics: ["Scala", "keyboard mapping", "MIDI", "tutorial"],
  },
  // Technical resources
  {
    title: "Scala Scale File Format Specification",
    url: "https://www.huygens-fokker.org/scala/scl_format.html",
    topics: ["Scala", "file format", "scl", "specification"],
  },
  {
    title: "Surge Synth Team Tuning Guide",
    url: "https://surge-synthesizer.github.io/tuning-guide/",
    topics: ["Surge", "synth tuning", "scl", "kbm", "tutorial"],
  },
  // Wikipedia
  {
    title: "Microtonality - Wikipedia",
    url: "https://en.wikipedia.org/wiki/Microtonality",
    topics: ["overview", "history", "composers", "terminology"],
  },
  {
    title: "Equal temperament - Wikipedia",
    url: "https://en.wikipedia.org/wiki/Equal_temperament",
    topics: ["equal temperament", "history", "mathematics"],
  },
  {
    title: "Just intonation - Wikipedia",
    url: "https://en.wikipedia.org/wiki/Just_intonation",
    topics: ["just intonation", "ratios", "history"],
  },
  {
    title: "Meantone temperament - Wikipedia",
    url: "https://en.wikipedia.org/wiki/Meantone_temperament",
    topics: ["meantone", "historical tuning", "comma"],
  },
  {
    title: "Cent (music) - Wikipedia",
    url: "https://en.wikipedia.org/wiki/Cent_(music)",
    topics: ["cents", "mathematics", "measurement"],
  },
  {
    title: "Harry Partch's 43-tone scale - Wikipedia",
    url: "https://en.wikipedia.org/wiki/Harry_Partch%27s_43-tone_scale",
    topics: ["Harry Partch", "just intonation", "43-tone"],
  },
];

async function main() {
  console.log("=== Microtuning Sources Ingestion ===\n");

  let ingested = 0;
  let skipped = 0;

  for (const source of sources) {
    const dedupeKey = `url:${source.url.replace(/https?:\/\//, "").split("?")[0]}`;

    // Check if exists
    const existing = await client.query(api.sources.getByDedupeKey, {
      dedupeKey,
    });
    if (existing) {
      console.log(`Already exists: ${source.title}`);
      skipped++;
      continue;
    }

    console.log(`\nProcessing: ${source.title}`);

    let fullText = "";
    try {
      fullText = await fetchText(source.url);
    } catch (err) {
      console.error(`  Failed: ${err}`);
      fullText = `${source.title}\nTopics: ${source.topics.join(", ")}`;
    }

    const result = await client.mutation(api.sources.create, {
      type: "url",
      title: source.title,
      author: source.author,
      canonicalUrl: source.url,
      rawText: fullText.length > 100 ? fullText.slice(0, 200000) : undefined,
      dedupeKey,
      topics: source.topics,
      metadata: {
        category: "microtuning",
        subcategory: "xenharmonic",
      },
    });

    if (!result.created) {
      console.log(`  Dedupe: ${source.title}`);
      skipped++;
    } else {
      console.log(`  ✓ Ingested (${fullText.length} chars): ${source.title}`);
      ingested++;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n=== Complete ===`);
  console.log(`Ingested: ${ingested}, Skipped: ${skipped}`);
}

main().catch(console.error);
