import { v } from "convex/values";
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

// Explicit human choice; the system never auto-selects the house voice.
export const setHouseVoice = mutation({
  args: { voiceId: v.string(), devBypassSecret: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    voiceById(args.voiceId);
    await writeSetting(ctx, HOUSE_VOICE_KEY, args.voiceId);
    return null;
  },
});
