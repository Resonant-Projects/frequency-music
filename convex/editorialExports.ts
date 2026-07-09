// oxlint-disable-next-line typescript-eslint/triple-slash-reference -- The web tsconfig excludes Node types but includes this Convex Node action.
/// <reference path="../node_modules/@types/node/index.d.ts" />

"use node";

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  buildExportEntry,
  PUBLIC_EDITORIAL_EXPORT_VERSION,
} from "./editorialArtifacts";

export const exportForAstroInternal = internalAction({
  args: {
    outputDir: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const outputDir = args.outputDir ?? "exports/public-editorial/v1";
    const appBaseUrl =
      process.env.PUBLIC_APP_BASE_URL ?? "https://app.resonantprojects.art";
    const exportBundle = await ctx.runQuery(
      internal.editorialArtifacts.getExportBundleInternal,
      {},
    );

    const manifestItems: Array<{
      slug: string;
      path: string;
      title: string;
      kind: Doc<"editorialArtifacts">["kind"];
      publishedAt: number;
      evidenceStatus: Doc<"editorialArtifacts">["evidenceStatus"];
    }> = [];

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    for (const item of exportBundle) {
      const { artifact, validation, campaignSlug, thesisSlugs } = item;
      if (!validation.canPublish) continue;
      const rendered = buildExportEntry(artifact, appBaseUrl, {
        campaignSlug,
        thesisSlugs,
      });
      const filePath = join(outputDir, rendered.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, rendered.markdown, "utf8");
      const exportSha = createHash("sha256")
        .update(rendered.markdown)
        .digest("hex");
      await ctx.runMutation(
        internal.editorialArtifacts.setAstroExportMetadataInternal,
        {
          id: artifact._id,
          exportPath: rendered.path,
          exportSha,
          exportedAt: Date.now(),
        },
      );
      manifestItems.push(rendered.manifestEntry);
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

    return {
      version: PUBLIC_EDITORIAL_EXPORT_VERSION,
      outputDir,
      exportedCount: manifestItems.length,
      manifestPath,
    };
  },
});
