import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { episodeTitleForWeek, pickBriefsNeedingNarration } from "./episodes";
import schema from "./schema";

async function insertBrief(t: ReturnType<typeof convexTest>, createdAt = 1) {
  return await t.run((ctx) =>
    ctx.db.insert("weeklyBriefs", {
      weekOf: "2026-09-21",
      model: "m",
      promptVersion: "v",
      bodyMd: "x",
      sourceIds: [],
      recommendedHypothesisIds: [],
      recommendedRecipeIds: [],
      visibility: "private",
      createdBy: "system",
      createdAt,
    }),
  );
}

async function insertEpisode(
  t: ReturnType<typeof convexTest>,
  briefId: Id<"weeklyBriefs">,
  role: "delivery" | "masterNormalized",
) {
  await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["e"]));
    await ctx.db.insert("audioArtifacts", {
      kind: "episode",
      role,
      metadataStripped: true,
      status: "ready",
      storageId,
      encoding:
        role === "delivery"
          ? { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 }
          : { codec: "wav", sampleRate: 48000, channels: 2 },
      normalization: "applied",
      access: role === "delivery" ? "feed" : "private",
      title: "t",
      refs: { weeklyBriefId: briefId },
      contentHash: "c",
      createdBy: "system",
      createdAt: 2,
      updatedAt: 2,
    });
  });
}

type JobStatus = "queued" | "claimed" | "done" | "failed" | "parked";

async function insertNarrateJob(
  t: ReturnType<typeof convexTest>,
  briefId: Id<"weeklyBriefs">,
  status: JobStatus,
) {
  return await t.run((ctx) =>
    ctx.db.insert("mediaJobs", {
      kind: "narrate",
      input: {
        kind: "narrate",
        script: { paragraphs: ["p"], chapters: [] },
        voiceId: "breeze-2",
        promptVersion: "narration.v1",
        target: "spoken",
        title: "t",
        access: "feed",
        refs: { weeklyBriefId: briefId },
        assembleOnDone: true,
        rendererVersion: "0.2.0",
      },
      dedupeKey: `k-${status}-${briefId}`,
      status,
      priority: 0,
      attempts: status === "parked" ? 3 : 0,
      createdAt: 1,
    }),
  );
}

