import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/** A rejected hypothesis draft rests its Correspondence for four weekly runs. */
export const REJECTED_DRAFT_REST_MS = 28 * 24 * 60 * 60 * 1000;

function draftCorrespondenceIds(drafts: Doc<"agentReviewDrafts">[]) {
  return drafts.flatMap((draft) => {
    if (
      draft.kind !== "hypothesis_draft" ||
      !draft.payload ||
      !("statement" in draft.payload) ||
      !draft.payload.correspondenceId
    ) {
      return [];
    }
    return [String(draft.payload.correspondenceId)];
  });
}

/** Correspondences the drafter must skip: one with a draft awaiting review,
 * or one whose draft a human rejected within the rest period. */
export async function restingCorrespondenceIds(
  ctx: QueryCtx,
  now: number,
): Promise<Set<string>> {
  const pendingDrafts = await ctx.db
    .query("agentReviewDrafts")
    .withIndex("by_status_kind_updatedAt", (q) =>
      q.eq("status", "pending_review").eq("kind", "hypothesis_draft"),
    )
    .collect();
  const rejectedDrafts = await ctx.db
    .query("agentReviewDrafts")
    .withIndex("by_status_kind_updatedAt", (q) =>
      q
        .eq("status", "rejected")
        .eq("kind", "hypothesis_draft")
        .gte("updatedAt", now - REJECTED_DRAFT_REST_MS),
    )
    .collect();
  return new Set([
    ...draftCorrespondenceIds(pendingDrafts),
    ...draftCorrespondenceIds(rejectedDrafts),
  ]);
}
