/**
 * Find duplicate sources by URL or title similarity.
 * Reports dupes that should be merged or archived.
 *
 * Usage: CONVEX_URL=... bun run scripts/find-dupes.ts [--archive]
 */
import "varlock/auto-load";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || "http://convex-backend.paas.rproj.art";
const BYPASS = process.env.AUTH_BYPASS_SECRET ?? process.env.DEV_BYPASS_SECRET;
if (!BYPASS) {
  console.error("AUTH_BYPASS_SECRET (or DEV_BYPASS_SECRET) is required — set it in 1Password / .env.local");
  process.exit(1);
}

function normalizeUrl(url: string): string {
  let u = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .replace(/#.*$/, "")
    .toLowerCase();
  // Keep query params for YouTube (video ID is in ?v=)
  if (!u.includes("youtube.com") && !u.includes("youtu.be")) {
    u = u.replace(/\?.*$/, "");
  }
  return u;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

async function main() {
  const doArchive = process.argv.includes("--archive");
  const client = new ConvexHttpClient(CONVEX_URL);

  // Get all non-archived sources
  const statuses = ["ingested", "text_ready", "extracted"] as const;
  const allSources: any[] = [];
  for (const status of statuses) {
    const batch = await client.query(api.sources.listByStatus, {
      status: status as any,
      limit: 1000,
    });
    allSources.push(...batch);
  }

  console.log(`Checking ${allSources.length} sources for duplicates...\n`);

  // Group by normalized URL
  const byUrl = new Map<string, any[]>();
  const byTitle = new Map<string, any[]>();

  for (const src of allSources) {
    if (src.canonicalUrl) {
      const key = normalizeUrl(src.canonicalUrl);
      if (!byUrl.has(key)) byUrl.set(key, []);
      byUrl.get(key)!.push(src);
    }
    if (src.title) {
      const key = normalizeTitle(src.title);
      if (key.length > 10) {
        // Skip very short titles
        if (!byTitle.has(key)) byTitle.set(key, []);
        byTitle.get(key)!.push(src);
      }
    }
  }

  // Find URL dupes
  const urlDupes = [...byUrl.entries()].filter(([_, sources]) => sources.length > 1);
  if (urlDupes.length > 0) {
    console.log(`=== URL Duplicates (${urlDupes.length} groups) ===\n`);
    let archived = 0;
    for (const [url, sources] of urlDupes) {
      console.log(`URL: ${url.slice(0, 70)}`);
      // Keep the one with most text, or the extracted one
      const sorted = sources.toSorted((a: any, b: any) => {
        if (a.status === "extracted" && b.status !== "extracted") return -1;
        if (b.status === "extracted" && a.status !== "extracted") return 1;
        return (b.rawText?.length || 0) - (a.rawText?.length || 0);
      });
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        const keep = i === 0;
        console.log(
          `  ${keep ? "KEEP" : "DUPE"} | ${s._id} | ${s.status} | ${(s.rawText?.length || 0).toString().padStart(6)} chars | ${s.title?.slice(0, 50)}`,
        );
        if (!keep && doArchive) {
          try {
            await client.mutation(api.sources.archive, {
              id: s._id,
              reason: `Duplicate of ${sorted[0]._id}`,
              devBypassSecret: BYPASS,
            });
            console.log(`       → Archived`);
            archived++;
          } catch (e: any) {
            console.log(`       → Archive failed: ${e.message?.slice(0, 50)}`);
          }
        }
      }
      console.log();
    }
    if (doArchive) console.log(`Archived ${archived} duplicate sources\n`);
  }

  // Find title dupes (only if not already caught by URL)
  const titleDupes = [...byTitle.entries()]
    .filter(([_, sources]) => sources.length > 1)
    .filter(([_, sources]) => {
      // Skip if all have the same URL (already caught above)
      const urls = new Set(sources.map((s: any) => normalizeUrl(s.canonicalUrl || "")));
      return urls.size > 1;
    });

  if (titleDupes.length > 0) {
    console.log(`=== Title-Similar Duplicates (${titleDupes.length} groups) ===\n`);
    for (const [title, sources] of titleDupes.slice(0, 20)) {
      console.log(`Title: "${title.slice(0, 60)}"`);
      for (const s of sources) {
        console.log(`  ${s._id} | ${s.status} | ${s.canonicalUrl?.slice(0, 60)}`);
      }
      console.log();
    }
  }

  if (urlDupes.length === 0 && titleDupes.length === 0) {
    console.log("No duplicates found ✓");
  }
}

main().catch(console.error);
