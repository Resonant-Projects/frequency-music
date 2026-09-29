import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { AudioArtifactFields } from "./shared/audioArtifacts";
import schema from "./schema";

function artifactFields(
  overrides: Partial<AudioArtifactFields> & { title: string },
): AudioArtifactFields {
  return {
    kind: "shootoutTake",
    role: "delivery",
    metadataStripped: true,
    status: "ready",
    encoding: {
      codec: "mp3",
      bitrateKbps: 128,
      sampleRate: 48000,
      channels: 2,
    },
    normalization: "applied",
    access: "private",
    refs: {},
    contentHash: overrides.title,
    createdBy: "system",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("listen.shootouts", () => {
  test("lists voice shootout groups newest first with reveal state", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("blindGroups", {
        purpose: "voiceShootout",
        members: [],
        requiredRatings: [],
        createdAt: 1,
      });
      await ctx.db.insert("blindGroups", {
        purpose: "studyFamily",
        members: [],
        requiredRatings: [],
        createdAt: 2,
      });
      await ctx.db.insert("blindGroups", {
        purpose: "voiceShootout",
        members: [],
        requiredRatings: [],
        revealedAt: 3,
        createdAt: 3,
      });
    });
    const rows = await t.query(internal.listen.shootoutsInternal, {});
    expect(rows.map((row) => row.revealed)).toEqual([true, false]);
    expect(rows.map((row) => row.createdAt)).toEqual([3, 1]);
    expect(rows.map((row) => row.memberCount)).toEqual([0, 0]);
    // No members means no media job to pair with.
    expect(rows.map((row) => row.episodeArtifactId)).toEqual([null, null]);
  });

  test("pairs a shootout with the ready feed episode from the same media job", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const job = async (dedupeKey: string) =>
        await ctx.db.insert("mediaJobs", {
          kind: "probe",
          input: {
            kind: "probe",
            toneHz: 440,
            seconds: 1,
            rendererVersion: "0.1.0",
          },
          dedupeKey,
          status: "done",
          priority: 0,
          attempts: 1,
          createdAt: 1,
        });
      const jobA = await job("job-a");
      const jobB = await job("job-b");
      const memberA = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({ title: "take a", refs: { mediaJobId: jobA } }),
      );
      const memberB = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({ title: "take b", refs: { mediaJobId: jobB } }),
      );
      const memberNoJob = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({ title: "take c" }),
      );
      // Decoys: the same job's WAV master, a pending episode, and an episode
      // from an unrelated job. None may be paired with group A.
      const masterA = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({
          title: "master a",
          kind: "episode",
          role: "masterNormalized",
          access: "feed",
          refs: { mediaJobId: jobA },
        }),
      );
      const pendingA = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({
          title: "pending a",
          kind: "episode",
          status: "pending",
          access: "feed",
          refs: { mediaJobId: jobA },
        }),
      );
      const episodeB = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({
          title: "episode b",
          kind: "episode",
          access: "feed",
          refs: { mediaJobId: jobB },
        }),
      );
      const episodeA = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({
          title: "episode a",
          kind: "episode",
          access: "feed",
          refs: { mediaJobId: jobA },
        }),
      );
      // As mediaJobs.complete leaves a job: its result names every artifact
      // it minted, including the decoys.
      await ctx.db.patch(jobA, {
        resultArtifactIds: [memberA, masterA, pendingA, episodeA],
      });
      await ctx.db.patch(jobB, { resultArtifactIds: [memberB, episodeB] });
      const group = async (artifactId: Id<"audioArtifacts">) =>
        await ctx.db.insert("blindGroups", {
          purpose: "voiceShootout",
          members: [{ memberId: `m-${artifactId}`, artifactId, label: "one" }],
          requiredRatings: [`m-${artifactId}`],
          createdAt: 1,
        });
      const groupA = await group(memberA);
      const groupB = await group(memberB);
      const groupNoJob = await group(memberNoJob);
      return { episodeA, episodeB, groupA, groupB, groupNoJob };
    });
    const rows = await t.query(internal.listen.shootoutsInternal, {});
    const byGroup = new Map(rows.map((row) => [row.groupId, row]));
    expect(byGroup.get(ids.groupA)?.episodeArtifactId).toBe(ids.episodeA);
    expect(byGroup.get(ids.groupB)?.episodeArtifactId).toBe(ids.episodeB);
    expect(byGroup.get(ids.groupNoJob)?.episodeArtifactId).toBeNull();
    expect(byGroup.get(ids.groupA)?.memberCount).toBe(1);
  });

  test("a shootout is still listed behind 55 newer studyFamily groups", async () => {
    const t = convexTest(schema, modules);
    const shootoutId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("blindGroups", {
        purpose: "voiceShootout",
        members: [],
        requiredRatings: [],
        createdAt: 1,
      });
      for (let i = 0; i < 55; i++) {
        await ctx.db.insert("blindGroups", {
          purpose: "studyFamily",
          members: [],
          requiredRatings: [],
          createdAt: 2 + i,
        });
      }
      return id;
    });
    const rows = await t.query(internal.listen.shootoutsInternal, {});
    expect(rows.map((row) => row.groupId)).toEqual([shootoutId]);
  });

  test("the episode is still paired behind 60 newer unrelated ready feed episodes", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const jobId = await ctx.db.insert("mediaJobs", {
        kind: "shootout",
        input: {
          kind: "shootout",
          passage: ["p"],
          voiceIds: ["breeze-2"],
          title: "Voice shootout",
          rendererVersion: "0.2.0",
        },
        dedupeKey: "job-shootout",
        status: "done",
        priority: 1,
        attempts: 1,
        createdAt: 1,
      });
      const member = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({ title: "take", refs: { mediaJobId: jobId } }),
      );
      const episode = await ctx.db.insert(
        "audioArtifacts",
        artifactFields({
          title: "episode",
          kind: "episode",
          access: "feed",
          refs: { mediaJobId: jobId },
        }),
      );
      await ctx.db.patch(jobId, { resultArtifactIds: [member, episode] });
      for (let i = 0; i < 60; i++) {
        await ctx.db.insert(
          "audioArtifacts",
          artifactFields({
            title: `unrelated ${i}`,
            kind: "episode",
            access: "feed",
            createdAt: 10 + i,
          }),
        );
      }
      const groupId = await ctx.db.insert("blindGroups", {
        purpose: "voiceShootout",
        members: [{ memberId: "m", artifactId: member, label: "one" }],
        requiredRatings: ["m"],
        createdAt: 1,
      });
      return { episode, groupId };
    });
    const rows = await t.query(internal.listen.shootoutsInternal, {});
    expect(rows.map((row) => row.groupId)).toEqual([ids.groupId]);
    expect(rows[0]?.episodeArtifactId).toBe(ids.episode);
  });
});
