import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

async function readyArtifact(t: ReturnType<typeof convexTest>, title: string) {
  const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
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
      engine: { name: "tts", version: "1", params: { voice: title } },
    },
  });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([title])));
  await t.mutation(internal.audioArtifacts.attachStorage, {
    artifactId,
    storageId,
  });
  await t.mutation(internal.audioArtifacts.markReady, {
    artifactId,
    durationSecs: 90,
    loudnessLufs: -16,
    truePeakDbtp: -1.2,
    mimeType: "audio/mpeg",
  });
  return artifactId;
}

describe("blindGroups", () => {
  test("projection exposes only opaque ids, labels, duration, and url until reveal", async () => {
    const t = convexTest(schema, modules);
    const a = await readyArtifact(t, "gemini");
    const b = await readyArtifact(t, "breeze");
    const { groupId, memberIds } = await t.mutation(
      internal.blindGroups.create,
      {
        purpose: "voiceShootout",
        members: [
          { artifactId: a, label: "take one" },
          { artifactId: b, label: "take two" },
        ],
      },
    );
    expect(memberIds).toHaveLength(2);
    const blind = await t.query(internal.blindGroups.projectionInternal, {
      groupId,
    });
    expect(blind.revealed).toBe(false);
    expect(blind.labels).toBeUndefined();
    for (const member of blind.members) {
      expect(Object.keys(member).toSorted()).toEqual([
        "durationSecs",
        "label",
        "memberId",
        "playbackUrl",
      ]);
      expect(JSON.stringify(member)).not.toMatch(/gemini|breeze/);
    }
    // Member artifacts are hidden from ordinary playback while blind.
    expect(
      await t.query(internal.audioArtifacts.playbackInternal, {
        artifactId: a,
      }),
    ).toBeNull();

    await t.mutation(internal.blindGroups.reveal, { groupId });
    const revealed = await t.query(internal.blindGroups.projectionInternal, {
      groupId,
    });
    expect(revealed.revealed).toBe(true);
    expect(revealed.labels).toEqual({ [memberIds[0]!]: a, [memberIds[1]!]: b });
  });

  test("create rejects duplicate artifacts and non-ready members; reveal is idempotent", async () => {
    const t = convexTest(schema, modules);
    const a = await readyArtifact(t, "one");
    await expect(
      t.mutation(internal.blindGroups.create, {
        purpose: "voiceShootout",
        members: [
          { artifactId: a, label: "x" },
          { artifactId: a, label: "y" },
        ],
      }),
    ).rejects.toThrow(/distinct/);
    const { groupId } = await t.mutation(internal.blindGroups.create, {
      purpose: "voiceShootout",
      members: [{ artifactId: a, label: "x" }],
    });
    await t.mutation(internal.blindGroups.reveal, { groupId });
    const first = await t.run((ctx) => ctx.db.get(groupId));
    await t.mutation(internal.blindGroups.reveal, { groupId });
    const second = await t.run((ctx) => ctx.db.get(groupId));
    expect(second?.revealedAt).toBe(first?.revealedAt);
  });
});
