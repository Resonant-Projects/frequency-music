#!/usr/bin/env bun
/**
 * Export unexported editCaptures into golden-dataset *candidate* files for human
 * curation, then flag them exported. Human edits of AI/agent-generated content
 * are strong training/eval signal, but still get a curation pass before joining
 * the canonical data/eval/*-golden.jsonl datasets (plan 05, task 1).
 *
 * Usage:
 *   CONVEX_URL=... AUTH_BYPASS_SECRET=... bun scripts/langsmith/export-edit-captures.ts
 */
import { appendFile, mkdir } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL ?? process.env.CONVEX_SELF_HOSTED_URL;
if (!CONVEX_URL) {
  console.error("Set CONVEX_URL (or CONVEX_SELF_HOSTED_URL).");
  process.exit(1);
}
const devBypassSecret = process.env.CONVEX_DEV_BYPASS_SECRET ?? process.env.AUTH_BYPASS_SECRET;

// Matches the plural golden filenames used by upload-datasets.ts.
const ENTITY_FILE: Record<string, string> = {
  extraction: "data/eval/extractions-golden.candidates.jsonl",
  hypothesis: "data/eval/hypotheses-golden.candidates.jsonl",
  weeklyBrief: "data/eval/weekly-briefs-golden.candidates.jsonl",
};

async function main() {
  const client = new ConvexHttpClient(CONVEX_URL as string);
  const rows = await client.query(api.editCaptures.listUnexported, {
    limit: 500,
    devBypassSecret,
  });

  if (!rows.length) {
    console.log("No unexported edit captures.");
    return;
  }

  await mkdir("data/eval", { recursive: true });
  const exportedIds: Array<(typeof rows)[number]["_id"]> = [];
  const perEntity: Record<string, number> = {};

  for (const row of rows) {
    const file = ENTITY_FILE[row.entityType];
    if (!file) continue;
    const line = JSON.stringify({
      inputs: { entityType: row.entityType, entityId: row.entityId, generated: row.generated },
      outputs: { edited: row.edited },
      metadata: {
        source: "edit_capture",
        promptVersion: row.promptVersion ?? null,
        model: row.model ?? null,
        editedAt: row.editedAt,
      },
    });
    await appendFile(file, `${line}\n`);
    exportedIds.push(row._id);
    perEntity[row.entityType] = (perEntity[row.entityType] ?? 0) + 1;
  }

  if (exportedIds.length) {
    const marked = await client.mutation(api.editCaptures.markExported, {
      ids: exportedIds,
      devBypassSecret,
    });
    console.log(
      `Exported ${exportedIds.length} edit capture(s) ${JSON.stringify(perEntity)}; marked ${marked.marked} exported.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
