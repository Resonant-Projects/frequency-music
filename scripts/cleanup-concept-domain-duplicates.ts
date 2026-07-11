/** Merge provisional concept-domain variants by normalized slug. Dry-run by default. */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

const apply = process.argv.includes("--apply");
const client = getConvexClient();
const result = await client.mutation(
  api.vocabulary.cleanupProvisionalConceptDomainDuplicates,
  {
    apply,
    devBypassSecret: getDevBypassSecret(),
  },
);

console.log(apply ? "APPLIED" : "DRY RUN (use --apply to execute)");
console.log(
  `duplicateGroups=${result.duplicateGroups} deleted=${result.deleted} renamed=${result.renamed}`,
);
