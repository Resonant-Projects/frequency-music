// Reclaims expired leases, abandoned pending artifacts, and storage blobs no
// artifact references (a worker that crashed between upload and attach).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";

const DEFAULT_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const SCAN_LIMIT = 200;
// settings row holding the _creationTime of the last _storage blob examined,
// as a decimal string. Absent means 0: the next sweep starts from the oldest.
export const STORAGE_SCAN_CURSOR_KEY = "mediaSweeper.storageScanCursor";

async function readStorageScanCursor(ctx: MutationCtx): Promise<number> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", STORAGE_SCAN_CURSOR_KEY))
    .unique();
  const parsed = row ? Number(row.value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

async function writeStorageScanCursor(
  ctx: MutationCtx,
  cursor: number,
  now: number,
): Promise<void> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", STORAGE_SCAN_CURSOR_KEY))
    .unique();
  const value = String(cursor);
  if (row) await ctx.db.patch(row._id, { value, updatedAt: now });
  else
    await ctx.db.insert("settings", {
      key: STORAGE_SCAN_CURSOR_KEY,
      value,
      updatedAt: now,
    });
}

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
    scanLimit: v.optional(v.number()), // _storage blobs examined per sweep
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
      // storage.delete throws on a missing blob, and the sweep is one
      // mutation: an unguarded delete would roll back lease recovery too.
      if (row.storageId && (await ctx.db.system.get(row.storageId))) {
        await ctx.storage.delete(row.storageId);
        blobsDeleted++;
      }
      await ctx.db.delete(row._id);
      artifactsDeleted++;
    }

    // Walk _storage once, oldest first, from a persisted cursor: a blob is only
    // ever attached shortly after upload, so an old unreferenced blob is an
    // orphan forever and one visit suffices. Without the cursor, old referenced
    // blobs would fill every scan window and shadow newer orphans permanently.
    const cursor = await readStorageScanCursor(ctx);
    const blobs = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        q.gt("_creationTime", cursor).lt("_creationTime", blobCutoff),
      )
      .order("asc")
      .take(args.scanLimit ?? SCAN_LIMIT);
    for (const blob of blobs) {
      const referenced = await ctx.db
        .query("audioArtifacts")
        .withIndex("by_storageId", (q) => q.eq("storageId", blob._id))
        .first();
      if (referenced) continue;
      await ctx.storage.delete(blob._id);
      blobsDeleted++;
    }
    const last = blobs.at(-1);
    if (last) await writeStorageScanCursor(ctx, last._creationTime, now);

    return { ...leases, artifactsDeleted, blobsDeleted };
  },
});
