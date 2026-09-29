import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

type Kind = "narration" | "shootoutTake" | "episode";
type Role = "masterNormalized" | "delivery";

// A pending artifact with a blob attached, as the worker leaves it before
// completing the job. A delivery carries its master's id.
async function attached(
  t: ReturnType<typeof convexTest>,
  jobId: Id<"mediaJobs">,
  kind: Kind,
  title: string,
  role: Role = "delivery",
  masterArtifactId?: Id<"audioArtifacts">,
) {
  const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
    fields: {
      kind,
      role,
      masterArtifactId,
      metadataStripped: true,
      status: "pending",
      encoding:
        role === "masterNormalized"
          ? { codec: "wav", sampleRate: 48000, channels: 1 }
          : { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
      normalization: "applied",
      access: "private",
      title,
      refs: { mediaJobId: jobId },
      contentHash: title,
      createdBy: "system",
    },
  });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([title])));
  await t.mutation(internal.audioArtifacts.attachStorage, {
    artifactId,
    storageId,
  });
  return artifactId;
}

// The master and delivery pair a narrate or assembleEpisode job renders.
async function attachedPair(
  t: ReturnType<typeof convexTest>,
  jobId: Id<"mediaJobs">,
  kind: Kind,
  title: string,
) {
  const master = await attached(
    t,
    jobId,
    kind,
    `${title}-master`,
    "masterNormalized",
  );
  const delivery = await attached(t, jobId, kind, title, "delivery", master);
  return { master, delivery };
}

const measured = (artifactId: Id<"audioArtifacts">) => ({
  artifactId,
  durationSecs: 10,
  loudnessLufs: -16,
  truePeakDbtp: -1.3,
  mimeType: "audio/mpeg",
});

// The brief a narration belongs to; R29 threads its id through to the
// episode the narrate effect enqueues.
async function insertBrief(t: ReturnType<typeof convexTest>) {
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
      createdAt: 1,
    }),
  );
}

const narrateInput = {
  kind: "narrate" as const,
  script: {
    paragraphs: ["a", "b"],
    chapters: [{ title: "Open", startParagraph: 0 }],
  },
  voiceId: "inworld-max",
  promptVersion: "narration.v1",
  target: "spoken" as const,
  title: "Brief",
  access: "feed" as const,
  refs: {},
  assembleOnDone: true,
  episodeTitle: "Weekly turn, week of 2026-09-21",
  rendererVersion: "0.2.0",
};

const shootoutInput = {
  kind: "shootout" as const,
  passage: ["p"],
  voiceIds: ["inworld-max", "breeze-2", "gemini-flash-tts"],
  title: "Shootout",
  rendererVersion: "0.2.0",
};

async function claimed(
  t: ReturnType<typeof convexTest>,
  input: typeof narrateInput | typeof shootoutInput,
) {
  const { jobId } = await t.mutation(internal.mediaJobs.enqueue, { input });
  const claim = await t.mutation(internal.mediaJobs.claimNext, {
    workerId: "w",
    kinds: [input.kind],
  });
  if (!claim) throw new Error("expected a claim");
  return { jobId, leaseToken: claim.leaseToken };
}

// Nothing may be marked ready, grouped, or published after a refused
// shootout result.
async function expectUntouched(
  t: ReturnType<typeof convexTest>,
  jobId: Id<"mediaJobs">,
) {
  const rows = await t.run((ctx) => ctx.db.query("audioArtifacts").collect());
  for (const row of rows) {
    expect(row.status).toBe("pending");
    expect(row.blindGroupId).toBeUndefined();
    expect(row.access).toBe("private");
  }
  const groups = await t.run((ctx) => ctx.db.query("blindGroups").collect());
  expect(groups).toHaveLength(0);
  const job = await t.run((ctx) => ctx.db.get(jobId));
  expect(job?.status).toBe("claimed");
}

