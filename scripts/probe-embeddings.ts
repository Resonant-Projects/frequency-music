/**
 * Probe the active-claim vector index with a claim id or free text.
 *
 *   vpx tsx scripts/probe-embeddings.ts <claimId>
 *   vpx tsx scripts/probe-embeddings.ts --text "visible standing waves"
 *
 * Operator-gated: this contacts the deployed Convex backend and may call the
 * OpenAI embeddings API when no current stored claim embedding can be reused.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import type { Id } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

function printUsage() {
  console.log("Usage:");
  console.log("  vpx tsx scripts/probe-embeddings.ts <claimId>");
  console.log('  vpx tsx scripts/probe-embeddings.ts --text "free text"');
}

function truncate(text: string, length: number) {
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }
  const args = process.argv.slice(2);
  const textIndex = args.indexOf("--text");
  const text = textIndex >= 0 ? args[textIndex + 1] : undefined;
  const positional = args.find((arg) => !arg.startsWith("--") && arg !== text);
  if ((!text && !positional) || (text && positional)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await getConvexClient().action(api.embeddings.probe, {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Convex validates the CLI id at the action boundary.
    claimId: positional as Id<"claims"> | undefined,
    text,
    devBypassSecret: getDevBypassSecret(),
  });
  console.log(
    `query=${JSON.stringify(result.queryText)} embedding=${result.reusedStoredEmbedding ? "stored" : "fresh"}`,
  );
  if (result.results.length === 0) {
    console.log("No neighbors returned.");
    return;
  }
  console.table(
    result.results.map((neighbor, index) => ({
      rank: index + 1,
      score: neighbor.score.toFixed(4),
      claimId: neighbor.claimId,
      source: truncate(neighbor.sourceTitle, 36),
      domains: truncate(neighbor.domains.join(", ") || "—", 42),
      claim: truncate(neighbor.text, 72),
    })),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
