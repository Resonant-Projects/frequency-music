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
import { dirname, join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL =
  process.env.CONVEX_URL ||
  process.env.CONVEX_SELF_HOSTED_URL ||
  "http://convex-backend.paas.rproj.art";
const DEV_BYPASS_SECRET =
  process.env.DEV_BYPASS_SECRET || "freq-opus-extract-2026";
const APP_BASE_URL =
  process.env.PUBLIC_APP_BASE_URL || "https://app.resonantprojects.art";
const PUBLIC_EDITORIAL_EXPORT_VERSION = "public_editorial_v1" as const;

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

function renderMarkdown(
  artifact: {
    _id: string;
    title: string;
    slug: string;
    kind: string;
    dek: string;
    bodyMd: string;
    whyItMattersMd: string;
    uncertaintyMd: string;
    whatChangedMd?: string | null;
    evidenceStatus: string;
    publishedAt?: number | null;
    updatedAt: number;
  },
  appBaseUrl: string,
  linkedMeta?: { campaignSlug?: string; thesisSlugs?: string[] },
): string {
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(artifact.title)}`,
    `slug: ${JSON.stringify(artifact.slug)}`,
    `kind: ${JSON.stringify(artifact.kind)}`,
    `publishedAt: ${JSON.stringify(
      new Date(artifact.publishedAt ?? artifact.updatedAt).toISOString(),
    )}`,
    `dek: ${JSON.stringify(artifact.dek)}`,
    `evidenceStatus: ${JSON.stringify(artifact.evidenceStatus)}`,
    `uncertaintySummary: ${JSON.stringify(artifact.uncertaintyMd)}`,
    `whyItMatters: ${JSON.stringify(artifact.whyItMattersMd)}`,
    ...(linkedMeta?.campaignSlug
      ? [`campaignSlug: ${JSON.stringify(linkedMeta.campaignSlug)}`]
      : []),
    ...(linkedMeta?.thesisSlugs?.length
      ? [`thesisSlugs: ${JSON.stringify(linkedMeta.thesisSlugs)}`]
      : []),
    `canonicalAppUrl: ${JSON.stringify(
      `${appBaseUrl.replace(/\/$/, "")}/editorial/${artifact._id}`,
    )}`,
    "---",
    "",
  ].join("\n");

  return [
    frontmatter,
    artifact.bodyMd,
    "",
    "## Why It Matters",
    artifact.whyItMattersMd,
    "",
    "## Uncertainty",
    artifact.uncertaintyMd,
    artifact.whatChangedMd
      ? `\n## What Changed\n${artifact.whatChangedMd}\n`
      : "",
  ].join("\n");
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

    const path = `${artifact.slug}.md`;
    const markdown = renderMarkdown(artifact, APP_BASE_URL, {
      campaignSlug,
      thesisSlugs,
    });

    await writeFile(join(outputDir, path), markdown, "utf8");
    const exportSha = createHash("sha256").update(markdown).digest("hex");

    metadataUpdates.push({ id: artifact._id, exportPath: path, exportSha });
    manifestItems.push({
      slug: artifact.slug,
      path,
      title: artifact.title,
      kind: artifact.kind,
      publishedAt: artifact.publishedAt ?? artifact.updatedAt,
      evidenceStatus: artifact.evidenceStatus,
    });

    console.log(`  Exported: ${path}`);
  }

  const exportedAt = Date.now();
  await Promise.all(
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
