import { v } from "convex/values";
import { query } from "./_generated/server";

type InboxStatus = "ingested" | "text_ready" | "extracted" | "review_needed";

const statusPriority: Record<InboxStatus, number> = {
  ingested: 0,
  text_ready: 1,
  extracted: 2,
  review_needed: 2,
};

function nextActionForSource(source: {
  status: string;
  type: string;
  blockedReason?: string;
  uploadThingUrl?: string;
}) {
  if (source.blockedReason === "no_text") {
    return "Paste excerpt or mark as blocked";
  }
  if (source.blockedReason === "ai_error") {
    return "Retry extraction";
  }

  if (source.status === "ingested") {
    if (source.type === "url" || source.type === "rss") return "Fetch text";
    if (source.type === "youtube") return "Fetch transcript";
    if (source.type === "pdf" && source.uploadThingUrl) return "Extract PDF text";
    return "Add missing content";
  }

  if (source.status === "text_ready") return "Run extraction";
  return "Review extraction";
}

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const statuses: InboxStatus[] = [
      "ingested",
      "text_ready",
      "extracted",
      "review_needed",
    ];

    let candidates: any[] = [];

    for (const status of statuses) {
      const rows = await ctx.db
        .query("sources")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
        .order("asc")
        .take(limit * 2);

      candidates = candidates.concat(rows.filter((row) => row.visibility === "private"));
    }

    const deduped = Array.from(new Map(candidates.map((s) => [s._id, s])).values());

    deduped.sort((a, b) => {
      const blockedDelta = Number(Boolean(b.blockedReason)) - Number(Boolean(a.blockedReason));
      if (blockedDelta !== 0) return blockedDelta;

      const ap = statusPriority[a.status as InboxStatus] ?? 99;
      const bp = statusPriority[b.status as InboxStatus] ?? 99;
      if (ap !== bp) return ap - bp;

      return a.updatedAt - b.updatedAt;
    });

    const selected = deduped.slice(0, limit);

    return await Promise.all(
      selected.map(async (source) => {
        const latestExtraction = await ctx.db
          .query("extractions")
          .withIndex("by_sourceId_createdAt", (q) => q.eq("sourceId", source._id))
          .order("desc")
          .first();

        return {
          ...source,
          nextAction: nextActionForSource(source),
          extractionPreview: latestExtraction
            ? {
                id: latestExtraction._id,
                summary: latestExtraction.summary,
                claims: latestExtraction.claims.length,
                parameters: latestExtraction.compositionParameters.length,
                confidence: latestExtraction.confidence,
              }
            : null,
        };
      }),
    );
  },
});

export const counts = query({
  args: {},
  returns: v.object({
    ingested: v.number(),
    textReady: v.number(),
    reviewNeeded: v.number(),
    blocked: v.number(),
  }),
  handler: async (ctx) => {
    const ingested = await ctx.db
      .query("sources")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "ingested"))
      .collect();
    const textReady = await ctx.db
      .query("sources")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "text_ready"))
      .collect();
    const reviewNeeded = await ctx.db
      .query("sources")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "review_needed"))
      .collect();

    const blocked = [...ingested, ...textReady, ...reviewNeeded].filter(
      (row) => row.visibility === "private" && Boolean(row.blockedReason),
    ).length;

    return {
      ingested: ingested.filter((row) => row.visibility === "private").length,
      textReady: textReady.filter((row) => row.visibility === "private").length,
      reviewNeeded: reviewNeeded.filter((row) => row.visibility === "private").length,
      blocked,
    };
  },
});
