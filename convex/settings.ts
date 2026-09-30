import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { voiceById } from "./shared/voices";

export const HOUSE_VOICE_KEY = "houseVoiceId";
// Written once, in the same transaction that schedules the first backfill, so
// a repeated or changed choice never queues it again.
export const INITIAL_NARRATION_KEY = "initialNarrationScheduledAt";
export const INITIAL_NARRATION_DAYS_BACK = 14;

async function readSetting(ctx: QueryCtx, key: string): Promise<string | null> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row?.value ?? null;
}

async function writeSetting(
  ctx: MutationCtx,
  key: string,
  value: string,
): Promise<void> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  const updatedAt = Date.now();
  if (row) await ctx.db.patch(row._id, { value, updatedAt });
  else await ctx.db.insert("settings", { key, value, updatedAt });
}

export const get = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: (ctx, args) => readSetting(ctx, args.key),
});

export const set = internalMutation({
  args: { key: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await writeSetting(ctx, args.key, args.value);
    return null;
  },
});

export const houseVoice = query({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: v.object({ voiceId: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return { voiceId: await readSetting(ctx, HOUSE_VOICE_KEY) };
  },
});

export const setHouseVoiceInternal = internalMutation({
  args: { voiceId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    voiceById(args.voiceId); // throws on unknown
    await writeSetting(ctx, HOUSE_VOICE_KEY, args.voiceId);
    return null;
  },
});

// Explicit human choice; the system never auto-selects the house voice. The
// first choice also starts narrating recent briefs instead of leaving them for
// the Saturday reconcile cron; reconcile skips briefs that already have a live
// narration job, so the backfill never duplicates an episode.
export const setHouseVoice = mutation({
  args: { voiceId: v.string(), devBypassSecret: v.optional(v.string()) },
  returns: v.object({ initialNarrationScheduled: v.boolean() }),
  handler: async (
    ctx,
    args,
  ): Promise<{ initialNarrationScheduled: boolean }> => {
    await requireAuth(ctx, args);
    voiceById(args.voiceId);
    if ((await readSetting(ctx, HOUSE_VOICE_KEY)) !== args.voiceId) {
      await writeSetting(ctx, HOUSE_VOICE_KEY, args.voiceId);
    }
    if ((await readSetting(ctx, INITIAL_NARRATION_KEY)) !== null) {
      return { initialNarrationScheduled: false };
    }
    await writeSetting(ctx, INITIAL_NARRATION_KEY, String(Date.now()));
    await ctx.scheduler.runAfter(0, internal.episodes.reconcile, {
      daysBack: INITIAL_NARRATION_DAYS_BACK,
    });
    return { initialNarrationScheduled: true };
  },
});
