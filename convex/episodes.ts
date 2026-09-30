// Weekly-turn episodes: narration is enqueued by brief generation itself;
// `reconcile` only catches briefs that missed it. It skips briefs with live
// narration jobs before paying for scripts; atomic per-brief admission in
// mediaJobs.enqueue prevents duplicates if callers overlap (ruling R19).
// No "use node": these actions only call ctx.run*, and this file also exports
// a query, which a node file cannot.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalQuery } from "./_generated/server";
import { NARRATE_PRIORITY } from "./mediaJobs";
import { NARRATION_PROMPT_VERSION } from "./narrationPrompt";
import { HOUSE_VOICE_KEY } from "./settings";
import { RENDERER_VERSION_FOR_JOBS } from "./shared/mediaJobs";
import { VOICE_IDS } from "./shared/voices";

// claimNext takes the lowest priority first, so a shootout sits above the
// narrate default (NARRATE_PRIORITY, 0) to stay behind episode work.
export const SHOOTOUT_PRIORITY = 1;

type EnqueueOutcome = { jobId: Id<"mediaJobs">; created: boolean };

export function episodeTitleForWeek(weekOf: string): string {
  return `Weekly turn, week of ${weekOf}`;
}

export function pickBriefsNeedingNarration(args: {
  briefs: Doc<"weeklyBriefs">[];
  readyEpisodeBriefIds: Set<string>;
  // Briefs with a narrate job in any non-failed status (queued, claimed,
  // done, parked): in flight, awaiting assembly, or a human's problem.
  blockedBriefIds: Set<string>;
}): Doc<"weeklyBriefs">[] {
  return args.briefs.filter(
    (brief) =>
      !args.readyEpisodeBriefIds.has(brief._id) &&
      !args.blockedBriefIds.has(brief._id),
  );
}

// Only a ready delivery counts as an episode: the WAV master is uploaded
// private and is never what the feed serves. An episode for a brief is
// always created after the brief, so the index range starts at the brief's
// creation time and no fixed window can miss it.
export const hasReadyEpisodeForBrief = internalQuery({
  args: { briefId: v.id("weeklyBriefs") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) return false;
    const episodes = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_access_kind_createdAt", (q) =>
        q
          .eq("access", "feed")
          .eq("kind", "episode")
          .gte("createdAt", brief._creationTime),
      )
      .collect();
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
      // Explicit so narrateJobStateForBrief's index range finds this job.
      priority: NARRATE_PRIORITY,
    });
  },
});

// Repeat runs are safe because a brief with any live narrate job (queued,
// claimed, done, parked) is skipped; only a failed job or none proceeds. Each
// narrateBrief call pays for a fresh script, so this check avoids unnecessary
// generation. Overlapping callers can still generate two scripts, but atomic
// per-brief admission creates only one job. Briefs are isolated: one whose
// narration throws is logged and counted, and the rest still run.
export const reconcile = internalAction({
  args: { daysBack: v.optional(v.number()) },
  returns: v.object({
    enqueued: v.number(),
    skipped: v.number(),
    failed: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ enqueued: number; skipped: number; failed: number }> => {
    const voiceId = await ctx.runQuery(internal.settings.get, {
      key: HOUSE_VOICE_KEY,
    });
    if (!voiceId) return { enqueued: 0, skipped: 0, failed: 0 };
    const since = Date.now() - (args.daysBack ?? 14) * 24 * 60 * 60 * 1000;
    const briefs = await ctx.runQuery(internal.weeklyBriefs.listSinceInternal, {
      since,
    });
    const readyEpisodeBriefIds = new Set<string>();
    const blockedBriefIds = new Set<string>();
    for (const brief of briefs) {
      const briefId = brief._id;
      if (
        await ctx.runQuery(internal.episodes.hasReadyEpisodeForBrief, {
          briefId,
        })
      ) {
        readyEpisodeBriefIds.add(briefId);
      }
      const jobState = await ctx.runQuery(
        internal.mediaJobs.narrateJobStateForBrief,
        { briefId },
      );
      if (jobState !== null) blockedBriefIds.add(briefId);
    }
    const needing = pickBriefsNeedingNarration({
      briefs,
      readyEpisodeBriefIds,
      blockedBriefIds,
    });
    let enqueued = 0;
    let skipped = briefs.length - needing.length;
    let failed = 0;
    for (const brief of needing) {
      try {
        const { created } = await ctx.runAction(
          internal.episodes.narrateBrief,
          { briefId: brief._id },
        );
        if (created) enqueued++;
        else skipped++;
      } catch (error) {
        console.error(
          `reconcile: narration failed for brief ${brief._id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        failed++;
      }
    }
    return { enqueued, skipped, failed };
  },
});

// Every shootout renders the same calibration passage across the whole
// catalog so takes stay comparable; SHOOTOUT_PRIORITY keeps it behind
// episodes.
export const enqueueShootout = internalAction({
  // `rerun: true` renders again after a done shootout (for example once a
  // missing provider key is configured); without it a repeat is a dedupe hit.
  args: { rerun: v.optional(v.boolean()) },
  returns: v.object({ jobId: v.id("mediaJobs"), created: v.boolean() }),
  handler: async (ctx, args): Promise<EnqueueOutcome> => {
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
        ...(args.rerun ? { runId: new Date().toISOString() } : {}),
      },
      priority: SHOOTOUT_PRIORITY,
    });
  },
});