describe("media job effects", () => {
  test("narrate with assembleOnDone stores chapters and enqueues assembleEpisode atomically", async () => {
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t);
    const { jobId, leaseToken } = await claimed(t, {
      ...narrateInput,
      refs: { weeklyBriefId: briefId },
    });
    const { master, delivery } = await attachedPair(
      t,
      jobId,
      "narration",
      "Brief",
    );
    const done = await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken,
      result: {
        kind: "narrate",
        artifacts: [measured(master), measured(delivery)],
        chapters: [{ title: "Open", startSecs: 0 }],
      },
    });
    expect(done.resultArtifactIds).toEqual([master, delivery]);
    const masterRow = await t.run((ctx) => ctx.db.get(master));
    expect(masterRow?.status).toBe("ready");
    expect(masterRow?.chapters).toBeUndefined();
    const row = await t.run((ctx) => ctx.db.get(delivery));
    expect(row?.status).toBe("ready");
    expect(row?.chapters).toEqual([{ title: "Open", startSecs: 0 }]);
    const queued = await t.run((ctx) =>
      ctx.db
        .query("mediaJobs")
        .withIndex("by_status_priority_createdAt", (q) =>
          q.eq("status", "queued"),
        )
        .collect(),
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]?.kind).toBe("assembleEpisode");
    // The assembler downloads the lossless master, not the MP3 delivery.
    const masterUrl = await t.run((ctx) =>
      ctx.storage.getUrl(masterRow!.storageId!),
    );
    const deliveryUrl = await t.run((ctx) =>
      ctx.storage.getUrl(row!.storageId!),
    );
    expect(masterUrl).toMatch(/^https?:\/\//);
    expect(masterUrl).not.toBe(deliveryUrl);
    expect(queued[0]?.input).toMatchObject({
      kind: "assembleEpisode",
      narrationArtifactId: delivery,
      title: "Weekly turn, week of 2026-09-21",
      chapters: [{ title: "Open", startSecs: 0 }],
      rendererVersion: "0.2.0",
      narrationStorageUrl: masterUrl,
      // R29: the episode job carries the narration's brief.
      refs: { weeklyBriefId: briefId },
    });
  });

  test("narrate without assembleOnDone enqueues nothing", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, {
      ...narrateInput,
      assembleOnDone: false,
    });
    const { master, delivery } = await attachedPair(
      t,
      jobId,
      "narration",
      "Brief",
    );
    await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken,
      result: {
        kind: "narrate",
        artifacts: [measured(master), measured(delivery)],
        chapters: [],
      },
    });
    const rows = await t.run((ctx) => ctx.db.query("mediaJobs").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("done");
  });

  test("narrate refuses a result without its master and delivery pair", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, narrateInput);
    const lone = await attached(t, jobId, "narration", "Brief");
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: { kind: "narrate", artifacts: [measured(lone)], chapters: [] },
      }),
    ).rejects.toThrow(/one masterNormalized and one delivery/);
    const row = await t.run((ctx) => ctx.db.get(lone));
    expect(row?.status).toBe("pending");
    const jobs = await t.run((ctx) => ctx.db.query("mediaJobs").collect());
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("claimed");
  });

  test("narrate refuses an artifact owned by another job before marking anything ready", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, narrateInput);
    const other = await t.mutation(internal.mediaJobs.enqueue, {
      input: { ...narrateInput, title: "Other" },
    });
    const master = await attached(
      t,
      jobId,
      "narration",
      "Brief-master",
      "masterNormalized",
    );
    const foreign = await attached(
      t,
      other.jobId,
      "narration",
      "Other",
      "delivery",
      master,
    );
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "narrate",
          artifacts: [measured(master), measured(foreign)],
          chapters: [],
        },
      }),
    ).rejects.toThrow(/does not belong/);
    for (const id of [master, foreign]) {
      expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("pending");
    }
  });

  test("shootout creates a blind group over the takes in member order and publishes the episode to the feed", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, shootoutInput);
    const { master: aMaster, delivery: a } = await attachedPair(
      t,
      jobId,
      "shootoutTake",
      "inworld",
    );
    const { master: bMaster, delivery: b } = await attachedPair(
      t,
      jobId,
      "shootoutTake",
      "breeze",
    );
    const { master: episodeMaster, delivery: episode } = await attachedPair(
      t,
      jobId,
      "episode",
      "Shootout",
    );
    const done = await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken,
      result: {
        kind: "shootout",
        takes: [
          {
            voiceId: "inworld-max",
            artifact: measured(a),
            master: measured(aMaster),
          },
          {
            voiceId: "breeze-2",
            artifact: measured(b),
            master: measured(bMaster),
          },
        ],
        skippedVoiceIds: ["gemini-flash-tts"],
        episode: measured(episode),
        episodeMaster: measured(episodeMaster),
        memberOrder: ["breeze-2", "inworld-max"],
      },
    });
    expect(done.resultArtifactIds).toEqual([a, b, episode]);
    for (const id of [a, b, aMaster, bMaster, episode, episodeMaster]) {
      expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("ready");
    }
    const groups = await t.run((ctx) => ctx.db.query("blindGroups").collect());
    expect(groups).toHaveLength(1);
    expect(groups[0]?.purpose).toBe("voiceShootout");
    const byLabel = new Map(
      groups[0]?.members.map((m) => [m.label, m.artifactId]),
    );
    expect(new Set(byLabel.keys())).toEqual(new Set(["take one", "take two"]));
    expect(byLabel.get("take one")).toBe(b);
    expect(byLabel.get("take two")).toBe(a);
    expect(groups[0]?.requiredRatings).toHaveLength(2);
    for (const id of [a, b]) {
      const take = await t.run((ctx) => ctx.db.get(id));
      expect(take?.blindGroupId).toBe(groups[0]?._id);
      expect(take?.access).toBe("private");
    }
    const ep = await t.run((ctx) => ctx.db.get(episode));
    expect(ep?.access).toBe("feed");
    expect(ep?.blindGroupId).toBeUndefined();
    expect(ep?.refs.mediaJobId).toBe(jobId);
    const master = await t.run((ctx) => ctx.db.get(episodeMaster));
    expect(master?.access).toBe("private");
    const take = await t.run((ctx) => ctx.db.get(a));
    expect(take?.voice).toEqual({
      catalogId: "inworld-max",
      promptVersion: "shootout.v1",
    });
    const feed = await t.query(internal.podcast.listFeedEpisodes, {});
    expect(feed.map((e) => e.id)).toEqual([episode]);
  });

  test("shootout refuses a memberOrder that names an unrendered voice", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, shootoutInput);
    const { master: aMaster, delivery: a } = await attachedPair(
      t,
      jobId,
      "shootoutTake",
      "inworld",
    );
    const { master: episodeMaster, delivery: episode } = await attachedPair(
      t,
      jobId,
      "episode",
      "Shootout",
    );
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "shootout",
          takes: [
            {
              voiceId: "inworld-max",
              artifact: measured(a),
              master: measured(aMaster),
            },
          ],
          skippedVoiceIds: ["breeze-2", "gemini-flash-tts"],
          episode: measured(episode),
          episodeMaster: measured(episodeMaster),
          memberOrder: ["inworld-max", "gemini-flash-tts"],
        },
      }),
    ).rejects.toThrow(/unrendered voice gemini-flash-tts/);
    const groups = await t.run((ctx) => ctx.db.query("blindGroups").collect());
    expect(groups).toHaveLength(0);
    for (const id of [a, aMaster, episode, episodeMaster]) {
      expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("pending");
    }
  });

  test("shootout refuses a memberOrder that omits a rendered take and rolls everything back", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, shootoutInput);
    const takes = [];
    for (const voiceId of ["inworld-max", "breeze-2", "gemini-flash-tts"]) {
      const pair = await attachedPair(t, jobId, "shootoutTake", voiceId);
      takes.push({
        voiceId,
        artifact: measured(pair.delivery),
        master: measured(pair.master),
      });
    }
    const { master: episodeMaster, delivery: episode } = await attachedPair(
      t,
      jobId,
      "episode",
      "Shootout",
    );
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "shootout",
          takes,
          skippedVoiceIds: [],
          episode: measured(episode),
          episodeMaster: measured(episodeMaster),
          memberOrder: ["breeze-2", "inworld-max"],
        },
      }),
    ).rejects.toThrow(/memberOrder must name every take/);
    // A duplicate entry cannot stand in for the missing take either.
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "shootout",
          takes,
          skippedVoiceIds: [],
          episode: measured(episode),
          episodeMaster: measured(episodeMaster),
          memberOrder: ["breeze-2", "inworld-max", "breeze-2"],
        },
      }),
    ).rejects.toThrow(/memberOrder repeats voice breeze-2/);
    const rows = await t.run((ctx) => ctx.db.query("audioArtifacts").collect());
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.status).toBe("pending");
      expect(row.voice).toBeUndefined();
      expect(row.blindGroupId).toBeUndefined();
      expect(row.access).toBe("private");
    }
    const groups = await t.run((ctx) => ctx.db.query("blindGroups").collect());
    expect(groups).toHaveLength(0);
    const job = await t.run((ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("claimed");
  });

  test("shootout refuses two takes for the same voice", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, shootoutInput);
    const { master: aMaster, delivery: a } = await attachedPair(
      t,
      jobId,
      "shootoutTake",
      "inworld",
    );
    const { master: bMaster, delivery: b } = await attachedPair(
      t,
      jobId,
      "shootoutTake",
      "inworld-again",
    );
    const { master: episodeMaster, delivery: episode } = await attachedPair(
      t,
      jobId,
      "episode",
      "Shootout",
    );
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "shootout",
          takes: [
            {
              voiceId: "inworld-max",
              artifact: measured(a),
              master: measured(aMaster),
            },
            {
              voiceId: "inworld-max",
              artifact: measured(b),
              master: measured(bMaster),
            },
          ],
          skippedVoiceIds: [],
          episode: measured(episode),
          episodeMaster: measured(episodeMaster),
          memberOrder: ["inworld-max"],
        },
      }),
    ).rejects.toThrow(/rendered voice inworld-max twice/);
    const groups = await t.run((ctx) => ctx.db.query("blindGroups").collect());
    expect(groups).toHaveLength(0);
  });

  test("shootout refuses a take whose master and artifact are swapped", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, shootoutInput);
    const { master: aMaster, delivery: a } = await attachedPair(
      t,
      jobId,
      "shootoutTake",
      "inworld",
    );
    const { master: episodeMaster, delivery: episode } = await attachedPair(
      t,
      jobId,
      "episode",
      "Shootout",
    );
    // The rows form a valid pair, but the WAV master is named as the blind
    // member and the MP3 delivery as its master.
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "shootout",
          takes: [
            {
              voiceId: "inworld-max",
              artifact: measured(aMaster),
              master: measured(a),
            },
          ],
          skippedVoiceIds: ["breeze-2", "gemini-flash-tts"],
          episode: measured(episode),
          episodeMaster: measured(episodeMaster),
          memberOrder: ["inworld-max"],
        },
      }),
    ).rejects.toThrow(/INVALID_ARGUMENT.*names master .* as a delivery/);
    await expectUntouched(t, jobId);
  });

  test("shootout refuses an episode that names the master", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await claimed(t, shootoutInput);
    const { master: aMaster, delivery: a } = await attachedPair(
      t,
      jobId,
      "shootoutTake",
      "inworld",
    );
    const { master: episodeMaster, delivery: episode } = await attachedPair(
      t,
      jobId,
      "episode",
      "Shootout",
    );
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "shootout",
          takes: [
            {
              voiceId: "inworld-max",
              artifact: measured(a),
              master: measured(aMaster),
            },
          ],
          skippedVoiceIds: ["breeze-2", "gemini-flash-tts"],
          episode: measured(episodeMaster),
          episodeMaster: measured(episode),
          memberOrder: ["inworld-max"],
        },
      }),
    ).rejects.toThrow(/INVALID_ARGUMENT.*names master .* as a delivery/);
    await expectUntouched(t, jobId);
    // A lone master with no delivery at all is refused the same way.
    const stray = await attached(
      t,
      jobId,
      "episode",
      "Stray-master",
      "masterNormalized",
    );
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "shootout",
          takes: [
            {
              voiceId: "inworld-max",
              artifact: measured(a),
              master: measured(aMaster),
            },
          ],
          skippedVoiceIds: ["breeze-2", "gemini-flash-tts"],
          episode: measured(stray),
          episodeMaster: measured(episodeMaster),
          memberOrder: ["inworld-max"],
        },
      }),
    ).rejects.toThrow(/one masterNormalized and one delivery/);
    await expectUntouched(t, jobId);
  });

  test("assembleEpisode marks the episode ready on the feed with the job's title and chapters", async () => {
    const t = convexTest(schema, modules);
    // The narration this job assembles, as the narrate effect left it.
    const narrate = await claimed(t, {
      ...narrateInput,
      assembleOnDone: false,
    });
    const narration = await attachedPair(
      t,
      narrate.jobId,
      "narration",
      "Brief",
    );
    const narrationStorageUrl = await t.run(async (ctx) => {
      const row = await ctx.db.get(narration.delivery);
      return await ctx.storage.getUrl(row!.storageId!);
    });
    // The input carries the narration's chapters; the assembler shifts them
    // by its lead-in and reports the shifted marks in the result.
    const input = {
      kind: "assembleEpisode" as const,
      narrationArtifactId: narration.delivery,
      narrationStorageUrl: narrationStorageUrl!,
      title: "Weekly turn, week of 2026-09-21",
      chapters: [{ title: "Open", startSecs: 0 }],
      rendererVersion: "0.2.0",
    };
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, { input });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w",
      kinds: ["assembleEpisode"],
    });
    const { master, delivery } = await attachedPair(
      t,
      jobId,
      "episode",
      "draft title",
    );
    await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result: {
        kind: "assembleEpisode",
        artifacts: [measured(master), measured(delivery)],
        chapters: [{ title: "Open", startSecs: 1 }],
      },
    });
    const deliveryRow = await t.run((ctx) => ctx.db.get(delivery));
    expect(deliveryRow?.status).toBe("ready");
    expect(deliveryRow?.access).toBe("feed");
    expect(deliveryRow?.title).toBe("Weekly turn, week of 2026-09-21");
    // The shifted result chapters land, not the input's narration chapters.
    expect(deliveryRow?.chapters).toEqual([{ title: "Open", startSecs: 1 }]);
    // The WAV master is provenance: ready, but never published or retitled.
    const masterRow = await t.run((ctx) => ctx.db.get(master));
    expect(masterRow?.status).toBe("ready");
    expect(masterRow?.access).toBe("private");
    expect(masterRow?.title).toBe("draft title-master");
    expect(masterRow?.chapters).toBeUndefined();
    const feed = await t.query(internal.podcast.listFeedEpisodes, {});
    expect(feed.map((e) => e.id)).toEqual([delivery]);
  });

  test("assembleEpisode refuses a master-only result and rolls back", async () => {
    const t = convexTest(schema, modules);
    const narrate = await claimed(t, {
      ...narrateInput,
      assembleOnDone: false,
    });
    const narration = await attached(t, narrate.jobId, "narration", "Brief");
    const input = {
      kind: "assembleEpisode" as const,
      narrationArtifactId: narration,
      narrationStorageUrl: "https://convex.test/api/storage/x",
      title: "Weekly turn, week of 2026-09-21",
      chapters: [],
      rendererVersion: "0.2.0",
    };
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, { input });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w",
      kinds: ["assembleEpisode"],
    });
    const master = await attached(
      t,
      jobId,
      "episode",
      "ep-master",
      "masterNormalized",
    );
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken: claim!.leaseToken,
        result: {
          kind: "assembleEpisode",
          artifacts: [measured(master)],
          chapters: [],
        },
      }),
    ).rejects.toThrow(/one masterNormalized and one delivery/);
    const row = await t.run((ctx) => ctx.db.get(master));
    expect(row?.status).toBe("pending");
    expect(row?.access).toBe("private");
    const job = await t.run((ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("claimed");
    const feed = await t.query(internal.podcast.listFeedEpisodes, {});
    expect(feed).toEqual([]);
  });
});
