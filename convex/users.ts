import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, query } from "./_generated/server";

const roleValidator = v.union(
  v.literal("admin"),
  v.literal("collaborator"),
  v.literal("follower"),
);

function userBySubject(ctx: Pick<QueryCtx, "db">, clerkUserId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

/** The role on a subject's users row, or null when the subject has no row. */
export const roleBySubject = internalQuery({
  args: { clerkUserId: v.string() },
  returns: v.union(roleValidator, v.null()),
  handler: async (ctx, args) =>
    (await userBySubject(ctx, args.clerkUserId))?.role ?? null,
});

/** The signed-in viewer's role, for showing or hiding controls. Never throws. */
export const viewer = query({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: v.union(
    v.object({
      userId: v.union(v.id("users"), v.null()),
      role: roleValidator,
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await userBySubject(ctx, identity.subject);
    return { userId: user?._id ?? null, role: user?.role ?? "follower" };
  },
});

/** Operator grant: internal on purpose, so no client can grant itself a role. */
export const setRole = internalMutation({
  args: { clerkUserId: v.string(), role: roleValidator },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await userBySubject(ctx, args.clerkUserId);
    if (user) {
      await ctx.db.patch(user._id, { role: args.role, updatedAt: now });
      return user._id;
    }
    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      role: args.role,
      createdAt: now,
      updatedAt: now,
    });
  },
});
