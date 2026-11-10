import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/** Every extraction id cited by any hypothesis. The table is small; see the
 * maintenance note in plans/021 before this grows past a few thousand rows. */
export async function linkedExtractionIds(
  db: QueryCtx["db"],
): Promise<Set<Id<"extractions">>> {
  const linked = new Set<Id<"extractions">>();
  for await (const hypothesis of db.query("hypotheses"))
    for (const id of hypothesis.extractionIds ?? []) linked.add(id);
  return linked;
}
