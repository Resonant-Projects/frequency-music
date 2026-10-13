/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
// Audio artifact lifecycle: pending -> (attachStorage) -> ready | failed.
// Bytes live in Convex file storage; `playback` is the only Clerk-gated way a
// non-feed artifact's URL is reached, and it refuses unrevealed blind-group
// members so a shootout cannot be peeked at before reveal.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { audioArtifactInputValidator } from "./shared/audioArtifacts";
import { truncateText } from "./shared/truncateText";

const playbackReturn = v.union(
  v.null(),
  v.object({
    url: v.string(),
    mimeType: v.string(),
    durationSecs: v.optional(v.number()),
  }),
);

export const createPending = internalMutation({
  // Input omits the server-stamped timestamps; the handler supplies them.
  args: { fields: audioArtifactInputValidator },
  returns: v.id("audioArtifacts"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("audioArtifacts", {
      ...args.fields,
      // The zod contract defaults access; the table validator leaves it
      // optional, so stamp it here to keep every stored row explicit.
      access: args.fields.access ?? "private",
      status: "pending",
      uploadIssuedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const attachStorage = internalMutation({
  args: { artifactId: v.id("audioArtifacts"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.artifactId);
    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Artifact not found",
      });
    }
    if (row.storageId !== undefined) {
      // A retried attach of the same blob is a no-op; a different blob would
      // orphan the first one and is refused.
      if (row.storageId === args.storageId) return null;
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Artifact already has storage attached",
      });
    }
    if (row.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Artifact is ${row.status}`,
      });
    }
    await ctx.db.patch(args.artifactId, {
      storageId: args.storageId,
      uploadIssuedAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markReady = internalMutation({
  args: {
    artifactId: v.id("audioArtifacts"),
    durationSecs: v.number(),
    loudnessLufs: v.number(),
    truePeakDbtp: v.number(),
    mimeType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.artifactId);
    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Artifact not found",
      });
    }
    if (row.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Artifact is ${row.status}`,
      });
    }
    if (!row.storageId) {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Artifact has no storage attached",
      });
    }
    await ctx.db.patch(args.artifactId, {
      status: "ready",
      durationSecs: args.durationSecs,
      loudnessLufs: args.loudnessLufs,
      truePeakDbtp: args.truePeakDbtp,
      mimeType: args.mimeType,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markFailed = internalMutation({
  args: { artifactId: v.id("audioArtifacts"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.artifactId);
    if (!row)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Artifact not found",
      });
    // Lifecycle is pending -> ready | failed: a late failure must never
    // unpublish a ready artifact. Repeating a failure is a no-op.
    if (row.status === "failed") return null;
    if (row.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Artifact is ${row.status}`,
      });
    }
    await ctx.db.patch(args.artifactId, {
      status: "failed",
      error: truncateText(args.error, 2000),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listByStatusOlderThan = internalQuery({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    olderThan: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("audioArtifacts")
      .withIndex("by_status_createdAt", (q) =>
        q.eq("status", args.status).lt("createdAt", args.olderThan),
      )
      .take(args.limit ?? 100);
  },
});

async function isBlindHidden(
  ctx: QueryCtx,
  row: Doc<"audioArtifacts">,
): Promise<boolean> {
  if (!row.blindGroupId) return false;
  const group = await ctx.db.get(row.blindGroupId);
  // A dangling membership must fail closed, too.
  return !group || group.revealedAt === undefined;
}

async function playbackFor(ctx: QueryCtx, artifactId: Id<"audioArtifacts">) {
  const row = await ctx.db.get(artifactId);
  if (!row || row.status !== "ready" || !row.storageId) return null;
  if (await isBlindHidden(ctx, row)) return null;
  const url = await ctx.storage.getUrl(row.storageId);
  if (!url) return null;
  return {
    url,
    mimeType: row.mimeType ?? "application/octet-stream",
    durationSecs: row.durationSecs,
  };
}

// Clerk-gated playback: the only way a non-feed artifact's bytes are reached.
export const playback = query({
  args: {
    artifactId: v.id("audioArtifacts"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: playbackReturn,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await playbackFor(ctx, args.artifactId);
  },
});

// Same projection without auth, for tests and internal callers.
export const playbackInternal = internalQuery({
  args: { artifactId: v.id("audioArtifacts") },
  returns: playbackReturn,
  handler: async (ctx, args) => await playbackFor(ctx, args.artifactId),
});

// Fail explicitly instead of silently presenting a partial listening library.
// All takes happen before filtering, so pending/failed rows cannot cause an
// unbounded scan.
const MAX_TARGET_ARTIFACTS = 100;
const MAX_RECIPE_COMPOSITIONS = 25;

function assertWithinLimit(rows: unknown[], limit: number) {
  if (rows.length > limit) {
    throw new ConvexError({
      code: "LIMIT_EXCEEDED",
      message: "Too many audio records to list for this target",
    });
  }
}

export const listReadyForTarget = query({
  args: {
    target: v.union(
      v.object({ kind: v.literal("recipe"), id: v.id("recipes") }),
      v.object({ kind: v.literal("composition"), id: v.id("compositions") }),
    ),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      artifactId: v.id("audioArtifacts"),
      title: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const target = args.target;
    if (!(await ctx.db.get(target.id))) return [];
    const candidates = new Map<Id<"audioArtifacts">, Doc<"audioArtifacts">>();
    const add = (rows: Doc<"audioArtifacts">[]) => {
      assertWithinLimit(rows, MAX_TARGET_ARTIFACTS);
      for (const row of rows) candidates.set(row._id, row);
      assertWithinLimit([...candidates.values()], MAX_TARGET_ARTIFACTS);
    };
    let compositionIds: Id<"compositions">[];
    if (target.kind === "recipe") {
      add(
        await ctx.db
          .query("audioArtifacts")
          .withIndex("by_refs_recipeId", (q) =>
            q.eq("refs.recipeId", target.id),
          )
          .take(MAX_TARGET_ARTIFACTS + 1),
      );
      const compositions = await ctx.db
        .query("compositions")
        .withIndex("by_recipeId_updatedAt", (q) => q.eq("recipeId", target.id))
        .take(MAX_RECIPE_COMPOSITIONS + 1);
      assertWithinLimit(compositions, MAX_RECIPE_COMPOSITIONS);
      compositionIds = compositions.map((row) => row._id);
    } else {
      compositionIds = [target.id];
    }
    for (const compositionId of compositionIds) {
      add(
        await ctx.db
          .query("audioArtifacts")
          .withIndex("by_refs_compositionId", (q) =>
            q.eq("refs.compositionId", compositionId),
          )
          .take(MAX_TARGET_ARTIFACTS + 1),
      );
    }
    const visible: Doc<"audioArtifacts">[] = [];
    for (const row of candidates.values()) {
      if (row.status !== "ready" || !row.storageId) continue;
      if (await isBlindHidden(ctx, row)) continue;
      visible.push(row);
    }
    return visible
      .toSorted(
        (a, b) => b.createdAt - a.createdAt || a._id.localeCompare(b._id),
      )
      .map((row) => ({ artifactId: row._id, title: row.title }));
  },
});
