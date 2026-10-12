/**
 * Backfill concept links for every stored Extraction on the live backend.
 * Idempotent: rerunning it adds no edges and counts no extra mentions.
 *
 *   vp run graph:backfill
 *
 * Calls extract.startConceptBackfill as the operator service identity (the
 * bypass secret Varlock resolves from 1Password); that schedules
 * graph.buildGraphFromExtractions, which pages through every Extraction in
 * the background and logs a "graph backfill page" line per page.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import {
  getConvexClient,
  getConvexUrl,
  getDevBypassSecret,
} from "./lib/convexClient";

try {
  await getConvexClient().mutation(api.extract.startConceptBackfill, {
    devBypassSecret: getDevBypassSecret(),
  });
  console.log(
    `Scheduled the concept-link backfill on ${getConvexUrl()}. It pages through every Extraction; watch the deployment logs for "graph backfill page".`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
