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
    // Stored order is random (ruling 12), so compare against the row's own
    // memberId -> artifactId mapping rather than input order.
    const row = await t.run((ctx) => ctx.db.get(groupId));
    expect(revealed.labels).toEqual(
      Object.fromEntries(
        row?.members.map((member) => [member.memberId, member.artifactId]) ??
          [],
      ),
    );
    expect(Object.keys(revealed.labels ?? {}).toSorted()).toEqual(
      memberIds.toSorted(),
    );
    expect(Object.values(revealed.labels ?? {}).toSorted()).toEqual(
      [a, b].toSorted(),
    );
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

  test("stored member order is random, so the X member is not always last", async () => {
    const t = convexTest(schema, modules);
    let xLastCount = 0;
    const rounds = 40;
    for (let i = 0; i < rounds; i++) {
      const a = await readyArtifact(t, `a-${String(i)}`);
      const b = await readyArtifact(t, `b-${String(i)}`);
      const x = await readyArtifact(t, `x-${String(i)}`);
      const { groupId, memberIds } = await t.mutation(
        internal.blindGroups.create,
        {
          purpose: "voiceShootout",
          members: [
            { artifactId: a, label: "take one" },
            { artifactId: b, label: "take two" },
          ],
          xMember: { artifactId: x, duplicatesLabel: "take one" },
        },
      );
      const row = await t.run((ctx) => ctx.db.get(groupId));
      const stored = row?.members.map((member) => member.memberId) ?? [];
      // Returned ids and requiredRatings follow the stored order.
      expect(memberIds).toEqual(stored);
      expect(row?.requiredRatings).toEqual(
        stored.filter((memberId) => memberId !== row?.xMember?.memberId),
      );
      if (stored[stored.length - 1] === row?.xMember?.memberId) xLastCount++;
    }
    expect(xLastCount).toBeLessThan(rounds);
  });
});
