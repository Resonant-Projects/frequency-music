import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/** Offline operator invocation only. Continue with the returned cursor until done. */
export const backfillRevisions = internalMutation({
  args: {
    table: v.union(v.literal("agentReviewDrafts"), v.literal("feeds")),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    cursor: v.string(),
    done: v.boolean(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.max(
      1,
      Math.min(100, Math.floor(args.batchSize ?? 50)),
    );
    const page = await ctx.db
      .query(args.table)
      .paginate({ cursor: args.cursor, numItems });
    let updated = 0;
    for (const row of page.page)
      if (row.revision === undefined) {
        await ctx.db.patch(row._id, { revision: 0 });
        updated++;
      }
    return { cursor: page.continueCursor, done: page.isDone, updated };
  },
});
