// General human feedback on ready episodes and litmus renders. Voice shootout
// takes keep their blind rating contract in voiceRatings.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireDecisionUser, requireHumanIdentity } from "./decisionIdentity";
import {
  AUDIO_FEEDBACK_QUEUE_LIMIT,
  AUDIO_RATING_KINDS,
  audioClientRequestIdZ,
  audioFeedbackQueueItemValidator,
  audioRatingPayloadValidator,
  audioRatingPayloadZ,
  audioRatingScoresValidator,
  isAudioRatingKind,
  scoreKeysOutsideKind,
  type AudioRatingPayload,
} from "./shared/audioFeedback";
import { listeningConditionsValidator } from "./shared/decisionIntents";
import { unratedAudioCardHash } from "./docket";

export const AUDIO_RATING_STALE =
  "This audio changed since you opened it. Reload and listen again.";
export const AUDIO_RATING_UNAVAILABLE =
  "This audio is not available for rating.";
// Newest candidates scanned per kind before filtering; older debt stays on the docket.
const QUEUE_SCAN_PER_KIND = 200;

/** Unrevealed groups hide members in both directions; dangling groups fail closed. */
export async function blindHiddenArtifactIds(
  ctx: QueryCtx | MutationCtx,
): Promise<Set<Id<"audioArtifacts">>> {
  const groups = await ctx.db
    .query("blindGroups")
    .withIndex("by_revealedAt", (q) => q.eq("revealedAt", undefined))
    .collect();
  return new Set(
    groups.flatMap((group) => group.members.map((row) => row.artifactId)),
  );
}

async function isBlindSafe(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"audioArtifacts">,
  hidden: Set<Id<"audioArtifacts">>,
): Promise<boolean> {
  if (hidden.has(row._id)) return false;
  if (!row.blindGroupId) return true;
  const group = await ctx.db.get(row.blindGroupId);
  return group?.revealedAt !== undefined;
}

/** The artifact may receive general feedback right now. */
export async function rateableArtifact(
  ctx: QueryCtx | MutationCtx,
  artifactId: Id<"audioArtifacts">,
): Promise<Doc<"audioArtifacts"> | null> {
  const row = await ctx.db.get(artifactId);
  if (
    !row ||
    row.status !== "ready" ||
    !row.storageId ||
    !isAudioRatingKind(row.kind) ||
    !(await isBlindSafe(ctx, row, await blindHiddenArtifactIds(ctx)))
  )
    return null;
  return row;
}

/** Human rating for the artifact's current content, from either feedback path. */
export async function hasHumanAudioRating(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"audioArtifacts">,
): Promise<boolean> {
  const ratings = await ctx.db
    .query("audioRatings")
    .withIndex("by_artifactId_createdAt", (q) => q.eq("artifactId", row._id))
    .collect();
  return ratings.some(
    (rating) => rating.artifactContentHash === row.contentHash,
  );
}

/** Shared by the web submission and signed `rateAudio` application. */
export async function createAudioRating(
  ctx: MutationCtx,
  args: {
    artifactId: Id<"audioArtifacts">;
    expectedContentHash: string;
    payload: AudioRatingPayload;
    userId: Id<"users">;
    source: "web" | "discord" | "telegram";
    requestKey: string;
    decisionIntentId?: Id<"decisionIntents">;
  },
): Promise<Id<"audioRatings">> {
  const parsed = audioRatingPayloadZ.safeParse(args.payload);
  if (!parsed.success) throw new ConvexError("Invalid audio rating");
  const payload = parsed.data;
  const row = await rateableArtifact(ctx, args.artifactId);
  if (!row || !isAudioRatingKind(row.kind))
    throw new ConvexError(AUDIO_RATING_UNAVAILABLE);
  if (row.contentHash !== args.expectedContentHash)
    throw new ConvexError(AUDIO_RATING_STALE);
  const outside = scoreKeysOutsideKind(row.kind, payload.scores);
  if (outside.length)
    throw new ConvexError(
      `Scores not used for this audio: ${outside.join(", ")}`,
    );
  if (!(await ctx.db.get(args.userId))) throw new ConvexError("User not found");
  return await ctx.db.insert("audioRatings", {
    artifactId: row._id,
    artifactKind: row.kind,
    artifactContentHash: row.contentHash,
    artifactValidation: row.validation,
    scores: payload.scores,
    conditions: payload.conditions,
    notes: payload.notes,
    createdBy: args.userId,
    source: args.source,
    decisionIntentId: args.decisionIntentId,
    requestKey: args.requestKey,
    createdAt: Date.now(),
  });
}

async function queueItem(row: Doc<"audioArtifacts">) {
  if (!isAudioRatingKind(row.kind)) throw new Error("Unrateable kind");
  return {
    artifactId: row._id,
    kind: row.kind,
    title: row.title,
    durationSecs: row.durationSecs,
    engineName: row.engine?.name,
    validation: row.validation,
    contentHash: row.contentHash,
    docketContentHash: await unratedAudioCardHash(row),
    createdAt: row.createdAt,
  };
}

