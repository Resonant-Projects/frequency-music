// Weekly-turn episodes: narration is enqueued by brief generation itself;
// `reconcile` only catches briefs that missed it. No "use node": the actions
// here only call ctx.run*, and the file also exports a query, which a node
// file cannot.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalQuery } from "./_generated/server";
import { NARRATION_PROMPT_VERSION } from "./narrationPrompt";
import { HOUSE_VOICE_KEY } from "./settings";
import { RENDERER_VERSION_FOR_JOBS } from "./shared/mediaJobs";
import { VOICE_IDS } from "./shared/voices";

const READY_EPISODE_SCAN = 200;

type EnqueueOutcome = { jobId: Id<"mediaJobs">; created: boolean };

export function episodeTitleForWeek(weekOf: string): string {
  return `Weekly turn, week of ${weekOf}`;
}

export function pickBriefsNeedingNarration(args: {
  briefs: Doc<"weeklyBriefs">[];
  readyEpisodeBriefIds: Set<string>;
  parkedBriefIds: Set<string>;
}): Doc<"weeklyBriefs">[] {
  return args.briefs.filter(
    (brief) =>
      !args.readyEpisodeBriefIds.has(brief._id) &&
      !args.parkedBriefIds.has(brief._id),
  );
}

// Only a ready delivery counts as an episode: the WAV master is uploaded
// private and is never what the feed serves.
export const hasReadyEpisodeForBrief = internalQuery({
  args: { briefId: v.id("weeklyBriefs") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const episodes = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_access_kind_createdAt", (q) =>
        q.eq("access", "feed").eq("kind", "episode"),
      )
      .order("desc")
      .take(READY_EPISODE_SCAN);
    return episodes.some(
      (row) =>
        row.role === "delivery" &&
        row.status === "ready" &&
        row.refs.weeklyBriefId === args.briefId,
    );
  },
});

export const narrateBrief = internalAction({
  args: { briefId: v.id("weeklyBriefs") },
  returns: v.object({ jobId: v.id("mediaJobs"), created: v.boolean() }),
  handler: async (ctx, args): Promise<EnqueueOutcome> => {
    const voiceId = await ctx.runQuery(internal.settings.get, {
      key: HOUSE_VOICE_KEY,
    });
    if (!voiceId) {
      throw new Error(
        "HOUSE_VOICE_UNSET: choose a house voice on /listen first",
      );
    }
    const brief = await ctx.runQuery(internal.weeklyBriefs.getInternal, {
      briefId: args.briefId,
    });
    if (!brief) throw new Error("brief not found");
    const script = await ctx.runAction(internal.narration.buildScriptForBrief, {
      briefId: args.briefId,
    });
    const title = episodeTitleForWeek(brief.weekOf);
    return await ctx.runMutation(internal.mediaJobs.enqueue, {
      input: {
        kind: "narrate",
        script,
        voiceId,
        promptVersion: NARRATION_PROMPT_VERSION,
        target: "spoken",
        title,
        access: "feed",
        refs: { weeklyBriefId: args.briefId },
        assembleOnDone: true,
        episodeTitle: title,
        rendererVersion: RENDERER_VERSION_FOR_JOBS,
      },
    });
  },
});

// Enqueue is deduped on the input snapshot, so re-running this is safe; a
// parked narrate job is a human's problem and is never re-enqueued here.
export const reconcile = internalAction({
  args: { daysBack: v.optional(v.number()) },
  returns: v.object({ enqueued: v.number(), skipped: v.number() }),
  handler: async (
    ctx,
    args,
  ): Promise<{ enqueued: number; skipped: number }> => {
    const voiceId = await ctx.runQuery(internal.settings.get, {
      key: HOUSE_VOICE_KEY,
    });
    if (!voiceId) return { enqueued: 0, skipped: 0 };
    const since = Date.now() - (args.daysBack ?? 14) * 24 * 60 * 60 * 1000;
    const briefs = await ctx.runQuery(internal.weeklyBriefs.listSinceInternal, {
      since,
    });
    const readyEpisodeBriefIds = new Set<string>();
    const parkedBriefIds = new Set<string>();
    for (const brief of briefs) {
      const briefId = brief._id;
      if (
        await ctx.runQuery(internal.episodes.hasReadyEpisodeForBrief, {
          briefId,
        })
      ) {
        readyEpisodeBriefIds.add(briefId);
      }
      if (
        await ctx.runQuery(internal.mediaJobs.isParkedForBrief, { briefId })
      ) {
        parkedBriefIds.add(briefId);
      }
    }
    const needing = pickBriefsNeedingNarration({
      briefs,
      readyEpisodeBriefIds,
      parkedBriefIds,
    });
    let enqueued = 0;
    let skipped = briefs.length - needing.length;
    for (const brief of needing) {
      const { created } = await ctx.runAction(internal.episodes.narrateBrief, {
        briefId: brief._id,
      });
      if (created) enqueued++;
      else skipped++;
    }
    return { enqueued, skipped };
  },
});

// Every shootout renders the same calibration passage across the whole
// catalog so takes stay comparable; low priority keeps it behind episodes.
export const enqueueShootout = internalAction({
  args: {},
  returns: v.object({ jobId: v.id("mediaJobs"), created: v.boolean() }),
  handler: async (ctx): Promise<EnqueueOutcome> => {
    const passage = await ctx.runQuery(
      internal.narrationPrompt.calibrationPassage,
      {},
    );
    return await ctx.runMutation(internal.mediaJobs.enqueue, {
      input: {
        kind: "shootout",
        passage: passage.paragraphs,
        voiceIds: [...VOICE_IDS],
        title: "Voice shootout",
        rendererVersion: RENDERER_VERSION_FOR_JOBS,
      },
      priority: -1,
    });
  },
});
