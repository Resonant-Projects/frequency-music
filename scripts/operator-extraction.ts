/**
 * Extract text_ready Sources a chunk at a time without the worker or
 * OpenRouter: an operator session (Claude Code) reads the same extract_v2
 * prompt and writes the extraction JSON itself.
 *
 * 1. Export a chunk (read-only unless --park-unextractable):
 *      vpx tsx scripts/operator-extraction.ts export --out <dir> [--limit 40] [--chunk-size 20] [--park-unextractable]
 *    Writes <dir>/chunk-NNN.json. Each holds the system prompt, the
 *    instructions, and per Source its id, inputHash and rendered prompt.
 * 2. Write <dir>/results-NNN.json as each chunk's instructions describe.
 * 3. Import the results:
 *      vpx tsx scripts/operator-extraction.ts import <results.json> [--dry-run]
 *    Each Extraction goes through extract.storeOperatorExtraction, which
 *    refuses a Source whose text changed since export, applies the same text
 *    gate and duplicate checks as extractSource, and records the model.
 *
 * Operator-gated: contacts the deployed Convex backend. --park-unextractable
 * and import write; both need AUTH_BYPASS_SECRET through Varlock.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { MODELS } from "../convex/llm";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";
import { buildChunks, parseResults } from "./lib/operator-extraction";

const MODEL = MODELS.opus;

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

async function exportChunks(args: string[]) {
  const out = flag(args, "--out");
  if (!out) throw new Error("export needs --out <dir>");
  const limit = positiveInt(flag(args, "--limit"), 40);
  const chunkSize = positiveInt(flag(args, "--chunk-size"), 20);
  const client = getConvexClient();
  const sources = await client.query(api.sources.listByStatus, {
    status: "text_ready",
    limit,
  });
  const { chunks, unextractable } = await buildChunks(sources, {
    model: MODEL,
    chunkSize,
  });
  mkdirSync(out, { recursive: true });
  chunks.forEach((chunk, index) => {
    const file = join(out, `chunk-${String(index + 1).padStart(3, "0")}.json`);
    writeFileSync(file, `${JSON.stringify(chunk, null, 2)}\n`);
    console.log(`${file}: ${chunk.items.length} sources`);
  });
  if (unextractable.length > 0) {
    console.log(`${unextractable.length} unextractable (not in any chunk):`);
    for (const { sourceId, reason } of unextractable) {
      console.log(`  ${sourceId}: ${reason}`);
    }
    if (args.includes("--park-unextractable")) {
      // extractSource parks these at its text gate, before any model call.
      const devBypassSecret = getDevBypassSecret();
      for (const { sourceId } of unextractable) {
        const outcome = await client.action(api.extract.extractSource, {
          sourceId: sourceId as Id<"sources">,
          devBypassSecret,
        });
        console.log(`  parked ${sourceId}: ${JSON.stringify(outcome)}`);
      }
    }
  }
}

async function importResults(args: string[]) {
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("import needs <results.json>");
  const { results } = parseResults(readFileSync(file, "utf8"), MODEL);
  if (args.includes("--dry-run")) {
    console.log(`${results.length} results parsed; nothing stored (--dry-run)`);
    return;
  }
  const client = getConvexClient();
  const devBypassSecret = getDevBypassSecret();
  const tally = { stored: 0, skipped: 0, failed: 0, claims: 0 };
  for (const result of results) {
    try {
      const outcome = await client.action(api.extract.storeOperatorExtraction, {
        sourceId: result.sourceId as Id<"sources">,
        model: MODEL,
        inputHash: result.inputHash,
        // Convex validates the extraction's shape before storing it.
        extraction: result.extraction as never,
        devBypassSecret,
      });
      if ("success" in outcome) {
        tally.stored += 1;
        tally.claims += outcome.claimCount;
        console.log(
          `stored ${result.sourceId}: ${outcome.claimCount} claims, ${outcome.parameterCount} parameters`,
        );
      } else {
        tally.skipped += 1;
        console.log(`skipped ${result.sourceId}: ${outcome.reason}`);
      }
    } catch (error) {
      tally.failed += 1;
      console.log(
        `FAILED ${result.sourceId}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
      );
    }
  }
  console.log(
    `${tally.stored} stored (${tally.claims} claims), ${tally.skipped} skipped, ${tally.failed} failed`,
  );
  if (tally.failed > 0) process.exitCode = 1;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "export") return exportChunks(args);
  if (command === "import") return importResults(args);
  console.log(
    "Usage:\n  vpx tsx scripts/operator-extraction.ts export --out <dir> [--limit 40] [--chunk-size 20] [--park-unextractable]\n  vpx tsx scripts/operator-extraction.ts import <results.json> [--dry-run]",
  );
  process.exitCode = command ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
