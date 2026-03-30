import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth } from "./auth";

export const seedCampaigns = mutation({
  args: {
    count: v.number(),
    titlePrefix: v.string(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const now = Date.now();
    for (let i = 0; i < args.count; i++) {
      await ctx.db.insert("campaigns", {
        title: `${args.titlePrefix} ${i + 1}`,
        question: `Campaign question for ${args.titlePrefix} ${i + 1}`,
        descriptionMd: `Campaign description for ${args.titlePrefix} ${i + 1}`,
        status: "paused",
        thesisIds: [],
        visibility: "public",
        createdBy: "system",
        createdAt: now - (args.count - i) * 1000,
        updatedAt: now - (args.count - i) * 1000,
      });
    }
    return null;
  },
});
