/**
 * Ingest esoteric/complementary research sources.
 * Fetches full text via Jina Reader and stores in Convex.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { readFileSync } from "fs";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);
const BYPASS = "freq-opus-extract-2026";

interface Source {
  title: string;
  url: string;
  type: string;
  topic: string;
  notes: string;
}

async function fetchText(url: string): Promise<string> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const resp = await fetch(jinaUrl, {
      headers: { Accept: "text/plain" },
    });
    if (!resp.ok) return "";
    const text = await resp.text();
    return text.slice(0, 100000);
  } catch {
    return "";
  }
}

async function main() {
  const sources: Source[] = JSON.parse(readFileSync("data/esoteric-sources.json", "utf-8"));

  const offset = parseInt(process.argv[2] || "0");
  const limit = parseInt(process.argv[3] || sources.length.toString());
  const batch = sources.slice(offset, offset + limit);

  console.log(`Processing ${batch.length} sources (offset=${offset})`);

  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (const src of batch) {
    try {
      console.log(`Fetching: ${src.title.slice(0, 60)}...`);
      const text = await fetchText(src.url);
      console.log(`  Text: ${text.length} chars`);

      const result = await client.mutation(api.sources.create, {
        title: src.title,
        canonicalUrl: src.url,
        type: src.type === "pdf" ? "pdf" : "url",
        rawText: text.length > 200 ? text : undefined,
        tags: [src.topic, "esoteric-research"],
        dedupeKey: `esoteric:${src.url}`,
        metadata: { notes: src.notes, topic: src.topic },
        devBypassSecret: BYPASS,
      });

      if (result.created) {
        console.log(`  ✓ Ingested: ${result.id}`);
        ingested++;
      } else {
        console.log(`  ⏭ Skipped: ${result.reason || "duplicate"}`);
        skipped++;
      }
    } catch (e: any) {
      console.error(`  ✗ Error: ${e.message?.slice(0, 100)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${ingested} ingested, ${skipped} skipped, ${failed} failed`);
}

main().catch(console.error);
