import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// One-off janitor surface for test debris that leaked into production.
// Structural fix tracked in the improvements ledger: the e2e cleanup tracker
// (web/tests/e2e/cleanup.ts) omits campaigns/theses and swallows errors, and
// e2e runs point at the production deployment. Until e2e isolation lands,
// this mutation is the audited way to purge — it matches ONLY rows whose
// titles carry the e2e marker prefixes.
const E2E_CAMPAIGN_PREFIX = "E2E Campaign e2e-";
const E2E_THESIS_PREFIX = "E2E Thesis e2e-";

export const purgeE2eDebris = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    dryRun: v.boolean(),
    campaignIds: v.array(v.id("campaigns")),
    thesisIds: v.array(v.id("theses")),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const campaigns = (await ctx.db.query("campaigns").take(500)).filter((c) =>
      c.title.startsWith(E2E_CAMPAIGN_PREFIX),
    );
    const theses = (await ctx.db.query("theses").take(500)).filter((t) =>
      t.title.startsWith(E2E_THESIS_PREFIX),
    );
    if (!dryRun) {
      for (const c of campaigns) {
        await ctx.db.delete(c._id);
      }
      for (const t of theses) {
        await ctx.db.delete(t._id);
      }
    }
    return {
      dryRun,
      campaignIds: campaigns.map((c) => c._id),
      thesisIds: theses.map((t) => t._id),
    };
  },
});