describe("episodes", () => {
  test("episode title uses the Monday date", () => {
    expect(episodeTitleForWeek("2026-09-21")).toBe(
      "Weekly turn, week of 2026-09-21",
    );
  });

  test("pickBriefsNeedingNarration skips briefs with ready episodes or parked jobs", () => {
    const picked = pickBriefsNeedingNarration({
      briefs: [{ _id: "b1" }, { _id: "b2" }, { _id: "b3" }] as never,
      readyEpisodeBriefIds: new Set(["b1"]),
      blockedBriefIds: new Set(["b3"]),
    });
    expect(picked.map((brief) => brief._id)).toEqual(["b2"]);
  });

  test("hasReadyEpisodeForBrief reads feed episodes by brief ref", async () => {
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t);
    expect(
      await t.query(internal.episodes.hasReadyEpisodeForBrief, { briefId }),
    ).toBe(false);
    await insertEpisode(t, briefId, "delivery");
    expect(
      await t.query(internal.episodes.hasReadyEpisodeForBrief, { briefId }),
    ).toBe(true);
  });

  test("hasReadyEpisodeForBrief ignores a WAV master without a delivery", async () => {
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t);
    await insertEpisode(t, briefId, "masterNormalized");
    expect(
      await t.query(internal.episodes.hasReadyEpisodeForBrief, { briefId }),
    ).toBe(false);
  });

  test("narrateJobStateForBrief reports any non-failed narrate job for that brief", async () => {
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t);
    const otherBriefId = await insertBrief(t);
    const state = () =>
      t.query(internal.mediaJobs.narrateJobStateForBrief, { briefId });
    expect(await state()).toBeNull();
    // A failed job is the one status that lets reconciliation proceed.
    await insertNarrateJob(t, briefId, "failed");
    expect(await state()).toBeNull();
    // A job for a different brief never blocks this one.
    await insertNarrateJob(t, otherBriefId, "queued");
    expect(await state()).toBeNull();
    for (const status of ["queued", "claimed", "done", "parked"] as const) {
      const fresh = convexTest(schema, modules);
      const id = await insertBrief(fresh);
      await insertNarrateJob(fresh, id, status);
      expect(
        await fresh.query(internal.mediaJobs.narrateJobStateForBrief, {
          briefId: id,
        }),
      ).toBe(status);
    }
  });

  test("listSinceInternal returns briefs created at or after the cutoff", async () => {
    const t = convexTest(schema, modules);
    await insertBrief(t, 100);
    const recentId = await insertBrief(t, 200);
    const rows = await t.query(internal.weeklyBriefs.listSinceInternal, {
      since: 150,
    });
    expect(rows.map((row) => row._id)).toEqual([recentId]);
  });

  test("narrateBrief throws HOUSE_VOICE_UNSET before touching the brief", async () => {
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t);
    await expect(
      t.action(internal.episodes.narrateBrief, { briefId }),
    ).rejects.toThrow("HOUSE_VOICE_UNSET");
  });

  test("reconcile is a no-op while the house voice is unset", async () => {
    const t = convexTest(schema, modules);
    await insertBrief(t, Date.now());
    expect(
      await t.action(internal.episodes.reconcile, { daysBack: 14 }),
    ).toEqual({ enqueued: 0, skipped: 0 });
    expect(await t.run((ctx) => ctx.db.query("mediaJobs").collect())).toEqual(
      [],
    );
  });

  test("reconcile skips a brief whose narrate job is still live (R19)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.settings.set, {
      key: "houseVoiceId",
      value: "breeze-2",
    });
    const briefId = await insertBrief(t, Date.now());
    await insertNarrateJob(t, briefId, "queued");
    const before = await t.run((ctx) => ctx.db.query("mediaJobs").collect());
    expect(
      await t.action(internal.episodes.reconcile, { daysBack: 14 }),
    ).toEqual({ enqueued: 0, skipped: 1 });
    const after = await t.run((ctx) => ctx.db.query("mediaJobs").collect());
    expect(after).toEqual(before);
  });

  test("a brief whose only narrate job failed is selected for narration", async () => {
    // reconcile would call narrateBrief here, which runs the Node LLM action;
    // that is not exercisable under convex-test, so assert the gate instead.
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t, Date.now());
    await insertNarrateJob(t, briefId, "failed");
    const state = await t.query(internal.mediaJobs.narrateJobStateForBrief, {
      briefId,
    });
    expect(state).toBeNull();
    const briefs = await t.query(internal.weeklyBriefs.listSinceInternal, {
      since: 0,
    });
    const picked = pickBriefsNeedingNarration({
      briefs,
      readyEpisodeBriefIds: new Set(),
      blockedBriefIds: new Set(state === null ? [] : [briefId]),
    });
    expect(picked.map((brief) => brief._id)).toEqual([briefId]);
  });

  test("enqueueShootout queues the calibration passage across every voice at low priority", async () => {
    const t = convexTest(schema, modules);
    const first = await t.action(internal.episodes.enqueueShootout, {});
    expect(first.created).toBe(true);
    const again = await t.action(internal.episodes.enqueueShootout, {});
    expect(again).toEqual({ jobId: first.jobId, created: false });
    const job = await t.run((ctx) => ctx.db.get(first.jobId));
    expect(job?.priority).toBe(-1);
    expect(job?.input.kind).toBe("shootout");
    if (job?.input.kind !== "shootout") throw new Error("unreachable");
    expect(job.input.voiceIds).toEqual([
      "gemini-flash-tts",
      "inworld-max",
      "elevenlabs-v3",
      "breeze-2",
    ]);
    expect(job.input.passage).toHaveLength(3);
    expect(job.input.rendererVersion).toBe("0.2.0");
  });
});
