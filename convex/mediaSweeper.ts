// Reclaims expired leases, abandoned pending artifacts, and storage blobs no
// artifact references (a worker that crashed between upload and attach).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const DEFAULT_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const SCAN_LIMIT = 200;

type LeaseSweep = { requeued: number; parked: number };
type SweepResult = LeaseSweep & {
  artifactsDeleted: number;
  blobsDeleted: number;
};

export const sweep = internalMutation({
  args: {
    now: v.optional(v.number()),
    orphanAgeMs: v.optional(v.number()), // pending artifacts older than this
    blobAgeMs: v.optional(v.number()), // unreferenced blobs older than this
  },
  returns: v.object({
    requeued: v.number(),
    parked: v.number(),
    artifactsDeleted: v.number(),
    blobsDeleted: v.number(),
  }),
  // Explicit result types break the type cycle: this module reaches
  // internal.mediaJobs through the generated api, which also includes it.
  handler: async (ctx, args): Promise<SweepResult> => {
    const now = args.now ?? Date.now();
    const cutoff = now - (args.orphanAgeMs ?? DEFAULT_ORPHAN_AGE_MS);
    const blobCutoff = now - (args.blobAgeMs ?? DEFAULT_ORPHAN_AGE_MS);

    const leases: LeaseSweep = await ctx.runMutation(
      internal.mediaJobs.sweepStale,
      { now },
    );

    let artifactsDeleted = 0;
    let blobsDeleted = 0;
    const stalePending = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_status_createdAt", (q) =>
        q.eq("status", "pending").lt("createdAt", cutoff),
      )
      .take(SCAN_LIMIT);
    for (const row of stalePending) {
      if (row.storageId) {
        await ctx.storage.delete(row.storageId);
        blobsDeleted++;
      }
      await ctx.db.delete(row._id);
      artifactsDeleted++;
    }

    const blobs = await ctx.db.system.query("_storage").take(SCAN_LIMIT);
    for (const blob of blobs) {
      if (blob._creationTime > blobCutoff) continue;
      const referenced = await ctx.db
        .query("audioArtifacts")
        .withIndex("by_storageId", (q) => q.eq("storageId", blob._id))
        .first();
      if (referenced) continue;
      await ctx.storage.delete(blob._id);
      blobsDeleted++;
    }

    return { ...leases, artifactsDeleted, blobsDeleted };
  },
});
