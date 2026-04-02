#!/usr/bin/env bun
/**
 * Export published editorial artifacts as markdown + manifest for the Astro site.
 *
 * This script runs locally (or on a GH runner) and writes files to disk,
 * replacing the broken Convex action approach where fs writes went to
 * the remote Convex server instead of the runner workspace.
 *
 * Usage:
 *   bun scripts/export-editorial.ts
 *   bun scripts/export-editorial.ts --output-dir exports/public-editorial/v1
 */

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import type { Doc } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import {
  buildExportEntry,
  PUBLIC_EDITORIAL_EXPORT_VERSION,
} from "../convex/editorialArtifacts";

const CONVEX_URL = process.env.CONVEX_URL || process.env.CONVEX_SELF_HOSTED_URL;
if (!CONVEX_URL) {
  console.error("CONVEX_URL or CONVEX_SELF_HOSTED_URL env var is required");
  process.exit(1);
}
const DEV_BYPASS_SECRET = process.env.DEV_BYPASS_SECRET;
if (!DEV_BYPASS_SECRET) {
  console.error("DEV_BYPASS_SECRET env var is required");
  process.exit(1);
}
const APP_BASE_URL =
  process.env.PUBLIC_APP_BASE_URL || "https://app.resonantprojects.art";

function parseArgs(): { outputDir: string } {
  const args = process.argv.slice(2);
  let outputDir = "exports/public-editorial/v1";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    }
  }
  return { outputDir };
}

async function main() {
  const { outputDir } = parseArgs();
  const client = new ConvexHttpClient(CONVEX_URL);

  console.log(`Querying published editorial artifacts from ${CONVEX_URL}...`);

  const exportBundle = await client.query(
    api.editorialArtifacts.getPublicExportBundle,
    { devBypassSecret: DEV_BYPASS_SECRET },
  );

  const manifestItems: Array<{
    slug: string;
    path: string;
    title: string;
    kind: string;
    publishedAt: number;
    evidenceStatus: string;
  }> = [];

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const metadataUpdates: Array<{
    id: (typeof exportBundle)[number]["artifact"]["_id"];
    exportPath: string;
    exportSha: string;
  }> = [];

  for (const item of exportBundle) {
    const { artifact, validation, campaignSlug, thesisSlugs } = item;
    if (!validation.canPublish) continue;

    const rendered = await buildExportEntry(
      artifact as unknown as Doc<"editorialArtifacts">,
      APP_BASE_URL,
      { campaignSlug, thesisSlugs },
    );

    await writeFile(join(outputDir, rendered.path), rendered.markdown, "utf8");
    const exportSha = createHash("sha256")
      .update(rendered.markdown)
      .digest("hex");

    metadataUpdates.push({
      id: artifact._id,
      exportPath: rendered.path,
      exportSha,
    });
    manifestItems.push(rendered.manifestEntry);

    console.log(`  Exported: ${rendered.path}`);
  }

  const exportedAt = Date.now();
  const results = await Promise.allSettled(
    metadataUpdates.map(({ id, exportPath, exportSha }) =>
      client.mutation(api.editorialArtifacts.setAstroExportMetadata, {
        id,
        exportPath,
        exportSha,
        exportedAt,
        devBypassSecret: DEV_BYPASS_SECRET,
      }),
    ),
  );
  const failedEntries = results
    .map((r, i) =>
      r.status === "rejected"
        ? { ...metadataUpdates[i], reason: r.reason }
        : null,
    )
    .filter(Boolean);
  if (failedEntries.length > 0) {
    console.error(`${failedEntries.length} metadata update(s) failed:`);
    for (const f of failedEntries) {
      console.error(`  ${f.id} (${f.exportPath}):`, f.reason);
    }
    process.exit(1);
  }

  const manifestPath = join(outputDir, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        version: PUBLIC_EDITORIAL_EXPORT_VERSION,
        items: manifestItems,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `\nExported ${manifestItems.length} artifacts to ${outputDir}/manifest.json`,
  );
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
