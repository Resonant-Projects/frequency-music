/**
 * Probe the passage index with free text: top passages with source titles,
 * live statuses, scores and chunk positions.
 *
 *   vpx tsx scripts/probe-passages.ts "standing waves on a plate"
 *   vpx tsx scripts/probe-passages.ts "chladni figures" --type youtube --limit 8
 *
 * Operator-gated: this contacts the deployed Convex backend and makes one paid
 * text-embedding-3-large call for the query when the index is populated.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import {
  PASSAGE_SEARCH_MAX_LIMIT,
  PASSAGE_SOURCE_TYPES,
  type PassageSourceType,
} from "../convex/shared/passages";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

function printUsage() {
  console.log(
    'Usage: vpx tsx scripts/probe-passages.ts "query" [--limit N] [--type TYPE ...]',
  );
  console.log(`Types: ${PASSAGE_SOURCE_TYPES.join(", ")}`);
}

function truncate(text: string, length: number) {
  const flat = text.replaceAll(/\s+/g, " ").trim();
  return flat.length <= length ? flat : `${flat.slice(0, length - 1)}…`;
}

function parseArgs(argv: string[]) {
  let query: string | undefined;
  let limit = PASSAGE_SEARCH_MAX_LIMIT;
  const types: PassageSourceType[] = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--limit") {
      limit = Number(argv[++index]);
    } else if (arg === "--type") {
      const type = PASSAGE_SOURCE_TYPES.find(
        (name) => name === argv[index + 1],
      );
      if (!type) return null;
      types.push(type);
      index++;
    } else if (arg?.startsWith("--") || query !== undefined) {
      return null;
    } else {
      query = arg;
    }
  }
  if (!query?.trim() || !Number.isFinite(limit)) return null;
  return { query, limit, types };
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  const result = await getConvexClient().action(api.passages.probe, {
    query: args.query,
    limit: args.limit,
    ...(args.types.length > 0 ? { types: args.types } : {}),
    devBypassSecret: getDevBypassSecret(),
  });
  console.log(
    `query=${JSON.stringify(args.query)} passages=${result.passages.length} truncated=${result.truncated} omitted=${result.omitted}`,
  );
  if (result.passages.length === 0) {
    console.log("No passages returned.");
    return;
  }
  console.table(
    result.passages.map((passage, index) => ({
      rank: index + 1,
      score: passage.score.toFixed(4),
      chunk: passage.order,
      status: passage.status,
      source: truncate(passage.title ?? passage.sourceId, 40),
      passage: truncate(passage.text, 90),
    })),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
