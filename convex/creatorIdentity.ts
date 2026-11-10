import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { AppIdentity } from "./auth";

/** The submitter's users row, or "system" for the bypass identity or an unmapped subject. */
export async function creatorOf(
  ctx: Pick<MutationCtx, "db">,
  identity: AppIdentity,
): Promise<Id<"users"> | "system"> {
  if (identity.isBypass || identity.subject === "system") return "system";
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  return user?._id ?? "system";
}
