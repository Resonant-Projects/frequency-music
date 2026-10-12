/**
 * Backfill concept links for every stored Extraction on the live backend.
 * Idempotent: rerunning it adds no edges and counts no extra mentions.
 *
 *   vp run graph:backfill
 *
 * Calls extractions.startConceptBackfill as the operator service identity
 * (the bypass secret Varlock resolves from 1Password); that schedules
 * graph.buildGraphFromExtractions, which pages through every Extraction in
 * the background and logs a "graph backfill page" line per page. Refuses any
 * target but the pinned self-hosted URL, and asks before sending the secret.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl, getDevBypassSecret } from "./lib/convexClient";
import { CONVEX_DEPLOY_URL } from "./lib/convex-deploy";

async function confirm(question: string): Promise<boolean> {
  if (!stdin.isTTY) {
    throw new Error(
      "Refusing to start the backfill without an interactive terminal.",
    );
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim() === "backfill";
  } finally {
    rl.close();
  }
}

async function main(): Promise<number> {
  const url = getConvexUrl();
  if (url !== CONVEX_DEPLOY_URL) {
    throw new Error(
      `The Convex URL must be ${CONVEX_DEPLOY_URL}; resolved a different URL.`,
    );
  }
  console.log(`Target:  ${url}`);
  console.log(
    "Action:  schedule graph:buildGraphFromExtractions over every Extraction",
  );
  if (!(await confirm('Type "backfill" to continue: '))) {
    console.log("Cancelled.");
    return 1;
  }
  await new ConvexHttpClient(url).mutation(
    api.extractions.startConceptBackfill,
    { devBypassSecret: getDevBypassSecret() },
  );
  console.log(
    'Scheduled. It pages through every Extraction; watch the deployment logs for "graph backfill page".',
  );
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
