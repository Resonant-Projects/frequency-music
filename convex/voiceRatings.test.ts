import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

async function group(
  t: ReturnType<typeof convexTest>,
  purpose: "voiceShootout" | "studyFamily" = "voiceShootout",
) {
  const make = async (title: string) => {
    const id = await t.mutation(internal.audioArtifacts.createPending, {
      fields: {
        kind: "shootoutTake",
        role: "delivery",
        metadataStripped: true,
        status: "pending",
        encoding: {
          codec: "mp3",
          bitrateKbps: 128,
          sampleRate: 48000,
          channels: 2,
        },
        normalization: "applied",
        access: "private",
        title,
        refs: {},
        contentHash: title,
        createdBy: "system",
        voice: { catalogId: title, promptVersion: "shootout.v1" },
      },
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([title])),
    );
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId: id,
      storageId,
    });
    await t.mutation(internal.audioArtifacts.markReady, {
      artifactId: id,
      durationSecs: 90,
      loudnessLufs: -16,
      truePeakDbtp: -1.2,
      mimeType: "audio/mpeg",
    });
    return id;
  };
  const a = await make("inworld-max");
  const b = await make("breeze-2");
  return await t.mutation(internal.blindGroups.create, {
    purpose,
    members: [
      { artifactId: a, label: "take one" },
      { artifactId: b, label: "take two" },
    ],
  });
}
const ratings = {
  naturalness: 4,
  prosody: 3,
  clean: 5,
  clarity: 4,
  overall: 4,
};

describe("voiceRatings", () => {
  test("reveals in the same mutation as the last required rating; repeats are idempotent", async () => {
    const t = convexTest(schema, modules);
    const { groupId, memberIds } = await group(t);
    const first = await t.mutation(internal.voiceRatings.submitInternal, {
      groupId,
      memberId: memberIds[0]!,
      ratings,
      createdBy: "user_1",
    });
    expect(first).toEqual({ revealed: false, remaining: 1 });
    const again = await t.mutation(internal.voiceRatings.submitInternal, {
      groupId,
      memberId: memberIds[0]!,
      ratings: { ...ratings, overall: 1 },
      createdBy: "user_1",
    });
    expect(again).toEqual({ revealed: false, remaining: 1 });
    const rows = await t.run((ctx) => ctx.db.query("voiceRatings").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ratings.overall).toBe(4);
    const last = await t.mutation(internal.voiceRatings.submitInternal, {
      groupId,
      memberId: memberIds[1]!,
      ratings,
      createdBy: "user_1",
    });
    expect(last).toEqual({ revealed: true, remaining: 0 });
    const projection = await t.query(internal.blindGroups.projectionInternal, {
      groupId,
    });
    expect(projection.revealed).toBe(true);
    const forGroup = await t.query(internal.voiceRatings.forGroupInternal, {
      groupId,
    });
    // Row order follows the random memberId index, so compare as a set.
    expect(forGroup).toHaveLength(2);
    expect(forGroup.map((row) => row.voiceId)).toEqual(
      expect.arrayContaining(["breeze-2", "inworld-max"]),
    );
  });

  test("rejects out-of-range values and unknown members, and hides voiceId before reveal", async () => {
    const t = convexTest(schema, modules);
    const { groupId, memberIds } = await group(t);
    await expect(
      t.mutation(internal.voiceRatings.submitInternal, {
        groupId,
        memberId: memberIds[0]!,
        ratings: { ...ratings, clean: 6 },
        createdBy: "user_1",
      }),
    ).rejects.toThrow(/between 0 and 5/);
    await expect(
      t.mutation(internal.voiceRatings.submitInternal, {
        groupId,
        memberId: "nope",
        ratings,
        createdBy: "user_1",
      }),
    ).rejects.toThrow(/member/);
    await t.mutation(internal.voiceRatings.submitInternal, {
      groupId,
      memberId: memberIds[0]!,
      ratings,
      createdBy: "user_1",
    });
    const rows = await t.query(internal.voiceRatings.forGroupInternal, {
      groupId,
    });
    expect(rows[0]?.voiceId).toBeUndefined();
  });

  test("refuses ratings on a group that is not a voice shootout", async () => {
    const t = convexTest(schema, modules);
    const { groupId, memberIds } = await group(t, "studyFamily");
    await expect(
      t.mutation(internal.voiceRatings.submitInternal, {
        groupId,
        memberId: memberIds[0]!,
        ratings,
        createdBy: "user_1",
      }),
    ).rejects.toThrow(/only to voice shootout groups/);
    const stored = await t.run((ctx) => ctx.db.get(groupId));
    expect(stored?.revealedAt).toBeUndefined();
  });
});