/** One rateable artifact by ID, for docket links to audio outside the queue
 * window. Null for anything not rateable, without saying why. */
export const item = query({
  args: { artifactId: v.string() },
  returns: v.union(audioFeedbackQueueItemValidator, v.null()),
  handler: async (ctx, args) => {
    await requireHumanIdentity(ctx);
    const id = ctx.db.normalizeId("audioArtifacts", args.artifactId);
    const row = id ? await rateableArtifact(ctx, id) : null;
    return row ? await queueItem(row) : null;
  },
});

/** Ready, blind-safe, human-unrated and not deferred, newest first. */
export const queue = query({
  args: {},
  returns: v.array(audioFeedbackQueueItemValidator),
  handler: async (ctx) => {
    await requireHumanIdentity(ctx);
    const hidden = await blindHiddenArtifactIds(ctx);
    const shootoutRated = new Set(
      (await ctx.db.query("voiceRatings").collect())
        .filter(
          (row) => row.createdBy !== "system" && row.createdBy !== "agent",
        )
        .map((row) => row.artifactId),
    );
    const now = Date.now();
    const candidates: Doc<"audioArtifacts">[] = [];
    for (const kind of AUDIO_RATING_KINDS)
      candidates.push(
        ...(await ctx.db
          .query("audioArtifacts")
          .withIndex("by_kind_createdAt", (q) => q.eq("kind", kind))
          .order("desc")
          .take(QUEUE_SCAN_PER_KIND)),
      );
    const items = [];
    for (const row of candidates.toSorted(
      (a, b) => b.createdAt - a.createdAt || a._id.localeCompare(b._id),
    )) {
      if (items.length >= AUDIO_FEEDBACK_QUEUE_LIMIT) break;
      if (
        row.status !== "ready" ||
        !row.storageId ||
        !isAudioRatingKind(row.kind) ||
        shootoutRated.has(row._id) ||
        !(await isBlindSafe(ctx, row, hidden)) ||
        (await hasHumanAudioRating(ctx, row))
      )
        continue;
      const card = await ctx.db
        .query("docketCards")
        .withIndex("by_targetId", (q) => q.eq("targetId", row._id))
        .unique();
      if ((card?.deferredUntil ?? 0) > now) continue;
      items.push(await queueItem(row));
    }
    return items;
  },
});

/** Idempotent per signed-in user and client request ID. */
export const submit = mutation({
  args: {
    artifactId: v.id("audioArtifacts"),
    contentHash: v.string(),
    payload: audioRatingPayloadValidator,
    clientRequestId: v.string(),
  },
  returns: v.object({ ratingId: v.id("audioRatings"), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await requireDecisionUser(ctx);
    const clientRequestId = audioClientRequestIdZ.safeParse(
      args.clientRequestId,
    );
    if (!clientRequestId.success)
      throw new ConvexError("Invalid client request ID");
    const requestKey = `${userId}:${clientRequestId.data}`;
    const existing = await ctx.db
      .query("audioRatings")
      .withIndex("by_requestKey", (q) => q.eq("requestKey", requestKey))
      .unique();
    if (existing) {
      if (existing.artifactId !== args.artifactId)
        throw new ConvexError("Client request ID was already used");
      return { ratingId: existing._id, replayed: true };
    }
    const ratingId = await createAudioRating(ctx, {
      artifactId: args.artifactId,
      expectedContentHash: args.contentHash,
      payload: args.payload,
      userId,
      source: "web",
      requestKey,
    });
    return { ratingId, replayed: false };
  },
});

/** Ratings for one currently visible artifact; nothing for blind-hidden audio. */
export const forArtifact = query({
  args: { artifactId: v.id("audioArtifacts") },
  returns: v.array(
    v.object({
      ratingId: v.id("audioRatings"),
      scores: audioRatingScoresValidator,
      conditions: v.optional(listeningConditionsValidator),
      notes: v.optional(v.string()),
      source: v.union(
        v.literal("web"),
        v.literal("discord"),
        v.literal("telegram"),
      ),
      current: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireHumanIdentity(ctx);
    const row = await rateableArtifact(ctx, args.artifactId);
    if (!row) return [];
    const ratings = await ctx.db
      .query("audioRatings")
      .withIndex("by_artifactId_createdAt", (q) => q.eq("artifactId", row._id))
      .order("desc")
      .take(50);
    return ratings.map((rating) => ({
      ratingId: rating._id,
      scores: rating.scores,
      conditions: rating.conditions,
      notes: rating.notes,
      source: rating.source,
      current: rating.artifactContentHash === row.contentHash,
      createdAt: rating.createdAt,
    }));
  },
});
