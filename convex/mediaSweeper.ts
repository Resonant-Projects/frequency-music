// Reclaims expired leases, abandoned pending artifacts, and storage blobs no
// artifact references (a worker that crashed between upload and attach).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";

const DEFAULT_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const SCAN_LIMIT = 200;
// settings row holding the last _storage blob examined as
// "<_creationTime>:<_id>". The next sweep resumes inclusively at that
// creation time (skipping only that blob), so blobs sharing the boundary
// timestamp are never lost. Absent means 0: start from the oldest blob.
export const STORAGE_SCAN_CURSOR_KEY = "mediaSweeper.storageScanCursor";

type StorageScanCursor = { creationTime: number; blobId?: string };

async function readStorageScanCursor(
  ctx: MutationCtx,
): Promise<StorageScanCursor> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", STORAGE_SCAN_CURSOR_KEY))
    .unique();
  if (!row) return { creationTime: 0 };
  const [timeText, blobId] = row.value.split(":");
  const creationTime = Number(timeText);
  if (!Number.isFinite(creationTime)) return { creationTime: 0 };
  return blobId ? { creationTime, blobId } : { creationTime };
}

async function writeStorageScanCursor(
  ctx: MutationCtx,
  cursor: StorageScanCursor,
  now: number,
): Promise<void> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", STORAGE_SCAN_CURSOR_KEY))
    .unique();
  const value = `${cursor.creationTime}:${cursor.blobId ?? ""}`;
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
        q
          .gte("_creationTime", cursor.creationTime)
          .lt("_creationTime", blobCutoff),
      )
      .order("asc")
      // Inclusive resume returns the last examined blob once more, so fetch
      // one extra row to keep the window at scanLimit new blobs.
      .take((args.scanLimit ?? SCAN_LIMIT) + (cursor.blobId ? 1 : 0));
    // Inclusive resume, tie-safe within the boundary timestamp: every blob at
    // the cursor's creation time is skipped until the cursor blob itself has
    // been seen (it is skipped too); later timestamps are always examined. If
    // the cursor blob is gone (deleted as an orphan), nothing at its timestamp
    // is skipped and those blobs are merely re-examined. Residual limit: more
    // than scanLimit blobs sharing one float64 creation time would stall the
    // window at that timestamp; Convex assigns strictly increasing creation
    // times, so this is theoretical.
    let cursorSeen =
      cursor.blobId === undefined ||
      !blobs.some((blob) => blob._id === cursor.blobId);
    for (const blob of blobs) {
      if (!cursorSeen && blob._creationTime === cursor.creationTime) {
        if (blob._id === cursor.blobId) cursorSeen = true;
        continue;
      }
      const referenced = await ctx.db
        .query("audioArtifacts")
        .withIndex("by_storageId", (q) => q.eq("storageId", blob._id))
        .first();
      if (referenced) continue;
      await ctx.storage.delete(blob._id);
      blobsDeleted++;
    }
    const last = blobs.at(-1);
    if (last && last._id !== cursor.blobId)
      await writeStorageScanCursor(
        ctx,
        { creationTime: last._creationTime, blobId: last._id },
        now,
      );

    return { ...leases, artifactsDeleted, blobsDeleted };
  },
});
