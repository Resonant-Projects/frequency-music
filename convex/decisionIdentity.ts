import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAuth } from "./auth";

/** A service bypass or a raw Clerk subject is never a human users-table id. */
export async function requireHumanIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);
  if (identity.isBypass || identity.subject === "system")
    throw new ConvexError("Human authentication required");
  return identity;
}

/** Provision only the authenticated subject, atomically with their first write.
 * Existing mappings and roles are preserved; callers cannot choose an identity
 * or acquire an admin role through a decision operation. */
export async function requireDecisionUser(ctx: MutationCtx) {
  const identity = await requireHumanIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  if (user) return user._id;
  const now = Date.now();
  return await ctx.db.insert("users", {
    clerkUserId: identity.subject,
    email: identity.email,
    displayName: identity.name,
    role: "collaborator",
    createdAt: now,
    updatedAt: now,
  });
}
